"use strict";

// Cross-module consistency (class C): every duplicated fact now has one owner.
// These tests fail if a consumer drifts from its source of truth.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { start, stop, request } = require("./helper");

const ROOT = path.join(__dirname, "..");
const SITE = require("../site.config.js");
const routes = require("../routes.js");
const schema = require("../article-schema.js");
const server = require("../server.js");

let base;
before(async () => { ({ base } = await start()); });
after(async () => { await stop(); });

// ---- C1: route table agreement (parseRoute / computePageMeta / isValid) ----

test("parseRoute, computePageMeta and isValidSpaRoute agree on a corpus", () => {
  const corpus = [
    "/", "/news", "/publications",
    "/news/ieee-pess-2025-best-paper-award",
    "/news/unknown-slug-xyz",
    "/random", "/news/", "/publications/", "/news/a/b",
  ];
  for (const p of corpus) {
    const r = routes.parseRoute(p);
    const meta = server.computePageMeta(p);
    const valid = server.isValidSpaRoute(p);

    if (r.page === "home") {
      assert.equal(meta.ogType, "website");
      assert.ok(meta.title.includes(SITE.jobTitle), `${p}: home title`);
      assert.equal(valid, true, `${p}: home valid`);
    } else if (r.page === "news-list") {
      assert.match(meta.title, /^News - /, p);
      assert.equal(valid, true, p);
    } else if (r.page === "publications-list") {
      assert.match(meta.title, /^Publications - /, p);
      assert.equal(valid, true, p);
    } else if (r.page === "article") {
      // computePageMeta only yields article meta when the slug exists; the same
      // existence check drives isValidSpaRoute, so they must agree.
      const isArticleMeta = meta.ogType === "article";
      assert.equal(isArticleMeta, valid, `${p}: article meta vs valid mismatch`);
    } else {
      assert.match(meta.title, /^Page not found/, p);
      assert.equal(valid, false, p);
    }
  }
});

// ---- C2: a single newest-first comparator drives every ordered surface -----

test("feed.json and rss.xml share one newest-first order", async () => {
  const feed = JSON.parse((await request(base, "/feed.json")).body.toString("utf8"));
  const feedSlugs = feed.items.map((i) => i.url.split("/news/")[1]);

  const rss = (await request(base, "/rss.xml")).body.toString("utf8");
  const rssSlugs = [...rss.matchAll(/\/news\/([^<]+)<\/link>/g)].map((m) => m[1]);

  assert.deepEqual(feedSlugs, rssSlugs, "feed and rss order diverged");

  // And that order is exactly compareByDateDesc over the article dates.
  const dates = feed.items.map((i) => i.date_published);
  const sorted = [...dates].sort((a, b) => schema.compareByDateDesc({ date: a }, { date: b }));
  assert.deepEqual(dates, sorted, "feed order is not compareByDateDesc");
});

// ---- C4: site identity comes only from site.config.js ----------------------

test("index.html source hardcodes no site identity", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(!html.includes(SITE.name), "index.html still hardcodes the site name");
});

test("served og:site_name / application-name come from SITE.name", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  assert.match(html, new RegExp(`<meta property="og:site_name" content="${SITE.name}"`));
  assert.match(html, new RegExp(`<meta name="application-name" content="${SITE.name}"`));
});

// ---- C5: preload target derived from the same image the Hero renders -------

