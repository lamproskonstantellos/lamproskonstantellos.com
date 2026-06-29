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

const SOURCE_DIRS = [".", "news"];
const EXTENSIONS = [".jpg", ".jpeg", ".png"];
const SKIP_DIRS = new Set(["node_modules", "dist", ".git", "vendor", "scripts"]);
const WEBP_QUALITY = 80;
const AVIF_QUALITY = 65;

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
  await sharp(srcPath).webp({ quality: WEBP_QUALITY }).toFile(webp);
  await sharp(srcPath).avif({ quality: AVIF_QUALITY }).toFile(avif);
  return true;
}

(async () => {
  let processed = 0;
  for (const dir of SOURCE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      try {
        if (await optimize(file)) processed++;
      } catch (e) {
        console.error(`Failed ${file}: ${e.message}`);
      }
    }
  }
  console.log(`Image optimization complete (${processed} processed).`);
})();
