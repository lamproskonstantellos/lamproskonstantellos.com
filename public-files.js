/* ============================================================
   public-files.js — the declared PUBLIC root surface
   ------------------------------------------------------------
   The repo root is the document root, so the public surface is
   declared explicitly and everything else is private BY DEFAULT.
   One leaf module with no dependencies, consumed by:
     - server.js               isPrivatePath allowlist
     - build-static.js         what ships into build/
     - scripts/optimize-images.js  which root images get NO variants
   (optimize-images used to require the whole server for one list,
   inheriting its startup work and article diagnostics.)

   Publishing a new root file is a single edit here that updates
   the served surface and the deploy together.
   ============================================================ */

"use strict";

// Root files served (and copied to the build) verbatim:
const ROOT_PLAIN_FILES = [
  "styles.css",
  "site.config.js",
  "routes.js",
  "article-schema.js",
  "ui-helpers.js",
  "data.js",
  "site.webmanifest",
  "robots.txt",
  "favicon.ico",
  // The header CV chip's target (site.config.js cvPath).
  "lampros-konstantellos-cv.pdf",
  // IndexNow ownership proof: the key file must be served at the site root
  // (.github/workflows/indexnow.yml POSTs the sitemap URLs with this key on
  // every push to main so Bing/Yandex/etc. re-crawl immediately). The key is
  // public BY DESIGN — serving it is what proves domain ownership. Invariant
  // (locked by consistency.test.js): filename == file contents == the KEY
  // constant in indexnow.yml.
  "4f944816acc54986697c161e20f28a2d.txt",
];

// Root images in two classes with different pipelines:
// - BRAND images (favicons, app icons, the og:image card) render at fixed
//   sizes via <link>/manifest/og tags — nothing references responsive
//   variants for them, so optimize-images skips them and neither the server
//   nor the build advertises variant paths.
// - PICTURE images go through <Picture>/preload srcsets and ship with their
//   optimize-images siblings (.webp/.avif plus the -480/-960 widths).
const ROOT_BRAND_IMAGES = [
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "favicon-64x64.png",
  "favicon-96x96.png",
  "favicon-128x128.png",
  "icon-192.png",
  "icon-256.png",
  "icon-512.png",
  // Maskable variant (safe-zone padding baked in) for Android/Chromium
  // adaptive icons — an "any"-only set gets letterboxed on the home screen.
  "icon-512-maskable.png",
  "apple-touch-icon.png",
  "og-image.jpg",
];
const ROOT_PICTURE_IMAGES = [
  "lampros-konstantellos-picture.jpg",
];

module.exports = { ROOT_PLAIN_FILES, ROOT_BRAND_IMAGES, ROOT_PICTURE_IMAGES };
