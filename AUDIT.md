# Website Audit - lamproskonstantellos.com

Full-stack security, SEO, performance, UI/UX and accessibility audit of the
personal website. The site is a no-framework SPA (React from a vendored global,
JSX compiled with esbuild) served by `server.js` and pre-rendered to `build/`
for Cloudflare Pages by `build-static.js`.

- Baseline: `npm install` clean, `npm test` GREEN (130/130) after `npm run build`.
- Dependency posture: `npm audit` reports 0 vulnerabilities (prod and full).
- Method: eight-domain sweep (security, SEO, performance, server/infra, UI/UX,
  accessibility, consistency/copy, dependencies), with every candidate finding
  re-checked against the actual source before it was accepted here. Findings that
  did not survive that check are listed under "Considered and rejected" so the
  reasoning is on record.

## Executive summary

The codebase is mature and unusually well hardened for a personal site. Security,
server behaviour and the build pipeline are in very good shape and needed no
changes. The real, actionable findings cluster in accessibility, front-end
performance/privacy, and copy consistency.

Posture by domain:

| Domain | Posture | Notes |
|--------|---------|-------|
| Security (headers, traversal, injection, DoS) | Strong | No P0/P1/P2. Strict CSP, layered traversal defence, injection-safe meta/feeds, DoS hardening. |
| Server / infrastructure | Strong | Correct cache classes, compression + Vary, Range, status codes, server/`_headers` parity. |
| Dependencies / supply chain | Strong | 0 vulns, no install hooks, no CDN scripts (Plausible pinned + CSP-allowlisted), clean `.gitignore`. |
| SEO | Good | Per-route meta + rich JSON-LD + valid feeds. Minor additive wins only. |
| Performance | Good, one real gap | Third-party render-blocking fonts is the one material item. |
| UI / UX | Good | Responsive, consistent design system; polish-level items only. |
| Accessibility | Good, one real defect | One sub-threshold contrast value; the rest is polish/defensive. |
| Consistency / copy | Minor | A few em dashes in user-facing strings; one feed-title mismatch. |

Counts by priority (actionable findings), with resolution:

| Priority | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| P0 (critical) | 0 | 0 | 0 |
| P1 (high) | 2 | 2 | 0 |
| P2 (medium) | 5 | 5 | 0 |
| P3 (low) | 7 | 5 | 2 |

Every P0/P1/P2 finding is fixed and verified. The two deferred items (SEC-05,
SEC-06) are optional P3 maintenance left for the owner. A further eight
candidates were considered and rejected as non-issues or by-design (see that
section).

Verification evidence:

- Test suite: 130 -> 135 passing (five regression tests added: footer rgba
  contrast, reduced-motion reveal, robots + noscript, video/aria-current wiring,
  and the 1200x630 social crop). `npm audit`: 0 vulnerabilities.
- Contrast: footer headings 4.30:1 -> 6.56:1 (measured, composited over navy).
- Fonts: two third-party origins removed from the CSP; the font stylesheet no
  longer render-blocks; Inter is served from this origin (verified loading in a
  headless browser at 1280px and 390px).
- Social images: article `og:image` dropped from 1-3 MB raw covers (one
  portrait) to 70-140 KB 1200x630 crops (verified per article).

## Findings table

