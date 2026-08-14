"use strict";

// Byte-parity: the static build/ output must be byte-identical to what the live
// server.js serves for every route and feed — the core guarantee of the
// Cloudflare migration. We render build/ fresh, boot the real server, normalize
// ONLY the per-deploy ?v= cache-buster on both sides, and assert equality.
//
// dist content hashes are deliberately NOT masked: both the server and the
// build share one asset map, so an exact match proves they agree on the hashed
// bundle names too (a mismatch there would be a real divergence, not noise).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const { start, stop, request, matchGolden } = require("./helper");
const { VALID_ARTICLE_SLUGS, SECURITY_HEADERS } = require("../server.js");
const { buildStatic, MUST_BE_ABSENT, assertNoExcluded } = require("../build-static.js");

const BUILD = path.join(__dirname, "..", "build");

// Mask only the per-deploy cache-buster (server uses a boot value, the build a
// CF SHA / timestamp); everything else must match byte-for-byte.
function stripVersion(s) {
  return String(s).replace(/\?v=[^"'&\s]*/g, "?v=V");
}

let base;
// The VALIDATED slugs — the ones the server routes on AND the build renders.
// (Using discoverArticleSlugs here would silently re-admit the divergence the
// build fix removed: folders whose article failed validation.)
const SLUGS = VALID_ARTICLE_SLUGS;

before(async () => {
  // Regenerate the static build from the current sources so the test is
  // self-contained (no dependence on a prior `npm run build:static`).
  buildStatic({ outDir: BUILD });
  ({ base } = await start());
});
after(async () => { await stop(); });

// Every HTML route → its flat build file (foo.html, so Cloudflare Pages serves
// it at the slash-less /foo that the canonical/sitemap/feed URLs use).
const HTML_ROUTES = [
  ["/", "index.html"],
  ["/news", "news.html"],
  ["/publications", "publications.html"],
  ...SLUGS.map((s) => [`/news/${s}`, `news/${s}.html`]),
];

for (const [routePath, buildRel] of HTML_ROUTES) {
  test(`byte-parity HTML: ${routePath}`, async () => {
    const res = await request(base, routePath);
    // Status parity too: every page the build ships must be one the server
    // answers 200 (a build file for a route the server 404s would be served
    // as a soft-404 by Cloudflare).
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
    const served = stripVersion(res.body.toString("utf8"));
    const built = stripVersion(fs.readFileSync(path.join(BUILD, buildRel), "utf8"));
    assert.strictEqual(built, served, `static build differs from server for ${routePath}`);
  });
}

test("byte-parity HTML: unknown route → 404.html", async () => {
  const res = await request(base, "/this-route-does-not-exist");
  assert.equal(res.status, 404);
  const served = stripVersion(res.body.toString("utf8"));
  const built = stripVersion(fs.readFileSync(path.join(BUILD, "404.html"), "utf8"));
  assert.strictEqual(built, served, "static 404.html differs from server not-found page");
});

// Feeds carry no ?v= token, so they must match exactly with no normalization.
const FEEDS = [
  ["/sitemap.xml", "sitemap.xml"],
  ["/rss.xml", "rss.xml"],
  ["/feed.json", "feed.json"],
];

for (const [routePath, buildRel] of FEEDS) {
  test(`byte-parity feed: ${routePath}`, async () => {
    const res = await request(base, routePath);
    assert.equal(res.status, 200);
    const served = res.body.toString("utf8");
    const built = fs.readFileSync(path.join(BUILD, buildRel), "utf8");
    assert.strictEqual(built, served, `static ${buildRel} differs from server`);
  });
}

test("build feed.json matches the committed golden", () => {
  // Through matchGolden, not a raw read: characterization.test.js owns the
  // same golden through the helper, and under UPDATE_GOLDEN=1 the two files
  // run in parallel processes — a raw read here raced the helper's rewrite
  // and failed the documented refresh command nondeterministically.
  const built = fs.readFileSync(path.join(BUILD, "feed.json"), "utf8");
  matchGolden("feed.json", built);
});

// buildStatic's own assertNoExcluded already swept MUST_BE_ABSENT during
// before() — re-running the existence checks here could never fail. What CAN
// regress silently is the guard itself, so assert it actually throws on a
// planted private file (and stays quiet once the file is gone).
test("assertNoExcluded catches a planted private file in build/", () => {
  assert.ok(MUST_BE_ABSENT.includes("server.js"), "canary entry missing from MUST_BE_ABSENT");
  const planted = path.join(BUILD, "server.js");
  fs.writeFileSync(planted, "// planted by parity test");
  try {
    assert.throws(() => assertNoExcluded(BUILD), /server\.js/, "planted private file not detected");
  } finally {
    fs.unlinkSync(planted);
  }
  assert.doesNotThrow(() => assertNoExcluded(BUILD));
  // Root dotfiles are swept by the same guard.
  const dotfile = path.join(BUILD, ".env");
  fs.writeFileSync(dotfile, "");
  try {
    assert.throws(() => assertNoExcluded(BUILD), /\.env/, "planted dotfile not detected");
  } finally {
    fs.unlinkSync(dotfile);
  }
});

// The _headers file is the static deploy's ONLY carrier of the security
// headers the server sets in code — parity for headers, not just bodies.
// Every SECURITY_HEADERS pair must appear verbatim, and every clean HTML
// route must have its own rule block (Cloudflare matches the REQUEST path;
// the extensionless SPA URLs match no /*.html pattern).
test("_headers carries every security header and every HTML route", () => {
  const headersFile = fs.readFileSync(path.join(BUILD, "_headers"), "utf8");
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    assert.ok(
      headersFile.includes(`${name}: ${value}`),
      `_headers is missing "${name}: ${value}" — static deploy would drop a server header`
    );
  }
  for (const [routePath] of HTML_ROUTES) {
    assert.ok(
      new RegExp(`^${routePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m").test(headersFile),
      `_headers has no rule block for HTML route ${routePath}`
    );
  }
});

// Every pre-rendered flat file must 301 to its clean URL so no page is ever
// reachable under a second address (and /index.html joins the same rule set).
test("_redirects maps every flat HTML file to its clean URL", () => {
  const redirects = fs.readFileSync(path.join(BUILD, "_redirects"), "utf8");
  const lines = redirects.split("\n").filter(Boolean);
  const expect = (from, to) =>
    assert.ok(
      lines.some((l) => {
        const [f, t, code] = l.trim().split(/\s+/);
        return f === from && t === to && code === "301";
      }),
      `_redirects is missing "${from} ${to} 301"`
    );
  expect("/index.html", "/");
  for (const [routePath, buildRel] of HTML_ROUTES) {
    if (buildRel === "index.html") continue;
    expect(`/${buildRel}`, routePath);
  }
});

// Guard against a reference-but-don't-copy bug: every icon the site points at
// (web manifest, <link rel=icon>, and the header logo compiled into the app
// bundle) must actually exist in build/, or it 404s on the static deploy.
test("every referenced icon is present in the static build", () => {
  const missing = [];
  const check = (ref, where) => {
    if (!fs.existsSync(path.join(BUILD, ref.replace(/^\//, "")))) {
      missing.push(`${ref} (referenced in ${where})`);
    }
  };
  // 1) web manifest icons
  const mani = JSON.parse(fs.readFileSync(path.join(BUILD, "site.webmanifest"), "utf8"));
  for (const icon of mani.icons || []) check(icon.src, "site.webmanifest");
  // 2) <link rel="icon"/"apple-touch-icon"> hrefs in the served HTML
  const html = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");
  for (const m of html.matchAll(/rel="(?:icon|apple-touch-icon)"[^>]*href="(\/[^"?]+)"/g)) {
    check(m[1], "index.html");
  }
  // 3) icon <img> paths compiled into the JS bundles (e.g. the header logo)
  const distDir = path.join(BUILD, "dist");
  const js = fs.readdirSync(distDir)
    .filter((f) => f.endsWith(".js"))
    .map((f) => fs.readFileSync(path.join(distDir, f), "utf8"))
    .join("\n");
  for (const m of js.matchAll(/["'](\/(?:icon-|favicon-|apple-touch-icon|logo-mark)[^"']*\.png)["']/g)) {
    check(m[1], "app bundle");
  }
  assert.deepEqual(missing, [], `icons referenced but missing from build/: ${missing.join(", ")}`);
});
