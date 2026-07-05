"use strict";

// Unit tests for pure helpers, as they ship today. parseRoute/routeToPath are
// exercised here from COMPILED output (routeToPath) and via the server route
// table (computePageMeta / isValidSpaRoute). Direct parseRoute unit tests are
// added once it moves to the shared route module.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const {
  escapeHtml,
  jsonLdScript,
  cacheHeaderFor,
  isValidSpaRoute,
  computePageMeta,
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
  assert.match(cacheHeaderFor(req("/dist/app-X.js"), "application/javascript"), /immutable/);
  assert.match(cacheHeaderFor(req("/styles.css?v=1"), "text/css"), /immutable/);
  assert.match(cacheHeaderFor(req("/styles.css"), "text/css"), /max-age=86400/);
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

// ---- defineArticle validation (data.js via window shim) --------------------

function loadDataWindow() {
  const code = fs.readFileSync(path.join(__dirname, "../data.js"), "utf8");
  // data.js relies on the same globals the browser loads before it: SITE
  // (site.config.js) and validateArticle/compareByDateDesc (article-schema.js).
  const schema = require("../article-schema.js");
  const window = {
    SITE: require("../site.config.js"),
    validateArticle: schema.validateArticle,
    compareByDateDesc: schema.compareByDateDesc,
  };
  // eslint-disable-next-line no-new-func
  new Function("window", code)(window);
  return window;
}

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
