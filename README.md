# lamproskonstantellos.com

[![License: All Rights Reserved](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Deployed on Railway](https://img.shields.io/badge/deployed%20on-Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.com/)
[![Live site](https://img.shields.io/badge/live-lamproskonstantellos.com-0a66c2)](https://lamproskonstantellos.com)

The personal website of **Lampros Konstantellos**, Electrical & Computer Engineer. A single-page application presenting bio, publications, and articles on renewable energy, battery storage, grid flexibility, and electricity markets.

## Stack

- **Frontend:** React 18 loaded via self-hosted UMD builds (`vendor/`). JSX is compiled to plain JavaScript at build time with [esbuild](https://esbuild.github.io/) — no in-browser Babel. Plain CSS. Inter and JetBrains Mono via Google Fonts.
- **Backend:** Minimal, dependency-free Node.js HTTP server (`server.js`) that serves static assets, auto-discovers and injects per-article scripts, injects per-route `<title>` / meta / Open Graph / Twitter / canonical / JSON-LD, generates `sitemap.xml`, `rss.xml` and `feed.json` on the fly, applies cached brotli/gzip compression, sets security headers + CSP and class-appropriate `Cache-Control`, guards against malformed requests (no request can crash the process), and adds a per-deploy version query string to local CSS/JS URLs to bust browser caches on every deploy.
- **Container:** `node:20-alpine`. The Dockerfile runs `npm run build` (esbuild) inside the image before starting the server.
- **Hosting:** [Railway](https://railway.com/). Auto-redeploys on every git push — no dashboard configuration needed.

## Local development

```bash
npm install
npm run build     # one-time JSX → JS compile to dist/ (also builds image siblings)
npm start         # serve at http://localhost:3000
npm test          # run the test suite (build first, so dist/ exists)
```

While editing `.jsx` files, run `npm run watch` in a second terminal — esbuild rebuilds on every save and a browser refresh shows the change.

## Project structure

```
.
├── app.jsx                Root React component and SPA shell (source)
├── components/            About, Publications, News (incl. Lightbox), Picture, shared UI (source)
├── icons.jsx              Inline SVG icon set (source)
├── site.config.js         Single source of truth for site identity (dual Node/browser)
├── routes.js              Route table: parseRoute / routeToPath / isValidSpaRoute / pageTitle (dual)
├── article-schema.js      Article validation + newest-first comparator (dual)
├── data.js                Profile, hero, about, publications, contact, selectors
├── styles.css             Global stylesheet
├── index.html             Single HTML entry with __META_*__ placeholders
├── server.js              Static server: per-route meta, sitemap/rss/feed, compression, security
├── scripts/               Build tooling (optimize-images.js)
├── vendor/                Self-hosted React 18 UMD builds
├── test/                  node:test suite + golden files (test/golden/)
├── .github/workflows/     CI (npm ci → build → test)
├── Dockerfile             Production container (runs the build inside)
├── robots.txt             Search-engine directives
├── dist/                  Built JS (gitignored; produced by `npm run build`)
└── news/                  Per-article folders, each with article.js + images
```

The route table (`routes.js`) and article schema (`article-schema.js`) are loaded
both in the browser (as `window` globals, before `data.js`) and in Node (via
`require` from `server.js`), so the client and server share one definition of
routes, titles, validation and sort order.

## Testing

```bash
npm run build && npm test
```

`node:test` (zero extra dependencies) boots the real `server.js` on an ephemeral
port and checks served status/headers/meta, the feeds, security and hostile-input
handling, cross-module consistency, SEO/accessibility, and the image pipeline.
Golden snapshots live in `test/golden/`; a deliberate output change is refreshed
with `UPDATE_GOLDEN=1 npm test`. CI runs the same `build` + `test` on every push.

## Adding a new article

See [`news/README.md`](./news/README.md). In short: create a folder under `news/<slug>/`, drop in `cover.jpg` and any photos, write `article.js`. The server auto-discovers it on the next request — no edits to `data.js`, `index.html`, or any other file needed.

## SEO

- Per-route `<title>`, `<meta description>`, Open Graph, Twitter Card, and canonical URL are injected server-side based on the requested path.
- Article pages include `Article` schema JSON-LD with author, date, headline, and image. The home page includes `ProfilePage` / `Person` JSON-LD.
- `sitemap.xml` is generated dynamically and includes every static page plus every auto-discovered article.
- `robots.txt` allows all crawlers and points to the sitemap.
- `rss.xml` is generated dynamically from the auto-discovered articles, newest first.
- `feed.json` is generated dynamically alongside the RSS feed, conforming to JSON Feed 1.1.

## License

This repository is published for portfolio visibility only. All rights are reserved by the author. See [`LICENSE`](./LICENSE) for the full terms — copying, modification, redistribution, or any derivative use of the source code or assets requires prior written permission.