| ID | Priority | Category | Title | File | Status |
|----|----------|----------|-------|------|--------|
| A11Y-01 | P1 | Accessibility | Footer column-title contrast below WCAG AA (4.30:1) | styles.css | fixed |
| PERF-01 | P1 | Performance / Privacy | Render-blocking third-party Google Fonts + IP leak | index.html, styles.css, server.js | fixed |
| SEO-01 | P2 | SEO / Resilience | No `<noscript>` fallback for JS-off / non-executing clients | index.html | fixed |
| COPY-01 | P2 | Consistency | `feed.json` title uses an em dash; `rss.xml` uses a hyphen | feeds.js | fixed |
| COPY-02 | P2 | Copy | Em dashes in manifest description and `og:image:alt` | site.webmanifest, server.js | fixed |
| A11Y-02 | P2 | Accessibility | Inline `<video>` has no accessible name (and no captions hook) | components/news.jsx | fixed |
| PERF-02 | P2 | Performance / Social | `og:image` uses the raw full-res cover (one portrait, several 1-3 MB) | server.js, scripts/optimize-images.js | fixed |
| A11Y-03 | P3 | Accessibility | Reveal-on-scroll has no reduced-motion / no-IO safety net | styles.css | fixed |
| A11Y-04 | P3 | Accessibility | `aria-current="page"` used for in-page section links | app.jsx | fixed |
| A11Y-05 | P3 | Accessibility / UX | Some tap targets below 44px (best practice, not a 2.1 AA gate) | styles.css | fixed |
| SEO-02 | P3 | SEO | No `max-image-preview:large` robots directive | index.html | fixed |
| HYG-01 | P3 | Hygiene | Unreferenced image assets tracked in the repo | (repo root) | fixed |
| SEC-05 | P3 | Supply chain | CI action tags not pinned to commit SHAs | .github/workflows/ci.yml | deferred |
| SEC-06 | P3 | Maintenance | Dev-only deps behind latest (0 vulns) | package.json | deferred |

Status values: `fixed` (done and verified, recorded in the changelog),
`deferred` (optional maintenance left for the owner), or `by design` (see
rejected section). Every P0/P1/P2 finding is fixed; the two deferred items are
optional P3 maintenance.

---

## Detailed findings

### A11Y-01 (P1) - Footer column-title contrast below WCAG AA

- **Location:** `styles.css` (`.footer-col-title`, the "Explore" / "Connect" headings).
- **Issue:** `color: rgba(255, 255, 255, 0.45)` composited over the navy footer
  background `#0a1f44` yields a measured contrast of **4.30:1**. The label is
  12px / 600 weight, which counts as normal text, so it needs 4.5:1. This is the
  only sub-threshold text colour in the footer (all other footer colours pass:
  role 6.95:1, tagline 5.74:1, bottom bar 5.25:1, column links 9.36:1).
- **Impact:** WCAG 2.1 SC 1.4.3 (Contrast, Minimum) conformance failure. Low-vision
  users may not read the two footer section headings.
- **Fix:** Raise the alpha to `rgba(255, 255, 255, 0.60)`, which measures **6.56:1**
  and keeps the intended muted look. CSS-only, no golden-snapshot impact. Extend
  `test/a11y.test.js` to compute rgba-over-navy footer contrasts so this cannot
  regress.
- **Effort:** S.
- **Status:** fixed.

### PERF-01 (P1) - Render-blocking third-party Google Fonts and IP leak

- **Location:** `index.html` (`<link rel="preconnect">` x2 and the Google Fonts
  stylesheet `<link>`); CSP `style-src`/`font-src` in `server.js` `SECURITY_HEADERS`.
- **Issue:** The document loads a synchronous stylesheet from
  `fonts.googleapis.com` in `<head>`, which blocks first paint on a third-party
  round trip, and every visitor's IP is sent to Google. That directly contradicts
  the "Privacy-friendly analytics (no cookies, no personal data)" note in the same
  head. It also forces the CSP to allowlist two Google origins. JetBrains Mono is
  fetched in the same request but is used in only three decorative spots (cover
  and gallery placeholders, the 404 code block), each already backed by a
  `ui-monospace, monospace` fallback.
- **Impact:** Slower LCP/FCP on the critical path (a Core Web Vitals / ranking
  signal); a third-party privacy dependency that is at odds with the site's stated
  privacy stance and carries GDPR exposure for an EU-based owner.
