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

const { start, stop, request } = require("./helper");
const { discoverArticleSlugs } = require("../server.js");
const { buildStatic } = require("../build-static.js");

const BUILD = path.join(__dirname, "..", "build");

// Mask only the per-deploy cache-buster (server uses a boot value, the build a
// CF SHA / timestamp); everything else must match byte-for-byte.
function stripVersion(s) {
  return String(s).replace(/\?v=[^"'&\s]*/g, "?v=V");
}

let base;
const SLUGS = discoverArticleSlugs();

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
  const built = fs.readFileSync(path.join(BUILD, "feed.json"), "utf8");
  const golden = fs.readFileSync(path.join(__dirname, "golden", "feed.json"), "utf8");
  assert.strictEqual(built, golden);
});

test("no private/excluded file leaked into build/", () => {
  const mustBeAbsent = [
    "server.js", "build-static.js", "feeds.js",
    "package.json", "package-lock.json",
    ".gitignore", "LICENSE",
    "README.md", "PUBLICATIONS.md", "news/README.md",
    "scripts", "test", "node_modules", "dist/manifest.json",
    "app.jsx", "icons.jsx", "components",
  ];
  for (const rel of mustBeAbsent) {
    assert.ok(!fs.existsSync(path.join(BUILD, rel)), `private file leaked into build/: ${rel}`);
  }
  for (const entry of fs.readdirSync(BUILD)) {
    assert.ok(!entry.startsWith("."), `dotfile leaked into build/: ${entry}`);
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
