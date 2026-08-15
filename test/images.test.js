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
  // Same natural dims the browser Hero passes (site.config), so this locks
  // the preload to what <Picture> actually renders — including the real
  // full-variant width the descriptor now states.
  assert.equal(
    m[1],
    imageSrcset(SITE.heroImage, "avif", {
      width: SITE.heroImageWidth,
      height: SITE.heroImageHeight,
    }),
    "preload srcset drifted from imageSrcset()"
  );
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

// Per-entry budget for the MINIFIED app bundles. Chosen as roughly 3x today's
// largest entry (~15 KB): generous enough for organic growth, small enough
// that accidentally inlining a dependency (React is ~130 KB) trips it. Only
// meaningful for `npm run build` output — `npm run watch` skips --minify.
const MAX_ENTRY_BUNDLE_BYTES = 50000;

test("dist bundles do not embed React (kept external via window globals)", () => {
  const manifest = require("../dist/manifest.json");
  for (const [out, info] of Object.entries(manifest.outputs)) {
    if (!info.entryPoint) continue;
    const code = fs.readFileSync(path.join(ROOT, out), "utf8");
    // Marker chosen from React's actual SOURCE text (its internals handle,
    // present in every bundled copy, dev or prod). The previous marker —
    // "react.production.min" — was the vendored FILENAME, which esbuild
    // never emits into a bundle, so that assertion could not fail even with
    // React fully inlined; only the size budget below did any work.
    assert.ok(!code.includes("__SECRET_INTERNALS"), `${out} appears to embed React`);
    assert.ok(
      code.length < MAX_ENTRY_BUNDLE_BYTES,
      `${out} unexpectedly large (${code.length}b > ${MAX_ENTRY_BUNDLE_BYTES}b) — dependency inlined?`
    );
  }
});

// Behavioural check of the pipeline itself, on throwaway fixtures — asserting
// on the script's SOURCE TEXT (as before) locked variable spellings while
// missing real regressions like an inverted freshness comparison.
test("optimize-images: processes, is idempotent, and reports per-image failure", async () => {
  const os = require("node:os");
  const { run } = require("../scripts/optimize-images.js");
  const { IMAGE_WIDTH_VARIANTS } = require("../ui-helpers.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "optimg-"));
  try {
    // A real (tiny) source image plus a corrupt one.
    const sharp = require("sharp");
    const good = path.join(dir, "photo.jpg");
    await sharp({ create: { width: 8, height: 8, channels: 3, background: "#123456" } })
      .jpeg()
      .toFile(good);
    fs.writeFileSync(path.join(dir, "broken.jpg"), "not actually a jpeg");

    // First run: the good image is processed (all variants appear), the broken
    // one is counted as failed without aborting the rest.
    const first = await run([dir], { stamp: false });
    assert.equal(first.failed, 1, "corrupt image must be reported as failed");
    assert.ok(first.processed >= 1, "good image must be processed");
    for (const ext of [".webp", ".avif"]) {
      assert.ok(fs.existsSync(path.join(dir, `photo${ext}`)), `missing photo${ext}`);
      for (const w of IMAGE_WIDTH_VARIANTS) {
        assert.ok(fs.existsSync(path.join(dir, `photo-${w}${ext}`)), `missing photo-${w}${ext}`);
      }
    }

    // Second run: nothing new to do for the good image (idempotence).
    const second = await run([dir], { stamp: false });
    assert.equal(second.processed, 0, "second run must be a no-op for fresh outputs");

    // Touching the source makes it stale again.
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(good, future, future);
    const third = await run([dir], { stamp: false });
    assert.ok(third.processed >= 1, "touched source must be re-processed");

    // force:true regenerates even FRESH outputs — the settings-stamp path
    // resolves to exactly this flag, so this is what keeps "edit a quality
    // constant → everything regenerates" testable (the stamp comparison
    // itself is covered below).
    const forced = await run([dir], { stamp: false, force: true });
    assert.ok(forced.processed >= 1, "force must re-process fresh outputs");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("optimize-images: settings stamp flags a changed encoder configuration", () => {
  const { settingsChanged, STAMP_FILE, SETTINGS_KEY } = require("../scripts/optimize-images.js");
  const had = fs.existsSync(STAMP_FILE);
  const before = had ? fs.readFileSync(STAMP_FILE, "utf8") : null;
  try {
    fs.writeFileSync(STAMP_FILE, SETTINGS_KEY);
    assert.equal(settingsChanged(), false, "matching stamp must read as unchanged");
    fs.writeFileSync(STAMP_FILE, SETTINGS_KEY + "-stale");
    assert.equal(settingsChanged(), true, "mismatched stamp must force regeneration");
    fs.rmSync(STAMP_FILE);
    assert.equal(settingsChanged(), true, "missing stamp must force regeneration");
  } finally {
    if (had) fs.writeFileSync(STAMP_FILE, before);
    else fs.rmSync(STAMP_FILE, { force: true });
  }
});

// A cover.* source must additionally produce the 1200x630 social crop.
test("optimize-images: article covers get a cover-og.jpg social crop", async () => {
  const os = require("node:os");
  const { run } = require("../scripts/optimize-images.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "optimg-og-"));
  try {
    const sharp = require("sharp");
    await sharp({ create: { width: 1400, height: 1400, channels: 3, background: "#345678" } })
      .jpeg()
      .toFile(path.join(dir, "cover.jpg"));
    const { failed } = await run([dir], { stamp: false });
    assert.equal(failed, 0);
    const og = path.join(dir, "cover-og.jpg");
    assert.ok(fs.existsSync(og), "cover-og.jpg not generated");
    const meta = await sharp(og).metadata();
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 630);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
