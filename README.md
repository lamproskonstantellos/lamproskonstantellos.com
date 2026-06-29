# lamproskonstantellos.com

[![License: All Rights Reserved](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Deployed on Cloudflare Pages](https://img.shields.io/badge/deployed%20on-Cloudflare%20Pages-F38020?logo=cloudflarepages&logoColor=white)](https://pages.cloudflare.com/)
[![Live site](https://img.shields.io/badge/live-lamproskonstantellos.com-0a66c2)](https://lamproskonstantellos.com)

The personal website of **Lampros Konstantellos**, Electrical & Computer Engineer. A single-page application presenting bio, publications, and articles on renewable energy, battery storage, grid flexibility, and electricity markets.

## Stack

- **Frontend:** React 18 loaded via self-hosted UMD builds (`vendor/`). JSX is compiled to plain JavaScript at build time with [esbuild](https://esbuild.github.io/) — no in-browser Babel. Plain CSS. Inter and JetBrains Mono via Google Fonts.
- **Build / pre-render:** A dependency-free Node build step (`build-static.js`) pre-renders every route to a static `build/` directory: per-route `<title>` / meta / Open Graph / Twitter / canonical / JSON-LD, the auto-discovered per-article scripts, `sitemap.xml` / `rss.xml` / `feed.json`, a route-independent `404.html`, and the security-header + cache rules as Cloudflare `_headers` / `_redirects`. It reuses the same `renderHtml` and `feeds.js` builders as the local preview server, so the static output is byte-identical to what `server.js` serves (proven by `test/parity.test.js`). A per-deploy version query string on local CSS/JS busts browser caches on every deploy.
- **Local preview:** The original dependency-free Node.js HTTP server (`server.js`, `npm start`) is retained for local preview. It serves the same per-route meta and feeds at request time, with cached brotli/gzip compression, security headers + CSP, class-appropriate `Cache-Control`, and malformed-request guards (no request can crash the process).
- **Container:** `node:20-alpine`. The `Dockerfile` (runs `npm run build`, then starts `server.js`) is now optional — it only containerizes the local preview server. Cloudflare Pages builds the static site from source and needs no container.
- **Hosting:** [Cloudflare Pages](https://pages.cloudflare.com/). Builds and deploys the static `build/` output on every git push — build command `npm run build && npm run build:static`, output directory `build`, `NODE_VERSION=20`.

## Local development

```bash
npm install
npm run build     # one-time JSX → JS compile to dist/ (also builds image siblings)
npm start         # serve at http://localhost:3000
npm test          # run the test suite (build first, so dist/ exists)
```

While editing `.jsx` files, run `npm run watch` in a second terminal — esbuild rebuilds on every save and a browser refresh shows the change.

## Static build

The site deploys to [Cloudflare Pages](https://pages.cloudflare.com/) as a fully
pre-rendered static bundle — no runtime server.

```bash
npm run build          # optimize images + compile JSX → dist/
npm run build:static   # pre-render every route → build/
```

`build-static.js` reuses the server's `renderHtml` and `feeds.js` builders, so
every page, feed and header file in `build/` is byte-identical to what
`server.js` serves (modulo the per-deploy `?v=` cache-buster) — asserted by
`test/parity.test.js`. Only public assets are copied into `build/`; source,
tooling and config never are.

**Cloudflare Pages settings**

| Setting | Value |
|---------|-------|
| Build command | `npm run build && npm run build:static` |
| Build output directory | `build` |
| Environment variable | `NODE_VERSION=20` |

See [`docs/MIGRATION.md`](./docs/MIGRATION.md) for the full Railway → Cloudflare
Pages migration notes.

## Project structure

```
.
├── app.jsx                Root React component and SPA shell (source)
├── components/            About, Publications, News (incl. Lightbox), Picture, shared UI (source)
├── icons.jsx              Inline SVG icon set (source)
├── site.config.js         Single source of truth for site identity (dual Node/browser)
├── routes.js              Route table: parseRoute / routeToPath / isValidSpaRoute / pageTitle (dual)
├── article-schema.js      Article validation + newest-first comparator (dual)
├── ui-helpers.js          Share links + scroll-spy resolver (dual Node/browser)
├── data.js                Profile, hero, about, publications, contact, selectors
├── styles.css             Global stylesheet
├── index.html             Single HTML entry with __META_*__ placeholders
├── feeds.js               sitemap.xml / rss.xml / feed.json builders (shared by server + build)
├── build-static.js        Pre-render every route to build/ for Cloudflare Pages
├── server.js              Local preview server: per-route meta, sitemap/rss/feed, compression, security
├── scripts/               Build tooling (optimize-images.js)
├── vendor/                Self-hosted React 18 UMD builds
├── test/                  node:test suite + golden files (test/golden/)
├── .github/workflows/     CI (npm ci → build → test)
├── Dockerfile             Optional local-preview container (runs build, starts server.js)
├── robots.txt             Search-engine directives
├── dist/                  Built JS (gitignored; produced by `npm run build`)
├── build/                 Static Cloudflare Pages output (gitignored; `npm run build:static`)
└── news/                  Per-article folders, each with article.js + images
```

Four modules are loaded both in the browser (as `window` globals, before
`data.js`) and in Node (via `require` from `server.js`): `site.config.js`
(site identity), `routes.js` (the route table, titles), `article-schema.js`
(article validation and sort order) and `ui-helpers.js` (share links and the
scroll-spy resolver). Because both worlds share one definition, the client and
server can never diverge on routes, titles, validation, sort order or identity.

## Testing

```bash
npm run build && npm test
```

`node:test` (zero extra dependencies) boots the real `server.js` on an ephemeral
port and checks served status/headers/meta, the feeds, security and hostile-input
handling, cross-module consistency, SEO/accessibility, and the image pipeline.
A byte-parity suite (`test/parity.test.js`) additionally renders the static
`build/` and asserts every route and feed is byte-identical to what `server.js`
serves. Golden snapshots live in `test/golden/`; a deliberate output change is
refreshed with `UPDATE_GOLDEN=1 npm test`. CI runs the same `build` + `test` on
every push.

## Adding a new article

See [`news/README.md`](./news/README.md). In short: create a folder under `news/<slug>/`, drop in `cover.jpg` and any photos, write `article.js`. The build auto-discovers it at build time and it ships on the next deploy (git push) — no edits to `data.js`, `index.html`, or any other file needed.

## SEO

- Per-route `<title>`, `<meta description>`, Open Graph, Twitter Card, and canonical URL are pre-rendered at build time into one static HTML file per route.
- Article pages include `Article` schema JSON-LD with author, date, headline, and image. The home page includes `ProfilePage` / `Person` JSON-LD.
- `sitemap.xml` is generated at build time and includes every static page plus every auto-discovered article.
- `robots.txt` allows all crawlers and points to the sitemap.
- `rss.xml` is generated at build time from the auto-discovered articles, newest first.
- `feed.json` is generated at build time alongside the RSS feed, conforming to JSON Feed 1.1.

## License

This repository is published for **portfolio visibility only** — public visibility on GitHub does not grant any right to reuse it. All rights are reserved by the author.

- **Source code, written content, and design** — © Lampros Konstantellos, all rights reserved. Copying, modification, redistribution, or any derivative use requires prior written permission.
- **Photographs and video** — all rights reserved; some event/conference photos were taken by third parties, whose rights are reserved to them. The personal portrait (`lampros-konstantellos-picture.jpg`) may not be reused in any context.
- **Third-party components** — keep their own licenses (see below); the terms above do not apply to them.

See [`LICENSE`](./LICENSE) for the full terms, including how to request permission.

### Third-party notices

- **React / ReactDOM** (`vendor/react.production.min.js`, `vendor/react-dom.production.min.js`) — MIT License, © Facebook, Inc. and its affiliates. The react-dom build additionally bundles a custom Modernizr build (MIT). The original MIT headers are retained verbatim in those files.
- **Inter** and **JetBrains Mono** — loaded at runtime from the Google Fonts CDN under the SIL Open Font License; not redistributed in this repository.
- **Brand icons** in `icons.jsx` (LinkedIn, Google Scholar, IEEE, ORCID, Zenodo, ResearchGate, GitHub) reference trademarks owned by their respective owners and are used only to link to the author's profiles.
