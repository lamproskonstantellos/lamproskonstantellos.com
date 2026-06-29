# Migration: Railway (runtime server) → Cloudflare Pages (static)

This document records the move from serving the site with a runtime Node
process (`server.js` on Railway) to deploying a fully **pre-rendered static
build** to **Cloudflare Pages**, with **zero change to user-facing output or
SEO**.

`server.js` is **not** removed: it is kept as the local preview server
(`npm start`) and as the reference implementation the static build is checked
against.

## Goal and guarantee

The static output for every route is **byte-identical** to what `server.js`
previously served, except for the per-deploy `?v=` cache-buster token. This is
not aspirational: it is enforced by `test/parity.test.js`, which boots the real
server, renders `build/`, normalizes only the `?v=` token, and asserts byte
equality for every route and feed.

Nothing about the HTML, meta tags, Open Graph / Twitter cards, canonical URLs,
JSON-LD, `sitemap.xml`, `rss.xml` or `feed.json` changed.

## What changed

| Concern | Before (Railway) | After (Cloudflare Pages) |
|---------|------------------|--------------------------|
| Serving | `server.js` renders each request at runtime | `build-static.js` pre-renders every route to `build/` at build time |
| HTML pipeline | `serveIndex` (inline) | shared `renderHtml()` in `server.js`, reused by the build |
| Feeds | inline in `server.js` request handlers | shared `feeds.js` builders, reused by the build |
| Article discovery | scanned per request | discovered at build time; ships on the next deploy (git push) |
| Security headers / CSP | `SECURITY_HEADERS` set per response | reproduced verbatim in `build/_headers` (generated from `SECURITY_HEADERS`) |
| Cache-Control | `cacheHeaderFor()` per response | cache classes in `build/_headers` |
| `/index.html` → `/` | 301 in `server.js` | `build/_redirects` |
| Unknown routes | SPA HTML served with HTTP 404 | `build/404.html` (Cloudflare serves it with HTTP 404) |
| Hosting | Railway, redeploy on push | Cloudflare Pages, build + deploy on push |
| Container | Dockerfile builds + runs the server | removed; Cloudflare builds from source, no container |

### Single source of truth

To keep the live server, the local preview and the static build from ever
diverging, the HTML render and the feed generation each live in exactly one
place:

- `renderHtml(templateHtml, pathname, { deployVersion, articleScripts, assetMap })`
  in `server.js`: meta injection → article `<script>` injection → `/dist/`
  hash rewrite → `?v=` stamping.
- `buildSitemap` / `buildRss` / `buildFeed` in `feeds.js`.

`server.js` (request time) and `build-static.js` (build time) both call these.

## The static build

```bash
npm run build          # optimize images + compile JSX → dist/ (+ manifest)
npm run build:static   # pre-render every route → build/
```

`build-static.js` writes, into a clean `build/`:

- `index.html`, `news/index.html`, `publications/index.html`, and
  `news/<slug>/index.html` for every discovered article;
- `404.html` (route-independent not-found page);
- `sitemap.xml`, `rss.xml`, `feed.json`;
- `_headers` (security headers + cache classes) and `_redirects`
  (`/index.html → /`);
- only the public assets: `styles.css`, the dual modules, `vendor/`, the
  hashed `dist/` bundles (never `dist/manifest.json`), favicons / icons /
  manifest / `robots.txt`, and each article folder's `article.js`, images
  (including the `optimize-images` `.webp`/`.avif` variants the `<picture>` tags
  need) and video.

Source, tooling, config and docs are never copied; the build asserts that no
excluded/private file leaked into `build/`.

## Deploying to Cloudflare Pages

1. **Create the project**: Cloudflare dashboard → *Workers & Pages* → *Create* →
   *Pages* → *Connect to Git* → select this repository.
2. **Build settings**:
   - Framework preset: *None*.
   - Build command: `npm run build && npm run build:static`
   - Build output directory: `build`
3. **Environment variables**: set `NODE_VERSION=20`.
4. **Save and Deploy**. Cloudflare clones the repo, runs the build command and
   publishes `build/`. Every subsequent `git push` triggers a new build and
   deploy.
5. **Custom domain**: *Custom domains* → add `lamproskonstantellos.com` and
   follow the DNS instructions.
6. `_headers` and `_redirects` in `build/` are applied automatically, with no
   dashboard configuration needed for security headers, caching, or the
   `/index.html → /` redirect.

### Notes

- `?v=` cache-buster: Cloudflare exposes the commit as `CF_PAGES_COMMIT_SHA`,
  which `build-static.js` uses (first 12 chars); locally it falls back to a
  build timestamp.
- Cloudflare Pages serves `404.html` with HTTP 404 for unmatched paths, so no
  SPA `200` catch-all is needed and 404 semantics are preserved.
- Hashed `/dist/*` bundles are served `immutable`; HTML is `no-store`.

## Retiring Railway

Once the Cloudflare Pages deployment is verified on the custom domain, the
Railway service can be deleted. The `Dockerfile` and `.dockerignore` have been
removed: Cloudflare Pages builds the static site from source, with no container
involved.

## Local preview (unchanged)

```bash
npm install
npm run build
npm start            # http://localhost:3000
npm test             # full suite, incl. byte-parity
```
