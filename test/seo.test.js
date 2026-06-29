"use strict";

// SEO / meta / feed correctness against the relevant specs, plus the status
// and canonical truth fixes from Phase 4.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { start, stop, request } = require("./helper");
const SITE = require("../site.config.js");
const server = require("../server.js");

let base;
before(async () => { ({ base } = await start()); });
after(async () => { await stop(); });

const ARTICLE = "ieee-pess-2025-best-paper-award";

// ---- SEO1: /index.html redirects to / (no duplicate home) ------------------

test("/index.html → 301 redirect to /", async () => {
  const res = await request(base, "/index.html");
  assert.equal(res.status, 301);
  assert.equal(res.headers["location"], "/");
});

// ---- SEO2: unknown route is 404 with a non-reflecting canonical ------------

test("unknown route: 404 + canonical/og:url point at home, not the path", async () => {
  const res = await request(base, "/no-such-page");
  assert.equal(res.status, 404);
  const html = res.body.toString("utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/lamproskonstantellos\.com\/"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/lamproskonstantellos\.com\/"/);
  assert.ok(!html.includes("no-such-page"), "404 must not reflect the requested path");
});

// ---- Trailing-slash policy: 200, deduped via canonical ---------------------

test("/news/ serves 200 with canonical to /news (no trailing slash)", async () => {
  const res = await request(base, "/news/");
  assert.equal(res.status, 200);
  const html = res.body.toString("utf8");
  assert.match(html, /<link rel="canonical" href="https:\/\/lamproskonstantellos\.com\/news"/);
});

// ---- Every 200 route is self-consistent (title/canonical/og:url) -----------

test("200 routes have self-consistent canonical, og:url, title", async () => {
  const routes = ["/", "/news", "/publications", `/news/${ARTICLE}`];
  for (const p of routes) {
    const html = (await request(base, p)).body.toString("utf8");
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)[1];
    const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/)[1];
    assert.equal(canonical, ogUrl, `${p}: canonical and og:url disagree`);
    assert.ok(/<title>[^<]+<\/title>/.test(html), `${p}: has a title`);
  }
});

// ---- Per-article meta equals the article source field-for-field ------------

test("article meta matches article.js source", () => {
  const a = server.loadArticleMeta(ARTICLE);
  const meta = server.computePageMeta(`/news/${ARTICLE}`);
  assert.equal(meta.title, `${a.title} - ${SITE.name}`);
  assert.equal(meta.description, a.excerpt);
  // og:image is the cover plus a content-hash ?v= so a same-name cover
  // replacement busts LinkedIn/Facebook/CDN caches (see server.js imageVersion).
  assert.ok(
    meta.image.startsWith(`${SITE.url}/${a.cover}?v=`),
    `article og:image should be the cover with a ?v= cache-buster, got ${meta.image}`
  );
  assert.match(meta.image, /\?v=[0-9a-f]{8,}$/, "the ?v= token is a content hash");
  const article = meta.jsonLd["@graph"].find((n) => n["@type"] === "Article");
  assert.equal(article.headline, a.title);
  assert.equal(article.datePublished, a.date);
  assert.equal(article.dateModified, a.date);
});

// ---- og:image:width/height are accurate per route (no hardcoded 1200x630) --

