"use strict";

// Build determinism: esbuild content hashing must be stable for identical
// inputs, so a redeploy without source changes does not churn asset URLs
// (which would needlessly bust caches). Runs the esbuild step only (no image
// optimization) via the JS API, twice, and compares the output name set.

const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const esbuild = require("esbuild");
// The SAME entry list and options the real build compiles (build.config.js) —
// a private copy here used to drift-proof nothing: the test could stay green
// while covering a different set than the one shipping.
const { ENTRY_POINTS, esbuildOptions } = require("../build.config.js");

const ROOT = path.join(__dirname, "..");

async function buildNames() {
  const result = await esbuild.build({
    absWorkingDir: ROOT,
    ...esbuildOptions({ minify: true }),
    outdir: "dist-determinism-check",
    write: false,
  });
  return Object.keys(result.metafile.outputs).sort();
}

test("two esbuild runs produce identical hashed output names", async () => {
  const a = await buildNames();
  const b = await buildNames();
  assert.deepEqual(a, b);
  assert.equal(a.length, ENTRY_POINTS.length, "one output per entry point");
  for (const name of a) {
    assert.match(name, /-[A-Z0-9]{8}\.js$/, `expected content hash in ${name}`);
  }
});
