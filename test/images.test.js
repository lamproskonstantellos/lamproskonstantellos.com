"use strict";

// Performance & build pipeline: every Picture-referenced image has its built
// AVIF/WebP siblings (the cold-build edge — the siblings are gitignored and
// regenerated), compression is correct and the LCP preload is the real asset.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { start, stop, request } = require("./helper");
const SITE = require("../site.config.js");
const server = require("../server.js");

const ROOT = path.join(__dirname, "..");
let base;
before(async () => { ({ base } = await start()); });
after(async () => { await stop(); });

// Collect every image the <Picture> component will render: hero + each
// article's cover and photos (a photo is a string or { src }).
function pictureSources() {
  const srcs = [SITE.heroImage.replace(/^\//, "")];
  for (const slug of server.discoverArticleSlugs()) {
    const a = server.loadArticleMeta(slug);
    if (!a) continue;
    if (a.cover) srcs.push(a.cover);
    for (const p of a.photos || []) srcs.push(typeof p === "string" ? p : p.src);
  }
  return srcs;
}

test("every Picture-referenced JPG/PNG has built .avif and .webp siblings (full + width variants)", () => {
  const { IMAGE_WIDTH_VARIANTS } = require("../ui-helpers.js");
  const missing = [];
  for (const src of pictureSources()) {
    if (!/\.(jpe?g|png)$/i.test(src)) continue;
    const base = src.replace(/\.(jpe?g|png)$/i, "");
    for (const ext of [".avif", ".webp"]) {
      // The full-size variant plus every width the srcset descriptors promise.
      const suffixes = [""].concat(IMAGE_WIDTH_VARIANTS.map((w) => `-${w}`));
      for (const suffix of suffixes) {
        const p = path.join(ROOT, base + suffix + ext);
        if (!fs.existsSync(p)) missing.push(base + suffix + ext);
      }
    }
  }
  assert.deepEqual(missing, [], `missing optimized siblings: ${missing.join(", ")}`);
});

test("width variants are real files at their promised widths", () => {
  const { IMAGE_WIDTH_VARIANTS } = require("../ui-helpers.js");
  // Spot-check the hero portrait: each -<w> AVIF must decode to exactly w wide
  // (the srcset descriptor is a promise, not a hint).
  const base = SITE.heroImage.replace(/^\//, "").replace(/\.(jpe?g|png)$/i, "");
  for (const w of IMAGE_WIDTH_VARIANTS) {
    const p = path.join(ROOT, `${base}-${w}.avif`);
    const buf = fs.readFileSync(p);
    assert.equal(buf.slice(4, 12).toString("latin1"), "ftypavif", `${p} is not a valid AVIF`);
    // ispe box: width/height as 32-bit BE right after the 4-byte version/flags.
    const i = buf.indexOf(Buffer.from("ispe"));
    assert.ok(i > 0, `${p} has no ispe box`);
    assert.equal(buf.readUInt32BE(i + 8), w, `${p} is not ${w}px wide`);
  }
});

test("the home preload's imagesrcset matches the shared imageSrcset helper", async () => {
  const { imageSrcset, HERO_IMG_SIZES } = require("../ui-helpers.js");
  const html = (await request(base, "/")).body.toString("utf8");
  const m = html.match(/<link rel="preload" as="image"[^>]*imagesrcset="([^"]+)"[^>]*imagesizes="([^"]+)"/);
  assert.ok(m, "home preload missing imagesrcset/imagesizes");
  assert.equal(m[1], imageSrcset(SITE.heroImage, "avif"), "preload srcset drifted from imageSrcset()");
  assert.equal(m[2], HERO_IMG_SIZES, "preload sizes drifted from HERO_IMG_SIZES");
});

test("preloaded hero is a real, smaller AVIF (LCP win)", () => {
  const avif = path.join(ROOT, SITE.heroImage.replace(/^\//, "").replace(/\.(jpe?g|png)$/i, ".avif"));
  const jpg = path.join(ROOT, SITE.heroImage.replace(/^\//, ""));
  assert.ok(fs.existsSync(avif), "hero AVIF missing");
  const buf = fs.readFileSync(avif);
  assert.equal(buf.slice(4, 12).toString("latin1"), "ftypavif", "not a valid AVIF");
  assert.ok(buf.length < fs.statSync(jpg).size, "AVIF should be smaller than the JPG");
});

test("AVIF is served as image/avif (not octet-stream under nosniff)", async () => {
  // The hero AVIF is preloaded (as=image, type=image/avif) and offered via
  // <source type="image/avif">. Served as application/octet-stream with the
  // site's X-Content-Type-Options: nosniff, the preload is dropped and the
  // source can be refused — so the registered MIME must be image/avif.
  const avifPath = "/" + SITE.heroImage.replace(/^\//, "").replace(/\.(jpe?g|png)$/i, ".avif");
  const res = await request(base, avifPath);
  assert.equal(res.status, 200, `${avifPath} should exist after build`);
  assert.equal(res.headers["content-type"], "image/avif");
});

test("the generated feeds are compressed and round-trip (rss, feed.json)", async () => {
  for (const path of ["/rss.xml", "/feed.json"]) {
    const identity = await request(base, path);
    const br = await request(base, path, { headers: { "Accept-Encoding": "br" } });
    assert.equal(br.headers["content-encoding"], "br", `${path} not brotli-compressed`);
    assert.equal(br.headers["vary"], "Accept-Encoding", `${path} missing Vary`);
    assert.ok(br.body.length < identity.body.length, `${path} compressed not smaller`);
    assert.ok(
      zlib.brotliDecompressSync(br.body).equals(identity.body),
      `${path} brotli payload does not round-trip`
    );
    // No Accept-Encoding → identity, byte-identical to the characterization golden.
    assert.equal(identity.headers["content-encoding"], undefined, `${path} identity has an encoding`);
  }
});

test("brotli and gzip responses round-trip to the original bytes", async () => {
  const original = fs.readFileSync(path.join(ROOT, "styles.css"));
  const br = await request(base, "/styles.css", { headers: { "Accept-Encoding": "br" } });
  assert.equal(br.headers["content-encoding"], "br");
  assert.ok(zlib.brotliDecompressSync(br.body).equals(original), "brotli payload corrupt");

  const gz = await request(base, "/styles.css", { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(gz.headers["content-encoding"], "gzip");
  assert.ok(zlib.gunzipSync(gz.body).equals(original), "gzip payload corrupt");
});

test("compression is cached: repeated requests return identical Content-Length", async () => {
  const a = await request(base, "/styles.css", { headers: { "Accept-Encoding": "br" } });
  const b = await request(base, "/styles.css", { headers: { "Accept-Encoding": "br" } });
  assert.equal(a.headers["content-length"], b.headers["content-length"]);
  assert.ok(a.body.equals(b.body), "cached compressed bytes differ");
});

test("dist bundles do not embed React (kept external via window globals)", () => {
  const manifest = require("../dist/manifest.json");
  for (const [out, info] of Object.entries(manifest.outputs)) {
    if (!info.entryPoint) continue;
    const code = fs.readFileSync(path.join(ROOT, out), "utf8");
    // A bundled React copy would contain its dev/prod banner or scheduler text.
    assert.ok(!code.includes("react.production.min"), `${out} appears to embed React`);
    assert.ok(code.length < 50000, `${out} unexpectedly large (${code.length}b)`);
  }
});

test("optimize-images is idempotent and tolerates per-image failure", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts/optimize-images.js"), "utf8");
  // Skips work when siblings are newer than source (idempotence).
  assert.ok(/mtimeMs\s*>=\s*srcMtime/.test(src), "missing freshness/idempotence check");
  // One bad image is logged and skipped, not fatal.
  assert.ok(/catch\s*\(e\)\s*\{[\s\S]*console\.error/.test(src), "per-image failure not caught");
});
