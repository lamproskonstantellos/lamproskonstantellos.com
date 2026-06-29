"use strict";

// SPA behaviour & UX: the stale-title fix and route-change focus. Titles are
// driven by the shared pageTitle so the client (document.title) and the server
// (injected <title>) can never diverge. Client-only wiring (no DOM in tests)
// is asserted against the source and the compiled bundle.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const routes = require("../routes.js");
const server = require("../server.js");
const SITE = require("../site.config.js");

const ROOT = path.join(__dirname, "..");
const ctx = { siteName: SITE.name, jobTitle: SITE.jobTitle };

// ---- pageTitle (shared source of truth) ------------------------------------

test("pageTitle covers every route", () => {
  assert.equal(pageTitleFor({ page: "home" }), "Lampros Konstantellos - Electrical & Computer Engineer");
  assert.equal(pageTitleFor({ page: "news-list" }), "News - Lampros Konstantellos");
  assert.equal(pageTitleFor({ page: "publications-list" }), "Publications - Lampros Konstantellos");
  assert.equal(
    routes.pageTitle({ page: "article" }, { ...ctx, articleTitle: "My Article" }),
    "My Article - Lampros Konstantellos"
  );
  assert.equal(pageTitleFor({ page: "article" }), "Page not found - Lampros Konstantellos"); // unknown slug
  assert.equal(pageTitleFor({ page: "not-found" }), "Page not found - Lampros Konstantellos");
});

function pageTitleFor(route) {
  return routes.pageTitle(route, ctx);
}

// ---- client and server titles agree (no divergence) ------------------------

test("server-injected title equals pageTitle(parseRoute(path)) for every route", () => {
  const cases = [
    "/", "/news", "/publications",
    "/news/ieee-pess-2025-best-paper-award",
    "/no-such-route",
  ];
  for (const p of cases) {
    const route = routes.parseRoute(p);
    const articleTitle =
      route.page === "article" ? (server.loadArticleMeta(route.slug) || {}).title : undefined;
    const expected = routes.pageTitle(route, { ...ctx, articleTitle });
    assert.equal(server.computePageMeta(p).title, expected, `title drift at ${p}`);
  }
});

// ---- client wiring: document.title + focus on route change -----------------

