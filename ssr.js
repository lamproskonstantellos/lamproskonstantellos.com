/* ============================================================
   ssr.js — Node-side pre-render of the React app
   ------------------------------------------------------------
   Renders <App /> to the HTML string that renderHtml injects
   into <div id="root"> — so the served/built pages carry their
   full visible content, not just <head> metadata. Crawlers that
   do not execute JavaScript (Bing inconsistently, most AI/LLM
   crawlers), reader modes and JS-off visitors all see the real
   page; the client bundle hydrates the same markup and the SPA
   behaves exactly as before.

   HOW: the browser bundles resolve their dependencies as bare
   globals on window (React, SITE, Picture, …), so they are
   executed inside a `vm` context whose global object doubles as
   `window` — the same resolution rules a browser applies. React
   itself is the npm package (pinned to the exact version of the
   vendored UMD bundles) because renderToString's hook dispatcher
   must belong to the SAME React instance the components call.

   Consumed by server.js (lazily, rebuilt when the watch asset
   map changes) and — through server.js's renderHtml — by
   build-static.js. Node-only; never shipped.
   ============================================================ */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const React = require("react");
const { renderToString } = require("react-dom/server");

const ROOT = __dirname;

// The plain browser globals index.html loads before the bundles, in order.
const GLOBAL_SCRIPTS = [
  "site.config.js",
  "routes.js",
  "article-schema.js",
  "ui-helpers.js",
  "data.js",
];

// The compiled bundles in index.html's load order (logical asset-map keys).
const BUNDLE_ORDER = [
  "icons",
  "components/shared",
  "components/picture",
  "components/about",
  "components/publications",
  "components/news",
  "app",
];

// Build a renderer over the CURRENT compiled bundles. assetMap is the
// esbuild manifest mapping ("app" → "/dist/app-<hash>.js"); articleSlugs are
// the validated slugs whose article.js files should be loaded (the same set
// the server routes on). Throws when the bundles are missing — callers treat
// that as "SSR unavailable" and serve an empty #root (the client bundle
// falls back to a fresh render).
function createSsrRenderer({ assetMap, articleSlugs }) {
  const sandbox = {
    console,
    React,
    // Minimal environment the code reads during RENDER. Effects and event
    // handlers never run here, so the richer browser APIs (document,
    // matchMedia, IntersectionObserver, navigator, …) stay undefined — and
    // the components are written to tolerate exactly that.
    location: { pathname: "/", search: "", hash: "" },
    history: { state: null },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);

  const runFile = (rel) => {
    const abs = path.join(ROOT, rel.replace(/^\//, ""));
    vm.runInContext(fs.readFileSync(abs, "utf8"), context, { filename: rel });
  };

  for (const rel of GLOBAL_SCRIPTS) runFile(rel);
  for (const slug of articleSlugs || []) runFile(`news/${slug}/article.js`);
  for (const key of BUNDLE_ORDER) {
    const rel = assetMap && assetMap[key];
    if (!rel) {
      throw new Error(`missing compiled bundle for "${key}" — run npm run build first`);
    }
    runFile(rel);
  }
  if (typeof sandbox.App !== "function") {
    throw new Error("app bundle did not expose window.App");
  }

  // One render per distinct VIEW, cached: the route set is finite (three
  // pages + one per article + the shared not-found view), and every unknown
  // path renders the identical not-found markup.
  const cache = new Map();
  const keyFor = (pathname) => {
    const route = sandbox.parseRoute(String(pathname || "/"));
    if (route.page === "article") {
      // Unknown slugs all render the same "Article not found" view.
      return sandbox.getArticle(route.slug) ? `article:${route.slug}` : "article:__unknown__";
    }
    return route.page;
  };

  function renderApp(pathname) {
    const key = keyFor(pathname);
    if (cache.has(key)) return cache.get(key);
    sandbox.location.pathname = String(pathname || "/");
    sandbox.history.state = null;
    const html = renderToString(React.createElement(sandbox.App));
    cache.set(key, html);
    return html;
  }

  return { renderApp };
}

// GLOBAL_SCRIPTS / BUNDLE_ORDER are exported for the server's SSR-input
// freshness check and for the consistency test that locks them against
// index.html's actual <script> order (a drifted copy here would leave a
// component undefined in the sandbox and blank every page's #root).
module.exports = { createSsrRenderer, GLOBAL_SCRIPTS, BUNDLE_ORDER };
