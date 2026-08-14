"use strict";

// SEO / meta / feed correctness against the relevant specs, plus route
// status/canonical truth: every route must serve the status its metadata
// claims (200 with a self-canonical, or 404 with noindex and no canonical).

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

// ---- SEO2: unknown route is 404, noindex, no canonical, non-reflecting -----

test("unknown route: 404 + noindex, no canonical, og:url points at home", async () => {
  const res = await request(base, "/no-such-page");
  assert.equal(res.status, 404);
  const html = res.body.toString("utf8");
  // noindex plus a canonical to a DIFFERENT URL is a conflicting-signal
  // anti-pattern (the noindex can consolidate onto the canonical target), so
  // the 404 page must emit no rel=canonical at all.
  assert.ok(!html.includes('rel="canonical"'), "404 must not emit a canonical");
  assert.match(html, /<meta name="robots" content="noindex,follow"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/lamproskonstantellos\.com\/"/);
  assert.ok(!html.includes("no-such-page"), "404 must not reflect the requested path");
});

// ---- Trailing-slash policy: 301 to the slash-less canonical form -----------
// Mirrors Cloudflare Pages, which 308s /foo/ → /foo for the flat foo.html
// layout — the dev server used to answer 200 with duplicate content here.

test("trailing-slash URLs redirect to the slash-less form", async () => {
  for (const [from, to] of [
    ["/news/", "/news"],
    ["/publications/", "/publications"],
    [`/news/${ARTICLE}/`, `/news/${ARTICLE}`],
  ]) {
    const res = await request(base, from);
    assert.equal(res.status, 301, `${from} should 301`);
    assert.equal(res.headers["location"], to, `${from} should point at ${to}`);
  }
  // The root itself is NOT redirected.
  assert.equal((await request(base, "/")).status, 200);
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

test("home JSON-LD Person sameAs is socialLinks minus search URLs", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(block)["@graph"];
  const person = graph.find((n) => n["@type"] === "ProfilePage").mainEntity;
  assert.equal(person["@type"], "Person");
  // sameAs must hold IDENTITY URLs. The Zenodo entry in socialLinks is a
  // paginated full-text search (fine on the contact row, wrong as an identity
  // claim), so search URLs are filtered out of the schema.
  const identityLinks = SITE.socialLinks.filter((u) => !u.includes("/search?"));
  assert.deepEqual(person.sameAs, identityLinks, "sameAs drifted from socialLinks");
  assert.ok(person.sameAs.every((u) => !u.includes("/search?")), "search URL leaked into sameAs");
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
  const today = new Date().toISOString().slice(0, 10);
  for (const [, d] of xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/, `bad lastmod: ${d}`);
    // A lastmod that hasn't happened yet (e.g. leaked from a future
    // journal-issue year) would make search engines distrust the sitemap.
    assert.ok(d <= today, `future lastmod: ${d}`);
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
    // The fallback promises only what actually works without JavaScript: the
    // feeds. The HTML routes render an empty #root, so linking them would
    // send a JS-off visitor in a circle.
    assert.match(noscript[1], /href="\/rss\.xml"/, `${p}: noscript links to the RSS feed`);
    assert.match(noscript[1], /href="\/feed\.json"/, `${p}: noscript links to the JSON feed`);
    assert.ok(!/href="\/news"/.test(noscript[1]), `${p}: noscript must not promise the JS-only /news route`);
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

// ---- seoDescription override (the branch 6 of 9 articles ship through) ------

test("an article with seoDescription uses it for the meta description", async () => {
  const slug = "intersolar-europe-2026";
  const a = server.loadArticleMeta(slug);
  assert.ok(a && a.seoDescription, "fixture article must carry seoDescription");
  const meta = server.computePageMeta(`/news/${slug}`);
  assert.equal(meta.description, a.seoDescription);
  assert.notEqual(meta.description, a.excerpt);
  assert.ok(a.seoDescription.length <= 160, "seoDescription should fit the SERP snippet window");
});

// ---- robots.txt --------------------------------------------------------------

test("robots.txt advertises the real sitemap URL", async () => {
  const body = (await request(base, "/robots.txt")).body.toString("utf8");
  assert.ok(
    body.split("\n").some((l) => l.trim() === `Sitemap: ${SITE.url}/sitemap.xml`),
    "robots.txt Sitemap line must match SITE.url (it is hardcoded and drifts silently)"
  );
});

// ---- Web manifest ------------------------------------------------------------

test("site.webmanifest: identity, theme colors and icons are real", async () => {
  const mani = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "site.webmanifest"), "utf8"));
  assert.equal(mani.name, SITE.name);
  // Without an explicit id the app identity derives from start_url and any
  // future start_url change reads as a brand-new app.
  assert.equal(mani.id, "/");
  // Android/Chromium letterboxes an "any"-only icon set inside the adaptive
  // mask; at least one maskable icon must be declared.
  assert.ok(mani.icons.some((i) => i.purpose === "maskable"), "no maskable icon declared");
  // theme_color matches the light-theme <meta name="theme-color"> in the shell.
  const shell = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const light = shell.match(/<meta name="theme-color" content="([^"]+)" \/>/)[1];
  assert.equal(mani.theme_color, light);
  // Every declared PNG icon exists on disk (the SVG too).
  for (const icon of mani.icons) {
    const p = path.join(__dirname, "..", icon.src.replace(/^\//, ""));
    assert.ok(fs.existsSync(p), `${icon.src} declared in manifest but missing on disk`);
  }
});

// ---- og:title vs <title> ------------------------------------------------------

test("og:title is the bare headline; <title> keeps the site-name suffix", async () => {
  const html = (await request(base, `/news/${ARTICLE}`)).body.toString("utf8");
  assert.match(html, /<meta property="og:title" content="Third Best Paper Award at IEEE PESS 2025" \/>/);
  assert.match(html, /<meta name="twitter:title" content="Third Best Paper Award at IEEE PESS 2025" \/>/);
  assert.match(html, /<title>Third Best Paper Award at IEEE PESS 2025 - Lampros Konstantellos<\/title>/);
  // Lists and home carry og:type website plus their own social titles.
  const news = (await request(base, "/news")).body.toString("utf8");
  assert.match(news, /<meta property="og:type" content="website"/);
  assert.match(news, /<meta property="og:title" content="News" \/>/);
  // Home's og:title is the JOB TITLE: og:site_name already renders the name
  // as its own card line, so name-as-og:title printed it twice.
  const home = (await request(base, "/")).body.toString("utf8");
  assert.match(home, /<meta property="og:title" content="Electrical &amp; Computer Engineer" \/>/);
  const siteName = home.match(/<meta property="og:site_name" content="([^"]+)"/)[1];
  const ogTitle = home.match(/<meta property="og:title" content="([^"]+)"/)[1];
  assert.notEqual(ogTitle, siteName, "home og:title must not duplicate og:site_name");
});

