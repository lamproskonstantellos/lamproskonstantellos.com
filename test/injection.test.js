"use strict";

// Template-injection (bug class A): meta values are injected with String.replace.
// A string replacement interprets $&, $`, $', $$ — so before the fix, article
// text containing those sequences corrupted the document and JSON-LD. These
// tests drive the REAL injectMeta with hostile content and assert verbatim,
// structurally-intact output.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { injectMeta, jsonLdScript } = require("../server.js");

const INDEX_HTML = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

// Every dangerous replacement-pattern token, plus </script>, quotes, emoji and
// Greek text — the edges called out in the audit brief.
const HOSTILE = `R&D $\` mid $& tail $' end $$ </script><b> "q" 'a' 😀 Ελληνικά`;

function hostileMeta() {
  return {
    title: HOSTILE,
    description: HOSTILE,
    url: "https://lamproskonstantellos.com/news/x",
    image: "https://lamproskonstantellos.com/og-image.png",
    imageAlt: HOSTILE,
    ogType: "article",
    preloadImage: null,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [{ "@type": "Article", headline: HOSTILE, description: HOSTILE }],
    },
  };
}

test("hostile meta does not corrupt document structure", () => {
  const out = injectMeta(INDEX_HTML, hostileMeta());

  // $&-expansion would re-insert the placeholder; $`/$' would duplicate
  // surrounding document text.
  assert.ok(!out.includes("__META_"), "a placeholder survived (=$& expansion)");
  assert.equal((out.match(/<title>/g) || []).length, 1, "duplicate <title> (=$` expansion)");
  // Document not duplicated by $'-expansion: structural tags appear exactly once.
  assert.equal((out.match(/<html lang="en">/g) || []).length, 1);
  assert.equal((out.match(/<\/html>/g) || []).length, 1);
  assert.equal((out.match(/<\/body>/g) || []).length, 1);
});

test("hostile title is HTML-escaped verbatim in <title>", () => {
  const out = injectMeta(INDEX_HTML, hostileMeta());
  const title = out.match(/<title>([\s\S]*?)<\/title>/)[1];
  // $-sequences appear literally (escaped), not expanded.
  assert.ok(title.includes("$&amp;"), "`$&` should survive as literal text");
  assert.ok(title.includes("$`"), "`$\\`` should survive as literal text");
  assert.ok(title.includes("$$"), "`$$` should survive as literal text");
  // </script> and angle brackets escaped.
  assert.ok(!title.includes("</script>"));
  assert.ok(title.includes("&lt;/script&gt;"));
});

test("JSON-LD remains valid JSON and cannot break out of the script tag", () => {
  const out = injectMeta(INDEX_HTML, hostileMeta());
  const block = out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(block, "ld+json block present");
  const json = block[1];
  // No raw </script> inside the JSON-LD (escaped to <).
  assert.ok(!json.includes("</script>"), "raw </script> would close the tag early");
  const parsed = JSON.parse(json); // throws if corrupted
  assert.equal(parsed["@graph"][0].headline, HOSTILE, "headline preserved verbatim");
});

test("jsonLdScript escapes <, U+2028 and U+2029", () => {
  const out = jsonLdScript({ a: "x</script>y\u2028z\u2029w" });
  assert.ok(!out.includes("</script>"));
  assert.ok(out.includes("\\u003c"));
  assert.ok(out.includes("\\u2028"));
  assert.ok(out.includes("\\u2029"));
  assert.deepEqual(JSON.parse(out), { a: "x</script>y\u2028z\u2029w" });
});
