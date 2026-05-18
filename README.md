# lamproskonstantellos.com

[![License: All Rights Reserved](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Deployed on Railway](https://img.shields.io/badge/deployed%20on-Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.com/)
[![Live site](https://img.shields.io/badge/live-lamproskonstantellos.com-0a66c2)](https://lamproskonstantellos.com)

The personal website of **Lampros Konstantellos**, Electrical & Computer Engineer. A single-page application presenting bio, publications, and articles on renewable energy, battery storage, grid flexibility, and electricity markets.

## Stack

- **Frontend:** React 18 loaded via UMD. JSX is compiled to plain JavaScript at build time with [esbuild](https://esbuild.github.io/) — no in-browser Babel. Plain CSS. Inter and JetBrains Mono via Google Fonts.
- **Backend:** Minimal Node.js HTTP server (`server.js`) that serves static assets, auto-discovers and injects per-article scripts, injects per-route `<title>` / meta / Open Graph / Twitter / canonical / JSON-LD, generates `sitemap.xml` on the fly, applies brotli/gzip compression, sets appropriate `Cache-Control` headers, and adds a per-deploy version query string to local CSS/JS URLs to bust browser caches on every deploy.
- **Container:** `node:20-alpine`. The Dockerfile runs `npm run build` (esbuild) inside the image before starting the server.
- **Hosting:** [Railway](https://railway.com/). Auto-redeploys on every git push — no dashboard configuration needed.

## Local development

```bash
npm install
npm run build     # one-time JSX → JS compile to dist/
npm start         # serve at http://localhost:3000
```

While editing `.jsx` files, run `npm run watch` in a second terminal — esbuild rebuilds on every save and a browser refresh shows the change.

## Project structure

```
.
├── app.jsx                Root React component and router (source)
├── components/            About, Publications, News, and shared UI (source)
├── data.js                Profile, hero, about, publications, contact, selectors
├── icons.jsx              Inline SVG icon set (source)
├── styles.css             Global stylesheet
├── index.html             Single HTML entry with meta placeholders
├── server.js              Static server, per-route meta, sitemap, compression
├── Dockerfile             Production container (runs the build inside)
├── robots.txt             Search-engine directives
├── dist/                  Built JS (gitignored; produced by `npm run build`)
└── news/                  Per-article folders, each with article.js + images
```

## Adding a new article

See [`news/README.md`](./news/README.md). In short: create a folder under `news/<slug>/`, drop in `cover.jpg` and any photos, write `article.js`. The server auto-discovers it on the next request — no edits to `data.js`, `index.html`, or any other file needed.

## SEO

- Per-route `<title>`, `<meta description>`, Open Graph, Twitter Card, and canonical URL are injected server-side based on the requested path.
- Article pages include `Article` schema JSON-LD with author, date, headline, and image. The home page includes `ProfilePage` / `Person` JSON-LD.
- `sitemap.xml` is generated dynamically and includes every static page plus every auto-discovered article.
- `robots.txt` allows all crawlers and points to the sitemap.

## License

This repository is published for portfolio visibility only. All rights are reserved by the author. See [`LICENSE`](./LICENSE) for the full terms — copying, modification, redistribution, or any derivative use of the source code or assets requires prior written permission.