// ---- Sitemap loc set exactness ----------------------------------------------

test("sitemap <loc> set is exactly the three pages plus every valid article", async () => {
  const xml = (await request(base, "/sitemap.xml")).body.toString("utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
  const expected = [
    `${SITE.url}/`,
    `${SITE.url}/news`,
    `${SITE.url}/publications`,
    ...server.VALID_ARTICLE_SLUGS.map((s) => `${SITE.url}/news/${s}`),
  ].sort();
  assert.deepEqual(locs, expected, "sitemap loc set has orphans or omissions");
});

// ---- /publications structured data ------------------------------------------

test("/publications emits a typed ItemList with DOIs and full author lists", async () => {
  const html = (await request(base, "/publications")).body.toString("utf8");
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(block.replace(/\\u003c/g, "<"))["@graph"];
  const list = graph.find((n) => n["@type"] === "ItemList");
  assert.ok(list, "no ItemList on /publications");
  assert.ok(list.itemListElement.length >= 5, "ItemList missing entries");
  const doi = list.itemListElement
    .map((e) => e.item.identifier && e.item.identifier.value)
    .filter(Boolean);
  assert.ok(doi.includes("10.30420/566656006"), "IEEE PESS DOI missing from ItemList");
  // Registrant/suffix shape and NO trailing punctuation of any kind — a
  // comma- or paren-suffixed capture 404s at doi.org.
  assert.ok(
    doi.every((d) => /^10\.\d{4,9}\/\S+$/.test(d) && !/[.,;)\]]$/.test(d)),
    "malformed DOI in ItemList"
  );
  // Co-authored papers carry their FULL author list (sole-author nodes
  // contradicted the visible page and the DOI registration), and the
  // non-peer-reviewed entries are typed by their category, not as articles.
  const pess = list.itemListElement.find(
    (e) => e.item.identifier && e.item.identifier.value === "10.30420/566656006"
  ).item;
  assert.equal(pess["@type"], "ScholarlyArticle");
  assert.ok(Array.isArray(pess.author) && pess.author.length === 5, "PESS paper has 5 authors");
  const types = list.itemListElement.map((e) => e.item["@type"]);
  assert.ok(types.includes("Thesis"), "Master's thesis must be typed Thesis");
  assert.ok(types.includes("Report"), "internship report must be typed Report");
});
