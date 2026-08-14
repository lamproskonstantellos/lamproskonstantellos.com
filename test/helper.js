"use strict";

// Test helper: boot the real server.js handler on an ephemeral port and expose
// a tiny fetch-like client. Uses the exported `server` (require does not call
// listen), so we drive the exact production request handler.

const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const { server } = require("../server.js");

const GOLDEN_DIR = path.join(__dirname, "golden");

// Content-hashed dist names and the per-boot ?v= cache-buster are not stable
// across builds/boots, so mask them before snapshotting structure.
function normalizeHtml(s) {
  return String(s)
    .replace(/(\/dist\/[^"?]*?)-[A-Z0-9]{8}(\.js)/g, "$1-HASH$2")
    .replace(/\?v=[^"'&\s]*/g, "?v=V");
}

// Compare `actual` against test/golden/<name>. UPDATE_GOLDEN=1 (re)writes the
// golden; otherwise a MISSING golden is a hard failure — silently creating it
// would turn a byte-equality assertion into an unconditional pass whenever a
// fixture is deleted or never committed.
function matchGolden(name, actual) {
  const file = path.join(GOLDEN_DIR, name);
  fs.mkdirSync(GOLDEN_DIR, { recursive: true });
  if (process.env.UPDATE_GOLDEN) {
    fs.writeFileSync(file, actual);
    return;
  }
  assert.ok(
    fs.existsSync(file),
    `golden "${name}" is missing — run UPDATE_GOLDEN=1 npm test to create it`
  );
  const expected = fs.readFileSync(file, "utf8");
  assert.strictEqual(
    actual,
    expected,
    `golden mismatch: ${name} — run UPDATE_GOLDEN=1 to refresh after a DELIBERATE change`
  );
}

// Evaluate data.js (a browser-global script, not a module) against a stub
// window carrying exactly the globals it depends on. ONE copy here: four test
// files used to inline their own stub, and each new data.js dependency broke
// three of them in confusing ways.
function loadDataWindow() {
  const schema = require("../article-schema.js");
  const code = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");
  const window = {
    SITE: require("../site.config.js"),
    validateArticle: schema.validateArticle,
    compareByDateDesc: schema.compareByDateDesc,
  };
  // eslint-disable-next-line no-new-func
  new Function("window", code)(window);
  return window;
}

let listening = null;

function start() {
  if (listening) return listening;
  listening = new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ port, base: `http://127.0.0.1:${port}` });
    });
  });
  return listening;
}

function stop() {
  return new Promise((resolve) => server.close(resolve));
}

// Minimal HTTP client. `path` is sent raw (no normalization) so we can test
// hostile inputs like "/%zz" or "/../x". Returns { status, headers, body }.
function request(base, path, opts = {}) {
  const url = new URL(base);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: url.hostname,
        port: url.port,
        method: opts.method || "GET",
        path,
        headers: opts.headers || {},
        // Fresh socket per request: avoids keep-alive pool desync when a test
        // mixes HEAD / 204 / error responses with normal ones.
        agent: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          })
        );
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Send a fully hand-rolled raw request over a socket so we can supply a
// malformed Host header (or any byte sequence) that the http.request API
// would otherwise reject before it ever reaches the server.
function rawRequest(port, raw) {
  const net = require("net");
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, "127.0.0.1", () => socket.write(raw));
    const chunks = [];
    socket.on("data", (c) => chunks.push(c));
    socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    socket.on("error", reject);
    socket.setTimeout(2000, () => {
      socket.destroy();
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
  });
}

module.exports = { start, stop, request, rawRequest, normalizeHtml, matchGolden, loadDataWindow };
