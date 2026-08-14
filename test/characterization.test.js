"use strict";

// Golden characterization of TODAY's served output. These lock the behaviour
// that must not change accidentally; deliberate fixes update the golden in the
// same commit, with a justification in the commit message.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { start, stop, request, normalizeHtml, matchGolden } = require("./helper");

let base;
before(async () => { ({ base } = await start()); });
after(async () => { await stop(); });

// ---- Full normalized HTML per route ----------------------------------------

const HTML_ROUTES = [
  ["/", "home.html"],
  ["/news", "news.html"],
  ["/publications", "publications.html"],
  ["/news/ieee-pess-2025-best-paper-award", "article-ieee.html"],
  ["/this-route-does-not-exist", "notfound.html"],
];

for (const [routePath, golden] of HTML_ROUTES) {
  test(`HTML golden: ${routePath}`, async () => {
    const res = await request(base, routePath);
    assert.equal(res.headers["content-type"], "text/html; charset=utf-8");
    matchGolden(golden, normalizeHtml(res.body.toString("utf8")));
  });
}

// ---- Status codes -----------------------------------------------------------

test("status codes per route", async () => {
  const checks = [
    ["/", 200],
    ["/news", 200],
    ["/publications", 200],
    ["/news/ieee-pess-2025-best-paper-award", 200],
    ["/news/does-not-exist", 404],
    ["/totally-unknown", 404],
    ["/missing-asset.js", 404],
  ];
  for (const [p, expected] of checks) {
    const res = await request(base, p);
    assert.equal(res.status, expected, `${p} expected ${expected}, got ${res.status}`);
  }
});

// ---- Title per route (quick, human-readable signal) -------------------------

test("title per route", async () => {
  const titleOf = (b) => (b.toString("utf8").match(/<title>([^<]*)<\/title>/) || [])[1];
  assert.equal(titleOf((await request(base, "/")).body), "Lampros Konstantellos - Electrical &amp; Computer Engineer");
  assert.equal(titleOf((await request(base, "/news")).body), "News - Lampros Konstantellos");
  assert.equal(titleOf((await request(base, "/publications")).body), "Publications - Lampros Konstantellos");
  assert.equal(
    titleOf((await request(base, "/news/ieee-pess-2025-best-paper-award")).body),
    "Third Best Paper Award at IEEE PESS 2025 - Lampros Konstantellos"
  );
});

// ---- Feeds (deterministic) --------------------------------------------------

test("sitemap.xml golden", async () => {
  const res = await request(base, "/sitemap.xml");
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "application/xml; charset=utf-8");
  matchGolden("sitemap.xml", res.body.toString("utf8"));
});

test("rss.xml golden", async () => {
  const res = await request(base, "/rss.xml");
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "application/rss+xml; charset=utf-8");
  matchGolden("rss.xml", res.body.toString("utf8"));
});

test("feed.json golden", async () => {
  const res = await request(base, "/feed.json");
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "application/feed+json; charset=utf-8");
  matchGolden("feed.json", res.body.toString("utf8"));
});

// ---- Asset MIME + cache classes --------------------------------------------

test("asset content types and cache classes", async () => {
  const css = await request(base, "/styles.css");
  assert.equal(css.headers["content-type"], "text/css; charset=utf-8");
  assert.match(css.headers["cache-control"], /public, max-age=86400/);

  const ico = await request(base, "/favicon.ico");
  assert.equal(ico.headers["content-type"], "image/x-icon");

  const mani = await request(base, "/site.webmanifest");
  assert.equal(mani.headers["content-type"], "application/manifest+json");

  // Hashed dist asset → immutable
  const html = (await request(base, "/")).body.toString("utf8");
  const distRef = html.match(/\/dist\/app-[A-Z0-9]{8}\.js/);
  assert.ok(distRef, "expected a hashed app bundle reference in HTML");
  const appJs = await request(base, distRef[0]);
  assert.equal(appJs.status, 200);
  assert.match(appJs.headers["cache-control"], /immutable/);

  // ?v= with a token that is not the current deploy token → the daily class,
  // NOT immutable (any-?v= used to qualify, letting third parties pin
  // arbitrary cache keys for a year).
  const vcss = await request(base, "/styles.css?v=abc123");
  assert.match(vcss.headers["cache-control"], /max-age=86400/);
  assert.ok(!/immutable/.test(vcss.headers["cache-control"]));

  // HTML → no-store
  const home = await request(base, "/");
  assert.match(home.headers["cache-control"], /no-store/);
});

// ---- Security headers -------------------------------------------------------

