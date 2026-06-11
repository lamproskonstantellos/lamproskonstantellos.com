"use strict";

// Build determinism: esbuild content hashing must be stable for identical
// inputs, so a redeploy without source changes does not churn asset URLs
// (which would needlessly bust caches). Runs the esbuild step only (no image
// optimization) via the JS API, twice, and compares the output name set.

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const ENTRY = [
  "app.jsx",
  "icons.jsx",
  "components/shared.jsx",
  "components/about.jsx",
  "components/publications.jsx",
  "components/news.jsx",
  "components/picture.jsx",
];

async function buildNames() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    entryPoints: ENTRY,
    outdir: "dist-determinism-check",
    entryNames: "[dir]/[name]-[hash]",
    loader: { ".jsx": "jsx" },
    jsx: "transform",
    jsxFactory: "React.createElement",
    jsxFragment: "React.Fragment",
    target: "es2020",
    minify: true,
    metafile: true,
    write: false,
  });
  return Object.keys(result.metafile.outputs).sort();
}

test("two esbuild runs produce identical hashed output names", async () => {
  const a = await buildNames();
  const b = await buildNames();
  assert.deepEqual(a, b);
  assert.equal(a.length, ENTRY.length, "one output per entry point");
  for (const name of a) {
    assert.match(name, /-[A-Z0-9]{8}\.js$/, `expected content hash in ${name}`);
  }
});
