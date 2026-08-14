"use strict";

// Unit tests for pure helpers: the server's own (escapeHtml, jsonLdScript,
// cacheHeaderFor, computePageMeta, isValidSpaRoute), the shared route table
// (parseRoute / routeToPath, from routes.js), the shared plainBody flattener,
// and article validation via the data.js window shim.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { loadDataWindow } = require("./helper");

const {
  escapeHtml,
  jsonLdScript,
  cacheHeaderFor,
  isValidSpaRoute,
  computePageMeta,
  isPrivatePath,
  checkRealPathContained,
  DEPLOY_VERSION,
} = require("../server.js");

// ---- escapeHtml -------------------------------------------------------------

test("escapeHtml escapes the five HTML-significant characters", () => {
  assert.equal(escapeHtml(`<a href="x" title='y'>&</a>`),
    "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
});

test("escapeHtml leaves $ unescaped (root of the replace-pattern hazard)", () => {
  // The $ itself is never escaped, so $`, $$ survive verbatim and $&, $'
  // survive as $&amp; / $&#39; — all of which begin with a special token that
  // String.prototype.replace interprets in the replacement string.
  assert.equal(escapeHtml("price $5 and $$"), "price $5 and $$");
  assert.equal(escapeHtml("$`"), "$`");
  assert.equal(escapeHtml("$&"), "$&amp;");
  assert.equal(escapeHtml("$'"), "$&#39;");
});

// ---- jsonLdScript -----------------------------------------------------------

test("jsonLdScript escapes < to prevent </script> breakout", () => {
  const out = jsonLdScript({ x: "</script><b>" });
  assert.ok(!out.includes("</script>"));
  assert.ok(out.includes("\\u003c/script"));
});

// ---- cacheHeaderFor ---------------------------------------------------------

test("cacheHeaderFor classes", () => {
  const req = (url) => ({ url, headers: { host: "example.com" } });
  assert.match(cacheHeaderFor(req("/"), "text/html; charset=utf-8"), /no-store/);
  // Content-hashed bundle filenames: always immutable.
  assert.match(cacheHeaderFor(req("/dist/app-X.js"), "application/javascript"), /immutable/);
  // A ?v= token that does NOT match the current deploy token must not earn
  // immutable — any-?v= qualified before, letting third parties pin arbitrary
  // cache keys (…?v=anything) for a year.
  assert.match(cacheHeaderFor(req("/styles.css?v=1"), "text/css"), /max-age=86400/);
  // The token the current process stamps: immutable in production (fresh token
  // per deploy), revalidate in dev — the token is fixed at boot there, so
  // immutable froze edited CSS/JS for the whole watch session. Tests run
  // without CF_PAGES_COMMIT_SHA, i.e. the dev branch.
  assert.equal(cacheHeaderFor(req(`/styles.css?v=${DEPLOY_VERSION}`), "text/css"), "no-cache");
  assert.match(cacheHeaderFor(req("/styles.css"), "text/css"), /max-age=86400/);
});

// ---- isPrivatePath ----------------------------------------------------------
// The exported symbol had no direct test: security.test.js exercises it only
// end-to-end through HTTP. In a deny-by-default design, this corpus is the
// direct contract.

test("isPrivatePath corpus: private stays private, public stays public", () => {
  const privates = [
    "/server.js", "/SERVER.JS",             // denylist, case-insensitive
    "/ssr.js", "/feeds.js", "/build-static.js", "/build.config.js",
    "/package.json", "/package-lock.json", "/LICENSE",
    "/dist/manifest.json",
    "/scripts/optimize-images.js", "/test/unit.test.js", "/node_modules/x.js",
    "/components/news.jsx", "/build/index.html", "/scratch/notes.txt",
    "/.gitignore", "/.git/config", "/.env",
    "/news/some-slug/.DS_Store",            // nested dotfile
    "/README.md", "/news/README.md", "/app.jsx",
    "/unknown-root-file.txt", "/env.local", // deny-by-default root
  ];
  for (const p of privates) {
    assert.equal(isPrivatePath(p), true, `${p} must be private`);
  }
  const publics = [
    "/", "/index.html", "/styles.css", "/data.js", "/routes.js",
    "/site.config.js", "/article-schema.js", "/ui-helpers.js",
    "/robots.txt", "/site.webmanifest", "/sitemap.xml", "/rss.xml", "/feed.json",
    "/favicon.ico", "/favicon.svg", "/favicon-32x32.png", "/icon-512.png",
    "/apple-touch-icon.png", "/og-image.jpg",
    "/lampros-konstantellos-picture.jpg", "/lampros-konstantellos-picture.avif",
    "/lampros-konstantellos-picture-480.webp",
    "/lampros-konstantellos-cv.pdf",
    "/news", "/publications",               // clean URLs (SPA fallback)
    "/news/some-slug/article.js", "/news/some-slug/cover.jpg",
    "/dist/app-ABCDEFGH.js", "/vendor/react.production.min.js",
    "/vendor/fonts/inter-latin.woff2",
  ];
  for (const p of publics) {
    assert.equal(isPrivatePath(p), false, `${p} must be public`);
  }
});

// ---- checkRealPathContained -------------------------------------------------
// Symlink containment on a throwaway temp tree: a symlink whose target
// resolves OUTSIDE the root must be refused, links and files inside it must
// pass. (The request handler wires a false result to a 403.)

test("checkRealPathContained: symlinks cannot escape the root", async (t) => {
  const os = require("os");
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "contain-")));
  const root = path.join(base, "root");
  const outside = path.join(base, "outside.txt");
  fs.mkdirSync(path.join(root, "sub"), { recursive: true });
  fs.writeFileSync(outside, "secret");
  fs.writeFileSync(path.join(root, "inside.txt"), "public");
  const check = (p) => new Promise((r) => checkRealPathContained(p, root, r));
  try {
    try {
      fs.symlinkSync(outside, path.join(root, "sub", "escape.txt"));
      fs.symlinkSync(path.join(root, "inside.txt"), path.join(root, "sub", "alias.txt"));
    } catch {
      return t.skip("cannot create symlinks here");
    }
    assert.equal(await check(path.join(root, "inside.txt")), true, "regular file must pass");
    assert.equal(await check(path.join(root, "sub", "alias.txt")), true, "in-root symlink must pass");
    assert.equal(await check(path.join(root, "sub", "escape.txt")), false, "escaping symlink must fail");
    assert.equal(await check(path.join(root, "missing.txt")), false, "unresolvable path must fail");
    assert.equal(await check(outside), false, "path outside the root must fail");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// ---- isValidSpaRoute --------------------------------------------------------

test("isValidSpaRoute corpus", () => {
  assert.equal(isValidSpaRoute("/"), true);
  assert.equal(isValidSpaRoute("/news"), true);
  assert.equal(isValidSpaRoute("/publications"), true);
  assert.equal(isValidSpaRoute("/news/ieee-pess-2025-best-paper-award"), true);
  assert.equal(isValidSpaRoute("/news/"), true); // trailing slash normalized
  assert.equal(isValidSpaRoute("/news/nope"), false);
  assert.equal(isValidSpaRoute("/random"), false);
  assert.equal(isValidSpaRoute("/news/a/b"), false);
});

// ---- computePageMeta route table -------------------------------------------

test("computePageMeta home", () => {
  const m = computePageMeta("/");
  assert.equal(m.ogType, "website");
  assert.match(m.title, /Electrical & Computer Engineer$/);
  assert.ok(m.jsonLd);
  assert.equal(m.url, "https://lamproskonstantellos.com/");
});

test("computePageMeta article", () => {
  const m = computePageMeta("/news/ieee-pess-2025-best-paper-award");
  assert.equal(m.ogType, "article");
  const graph = m.jsonLd["@graph"];
  const article = graph.find((n) => n["@type"] === "Article");
  assert.equal(article.headline, "Third Best Paper Award at IEEE PESS 2025");
  assert.equal(article.inLanguage, "en");
  assert.ok(article.wordCount > 0);
});

test("computePageMeta unknown route → not-found meta", () => {
  const m = computePageMeta("/nope");
  assert.match(m.title, /^Page not found/);
  assert.equal(m.jsonLd, null);
});

// ---- defineArticle validation (data.js via the shared helper shim) ---------

function loadDefineArticle() {
  return loadDataWindow().defineArticle;
}

const validArticle = () => ({
  slug: "x",
  date: "2026-01-02",
  dateLabel: "January 2, 2026",
  title: "T",
  excerpt: "E",
  body: ["one"],
});

test("defineArticle accepts a valid article", () => {
  const defineArticle = loadDefineArticle();
  assert.doesNotThrow(() => defineArticle(validArticle()));
});

test("defineArticle rejects missing required fields", () => {
  const defineArticle = loadDefineArticle();
  for (const f of ["slug", "date", "dateLabel", "title", "excerpt", "body"]) {
    const a = validArticle();
    delete a[f];
    assert.throws(() => defineArticle(a), new RegExp(f), `should reject missing ${f}`);
  }
});

test("defineArticle rejects bad date format", () => {
  const defineArticle = loadDefineArticle();
  const a = validArticle();
  a.date = "2026/01/02";
  assert.throws(() => defineArticle(a), /invalid date/);
});

test("defineArticle rejects non-array body / photos / keywords / topics", () => {
  const defineArticle = loadDefineArticle();
  const bad = (mut) => { const a = validArticle(); mut(a); return a; };
  assert.throws(() => defineArticle(bad((a) => (a.body = "no"))), /empty or non-array body/);
  assert.throws(() => defineArticle(bad((a) => (a.photos = "no"))), /non-array photos/);
  assert.throws(() => defineArticle(bad((a) => (a.keywords = "no"))), /non-array keywords/);
  assert.throws(() => defineArticle(bad((a) => (a.topics = "no"))), /non-array topics/);
});

// ---- plainBody (shared machine-text flattener) -------------------------------

test("plainBody joins paragraphs and strips inline bold markers", () => {
  const { plainBody } = require("../article-schema.js");
  assert.equal(
    plainBody(["I met **Dr. X** at **the expo**.", "Second paragraph."]),
    "I met Dr. X at the expo.\n\nSecond paragraph."
  );
  assert.equal(plainBody([]), "");
  assert.equal(plainBody(undefined), "");
});

// ---- PROFILE.contact entries (data.js via window shim) ----------------------

test("PROFILE.contact lists ResearchGate and GitHub, with email kept last", () => {
  const { PROFILE } = loadDataWindow();
  const hrefs = PROFILE.contact.map((c) => c.href);
  assert.ok(
    hrefs.includes("https://www.researchgate.net/profile/Lampros-Konstantellos"),
    "ResearchGate contact link missing"
  );
  assert.ok(
    hrefs.includes("https://github.com/lamproskonstantellos"),
    "GitHub contact link missing"
  );
  assert.equal(PROFILE.contact[PROFILE.contact.length - 1].id, "email", "email must stay last");
});

// ---- shared route table (routes.js, used by client AND server) -------------

const routes = require("../routes.js");

test("parseRoute corpus", () => {
  assert.deepEqual(routes.parseRoute("/"), { page: "home", section: null });
  assert.deepEqual(routes.parseRoute(""), { page: "home", section: null });
  assert.deepEqual(routes.parseRoute("/news"), { page: "news-list" });
  assert.deepEqual(routes.parseRoute("/news/"), { page: "news-list" });
  assert.deepEqual(routes.parseRoute("/publications"), { page: "publications-list" });
  assert.deepEqual(routes.parseRoute("/news/some-slug"), { page: "article", slug: "some-slug" });
  assert.deepEqual(routes.parseRoute("/news/a/b"), { page: "not-found" });
  assert.deepEqual(routes.parseRoute("/random"), { page: "not-found" });
});

test("routeToPath corpus (inverse of parseRoute)", () => {
  assert.equal(routes.routeToPath({ page: "home" }), "/");
  assert.equal(routes.routeToPath({ page: "news-list" }), "/news");
  assert.equal(routes.routeToPath({ page: "publications-list" }), "/publications");
  assert.equal(routes.routeToPath({ page: "article", slug: "s" }), "/news/s");
  assert.equal(routes.routeToPath({ page: "home", section: "contact" }), "/#contact");
  assert.equal(routes.routeToPath(null), "/");
});

test("isValidSpaRoute respects known slugs", () => {
  const known = ["a", "b"];
  assert.equal(routes.isValidSpaRoute("/news/a", known), true);
  assert.equal(routes.isValidSpaRoute("/news/c", known), false);
  assert.equal(routes.isValidSpaRoute("/news/a", undefined), true); // client: any slug
  assert.equal(routes.isValidSpaRoute("/random", known), false);
});