- **Fix:** Self-host the Inter weights actually used (400/500/600/700) as `woff2`
  under `vendor/fonts/`, declare them with `@font-face { font-display: swap }` in
  the already-bundled `styles.css`, drop JetBrains Mono in favour of the existing
  monospace fallback, remove the three font `<link>`s and preconnects from
  `index.html`, and tighten the CSP to `style-src 'self' 'unsafe-inline'; font-src 'self'`.
  `build-static.js` already copies `vendor/` recursively, so the fonts ship
  automatically. Regenerate the HTML goldens and the security-headers golden for
  the intended CSP change; diff to confirm only the font/CSP lines moved.
- **Effort:** M.
- **Status:** fixed.

### SEO-01 (P2) - No `<noscript>` fallback

- **Location:** `index.html` `<body>` (only `<div id="root"></div>` plus scripts).
- **Issue:** With JavaScript disabled (or a fetcher that does not execute JS), the
  page body is blank. The server injects full per-route meta and JSON-LD (so
  crawlers are well served, by design), but a human with JS off sees nothing:
  no name, no bio, no links.
- **Impact:** Zero content for the no-JS case; a resilience and inclusivity gap.
- **Fix:** Add a small `<noscript>` block with the name, role, a one-line bio, and
  links to `/news`, `/publications` and the feeds. Regenerate HTML goldens.
- **Effort:** S.
- **Status:** fixed.

### COPY-01 (P2) - Feed-title dash mismatch

- **Location:** `feeds.js` (`buildFeed` title vs `buildRss` title).
- **Issue:** `feed.json` renders the title as `"<name> — News"` (em dash) while
  `rss.xml` and the HTML `<link>` feed titles use `"<name> - News"` (hyphen). Same
  logical title, two renderings, and the em dash is exactly the punctuation the
  owner wants to avoid.
- **Impact:** Inconsistent feed branding; an em dash in a user-facing string.
- **Fix:** Change the `feed.json` title to `"- News"` to match RSS and the HTML.
  Update `test/golden/feed.json` (the only golden that embeds the em-dash form).
- **Effort:** S.
- **Status:** fixed.

### COPY-02 (P2) - Em dashes in manifest description and `og:image:alt`

- **Location:** `site.webmanifest` (`description`); `server.js` (home and
  not-found `imageAlt`).
- **Issue:** The manifest description reads "Engineer — renewable ..." and the
  `og:image:alt` for the home and 404 routes is `"<name> — <jobTitle>"`. These
  surface in install prompts and in social/alt text.
- **Impact:** User-facing em dashes in metadata.
- **Fix:** Replace `—` with a hyphen in these strings. Update `test/golden/home.html`
  and `test/golden/notfound.html` for the alt-text change.
- **Effort:** S.
- **Status:** fixed.

### A11Y-02 (P2) - Inline `<video>` has no accessible name

- **Location:** `components/news.jsx` (`renderVideo`).
- **Issue:** The inline `<video controls>` (used by the renewable-energytech
  article) has no `aria-label`/`aria-labelledby` and no captions `<track>`. A
  captions requirement (WCAG 1.2.2) applies only if the clip carries meaningful
  speech, which cannot be verified from the repo, so a hard captions failure is
  not asserted. The missing accessible name is a concrete, unconditional gap.
- **Impact:** Screen-reader users hear an unlabeled "video" with no context;
  potential captions gap if the clip contains speech.
- **Fix:** Always set an accessible name derived from the article title
  (`aria-label={`Video: ${article.title}`}`). Add optional, data-driven captions:
  when an article provides a `captions` VTT path, render
  `<track kind="captions" srclang="en" src=... default />`. Do not ship an empty
  placeholder track. If the owner confirms the clip is silent, the label is
  sufficient for conformance.
- **Effort:** S (label) / M (captions authoring, owner-provided).
- **Status:** fixed (accessible name + captions hook shipped; authoring a VTT
  file remains an owner content task if the clip carries speech).

### PERF-02 (P2) - `og:image` uses the raw full-res cover

- **Location:** `server.js` `computePageMeta` (article branch); covers under
  `news/<slug>/cover.jpg`.
