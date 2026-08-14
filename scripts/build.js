"use strict";

// esbuild driver for `npm run build` (minified, one-shot) and `npm run watch`
// (unminified, incremental). Entry points and compile options come from
// build.config.js — the single list shared with test/build.test.js — so the
// build, the watch and the determinism test can never compile different sets.
//
// The metafile is written to dist/manifest.json exactly like the old CLI
// --metafile flag did: server.js watches its mtime to serve fresh hashed
// bundle names without a restart.

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const { esbuildOptions } = require("../build.config.js");

const ROOT = path.join(__dirname, "..");
const WATCH = process.argv.includes("--watch");

function writeManifest(metafile) {
  fs.mkdirSync(path.join(ROOT, "dist"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "dist", "manifest.json"), JSON.stringify(metafile));
}

(async () => {
  if (WATCH) {
    const ctx = await esbuild.context({
      absWorkingDir: ROOT,
      ...esbuildOptions({ minify: false }),
      plugins: [
        {
          name: "manifest",
          setup(build) {
            build.onEnd((result) => {
              if (result.errors.length === 0 && result.metafile) {
                writeManifest(result.metafile);
                console.log("[watch] rebuilt");
              }
            });
          },
        },
      ],
    });
    await ctx.watch();
    console.log("[watch] watching for changes…");
  } else {
    const result = await esbuild.build({
      absWorkingDir: ROOT,
      ...esbuildOptions({ minify: true }),
    });
    writeManifest(result.metafile);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