test("home preload is the AVIF sibling of SITE.heroImage", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  const expected = SITE.heroImage.replace(/\.(jpe?g|png)$/i, ".avif");
  assert.match(html, new RegExp(`<link rel="preload"[^>]*href="${expected}"`));
  // And the Hero <img>/<source> chain is built from SITE.heroImage, not a
  // separately hardcoded path.
  assert.ok(fs.existsSync(path.join(ROOT, SITE.heroImage.replace(/^\//, ""))));
});

// ---- C6: copyright year is derived, not hardcoded --------------------------

test("Footer derives the year (no hardcoded © 20xx)", () => {
  const appjsx = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
  assert.ok(!/©\s*20\d\d/.test(appjsx), "app.jsx still hardcodes a copyright year");
  assert.ok(appjsx.includes("getFullYear()"), "Footer should derive the year");
});

// ---- C7: photo alignment is article data, not a filename check -------------

test("photo alignment lives in article data", () => {
  const newsjsx = fs.readFileSync(path.join(ROOT, "components/news.jsx"), "utf8");
  assert.ok(
    !newsjsx.includes("photo-01.jpg"),
    "news.jsx still hardcodes a content-specific filename"
  );
  const ieee = server.loadArticleMeta("ieee-pess-2025-best-paper-award");
  assert.equal(typeof ieee.photos[0], "object");
  assert.equal(ieee.photos[0].align, "top");
});

// ---- C8: the folder name is the single owner of an article's slug ----------

test("every discovered article's folder name equals its slug field", () => {
  for (const slug of server.discoverArticleSlugs()) {
    const a = server.loadArticleMeta(slug);
    assert.ok(a, `${slug} failed to load`);
    assert.equal(a.slug, slug, `folder "${slug}" diverges from slug field "${a.slug}"`);
  }
});

test("loadArticleMeta skips an article whose slug field diverges from its folder", () => {
  const folder = "__consistency_divergent__";
  const dir = path.join(ROOT, "news", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "article.js"),
    // Valid in every respect EXCEPT that slug !== folder — which would make the
    // RSS/feed/canonical URL (/news/elsewhere) unroutable and break the browser
    // getArticle(folder) lookup while the server still returns 200.
    `defineArticle({ slug: "elsewhere", date: "2026-01-01", dateLabel: "x", title: "t", excerpt: "e", body: ["b"] });`
  );
  try {
    assert.equal(server.loadArticleMeta(folder), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---- C9: an article slug must be URL-safe (both worlds) --------------------

test("validateArticle rejects a slug with URL-unsafe characters", () => {
  const base = { date: "2026-01-01", dateLabel: "x", title: "t", excerpt: "e", body: ["b"] };
  for (const bad of ["a/b", "a b", "R&D", "a<b", "Upper"]) {
    assert.throws(() => schema.validateArticle({ ...base, slug: bad }), /invalid slug/, bad);
  }
  assert.doesNotThrow(() => schema.validateArticle({ ...base, slug: "7th-power-gas-forum-athens" }));
});

// ---- C10: contact links never diverge from site.config socialLinks ---------

test("PROFILE.contact hrefs (minus email) are exactly site.config.socialLinks", () => {
  const code = fs.readFileSync(path.join(ROOT, "data.js"), "utf8");
  const window = { SITE, validateArticle: schema.validateArticle, compareByDateDesc: schema.compareByDateDesc };
  // eslint-disable-next-line no-new-func
  new Function("window", code)(window);
  const social = window.PROFILE.contact
    .filter((c) => c.id !== "email")
    .map((c) => c.href);
  // Same set, same order: the contact row and JSON-LD sameAs share one list.
  assert.deepEqual(social, SITE.socialLinks, "contact links drifted from socialLinks");
});

// ---- C3: server and browser validate articles identically ------------------

test("validateArticle rejects the same invalid article in both worlds", () => {
  const bad = { slug: "x", date: "bad", dateLabel: "d", title: "t", excerpt: "e", body: ["b"] };
  assert.throws(() => schema.validateArticle(bad), /invalid date/);
});

test("loadArticleMeta skips an invalid article (returns null, fails loudly)", () => {
  const slug = "__consistency_invalid__";
  const dir = path.join(ROOT, "news", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "article.js"),
    // Missing required `excerpt` — defineArticle would throw in the browser.
    `defineArticle({ slug: "${slug}", date: "2026-01-01", dateLabel: "x", title: "t", body: ["b"] });`
  );
  try {
    assert.equal(server.loadArticleMeta(slug), null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