- **Issue:** Article `og:image` points at the un-optimized cover. Measured: the
  Intersolar cover is portrait 3132x4176 (2.95 MB), the storage-forum cover is
  4:3 4646x3485 (2.54 MB), and two more are 1.3-1.9 MB. Portrait and 4:3 images
  are center-cropped (or downgraded from a large card) by LinkedIn/Twitter/Facebook,
  which want roughly 1.91:1, and multi-MB images slow scraper fetches (LinkedIn
  can silently skip images near its size limit). The default home/list/404 share
  image is a correct 1200x630 and is not affected.
- **Impact:** Weaker or mis-cropped social share cards for several articles, worst
  for the one portrait cover.
- **Fix (recommended):** Extend `scripts/optimize-images.js` to emit a dedicated
  1.91:1 (about 1200x630) social crop per article cover, gitignore it like the
  other generated derivatives, point the article `og:image` at it (declaring
  1200x630), and keep the full cover for the on-page `<picture>`. Update
  `test/seo.test.js` (which asserts current cover dims) and the article golden.
- **Effort:** M-L.
- **Status:** fixed. `optimize-images.js` now emits a smart-cropped
  (attention-based) 1200x630 `cover-og.jpg` per article cover (70-140 KB), and
  `computePageMeta` prefers it for the article `og:image` / `twitter:image` /
  JSON-LD image, falling back to the raw cover when the crop is not built. The
  portrait Intersolar cover now yields a correctly framed landscape card.

### A11Y-03 (P3) - Reveal-on-scroll has no reduced-motion / no-IO safety net

- **Location:** `styles.css` (`.reveal`, `.about-paragraph`, `.chip`).
- **Issue:** These elements start at `opacity: 0` and are revealed by a JS-added
  `.in` class driven by IntersectionObserver. The `prefers-reduced-motion` block
  only zeroes durations, it does not reset opacity, so a reduced-motion user still
  depends on the observer firing to see news/publication cards and the bio. In
  practice IntersectionObserver is near-universal and elements are observed on
  mount, but there is no CSS fallback if it does not fire.
- **Impact:** Small risk of content staying invisible for reduced-motion users or
  in rare JS/observer edge cases.
- **Fix:** Add `@media (prefers-reduced-motion: reduce) { .reveal, .about-paragraph, .chip { opacity: 1; transform: none } }`
  so reduced-motion users never depend on the observer.
- **Effort:** S.
- **Status:** fixed.

### A11Y-04 (P3) - `aria-current="page"` for in-page section links

- **Location:** `app.jsx` (`Header` nav).
- **Issue:** On the homepage the nav items point at in-page sections (`/#about`,
  etc.), so `aria-current="page"` is semantically loose; `aria-current="location"`
  is the correct token for "current position within this page". On list/article
  routes `"page"` is appropriate.
- **Impact:** Minor semantic imprecision; screen readers announce "current" for any
  truthy value, so impact is low.
- **Fix:** Emit `"location"` for the home-section highlight and keep `"page"` for the
  list/article route match.
- **Effort:** S.
- **Status:** fixed.

### A11Y-05 (P3) - Some tap targets below 44px

- **Location:** `styles.css` (nav links, footer column links, share controls,
  `.view-all`, `.back-link`, back-to-top, `.lightbox-close`).
- **Issue:** Several interactive targets are shorter than 44px; the tightest
  (`.view-all`, `.back-link`, back-to-top) have no vertical padding (about 18-20px
  tall). Note this is not a WCAG 2.1 AA failure: SC 2.5.5 (Target Size) is AAA and
  the 24px minimum (2.5.8) is WCAG 2.2, so this is best-practice mobile ergonomics.
- **Impact:** Slightly harder to tap on touch devices.
- **Fix:** Enlarge the safe cases without shifting layout: bump `.lightbox-close`
  to 44x44 and add vertical padding / min-height to the inline text controls where
  it does not disturb the design. CSS-only.
