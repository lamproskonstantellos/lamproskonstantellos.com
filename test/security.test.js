"use strict";

// Security & availability: hostile requests must get a clean status code and
// must never crash the process. Each case below crashed or could corrupt
// output before the Phase 3 fixes (proven in scratch/).

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const { start, stop, request, rawRequest } = require("./helper");

let base, port;
before(async () => { ({ base, port } = await start()); });
after(async () => { await stop(); });

// ---- B1: invalid percent-encoding no longer crashes -------------------------

test("invalid %-encoding returns 400 and keeps the server up", async () => {
  const bad = await request(base, "/%zz");
  assert.equal(bad.status, 400);
  const ok = await request(base, "/");
  assert.equal(ok.status, 200, "server must survive a bad-encoding request");
});

test("NUL byte (%00) returns 400, server survives", async () => {
  const res = await request(base, "/%00");
  assert.equal(res.status, 400);
  assert.equal((await request(base, "/")).status, 200);
});

// ---- B2: malformed / missing Host no longer crashes -------------------------

test("malformed Host header does not crash the server", async () => {
  const raw = await rawRequest(port, "GET / HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n");
  assert.match(raw, /^HTTP\/1\.1 200/, "should answer 200 despite bad Host");
  assert.equal((await request(base, "/")).status, 200);
});

test("absent Host header still serves", async () => {
  const raw = await rawRequest(port, "GET / HTTP/1.0\r\n\r\n");
  assert.match(raw, /^HTTP\/1\.[01] 200/);
});

// ---- Method policy ----------------------------------------------------------

test("method policy: GET/HEAD ok, OPTIONS 204, others 405", async () => {
  assert.equal((await request(base, "/", { method: "GET" })).status, 200);

  const head = await request(base, "/", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0, "HEAD must not send a body");

  const opt = await request(base, "/", { method: "OPTIONS" });
  assert.equal(opt.status, 204);
  assert.equal(opt.headers["allow"], "GET, HEAD, OPTIONS");

  for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
    const res = await request(base, "/", { method: m });
    assert.equal(res.status, 405, `${m} should be 405`);
    assert.equal(res.headers["allow"], "GET, HEAD, OPTIONS");
  }
});

// ---- Path traversal corpus --------------------------------------------------

test("traversal attempts never disclose files outside the site", async () => {
  const corpus = [
    "/../server.js",
    "/../../etc/passwd",
    "/%2e%2e%2f%2e%2e%2fetc%2fpasswd",
    "/..%2f..%2fserver.js",
    "/news/../../server.js",
    "/.git/config",
    "/%2e%2e/%2e%2e/package.json",
  ];
  for (const p of corpus) {
    const res = await request(base, p);
    assert.ok([400, 403, 404].includes(res.status), `${p} -> ${res.status} (must be blocked)`);
    assert.ok(!res.body.toString("utf8").includes("PUBLIC_DIR"), `${p} leaked server.js`);
    assert.ok(!res.body.toString("utf8").includes("root:x:0:0"), `${p} leaked /etc/passwd`);
  }
});

// Encoded traversals that NORMALIZE BACK ONTO a private file inside the root
// (not merely escaping it) must still be denied: the denylist check runs on the
// path AFTER "." / ".." collapse, so "/news/..%2fserver.js" -> "/server.js" is
// blocked. Before the fix these returned 200 with the file contents because
// isPrivatePath saw the un-normalized "/news/../server.js".
test("encoded traversal that re-enters the root onto a private file is blocked", async () => {
  const corpus = [
    "/news/..%2fserver.js",
    "/news/..%2fpackage.json",
    "/news/..%2f.git%2fconfig",
    "/news/..%2f.git%2fHEAD",
    "/news/..%2fdist%2fmanifest.json",
    "/news/..%2fREADME.md",
    "/news/..%2ftest%2funit.test.js",
    "/news/..%2fscripts%2foptimize-images.js",
  ];
  for (const p of corpus) {
    const res = await request(base, p);
    assert.equal(res.status, 404, `${p} -> ${res.status} (private file must 404)`);
    const body = res.body.toString("utf8");
    assert.ok(!body.includes("require("), `${p} leaked JS source`);
    assert.ok(!body.includes("\"name\":"), `${p} leaked JSON config`);
  }
});

test("sibling-directory prefix cannot escape the public root", async () => {
  // path.join(PUBLIC_DIR, "/../<dir>-x") would startWith(PUBLIC_DIR) under the
  // old check; the trailing-separator check rejects it.
  const res = await request(base, "/..%2flamproskonstantellos-secrets%2fx");
  assert.ok([400, 403, 404].includes(res.status));
});

// ---- Oversized / odd inputs -------------------------------------------------

test("very long URL does not crash", async () => {
  const res = await request(base, "/" + "a".repeat(10000));
  assert.equal(res.status, 404);
  assert.equal((await request(base, "/")).status, 200);
});

