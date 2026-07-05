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

// ---- Machine-readable article text is plain (no authoring markers) ---------

test("JSON-LD articleBody and feed content_text carry no ** markers", async () => {
  const article = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  const jsonLd = article.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1];
  assert.ok(!jsonLd.includes("**"), "JSON-LD still contains raw markdown markers");
  const feed = (await request(base, "/feed.json")).body.toString("utf8");
  assert.ok(!feed.includes("**"), "feed.json still contains raw markdown markers");
});

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
  // og:image is the dedicated 1200x630 social crop (cover-og.jpg) plus a
  // content-hash ?v= so a same-name cover replacement busts LinkedIn/Facebook/
  // CDN caches (see server.js imageVersion + ARTICLE_SOCIAL).
  const ogPath = a.cover.replace(/\.(jpe?g|png)$/i, "-og.jpg");
  assert.ok(
    meta.image.startsWith(`${SITE.url}/${ogPath}?v=`),
    `article og:image should be the 1200x630 social crop with a ?v= cache-buster, got ${meta.image}`
  );
  assert.match(meta.image, /\?v=[0-9a-f]{8,}$/, "the ?v= token is a content hash");
  const article = meta.jsonLd["@graph"].find((n) => n["@type"] === "Article");
  assert.equal(article.headline, a.title);
  assert.equal(article.datePublished, a.date);
  assert.equal(article.dateModified, a.date);
});

// ---- og:image is a per-article 1200x630 social crop ------------------------

test("og:image is a per-article 1200x630 social crop, not the raw cover", async () => {
  // The default share image (home / list / 404) is genuinely 1200x630. Its
  // dimensions come from the server's own JPEG header parser (computePageMeta
  // reads the real file), so this also locks the file's existence.
  const homeMeta = server.computePageMeta("/");
  assert.equal(homeMeta.imageWidth, 1200);
  assert.equal(homeMeta.imageHeight, 630);

  const home = (await request(base, "/")).body.toString("utf8");
  assert.match(home, /<meta property="og:image" content="[^"]*\/og-image\.jpg/);
  assert.match(home, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(home, /<meta property="og:image:height" content="630" \/>/);

  // The article's og:image is its dedicated 1200x630 social crop (cover-og.jpg),
  // never the multi-megabyte raw cover and never the default share image.
  const article = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  assert.match(
    article,
    new RegExp(`<meta property="og:image" content="${SITE.url}/news/${ARTICLE}/cover-og\\.jpg\\?v=`)
  );
  assert.match(article, /<meta property="og:image:width" content="1200" \/>/);
  assert.match(article, /<meta property="og:image:height" content="630" \/>/);
  assert.ok(
    !article.includes(`/news/${ARTICLE}/cover.jpg`),
    "article shell must not reference the raw cover as a share image"
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

// ---- robots directive + no-JS fallback on every route ----------------------

test("indexable routes carry the image-preview robots directive and a noscript fallback", async () => {
  for (const p of ["/", "/news", "/publications", `/news/${ARTICLE}`]) {
    const html = (await request(base, p)).body.toString("utf8");
    assert.match(
      html,
      /<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" \/>/,
      `${p}: robots directive`
    );
    const noscript = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
    assert.ok(noscript, `${p}: has a <noscript> fallback`);
    assert.match(noscript[1], /href="\/news"/, `${p}: noscript links to /news`);
    assert.match(noscript[1], /href="\/publications"/, `${p}: noscript links to /publications`);
  }
});

// The not-found page must NOT ask to be indexed (it is served with HTTP 404),
// and it must emit no JSON-LD block at all — an empty ld+json script is invalid
// JSON that structured-data validators reject.
test("the 404 route is noindex and emits no empty JSON-LD block", async () => {
  const res = await request(base, "/no-such-page");
  assert.equal(res.status, 404, "unknown route must be HTTP 404");
  const html = res.body.toString("utf8");
  assert.match(html, /<meta name="robots" content="noindex,follow" \/>/, "404 must be noindex");
  assert.ok(
    !/<meta name="robots" content="index,follow/.test(html),
    "404 must not carry the index directive"
  );
  assert.ok(
    !/<script type="application\/ld\+json">\s*<\/script>/.test(html),
    "404 must not emit an empty ld+json block"
  );
  assert.ok(!html.includes('type="application/ld+json"'), "404 emits no JSON-LD at all");
});

// ---- Crawler view (JS disabled): server HTML carries full meta -------------

test("article served HTML carries title/canonical/JSON-LD without JS", async () => {
  const html = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  assert.match(html, /<title>Third Best Paper Award at IEEE PESS 2025 - Lampros Konstantellos<\/title>/);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE.url}/news/${ARTICLE}"`));
  assert.match(html, /<meta property="og:type" content="article"/);
  assert.ok(html.includes('"@type":"Article"'), "Article JSON-LD present in raw HTML");
});