- **Effort:** S-M.
- **Status:** fixed (touch-only enlargement of the tightest controls plus the
  lightbox close button; desktop layout unchanged).

### SEO-02 (P3) - No `max-image-preview:large` robots directive

- **Location:** `index.html` `<head>`.
- **Issue:** There is no `<meta name="robots">`. `theme-color` and Twitter card are
  present. Adding `max-image-preview:large` lets Google show large image thumbnails
  in results. `twitter:site` is intentionally omitted (the owner has no X handle;
  inventing one would be wrong).
- **Impact:** Missed opportunity for richer image results.
- **Fix:** Add one route-independent line:
  `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />`.
  Regenerate HTML goldens.
- **Effort:** S.
- **Status:** fixed.

### HYG-01 (P3) - Unreferenced image assets tracked in the repo

- **Location:** repo root: `og-image-2x.png` (2.2 MB), `og-image.svg`,
  `logo-mark-1024.png`; `apple-touch-icon.svg` is copied into the build but not
  referenced by `index.html` (which uses the PNG).
- **Issue:** These files are git-tracked but referenced by no code. Confirmed:
  `og-image-2x.png` is not in `build-static.js` `ROOT_IMAGE_BASES`, so it is not
  shipped to Cloudflare; it is repo weight only, not deployed weight.
- **Impact:** 2.2 MB-plus of dead weight in the repository (no user-facing impact).
- **Fix:** `git rm` the unreferenced assets if they are not kept as design sources.
- **Effort:** S.
- **Status:** fixed (removed with owner sign-off; the shipped `og-image.png` and
  icon set are untouched, and git history retains the originals).

### SEC-05 (P3) - CI action tags not pinned to SHAs

- **Location:** `.github/workflows/ci.yml`.
- **Issue:** `actions/checkout@v4` and `actions/setup-node@v4` use major-version
  tags rather than commit SHAs. CI holds no deploy secrets (Cloudflare Pages builds
  separately), so the supply-chain exposure is minimal.
- **Impact:** Theoretical tag-repoint risk in CI only.
- **Fix:** Pin actions to full commit SHAs.
- **Effort:** S.
- **Status:** deferred (optional hardening, low value for this repo).

### SEC-06 (P3) - Dev-only dependencies behind latest

- **Location:** `package.json` (`esbuild` 0.25.x -> 0.28.x, `sharp` 0.34.x -> 0.35.x).
- **Issue:** Both are behind latest but are `devDependencies`, never shipped to
  clients, and report 0 vulnerabilities.
- **Impact:** None security-wise; routine maintenance only.
- **Fix:** Bump when convenient and re-run the suite.
- **Effort:** S.
- **Status:** deferred (optional maintenance).

---

## Considered and rejected (skeptically checked, no change warranted)

These were evaluated against the source and deliberately not actioned. Recording
them so the reasoning is auditable.

- **CORP / COEP headers (by design).** Adding `Cross-Origin-Resource-Policy` would
  block legitimate cross-origin embedding of the OG image by browser-context
  embedders while mitigating no real attack here (there is no cross-origin-isolation
  goal, no SharedArrayBuffer). Social scrapers fetch the OG image server-side and
  ignore CORP anyway. COOP is already set. Left as-is.
- **HSTS `preload` token (by design).** `max-age` is already one year with
  `includeSubDomains`. Adding `preload` and submitting to the preload list is a
  hard-to-reverse, all-subdomains-HTTPS-forever commitment with no concrete benefit
  here beyond the existing long max-age. Left off intentionally.
- **`new Function` in `loadArticleMeta` (by design).** It executes first-party
  `news/<slug>/article.js` at boot (not per request, not attacker-controlled), and
  the result is re-validated by the shared `validateArticle` plus a slug/folder
  cross-check. The trust boundary is the repository; a sandbox would add no real
  boundary. Comment in `server.js` already documents this accurately.