test("og:image dimensions are per-route accurate: default 1200x630, covers real", async () => {
  // The default share image (home / list / 404) is genuinely 1200x630.
  const buf = fs.readFileSync(path.join(__dirname, "../og-image.png"));
  // PNG: 8-byte sig, then IHDR length(4)+type(4), width @16, height @20 (BE).
  assert.equal(buf.readUInt32BE(16), 1200);
  assert.equal(buf.readUInt32BE(20), 630);

  const home = (await request(base, "/")).body.toString("utf8");
  assert.match(home, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(home, /<meta property="og:image:height" content="630" \/>/);

  // The IEEE article's og:image is its cover, which is 3840x2160 — so the page
  // must declare the cover's real pixels, never inherit the default 1200x630.
  const article = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  assert.match(article, /<meta property="og:image:width" content="3840" \/>/);
  assert.match(article, /<meta property="og:image:height" content="2160" \/>/);
  assert.ok(
    !/og:image:width" content="1200"/.test(article),
    "article must not declare the default image's dimensions"
  );
});

// ---- JSON-LD Article: ISO dates, consistent author/publisher ---------------

test("JSON-LD Article is schema-correct", async () => {
  const html = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(block)["@graph"];
  const article = graph.find((n) => n["@type"] === "Article");
  assert.match(article.datePublished, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(article.dateModified, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(article.author.name, SITE.name);
  assert.equal(article.publisher.name, SITE.name);
  assert.equal(article.inLanguage, "en");
  assert.ok(graph.some((n) => n["@type"] === "BreadcrumbList"));
});

// ---- JSON-LD Person sameAs mirrors socialLinks ------------------------------

test("home JSON-LD Person sameAs is exactly site.config socialLinks (incl. ResearchGate + GitHub)", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(block)["@graph"];
  const person = graph.find((n) => n["@type"] === "ProfilePage").mainEntity;
  assert.equal(person["@type"], "Person");
  assert.deepEqual(person.sameAs, SITE.socialLinks, "sameAs drifted from socialLinks");
  assert.ok(person.sameAs.includes("https://www.researchgate.net/profile/Lampros-Konstantellos"));
  assert.ok(person.sameAs.includes("https://github.com/lamproskonstantellos"));
});

// ---- RSS 2.0 spec checks ----------------------------------------------------

test("rss.xml is RSS 2.0 with RFC-822 dates, guid and atom:link self", async () => {
  const xml = (await request(base, "/rss.xml")).body.toString("utf8");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<rss version="2\.0"/);
  assert.match(xml, /<atom:link href="https:\/\/lamproskonstantellos\.com\/rss\.xml" rel="self"/);
  assert.match(xml, /<lastBuildDate>[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT<\/lastBuildDate>/);
  // Every item: RFC-822 pubDate + permalink guid.
  const pubDates = [...xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)];
  assert.ok(pubDates.length >= 1);
  for (const [, d] of pubDates) {
    assert.match(d, /^[A-Z][a-z]{2}, \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT$/, `bad RFC-822 date: ${d}`);
  }
  assert.match(xml, /<guid isPermaLink="true">https:\/\/lamproskonstantellos\.com\/news\//);
});

// ---- JSON Feed 1.1 spec checks ---------------------------------------------

test("feed.json conforms to JSON Feed 1.1", async () => {
  const feed = JSON.parse((await request(base, "/feed.json")).body.toString("utf8"));
  assert.equal(feed.version, "https://jsonfeed.org/version/1.1");
  assert.equal(typeof feed.title, "string");
  assert.ok(Array.isArray(feed.items));
  for (const item of feed.items) {
    assert.ok(item.id, "item.id required");
    assert.ok(item.url, "item.url required");
    assert.ok("content_text" in item || "content_html" in item, "item needs content");
    assert.match(item.date_published, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  }
});

// ---- sitemap.xml spec checks ------------------------------------------------

test("sitemap.xml is well-formed with absolute locs and YYYY-MM-DD lastmod", async () => {
  const xml = (await request(base, "/sitemap.xml")).body.toString("utf8");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 4);
  for (const loc of locs) assert.match(loc, /^https:\/\/lamproskonstantellos\.com\//);
  for (const [, d] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `bad lastmod: ${d}`);
  }
});

// ---- Crawler view (JS disabled): server HTML carries full meta -------------

test("article served HTML carries title/canonical/JSON-LD without JS", async () => {
  const html = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  assert.match(html, /<title>Third Best Paper Award at IEEE PESS 2025 - Lampros Konstantellos<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE.url}/news/${ARTICLE}"`));
  assert.match(html, /<meta property="og:type" content="article"/);
  assert.ok(html.includes('"@type":"Article"'), "Article JSON-LD present in raw HTML");
});
