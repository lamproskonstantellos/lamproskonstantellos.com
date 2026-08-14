# lamproskonstantellos.com

[![License: All Rights Reserved](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20.9-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Deployed on Cloudflare Pages](https://img.shields.io/badge/deployed%20on-Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=white)](https://pages.cloudflare.com/)
[![Live site](https://img.shields.io/badge/live-lamproskonstantellos.com-0a66c2)](https://lamproskonstantellos.com)

The personal website of **Lampros Konstantellos**, Electrical & Computer Engineer. A fully pre-rendered React site (static HTML per route, hydrating into a single-page application) presenting bio, publications, and articles on renewable energy, battery storage, grid flexibility, and electricity markets.

## Stack

- **Frontend:** React 18 loaded via self-hosted UMD builds (`vendor/`). JSX is compiled to plain JavaScript at build time with [esbuild](https://esbuild.github.io/); no in-browser Babel. Plain CSS. Inter is self-hosted as subsetted woff2 (`vendor/fonts/`, preloaded, `font-display: swap`); monospace falls back to the system stack — no third-party font requests.
- **Build / pre-render:** A Node build step (`build-static.js`) pre-renders every route to a static `build/` directory — the **full page body included**: `ssr.js` renders the React app per route (`react-dom/server`, pinned to the vendored React version) and the markup is baked into `#root`, so search engines, AI crawlers, reader modes and JS-off visitors see the real content; the client bundle hydrates it and the site behaves as an SPA from there. Alongside the body: per-route `<title>` / meta / Open Graph / Twitter / canonical / JSON-LD, the auto-discovered per-article scripts, `sitemap.xml` / `rss.xml` / `feed.json`, a route-independent `404.html`, and the security-header + cache rules as Cloudflare `_headers` / `_redirects`. It reuses the same `renderHtml` and `feeds.js` builders as the local preview server, so the static output is byte-identical to what `server.js` serves (proven by `test/parity.test.js`). A per-deploy version query string on local CSS/JS busts browser caches on every deploy.
- **Local preview:** The Node.js HTTP server (`server.js`, `npm start`) is retained for local preview — Node built-ins throughout, plus the pinned `react-dom/server` (the one npm runtime dependency, kept at exactly the vendored browser React's version) for the pre-render. It serves the same per-route meta and feeds at request time, with cached brotli/gzip compression, security headers + CSP, class-appropriate `Cache-Control`, and malformed-request guards (no request can crash the process).
- **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com/). Builds and deploys the static `build/` output on every git push: build command `npm run build && npm run build:static`, output directory `build`, `NODE_VERSION=22`.

## Local development

```bash
npm install
npm run build     # one-time JSX → JS compile to dist/ (also builds image siblings)
npm start         # serve at http://localhost:3000
npm test          # run the test suite (build first, so dist/ exists)
```

While editing `.jsx` files, run `npm run watch` in a second terminal; esbuild rebuilds on every save and a browser refresh shows the change.

## Static build

The site deploys to [Cloudflare Pages](https://pages.cloudflare.com/) as a fully
pre-rendered static bundle, with no runtime server.

```bash
npm run build          # optimize images + compile JSX → dist/
npm run build:static   # pre-render every route → build/
```

`build-static.js` reuses the server's `renderHtml` and `feeds.js` builders, so
every page and feed in `build/` is byte-identical to what `server.js` serves
(modulo the per-deploy `?v=` cache-buster), asserted by `test/parity.test.js`.
The `_headers` file is deploy config rather than a served body: it reproduces
the server's security-header set verbatim and adds the per-class cache rules,
and the parity suite asserts it carries every server security header and a
rule block for every HTML route. Only public assets are copied into `build/`;
source, tooling and config never are.

**Cloudflare Pages settings**

| Setting | Value |
|---------|-------|
| Build command | `npm run build && npm run build:static` |
| Build output directory | `build` |
| Environment variable | `NODE_VERSION=22` |

The Node major lives in [`.nvmrc`](./.nvmrc) (`nvm use` locally; CI reads it
via `setup-node`'s `node-version-file`). When bumping it, update the
Cloudflare Pages `NODE_VERSION` variable to match — that one cannot be read
from the repo.

## Project structure

```
.
├── app.jsx                Root React component and SPA shell (source)
├── components/            About, Publications, News (incl. Lightbox), Picture, shared UI (source)
├── icons.jsx              Inline SVG icon set (source)
├── site.config.js         Single source of truth for site identity (dual Node/browser)
├── routes.js              Route table: parseRoute / routeToPath / isValidSpaRoute / pageTitle (dual)
├── article-schema.js      Article validation + newest-first comparator (dual)
├── ui-helpers.js          Share links, scroll-spy, publication filters/grouping, hero joiner, responsive image variants (dual)
├── data.js                Profile, hero, about, publications, contact, selectors
├── PUBLICATIONS.md        Guide: adding publications (journal / conference / theses & reports)
├── styles.css             Global stylesheet
├── index.html             Single HTML entry with __META_*__ placeholders
├── feeds.js               sitemap.xml / rss.xml / feed.json builders (shared by server + build)
├── ssr.js                 Node-side React pre-render (fills #root for server + build)
├── build-static.js        Pre-render every route (full body + meta) to build/ for Cloudflare Pages
├── build.config.js        esbuild entry list + options (shared by build, watch, and tests)
├── server.js              Local preview server: per-route meta, sitemap/rss/feed, compression, security
├── public-files.js        Allowlists of the public root files/images (shared by server, static build, image pipeline)
├── scripts/               Build tooling (build.js, optimize-images.js)
├── vendor/                Self-hosted React 18 UMD builds + Inter woff2 subsets (+ license texts)
├── test/                  node:test suite + golden files (test/golden/) + browser e2e smoke
├── .github/workflows/     CI (npm ci → build → test) + IndexNow ping on deploy
├── .nvmrc                 Node major for local dev + CI (mirror it in Cloudflare's NODE_VERSION)
├── robots.txt             Search-engine directives
├── 4f9448…c2d.txt         IndexNow ownership key file (public by design; see the SEO section)
├── dist/                  Built JS (gitignored; produced by `npm run build`)
├── build/                 Static Cloudflare Pages output (gitignored; `npm run build:static`)
└── news/                  Per-article folders, each with article.js + images
```

Four modules are loaded both in the browser (as `window` globals, before
`data.js`) and in Node (via `require` from `server.js`): `site.config.js`
(site identity), `routes.js` (the route table, titles), `article-schema.js`
(article validation, sort order, and the plain-text body flattener) and
`ui-helpers.js` (share links, the scroll-spy resolver, the publications
filters/grouping, the hero joiner, and the responsive image widths/srcset
builder shared by `<Picture>`, the server preloads and the image pipeline).
Because both worlds share one definition, the client and server can never
diverge on routes, titles, validation, sort order or identity.

## Testing

```bash
npm run build && npm test
```

`node:test` boots the real `server.js` on an ephemeral port and checks served
status/headers/meta, the feeds, security and hostile-input handling,
cross-module consistency, SEO/accessibility, and the image pipeline.
A byte-parity suite (`test/parity.test.js`) additionally renders the static
`build/` and asserts every route and feed is byte-identical to what `server.js`
serves. A browser smoke suite (`test/e2e.test.js`, Playwright driving a local
Chromium/Chrome when one is available — always on CI) verifies the page
hydrates without console errors, client-side navigation keeps the head in
sync, and the site stays fully readable with JavaScript disabled. Golden
snapshots live in `test/golden/`; a deliberate output change is refreshed with
`UPDATE_GOLDEN=1 npm test`. CI runs the same `build` + `test` on every push.

## Adding content

### New article (News)

See [`news/README.md`](./news/README.md) for the complete guide — folder layout, the `article.js` template, every field (including photos, video, and the SEO fields), and validation. In short: create a folder under `news/<slug>/`, drop in `cover.jpg` and any photos, write `article.js` from the template. The build auto-discovers it and it ships on the next deploy (git push), with no edits to `data.js`, `index.html`, or any other file needed.

### New publication

See [`PUBLICATIONS.md`](./PUBLICATIONS.md) for the complete guide — the entry
template with every field explained, how entries are filed under journal
articles / conference papers / theses & reports (`kind` splits the
peer-reviewed pills, `type` drives the thesis/report badge and filter), where
and how entries render, a publishing checklist, and common mistakes. In short:
add one object to the `publications` array in [`data.js`](./data.js), newest
first — nothing else changes.

### SEO checklist for new content

- **Articles:** fill `excerpt` (and `seoDescription` when the excerpt runs past ~160 characters), `keywords` and `articleSection` for rich results, and — for the pieces with a clear subject — `topics` entries pointing `sameAs` at the canonical Wikipedia page, so engines resolve the *concept*, not the keyword string. Commit a `cover.jpg`; the build derives the 1200×630 `cover-og.jpg` social card automatically. When you materially edit a **published** article, set `dateUpdated` — it feeds `dateModified`, `article:modified_time`, the sitemap `<lastmod>` and the JSON Feed, which is what makes engines re-crawl the page. `<title>`, meta description, canonical, Open Graph/Twitter tags, `Article` JSON-LD, `sitemap.xml`, `rss.xml`, and `feed.json` all update automatically at build time. The full field-by-field guide is [`news/README.md`](./news/README.md).
- **Publications:** supply an accurate IEEE-style `citation` **ending with the DOI** (`… doi: 10.xxxx/yyyy.`) — the `/publications` page emits a `ScholarlyArticle`/`Thesis`/`Report` JSON-LD node per entry and extracts the DOI from exactly that position. Details and pitfalls in [`PUBLICATIONS.md`](./PUBLICATIONS.md).

## SEO

- Every route is pre-rendered at build time into one static HTML file — the full visible body (`ssr.js`) plus `<title>`, `<meta description>`, Open Graph, Twitter Card, and canonical URL — so non-JS crawlers (most AI/LLM crawlers included) index the real content.
- Article pages include `Article` schema JSON-LD with author, dates, headline, image, full text, and (when set) `topics` as `about` entities. The home page includes `ProfilePage` / `Person` JSON-LD; `/publications` carries a typed `ItemList` with a DOI-bearing node per publication.
- `sitemap.xml` is generated at build time and includes every static page plus every auto-discovered article; `lastmod` follows `dateUpdated` when an article is edited.
- `robots.txt` allows all crawlers and points to the sitemap.
- `rss.xml` and `feed.json` (JSON Feed 1.1) are generated at build time from the auto-discovered articles, newest first.
- On every push to `main`, the IndexNow workflow (`.github/workflows/indexnow.yml`) waits for the Cloudflare deploy to go live (it polls the live sitemap until it matches the pushed commit's articles), then submits the sitemap's URLs to Bing/Yandex/etc. so new content is crawled immediately. The ownership key file (`<key>.txt` at the site root, containing exactly the key) is **public by design** — that is how the protocol proves ownership; it is not a secret. To rotate the key: generate a new 32-hex key, rename and rewrite the key file, and update the filename in `public-files.js` (`ROOT_PLAIN_FILES`) and the `KEY` constant in `indexnow.yml` — `test/consistency.test.js` fails until all four copies agree.

## License

This repository is published for **portfolio visibility only**. Public visibility on GitHub does not grant any right to reuse it. All rights are reserved by the author.

- **Source code, written content, and design**: © Lampros Konstantellos, all rights reserved. Copying, modification, redistribution, or any derivative use requires prior written permission.
- **Photographs and video**: all rights reserved; some event/conference photos were taken by third parties, whose rights are reserved to them. The personal portrait (`lampros-konstantellos-picture.jpg`) may not be reused in any context.
- **Third-party components**: keep their own licenses (see below); the terms above do not apply to them.

See [`LICENSE`](./LICENSE) for the full terms, including how to request permission.

### Third-party notices

- **React / ReactDOM** (`vendor/react.production.min.js`, `vendor/react-dom.production.min.js`): MIT License, © Facebook, Inc. and its affiliates. The full license text ships alongside the bundles in [`vendor/LICENSE-MIT.txt`](./vendor/LICENSE-MIT.txt); the original MIT headers are also retained verbatim in the files.
- **Inter** (`vendor/fonts/inter-latin.woff2`, `vendor/fonts/inter-latin-ext.woff2`): © The Inter Project Authors, redistributed as self-hosted woff2 subsets under the SIL Open Font License 1.1 — full text in [`vendor/fonts/OFL.txt`](./vendor/fonts/OFL.txt).
- **Brand icons** in `icons.jsx` (LinkedIn, Google Scholar, IEEE, ORCID, Zenodo, ResearchGate, Scopus, GitHub) reference trademarks owned by their respective owners and are used only to link to the author's profiles.
