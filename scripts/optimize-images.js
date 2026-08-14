/**
 * Image optimization pipeline.
 *
 * Walks the configured source directories, finds JPG/PNG images, and emits,
 * per image:
 *   - a capped full-size .webp and .avif sibling (max IMAGE_MAX_WIDTH px)
 *   - a -<w>.webp and -<w>.avif pair per IMAGE_WIDTH_VARIANTS width
 *   - for article covers (news/<slug>/cover.*) additionally a 1200x630
 *     smart-cropped cover-og.jpg social card
 * Brand/social assets at the repo root (favicon-*, icon-*, apple-touch-icon,
 * og-image) are copied verbatim by the build and rendered at fixed sizes, so
 * they get NO variants — nothing references them, and a 16px favicon upscaled
 * to 960px was pure dead weight in the deploy.
 *
 * Idempotent: skips images whose outputs are already newer than the source.
 * The freshness check also covers the encoder settings themselves (via a
 * settings stamp): editing a quality constant regenerates everything, where
 * the mtime check alone silently kept every stale variant.
 *
 * Run by `npm run build` before esbuild, so every deploy ships with fresh
 * optimized variants without ever committing them to git. Exits non-zero if
 * any image fails: Cloudflare Pages runs no tests, so a silent sharp failure
 * here would ship a site whose preloads and og:images 404.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
// Width variants + cap are shared with the browser's <Picture> srcset and the
// server's preload (ui-helpers.imageSrcset) so the descriptors always match
// the files this script writes.
const { IMAGE_WIDTH_VARIANTS, IMAGE_MAX_WIDTH } = require("../ui-helpers.js");
// The brand-image list (favicons/icons/og-image — rendered at fixed sizes,
// no srcset consumer) comes from server.js, the single owner of the root
// image classes, so this skip can never drift from what the server and the
// build advertise. Scoped to ROOT files only — a hypothetical
// news/<slug>/icon-something.jpg is a normal article image and keeps its
// variants.
const { ROOT_BRAND_IMAGES } = require("../server.js");
const NO_VARIANT_ROOT_FILES = new Set(ROOT_BRAND_IMAGES);

// Walking "." already covers news/ recursively.
const SOURCE_DIRS = ["."];
const EXTENSIONS = [".jpg", ".jpeg", ".png"];
// "build" (the static deploy output) and "scratch" are generated trees — never
// re-encode inside them.
const SKIP_DIRS = new Set(["node_modules", "dist", "build", "scratch", ".git", "vendor", "scripts"]);
const WEBP_QUALITY = 80;
const AVIF_QUALITY = 65;
// The widest display slot on the site is the 1100px content column, so 2200px
// (2x DPR) is the most a <picture> variant can usefully provide. Downscaling
// to that cap turns multi-thousand-pixel phone-camera originals into a
// fraction of the bytes with no visible loss anywhere they render (cards,
// article covers, the lightbox). The raw original is untouched — it stays the
// <img> fallback and the source of og:image dimensions. On top of the full
// variant, the IMAGE_WIDTH_VARIANTS widths give small slots (news cards,
// phones) candidates a fraction of even that size.
const MAX_VARIANT_SIZE = IMAGE_MAX_WIDTH;

// Per-article social share crop. og:image wants a landscape ~1.91:1 card; the
// raw covers are full-res and sometimes portrait/4:3, which social platforms
// crop badly (and the multi-MB weight slows scrapers). We derive a dedicated
// 1200x630 JPEG (cover-og.jpg) that server.js serves as the article og:image,
// keeping the full cover for the on-page <picture>. Smart-cropped (attention)
// so faces/subject survive the reframe.
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_QUALITY = 82;
const OG_SUFFIX = "-og.jpg";

// Freshness is mtime-based, which cannot see a changed encoder setting: after
// editing a quality/width constant every existing variant still looked
// "fresh" and the change was a silent no-op until the variants were deleted
// by hand. The current settings are stamped to a sidecar file; a mismatch
// forces one full regeneration pass.
const SETTINGS_KEY = JSON.stringify({
  WEBP_QUALITY,
  AVIF_QUALITY,
  MAX_VARIANT_SIZE,
  IMAGE_WIDTH_VARIANTS,
  OG_WIDTH,
  OG_HEIGHT,
  OG_QUALITY,
});
const STAMP_FILE = path.join(__dirname, "..", ".optimize-images-stamp.json");

function settingsChanged() {
  try {
    return fs.readFileSync(STAMP_FILE, "utf8") !== SETTINGS_KEY;
  } catch {
    return true;
  }
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path.join(dir, entry.name));
    } else if (EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
      yield path.join(dir, entry.name);
    }
  }
}

async function optimize(srcPath, { force = false } = {}) {
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath, path.extname(srcPath));
  const out = (suffix, ext) => path.join(dir, base + suffix + ext);
  const outputs = [["", ".webp"], ["", ".avif"]];
  for (const w of IMAGE_WIDTH_VARIANTS) outputs.push([`-${w}`, ".webp"], [`-${w}`, ".avif"]);

  const srcMtime = fs.statSync(srcPath).mtimeMs;
  const fresh = (p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= srcMtime;

  if (!force && outputs.every(([suffix, ext]) => fresh(out(suffix, ext)))) return false;

  console.log(`Optimizing ${srcPath}`);
  // Full-size variant: capped, never enlarged (its srcset descriptor may
  // overstate a small original — see ui-helpers.imageSrcset).
  const full = () =>
    sharp(srcPath).resize({
      width: MAX_VARIANT_SIZE,
      height: MAX_VARIANT_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    });
  await full().webp({ quality: WEBP_QUALITY }).toFile(out("", ".webp"));
  await full().avif({ quality: AVIF_QUALITY }).toFile(out("", ".avif"));
  // Width variants: exactly the promised width (a rare smaller-than-480px
  // original is gently upscaled rather than shipping a lying descriptor).
  for (const w of IMAGE_WIDTH_VARIANTS) {
    const sized = () => sharp(srcPath).resize({ width: w });
    await sized().webp({ quality: WEBP_QUALITY }).toFile(out(`-${w}`, ".webp"));
    await sized().avif({ quality: AVIF_QUALITY }).toFile(out(`-${w}`, ".avif"));
  }
  return true;
}

// Generate the 1200x630 og:image crop for an article cover (news/<slug>/cover.*).
// Only files whose base name is exactly "cover" get one; the crop itself is
// skipped as a source in the loop below so it is never re-cropped or turned
// into webp/avif. Idempotent via the same mtime freshness check as optimize().
async function socialCrop(srcPath, { force = false } = {}) {
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath, path.extname(srcPath));
  if (base !== "cover") return false;

  const og = path.join(dir, base + OG_SUFFIX);
  const srcMtime = fs.statSync(srcPath).mtimeMs;
  if (!force && fs.existsSync(og) && fs.statSync(og).mtimeMs >= srcMtime) return false;

  console.log(`Social crop ${srcPath} -> ${og}`);
  await sharp(srcPath)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: OG_QUALITY, mozjpeg: true })
    .toFile(og);
  return true;
}

// Process every image under `dirs`. Returns { processed, failed }; the CLI
// wrapper turns failed > 0 into a non-zero exit. `stamp: false` (tests) skips
// the settings-stamp bookkeeping so runs over fixture dirs stay independent;
// `force` overrides the freshness check outright and is a separate, testable
// knob (the stamp path resolves to exactly this flag).
async function run(dirs = SOURCE_DIRS, { stamp = true, force } = {}) {
  const effectiveForce = force !== undefined ? force : stamp ? settingsChanged() : false;
  if (effectiveForce && force === undefined) {
    console.log("Encoder settings changed — regenerating all variants.");
  }
  let processed = 0;
  let failed = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      // The generated social crop is an output, never a source; the ROOT
      // brand/social assets get no variants at all (fixed-size consumers).
      if (file.toLowerCase().endsWith(OG_SUFFIX)) continue;
      const isRootFile = !file.includes(path.sep);
      if (isRootFile && NO_VARIANT_ROOT_FILES.has(path.basename(file))) continue;
      try {
        if (await optimize(file, { force: effectiveForce })) processed++;
        if (await socialCrop(file, { force: effectiveForce })) processed++;
      } catch (e) {
        console.error(`Failed ${file}: ${e.message}`);
        failed++;
      }
    }
  }
  if (stamp && failed === 0) fs.writeFileSync(STAMP_FILE, SETTINGS_KEY);
  console.log(
    `Image optimization complete (${processed} processed${failed ? `, ${failed} FAILED` : ""}).`
  );
  return { processed, failed };
}

module.exports = { run, optimize, socialCrop, settingsChanged, STAMP_FILE, SETTINGS_KEY };

if (require.main === module) {
  run()
    .then(({ failed }) => {
      // A failed image must fail the build: Cloudflare Pages runs
      // `npm run build && npm run build:static` with no test step, so a green
      // exit here despite a sharp failure shipped a site whose hero preload
      // and article og:images 404'd.
      if (failed > 0) process.exitCode = 1;
    })
    .catch((e) => {
      // Errors OUTSIDE the per-file try (an unreadable directory, the stamp
      // write) must also fail cleanly, not as an unhandled rejection.
      console.error(e);
      process.exitCode = 1;
    });
}