- **Additional hardening headers (by design).** `upgrade-insecure-requests` is
  unnecessary (all subresource URLs are already https/same-origin), `X-DNS-Prefetch-Control`
  adds no value here, and `X-XSS-Protection` is correctly absent (deprecated).
  A `/.well-known/security.txt` is optional and not a defect.
- **En dashes in article date ranges (by design).** Strings such as "15-18 June" in
  article bodies use en dashes as correct typography for numeric ranges, not as
  em-dash prose. They also fall under the guardrail against altering article body
  content. Left unchanged; can be converted on explicit request.
- **En dash inside a publication title (by design).** `data.js` has an en dash
  inside an official publication title ("... Islands - A Kastellorizo ..."). This is
  a canonical academic record and is out of scope to change per the guardrails.
- **Footer heading levels (by design).** The footer uses two `<h2>`s ("Explore",
  "Connect"). No route produces a skipped heading level, and each footer `<nav>` is
  already `aria-label`led. No conformance issue; left as-is.
- **SPA body is client-rendered (by design).** Crawlers receive full per-route meta
  and JSON-LD from the server/prerender; the visible body is hydrated client-side.
  Server-side rendering the body would mean adding a framework, which the project
  deliberately avoids. Out of scope.

---

## Verified strengths

Called out so the report is balanced and future work does not regress them:

- Strict, real CSP with no `unsafe-inline` for scripts; `object-src 'none'`,
  `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'none'`.
- Security headers set on every response and reproduced byte-identically into
  `build/_headers` from the same `SECURITY_HEADERS` object, so server and Cloudflare
  cannot drift.
- Layered path-traversal defence (decode + NUL check + normalize + trailing-separator
  boundary check); GET/HEAD/OPTIONS method policy with proper 204/405.
- Injection-safe meta/JSON-LD/feed generation (function-form replacements,
  `escapeHtml`, `jsonLdScript` escaping `<` and U+2028/9, URL-safe slug gate).
- DoS hardening: memoized brotli/gzip cache with LRU eviction, streaming + HTTP
  Range for binaries, fixed-base URL parsing, whole-handler try/catch plus process
  safety nets.
- Correct cache classes (no-store HTML, immutable hashed `/dist`, feeds 3600, else
  86400); `/index.html` canonicalized to `/` in both server and `_redirects`.
- SEO: one correct `<h1>` per view, descriptive alt text (empty for decorative
  logos), rich Article JSON-LD (wordCount, articleBody, about[], keywords,
  breadcrumbs), content-derived sitemap `lastmod`, spec-shaped RSS/JSON Feed/sitemap.
- Accessibility: skip link, route-change focus management, `:focus-visible`,
  reduced-motion handling in both CSS and JS, a thorough lightbox focus trap/restore,
  and a contrast test that computes ratios from the live stylesheet.
- Responsive design system with reasoned breakpoints (grids that collapse cleanly,
  header that reduces to the logo at very narrow widths).

---

## Changelog (finding -> commit)

Each fix keeps `npm test` green and refreshes golden snapshots only for intended
output changes.

| Finding(s) | Commit (subject) |
|------------|------------------|
| A11Y-01 | `fix(a11y): raise footer heading contrast to meet WCAG AA` |
| PERF-01 | `perf(fonts): self-host Inter and drop the third-party font load` |
| SEO-01, SEO-02 | `fix(seo): add a no-JS fallback and an image-preview robots directive` |
| COPY-01, COPY-02 | `fix(copy): replace em dashes in feed, manifest and alt text with hyphens` |
| A11Y-02, A11Y-03, A11Y-04, A11Y-05 | `fix(a11y): label the video, harden reveal, refine aria-current and tap targets` |
| PERF-02 | `perf(images): serve a dedicated 1200x630 social crop as the article og:image` |
| HYG-01 | `chore: drop unreferenced image assets` |
| (report) | `docs(audit): add the audit report and remediation changelog` |
| SEC-05, SEC-06 | deferred (optional P3 maintenance; not applied) |