test("security header set", async () => {
  const res = await request(base, "/");
  const picked = {};
  // Derived from the server's OWN header list, not a hardcoded copy: a
  // header ADDED to SECURITY_HEADERS is snapshotted (and locked) the moment
  // it exists — a literal name list here silently ignored new headers.
  const { SECURITY_HEADERS } = require("../server.js");
  for (const name of Object.keys(SECURITY_HEADERS)) {
    picked[name.toLowerCase()] = res.headers[name.toLowerCase()];
  }
  matchGolden("security-headers.json", JSON.stringify(picked, null, 2) + "\n");
});

// ---- Compression negotiation + Vary ----------------------------------------

test("brotli negotiation sets Content-Encoding + Vary", async () => {
  const res = await request(base, "/styles.css", { headers: { "Accept-Encoding": "br" } });
  assert.equal(res.headers["content-encoding"], "br");
  assert.equal(res.headers["vary"], "Accept-Encoding");
});

test("gzip negotiation sets Content-Encoding + Vary", async () => {
  const res = await request(base, "/styles.css", { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(res.headers["content-encoding"], "gzip");
  assert.equal(res.headers["vary"], "Accept-Encoding");
});

test("no Accept-Encoding → identity, but Vary still declares the negotiation", async () => {
  const res = await request(base, "/styles.css", { headers: { "Accept-Encoding": "" } });
  assert.equal(res.headers["content-encoding"], undefined);
  // Identity variants of compressible content must also carry Vary, or a
  // shared cache that stores this response serves it to gzip/brotli clients.
  assert.equal(res.headers["vary"], "Accept-Encoding");
});

test("a coding refused with ;q=0 is never chosen (RFC 9110)", async () => {
  const br0 = await request(base, "/styles.css", { headers: { "Accept-Encoding": "br;q=0" } });
  assert.equal(br0.headers["content-encoding"], undefined);
  const gz0 = await request(base, "/styles.css", { headers: { "Accept-Encoding": "gzip;q=0, identity" } });
  assert.equal(gz0.headers["content-encoding"], undefined);
  // A refused coding must not mask an accepted one listed after it.
  const mixed = await request(base, "/styles.css", { headers: { "Accept-Encoding": "br;q=0, gzip" } });
  assert.equal(mixed.headers["content-encoding"], "gzip");
});

test("OPTIONS answers 204 without a Content-Length (RFC 9110)", async () => {
  const res = await request(base, "/", { method: "OPTIONS" });
  assert.equal(res.status, 204);
  assert.equal(res.headers["content-length"], undefined);
  assert.equal(res.headers["allow"], "GET, HEAD, OPTIONS");
});

// ---- Private paths return 404 ----------------------------------------------

test("private paths are not served", async () => {
  for (const p of [
    "/server.js",
    "/feeds.js",
    "/build-static.js",
    "/package.json",
    "/package-lock.json",
    "/.gitignore",
    "/LICENSE",
    "/dist/manifest.json",
    "/scripts/optimize-images.js",
    "/.git/config",
    "/README.md",
    "/PUBLICATIONS.md",
    "/news/README.md",
    "/test/helper.js",
    "/test/golden/home.html",
    "/node_modules/esbuild/package.json",
    "/app.jsx",
    "/icons.jsx",
    "/components/about.jsx",
    // Generated trees and case variants (a case-insensitive dev filesystem
    // must not let /SERVER.JS bypass the lowercase denylist).
    "/build/index.html",
    "/build/_headers",
    "/scratch/notes.txt",
    "/SERVER.JS",
    "/License",
    "/Package.json",
  ]) {
    const res = await request(base, p);
    assert.equal(res.status, 404, `${p} should be 404, got ${res.status}`);
  }
});

// ---- Intended-public files still served ------------------------------------

test("intended-public files are served", async () => {
  for (const p of [
    "/site.config.js",
    "/ui-helpers.js",
    "/data.js",
    "/robots.txt",
    "/site.webmanifest",
    "/news/ieee-pess-2025-best-paper-award/article.js",
  ]) {
    const res = await request(base, p);
    assert.equal(res.status, 200, `${p} should be 200, got ${res.status}`);
  }
});

// ---- HEAD requests ----------------------------------------------------------

test("HEAD on home: 200, no body, same Content-Length as GET", async () => {
  // ([200, 404] was accepted here before — an assertion no regression short
  // of a 5xx could ever fail.)
  const res = await request(base, "/", { method: "HEAD" });
  assert.equal(res.status, 200);
  assert.equal(res.body.length, 0, "HEAD must not carry a body");
  const get = await request(base, "/");
  assert.equal(
    res.headers["content-length"],
    get.headers["content-length"],
    "HEAD must advertise the same entity length as GET"
  );
});
