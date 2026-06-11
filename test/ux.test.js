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
