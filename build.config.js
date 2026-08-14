/* ============================================================
   build.config.js — single source of truth for the esbuild step
   ------------------------------------------------------------
   The entry-point list and compile options used by:
     - scripts/build.js      (npm run build / npm run watch)
     - test/build.test.js    (determinism check)
   One list: the three hand-maintained copies (build script, watch
   script, test) could drift — a component added to one but not the
   others built fine locally while the watch or the determinism
   guarantee silently covered a different set.

   Node-only (require) — never loaded in the browser.
   ============================================================ */

"use strict";

const ENTRY_POINTS = [
  "app.jsx",
  "icons.jsx",
  "components/shared.jsx",
  "components/about.jsx",
  "components/publications.jsx",
  "components/news.jsx",
  "components/picture.jsx",
];

// Options shared verbatim between the real build and the determinism test.
// minify is the one intentional difference between build (true) and watch
// (false) — pass it explicitly.
function esbuildOptions({ minify }) {
  return {
    entryPoints: ENTRY_POINTS,
    outdir: "dist",
    entryNames: "[dir]/[name]-[hash]",
    loader: { ".jsx": "jsx" },
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    target: "es2020",
    minify,
    metafile: true,
  };
}

module.exports = { ENTRY_POINTS, esbuildOptions };
