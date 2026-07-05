/**
 * Image optimization pipeline.
 *
 * Walks the configured source directories, finds JPG/PNG images, and emits
 * sibling .webp and .avif files. Idempotent: skips images whose outputs are
 * already newer than the source.
 *
 * Run by `npm run build` before esbuild, so every deploy ships with fresh
 * optimized variants without ever committing them to git.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

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
// <img> fallback and the source of og:image dimensions.
const MAX_VARIANT_SIZE = 2200;

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

async function optimize(srcPath) {
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath, path.extname(srcPath));
  const webp = path.join(dir, base + ".webp");
  const avif = path.join(dir, base + ".avif");

  const srcMtime = fs.statSync(srcPath).mtimeMs;
  const fresh = (p) => fs.existsSync(p) && fs.statSync(p).mtimeMs >= srcMtime;

  if (fresh(webp) && fresh(avif)) return false;

  console.log(`Optimizing ${srcPath}`);
  const resized = () =>
    sharp(srcPath).resize({
      width: MAX_VARIANT_SIZE,
      height: MAX_VARIANT_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    });
  await resized().webp({ quality: WEBP_QUALITY }).toFile(webp);
  await resized().avif({ quality: AVIF_QUALITY }).toFile(avif);
  return true;
}

// Generate the 1200x630 og:image crop for an article cover (news/<slug>/cover.*).
// Only files whose base name is exactly "cover" get one; the crop itself is
// skipped as a source in the loop below so it is never re-cropped or turned
// into webp/avif. Idempotent via the same mtime freshness check as optimize().
async function socialCrop(srcPath) {
  const dir = path.dirname(srcPath);
  const base = path.basename(srcPath, path.extname(srcPath));
  if (base !== "cover") return false;

  const og = path.join(dir, base + OG_SUFFIX);
  const srcMtime = fs.statSync(srcPath).mtimeMs;
  if (fs.existsSync(og) && fs.statSync(og).mtimeMs >= srcMtime) return false;

  console.log(`Social crop ${srcPath} -> ${og}`);
  await sharp(srcPath)
    .resize(OG_WIDTH, OG_HEIGHT, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: OG_QUALITY, mozjpeg: true })
    .toFile(og);
  return true;
}

(async () => {
  let processed = 0;
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      // The generated social crop is an output, never a source.
      if (file.toLowerCase().endsWith(OG_SUFFIX)) continue;
      try {
        if (await optimize(file)) processed++;
        if (await socialCrop(file)) processed++;
      } catch (e) {
        console.error(`Failed ${file}: ${e.message}`);
      }
    }
  }
  console.log(`Image optimization complete (${processed} processed).`);
})();