test("app.jsx updates document.title from pageTitle on route change", () => {
  const src = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
  assert.ok(/document\.title\s*=\s*pageTitle\(/.test(src), "navigate/effect must set document.title via pageTitle");
});

test("app.jsx moves focus to main on route change (a11y)", () => {
  const src = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
  assert.ok(src.includes('tabIndex={-1}'), "main must be programmatically focusable");
  assert.ok(/mainRef\.current\.focus\(/.test(src), "route change should focus main");
});

function compiledBundle(entryPoint) {
  const manifest = require("../dist/manifest.json");
  const out = Object.entries(manifest.outputs).find(([, v]) => v.entryPoint === entryPoint)[0];
  return fs.readFileSync(path.join(ROOT, out), "utf8");
}

test("compiled app bundle carries the title + focus wiring", () => {
  const code = compiledBundle("app.jsx");
  assert.ok(code.includes("document.title"), "bundle missing document.title");
  assert.ok(code.includes("pageTitle"), "bundle missing pageTitle");
});

// ---- Contact: ResearchGate + GitHub cards ------------------------------------

test("icons bundle defines the ResearchGate and GitHub brand icons", () => {
  const code = compiledBundle("icons.jsx");
  assert.ok(code.includes("brandResearchgate"), "Icon.brandResearchgate missing");
  assert.ok(code.includes("brandGithub"), "Icon.brandGithub missing");
});

test("Contact maps the researchgate and github ids to their brand icons", () => {
  const code = compiledBundle("app.jsx");
  assert.ok(code.includes("brandResearchgate"), "Contact not wired to Icon.brandResearchgate");
  assert.ok(code.includes("brandGithub"), "Contact not wired to Icon.brandGithub");
});

// ---- Homepage scroll-spy nav -------------------------------------------------

test("App observes the home sections and drives the Header via activeSection", () => {
  const src = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
  assert.match(src, /rootMargin:\s*"-15% 0px -80% 0px"/, "near-top band rootMargin missing");
  assert.ok(src.includes("pickActiveSection("), "App must resolve the section via pickActiveSection");
  assert.match(src, /\["about",\s*"publications",\s*"news",\s*"contact"\]/, "section order missing");
  assert.ok(src.includes("activeSection={activeSection}"), "Header must receive activeSection");
  assert.match(
    src,
    /route\.page === "home" && activeSection === it\.id/,
    "home nav highlight must follow the scroll-spy"
  );
  assert.ok(src.includes("io.disconnect()"), "observer must be disconnected on leave");
});

test("compiled app bundle carries the scroll-spy wiring", () => {
  const code = compiledBundle("app.jsx");
  assert.ok(code.includes("IntersectionObserver"), "bundle missing the observer");
  assert.ok(code.includes("pickActiveSection"), "bundle must call the shared helper");
  assert.ok(code.includes("-15% 0px -80% 0px"), "bundle missing the band rootMargin");
});

// ---- Article share row -------------------------------------------------------

test("Article wires the share row above the sources block, URL from config", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/news.jsx"), "utf8");
  assert.ok(
    src.includes('SITE.url + "/news/" + article.slug'),
    "share URL must be canonical (from config), not window.location"
  );
  assert.ok(src.includes("shareLinks(url).linkedin"), "LinkedIn href must come from shareLinks");
  assert.match(src, /aria-label="Share on LinkedIn"/);
  assert.match(src, /target="_blank"[\s\S]{0,40}rel="noopener noreferrer"/);
  const shareAt = src.indexOf("<ArticleShare article={article} />");
  const sourcesAt = src.indexOf("article.sources && article.sources.length > 0 &&");
  assert.ok(shareAt !== -1, "Article must render ArticleShare");
  assert.ok(sourcesAt !== -1 && shareAt < sourcesAt, "share row must sit above the sources block");
});

test("copy-link uses the clipboard API with an execCommand fallback and a live announcement", () => {
  const src = fs.readFileSync(path.join(ROOT, "components/news.jsx"), "utf8");
  assert.ok(src.includes("navigator.clipboard.writeText(url)"), "missing clipboard copy");
  assert.ok(src.includes('document.execCommand("copy")'), "missing legacy clipboard fallback");
  assert.match(src, /aria-live="polite"/, "copied state must be announced");
  assert.ok(src.includes("clearTimeout(copyTimer.current)"), "copied-state timer must be cleared on unmount");
});

test("compiled news bundle carries the share row + copy handler", () => {
  const code = compiledBundle("components/news.jsx");
  assert.ok(code.includes("article-share"), "share row class missing from bundle");
  assert.ok(code.includes("shareLinks"), "bundle must call the shared shareLinks helper");
  assert.ok(code.includes("writeText"), "bundle missing clipboard copy");
  assert.ok(code.includes("execCommand"), "bundle missing clipboard fallback");
  assert.ok(code.includes("aria-live"), "bundle missing the copied announcement");
});

// ---- NotFound page -----------------------------------------------------------

test("NotFound offers routes onward: home, /news, /publications, contact", () => {
  const src = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
  const notFound = src.slice(src.indexOf("function NotFound"), src.indexOf("function App"));
  assert.match(notFound, /href="\/"/, "missing back-to-home link");
  assert.match(notFound, /href="\/news"/, "missing /news link");
  assert.match(notFound, /href="\/publications"/, "missing /publications link");
  assert.match(notFound, /href="\/#contact"/, "missing contact link");
  assert.ok(notFound.includes("handleAnchorClick"), "links must go through SPA navigation");
  assert.ok(!notFound.includes("style={{"), "404 styling lives in styles.css, not inline");
});

test("compiled app bundle carries the redesigned 404", () => {
  const code = compiledBundle("app.jsx");
  assert.ok(code.includes("notfound"), "bundle missing the .notfound classes");
  assert.ok(code.includes("Page not found"), "bundle missing the 404 headline");
});

// ---- View-all threshold is exactly "more than the cap" ---------------------

test("news preview cap: View-all appears only when items exceed the limit", () => {
  // Reproduce the component's predicate against real data via the data.js shim.
  const schema = require("../article-schema.js");
  const window = {
    SITE,
    validateArticle: schema.validateArticle,
    compareByDateDesc: schema.compareByDateDesc,
  };
  const code = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
  // eslint-disable-next-line no-new-func
  new Function("window", code)(window);
  // Seed N articles and check the predicate getRecentNews().length > cap.
  window.NEWS_ARTICLES = [];
  const cap = window.LIMITS.newsPreview;
  const mk = (i) => ({ slug: "s" + i, date: "2026-01-0" + (i + 1) });
  for (let i = 0; i < cap; i++) window.NEWS_ARTICLES.push(mk(i));
  assert.equal(window.getRecentNews().length > cap, false, "exactly cap → no View-all");
  window.NEWS_ARTICLES.push(mk(cap));
  assert.equal(window.getRecentNews().length > cap, true, "cap+1 → View-all");
  assert.equal(window.getRecentNews(cap).length, cap, "preview is sliced to the cap");
});