// ---- A1: $-pattern injection through article-like meta ----------------------
// The template injection is locked in injection.test.js against a live hostile
// article; here we assert the served home page is structurally intact.
test("served HTML has exactly one <title> and no leftover placeholder", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  assert.equal((html.match(/<title>/g) || []).length, 1);
  assert.ok(!html.includes("__META_"), "no unreplaced meta placeholder");
});

// ---- Compression negotiation safety ----------------------------------------

test("HEAD with brotli sets encoding but sends no body", async () => {
  const res = await request(base, "/styles.css", {
    method: "HEAD",
    headers: { "Accept-Encoding": "br" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-encoding"], "br");
  assert.equal(res.body.length, 0);
});

// ---- Object.prototype keys as slugs -----------------------------------------
// ARTICLE_META & friends are looked up by the URL slug; on a plain object
// literal ["__proto__"] / ["constructor"] return truthy INHERITED values, which
// sent these URLs through the article meta branch: index-robots, a canonical of
// /news/undefined, and a full Article JSON-LD block on a 404 response.
test("Object.prototype keys are not article slugs", async () => {
  for (const slug of ["__proto__", "constructor", "hasOwnProperty", "toString"]) {
    const res = await request(base, `/news/${slug}`);
    assert.equal(res.status, 404, `/news/${slug} must 404`);
    const html = res.body.toString("utf8");
    assert.match(html, /noindex/, `/news/${slug} must be noindex`);
    assert.ok(!html.includes("/news/undefined"), `/news/${slug} leaked undefined into meta`);
    assert.ok(!/"@type":\s*"(News)?Article"/.test(html), `/news/${slug} emitted Article JSON-LD`);
  }
});

// ---- Request-target shapes ---------------------------------------------------

// "//news" is a legal origin-form target, but new URL(target, base) parses the
// second segment as an AUTHORITY (pathname "/"), so the server answered 200
// with the home page for any //<x> URL — a request-line/content mismatch.
test("scheme-relative // request target is rejected with 400", async () => {
  for (const target of ["//news", "//evil.example/", "//x/styles.css"]) {
    const raw = await rawRequest(port, `GET ${target} HTTP/1.1\r\nHost: h\r\nConnection: close\r\n\r\n`);
    assert.match(raw, /^HTTP\/1\.1 400/, `${target} must be rejected`);
  }
});

// An encoded backslash survives the WHATWG parser and only becomes "\" after
// decodeURIComponent; the denylist compares POSIX-style while path.join uses
// platform rules, so on win32 /news/..%5Cserver.js dodged isPrivatePath yet
// resolved onto the source file. The whole class is rejected up front.
test("encoded backslash (%5C) in the path is rejected with 400", async () => {
  for (const p of ["/news/..%5Cserver.js", "/%5C%5Ch%5Cshare", "/a%5Cb.css"]) {
    const res = await request(base, p);
    assert.equal(res.status, 400, `${p} must be rejected`);
  }
});

// ---- Deny-by-default document root ------------------------------------------
// The repo root is the document root; the public surface is an explicit
// allowlist, so a NEW root file (notes, scripts, configs dropped next to the
// code) is 404 until deliberately published in ROOT_PLAIN_FILES/_IMAGE_BASES.
test("an unlisted root file is not served", async () => {
  const fs = require("fs");
  const path = require("path");
  const stray = path.join(__dirname, "..", "tmp-audit-stray.txt");
  fs.writeFileSync(stray, "should never be public");
  try {
    const res = await request(base, "/tmp-audit-stray.txt");
    assert.equal(res.status, 404, "unlisted root file must 404");
  } finally {
    fs.unlinkSync(stray);
  }
});

// ---- Symlink containment -----------------------------------------------------
// The lexical boundary check cannot see symlinks (fs follows them), so a link
// under an allowed prefix whose target is outside the root must be refused by
// the realpath re-check.
test("symlink escaping the document root is not served", async (t) => {
  const fs = require("fs");
  const path = require("path");
  const link = path.join(__dirname, "..", "vendor", "tmp-audit-link.css");
  const target = "/etc/hostname";
  if (!fs.existsSync(target)) return t.skip("no /etc/hostname on this system");
  try {
    fs.symlinkSync(target, link);
  } catch {
    return t.skip("cannot create symlinks here");
  }
  try {
    const res = await request(base, "/vendor/tmp-audit-link.css");
    assert.equal(res.status, 403, "symlink out of the root must be 403");
  } finally {
    fs.unlinkSync(link);
  }
});

// ---- CSP invariant: no inline styles ----------------------------------------
// style-src carries no 'unsafe-inline' (React's style prop writes through the
// CSSOM, which CSP does not govern), so the RENDERED markup must stay free of
// style attributes and <style> blocks — this test is what makes dropping the
// token safe to keep.
test("served HTML contains no inline style attribute or <style> block", async () => {
  for (const p of ["/", "/news", "/publications", "/news/ieee-pess-2025-best-paper-award"]) {
    const html = (await request(base, p)).body.toString("utf8");
    assert.ok(!/<style[\s>]/i.test(html), `${p} has a <style> block`);
    assert.ok(!/\sstyle="/i.test(html), `${p} has an inline style attribute`);
  }
});
