# Pre-Delivery QA & UI/UX Review — lamproskonstantellos.com

> **Historical snapshot.** This is the point-in-time review brief used for the
> pre-delivery QA pass; the site has since been restyled (stacked publications
> preview, filterable year-grouped `/publications`, hero keyword highlight
> bands, divider above About, mobile profile-card hero) and entrance
> animations were removed. Facts below were refreshed to match the shipped
> site at handover; where a checklist item and the live site disagree, the
> code and the test suite are authoritative.

## Role & Objective

You are a **senior QA engineer and UI/UX reviewer** performing a **pre-delivery pass** on
**lamproskonstantellos.com**, the personal site of **Lampros Konstantellos**, Electrical &
Computer Engineer (renewable energy, battery storage, grid flexibility, electricity markets).

The site is an **English-only** single-page React 18 app (self-hosted React UMD; JSX compiled
with esbuild; plain CSS), pre-rendered to a static `build/` directory for **Cloudflare Pages**,
so the static output is byte-identical to the local preview server (`server.js`). Analytics are
provided by **Plausible** (`plausible.io`), a privacy-friendly, cookieless script.

**The bar:** would this be embarrassing to ship as a professional's public portfolio right now?
Find everything between "it runs" and "polished, correct, and ready." You have a real browser
(Chromium + Playwright) available — use it. Do not rely on `curl` alone for anything visual.

---

## Ground Rules — READ FIRST

1. **This is primarily an AUDIT.** The default action is to **observe and report**, not to
   change code.
2. **You MAY make tiny, safe, cosmetic POLISH fixes** — obviously-correct, risk-free: a wrong/
   missing `aria-label` on an icon-only control, a one-line CSS nudge, removing a stray
   `console.log`, fixing an unambiguous Latin-script code typo (and flagging it).
3. **Anything bigger than trivial polish is REPORTED, not done.** Do not refactor, redesign,
   rename, change business logic, or make sweeping CSS changes. Write it up with **file:line,
   severity, and a recommended fix**.
4. **Do NOT change client-facing copy** (name, tagline, publication titles/authors/venues, news
   article bodies, dates, contact details) without flagging it first — a human must confirm.
   Latin-script code typos are the only exception, and even then you note them.
5. **Log every polish fix** in the report with a diff or `file:line`.
6. **Do not touch test goldens** (`test/golden/`) or run `UPDATE_GOLDEN=1`, and do **not** commit
   or push without the owner's go-ahead.

### Severity scale (P0–P3)

- **P0 — Blocker:** must fix before the site is public. Broken route, failing build/test, 404 on
  a referenced asset, broken image negotiation, missing security header, wrong contact detail,
  broken external link on a headline credential.
- **P1 — Major:** clearly visible defect or significant UX / SEO / a11y problem, not catastrophic.
- **P2 — Minor:** small polish / visual / consistency issue.
- **P3 — Nit:** cosmetic, optional, or a documentation/maintainability gap.

---

## 0. Owner-Requested Changes (already applied — verify)

These were explicitly approved by the owner and are the sanctioned exceptions to "audit only."
Verify each renders correctly at desktop and mobile.

1. **Inline news photos.** Article photos can now be placed **inline** between paragraphs (via a
   per-photo `after` paragraph index + a `caption`), instead of only in an end gallery. Applied
   to the two photo articles:
   - `news/ieee-pess-2025-best-paper-award/article.js` — the single award photo now renders right
     after the award-announcement paragraph, with a caption.
   - `news/ai-hub-mayor-western-achaia/article.js` — the three photos now sit next to the meeting
     intro, the monitoring-prototype detail, and the live-data paragraph, each captioned.
   Photos without an `after` still fall back to the end gallery (backward compatible). This is a
   **client-side-only** change — feeds, JSON-LD, and goldens are unaffected.
2. **Publications: thesis + internship report.** The Master's thesis and the TU Munich research
   internship report were added to `data.js` `publications`, each tagged (a navy `pub-type` pill:
   "Master's Thesis" / "Internship Report") so they read apart from the peer-reviewed conference
   papers. The homepage preview cap (`LIMITS.publicationsPreview`) was lowered to **3** so the
   "View all →" link and the `/publications` page appear now. The visible `/publications` subtitle
   was updated to "Peer-reviewed papers, plus theses and reports, …".
3. **Docs clarity.** `news/README.md` now documents `coverAlign`, the corrected `poster` behavior,
   the render order, inline-vs-gallery photo placement (`after`/`caption`), and the `• ` bullet
   convention.

---

## 1. Setup & Smoke Test

Run from the repo root. **The build step is mandatory before tests and preview** — optimized
images and `dist/` bundles are gitignored, so a bare checkout has no AVIF/WebP siblings and no
`dist/manifest.json`.

```bash
npm install            # ~10 packages (esbuild + sharp), expect 0 vulnerabilities
npm run build          # optimize-images (20 source images → 40 .webp/.avif siblings) + esbuild → dist/ + dist/manifest.json
npm run build:static   # pre-render every route → build/
npm test               # node --test (runs the full suite against a real server)
npm start              # preview server at http://localhost:3000
```

What "green" looks like:

- [ ] `npm install` exits 0 with **0 vulnerabilities**. (If `sharp` fails to encode AVIF on this
      platform, stop and report it — it blocks the build and the image tests.)
- [ ] `npm run build` logs `Image optimization complete (N processed).` (N = images whose
      variants were stale; 0 on a warm re-run), then emits **7 hashed bundles +
      `dist/manifest.json`**, exits 0.
- [ ] After build, every Picture-served source has `.webp`/`.avif` siblings (and each article
      cover a `cover-og.jpg` crop):
      `find . \( -path ./node_modules -o -path ./build \) -prune -o -type f \( -iname '*.webp' -o -iname '*.avif' \) -print | wc -l`
      returns two siblings per source image.
- [ ] `npm run build:static` logs `Static build complete → build` and `12 HTML pages + 404.html, 9 articles`.
- [ ] `npm test` reports **0 fail**, exit 0 (the suite's test count is printed in its summary
      line). If any fail, capture the names and treat as **P0** unless clearly environmental.
- [ ] `npm start` prints the running message and `GET /` returns `200 text/html; charset=utf-8`.

> There are **9** news articles and **4** publications (2 conference papers + 1 thesis + 1 report).
> Use `ieee-pess-2025-best-paper-award` wherever a concrete article URL is needed (it is the one
> the tests reference).

---

## 2. Functionality & Routing

Test **both** the live preview (`npm start`, port 3000) and the static `build/` output. They must
converge (asserted by `test/parity.test.js`).

### Routes resolve (server + static build)
- [ ] `/`, `/news`, `/publications`, `/news/ieee-pess-2025-best-paper-award` each return
      **HTTP 200, `text/html; charset=utf-8`**, contain `#root`, and have **no leftover
      `__META_*__` placeholder tokens** in the body.
- [ ] The matching `build/<route>/index.html` files exist and render the same page.
- [ ] **Deep-linking works on first hit** (type the URL + Enter, no prior SPA load): every valid
      route returns full pre-rendered `<head>` meta, then hydrates — no reliance on client JS to
      produce the right `<title>`/canonical.

### 404 handling
- [ ] `/this-does-not-exist` and `/totally/unknown` return **HTTP 404** with the SPA NotFound page;
      `<title>` is `Page not found - Lampros Konstantellos`; canonical/og:url point at home `/`
      (the requested path is **not** reflected anywhere in the HTML); no JSON-LD is emitted.
- [ ] `/news/does-not-exist` (unknown slug) returns **HTTP 404** server-side. **Known gap:** the
      client currently renders a bare "Article not found." line (not the full styled NotFound
      component) for unknown `/news/<x>` — verify and report if it feels like a dead end.
- [ ] `build/404.html` exists and is the same NotFound markup.

### Edge routing
- [ ] Trailing slashes resolve: `/news/`, `/publications/` serve the right page (200), not a 404.
- [ ] `/index.html` issues **HTTP 301 → `/`**.
- [ ] Private/tooling paths (`/server.js`, `/package.json`, `/README.md`, `/news/README.md`,
      `/dist/manifest.json`, `/test/*`, `/scripts/*`, dotfiles) return **404** and never leak
      source; path traversal returns **403**; `%00` / bad `%`-encoding → **400**.

### SPA navigation
- [ ] Clicking each nav item (About, Publications, News, Contact) does **not** full-reload the
      document (watch the Network tab), updates the tab title, and uses the client router.
- [ ] Sub-pages (`/news`, `/publications`, articles) start **scrolled to top** and move focus to
      `<main>`; a home `#section` target smooth-scrolls with the sticky-header offset (~70px);
      plain home scrolls to top.
- [ ] Per-route `<title>` is exact (note the **spaced hyphen ` - `**, not an en-dash):
      home = `Lampros Konstantellos - Electrical & Computer Engineer`; `/news` =
      `News - Lampros Konstantellos`; `/publications` = `Publications - Lampros Konstantellos`;
      article = `<articleTitle> - Lampros Konstantellos`. SPA-navigated titles must match the
      server-rendered ones.
- [ ] **Back/forward** swaps views without reload and keeps the title in sync. The article
      back-link reflects origin: opened from home → «Back to Home» (→ home `#news`); opened from
      `/news` → «Back to News» (→ `/news`); a hard-refreshed/deep-linked article (no history
      state) defaults to «Back to News» — confirm that fallback reads acceptably.
- [ ] `/#publications` and `/#news` (etc.) smooth-scroll to the section on first load.

---

## 3. UI & Interaction Behaviors

Use the browser. Click, hover, Tab, resize, emulate touch. Watch the console throughout.

### Header & nav
- [ ] The sticky header stays pinned with backdrop blur/saturate and a bottom border, above page
      content. The brand (name + role) links home.
- [ ] **Scroll-spy (home only):** the active nav underline follows the section in view
      (About/Publications/News/Contact); no item is active over the hero. Scroll fast and slow —
      the highlight should not flicker or stick at boundaries. On list/article pages the nav
      shows the route-derived highlight (News for `/news` and any article; Publications for
      `/publications`). **Confirm** it's acceptable that "About"/"Contact" are never "active" off
      the home page (there are no standalone About/Contact routes).
- [ ] **No mobile hamburger** — the 4 nav links stay inline at every width. Verify they fit
      without horizontal overflow down to **360px** (see §4).

### Hero
- [ ] The hero photo (`lampros-konstantellos-picture.jpg`) is the LCP image, preloaded as AVIF on
      the home route; it loads promptly and lifts slightly on hover. The three CTAs (View
      publications / Read news / Contact) smooth-scroll to their sections.

### Entrance motion
- [ ] There is **no** entrance/reveal animation: cards, About paragraphs, and chips are visible
      immediately in their final position, on load and after SPA navigation, at every viewport.
      No content may ever be gated behind an IntersectionObserver or `opacity:0` state (the old
      reveal machinery was removed outright; a test guards against reintroducing it).

### News
- [ ] Home news preview shows at most **3** newest cards; «View all →» appears (there are 9
      articles); the section hides entirely if there are zero articles; cards navigate to the
      article and lift/scale the cover image on hover.
- [ ] `/news` renders all 9 articles newest-first; back link returns to home `#news`.
- [ ] **Article photos (see §0.1):** inline photos render at natural aspect ratio (portrait caps
      by height, landscape by width — no distortion), centered, with a caption; end-gallery photos
      (any without `after`) render in the 4:3 grid. Confirm the IEEE award photo sits after the
      award paragraph and the three AI-Hub photos sit beside their relevant paragraphs, captions
      accurate.
- [ ] **Lightbox:** clicking a photo (inline or gallery) opens a modal (body scroll locked, focus
      moved to the close button, focus trapped); Escape / backdrop-click / × close it and restore
      focus to the triggering photo; Enter/Space on a focused photo opens it. **Verify focus
      return after a mouse-open in WebKit/Safari** (non-form elements are not always focused on
      click).
- [ ] **Share row:** the LinkedIn share opens with the **canonical** `https://lamproskonstantellos.com/news/<slug>`
      URL (new tab); «Copy link» copies that canonical URL (not `window.location`), swaps to
      «Copied!» for ~1.8s, and announces via `aria-live`; native «Share» appears only when
      `navigator.share` exists. Verify the `execCommand` clipboard fallback.

### Publications
- [ ] Home preview shows the **3** newest as stacked full-width cards; «View all →» links to
      `/publications`; `/publications` lists all 4 in hairline-separated rows grouped under large
      muted year labels, with filter pills «All (4) / Peer-reviewed (2) / Theses & reports (2)»
      (active pill navy, `aria-pressed`) and a «Back to Home» link. The IEEE paper shows the gold
      award pill; the thesis and report show the navy type pill, inline on the meta row. Card meta
      lines read venue · location · year; list rows omit the year (the group label carries it).

### Contact + footer
- [ ] All 8 contact cards (LinkedIn, Google Scholar, IEEE Xplore, ORCID, Zenodo, ResearchGate,
      GitHub, Email) open the correct target: external links in a new tab with `rel="noopener
      noreferrer"`; Email opens `mailto:info@lamproskonstantellos.com`. Icons hover-scale and the
      external-link glyph appears on hover.
- [ ] Footer shows `© <current year> Lampros Konstantellos` (year derived from `getFullYear()`).

---

## 4. UI/UX & Visual Design Quality

Open each page at desktop, tablet, and mobile widths and actually *look*.

### Layout, spacing, alignment
- [ ] Consistent vertical rhythm; no cramped or oddly large gaps. Sections align to the 1100px
      container.
- [ ] **No horizontal overflow / scrollbars at any width** — check 360, 390, 480, 560, 720, 820,
      960, 1200px. (The header nav previously overran at 360px; confirm the narrow-width fix holds.)
- [ ] Section dividers — confirm the hairline **above the About block is present** and spaced
      evenly (56px both sides), exactly like the dividers between the other home sections.
- [ ] Lonely-item check: the 3-card news preview leaves a single stretched card on row 2 between
      ~720–959px (2 columns); the 8-card contact grid leaves one empty trailing cell ≥721px (3
      columns). Both are acceptable but note if they read as unfinished.

### Typography & hierarchy
- [ ] Exactly one obvious `<h1>` per route; consistent H2/H3 styling; readable body sizes and line
      lengths. On `/news` the card titles are `<h2>`; on `/publications` the year-group labels are
      `<h2>` and the entry titles `<h3>` (no skipped levels).
- [ ] Justified English prose (≥720px, About + article bodies) hyphenates without rivers of
      whitespace; en-dashes and «…» render correctly.

### States, motion, consistency
- [ ] Every interactive element has a clear **hover** state and a visible **:focus-visible**
      outline (2px accent, 2px offset). Tab through nav links, hero CTAs, contact/news/pub cards,
      share buttons, lightbox close, footer — nothing should be unreachable or ring-less.
- [ ] The skip link «Skip to main content» appears on the first Tab and jumps to `#main-content`.
- [ ] Overall impression: colors (navy `#0a1f44` / accent `#1f3a8a` on light `#f4f6f9`), imagery,
      and copy feel cohesive and "delivered," not draft.

---

## 5. Content Correctness (English copy & professional identity)

**Proofread, but do not edit client-facing copy — report for confirmation.**

### Identity & contact
- [ ] Name `Lampros Konstantellos` and role `Electrical & Computer Engineer` consistent across
      `site.config.js` and `data.js`.
- [ ] Public email `info@lamproskonstantellos.com` (site.config.js) is the intended, monitored
      address (distinct from the account email).
- [ ] All 7 social profiles resolve to the correct, current profiles (LinkedIn, Google Scholar,
      IEEE Xplore author, ORCID, Zenodo, ResearchGate, GitHub) — none 404 or point to a stale
      account. `data.js` `contact` == `site.config.js` `socialLinks` (+ Email).

### Publications (factual — confirm with the author)
- [ ] The 2 conference papers (IEEE PESS 2025 «Integration of PV and V2G…»; EVS38 2025 «Financial
      Impact Analysis…») — venue, city, year, co-author order/spelling, award, and the
      IEEE Xplore / VDE Verlag / Proceedings / Zenodo links are correct and resolve.
- [ ] The **Master's thesis** and **Internship report** — titles, institutions (University of
      Patras; TU Munich, Chair of Renewable & Sustainable Energy Systems), years (2025 / 2023),
      and links (Nemertes handle `hdl.handle.net/10889/28931`; Zenodo `14871102` / `13936256`)
      are correct and resolve.
- [ ] The award is written consistently — **flag:** the IEEE article *title* says "Third Best
      Paper Award" while the excerpt, body, About paragraph, and publication card say "3rd Best
      Paper Award". Pick one (numeral dominates 4:1). (Changing the title also touches `<title>`,
      JSON-LD, and tests — owner decision.)

### News articles (9)
- [ ] Every article: `slug` == folder name; `date` `YYYY-MM-DD` agrees with `dateLabel`; body
      facts are accurate. Flag date-sensitive / future-dated articles (several are dated in
      2026 — confirm intended to be live at delivery).
- [ ] Factual claims to confirm: the AI-Hub mayor's name (`Grigoris Alexopoulos`), the Nireas
      prototype details, the Intersolar 2026 statistics (visitor/exhibitor counts, curtailment
      TWh, 4.7 GW storage programme), the EVS38 "4.9%" and "first author" claims, the TU Munich
      chair names, and the deliberately anonymised "23.1 MW Wind Farm" project.
- [ ] British-vs-American spelling: prose is British English (behaviour, modelling, honoured) —
      flag the two "data centers" in `7th-power-gas-forum-athens` (paper *titles* keep their
      official "Behavior" spelling — do not change).
- [ ] No `lorem`/`TODO`/`TBD`/`placeholder` copy; all referenced image paths point to real files.

---

## 6. SEO, Metadata & Feeds

- [ ] Every route has a single non-empty, route-specific `<title>` (spaced-hyphen separator)
      matching `pageTitle()` in `routes.js`.
- [ ] `<meta name="description">` is non-empty and **identical** across `description`,
      `og:description`, `twitter:description` on each route; the article description equals the
      article `excerpt`; no leftover `__META_DESCRIPTION__`.
- [ ] `<link rel="canonical">` is absolute https and **byte-equal to `og:url`** on every 200
      route; on 404 both point at home `/`.
- [ ] OG per route: `og:type` = `website` (home/lists) / `article` (article); `og:locale` =
      `en_US`; `og:site_name` = `Lampros Konstantellos`; `og:image` resolves with a
      `?v=<hash>` cache-buster; `og:image:width/height` accurate when present; `og:image:alt`
      per route. `twitter:card` = `summary_large_image` everywhere, mirroring OG.
- [ ] JSON-LD: home `@graph` = `WebSite` + `ProfilePage`→`Person` (name/jobTitle/`sameAs` ==
      socialLinks); `/news` and `/publications` carry `BreadcrumbList`; the article carries
      `Article` (headline/datePublished==dateModified/author/publisher/`inLanguage=en`) +
      `BreadcrumbList`. **Validate with Google Rich Results Test (0 errors)**; confirm `<` is
      escaped (no `</script>` breakout — covered by `test/injection.test.js`).
- [ ] Favicons & manifest: `favicon.svg` (renders the navy "LK" glyph), the `favicon-16…512`
      PNG set, `favicon.ico`, `apple-touch-icon.png`, `site.webmanifest` all return 200; manifest
      is valid JSON (theme_color `#0a1f44`, `lang: "en"`, full icon set including maskable
      entries).
- [ ] `robots.txt`: `User-agent: *`, `Allow: /`, absolute `Sitemap:`; no `noindex` anywhere.
- [ ] `sitemap.xml`: well-formed, **12 `<loc>`** (home + /news + /publications + 9 articles), all
      absolute https, `lastmod` `YYYY-MM-DD`. Static-page lastmod derives from the newest article
      date — confirm acceptable if that date is in the future.
- [ ] `rss.xml`: valid RSS 2.0, **9 items**, newest-first, `guid` isPermaLink, `atom:link
      rel=self`, `<language>en</language>`; content-type `application/rss+xml`.
- [ ] `feed.json`: valid JSON Feed 1.1, `language=en`, **9 items** newest-first (same order as
      rss.xml), content-type `application/feed+json`; matches `test/golden/feed.json`. **Note:**
      feeds are **news-only** — publications are intentionally not in sitemap/rss/feed.
- [ ] **LCP preload:** raw home HTML contains
      `<link rel="preload" as="image" href="/lampros-konstantellos-picture.avif" type="image/avif" fetchpriority="high">`,
      and that AVIF **returns 200 in the built output**. Confirm every `<picture>` AVIF/WebP source
      resolves at runtime (Network tab, no image 404s).
- [ ] Feed/article count integrity: sitemap/rss/feed article count == non-draft `news/` folder
      count (folders whose name ≠ slug are silently skipped — assert the **count**, 9 today).

---

## 7. Accessibility

- [ ] `<html lang="en">` present; each route has **exactly one `<h1>`** and no skipped heading
      levels (run axe-core / Lighthouse; confirm the `/news` and `/publications` card titles are
      `<h2>`).
- [ ] Color contrast meets **WCAG AA (4.5:1)** for body text, nav, buttons, muted meta text, and
      the award/type pills (contrast for body pairs + the award pill is recomputed in
      `test/a11y.test.js` — spot-check the new `.pub-type` pill: accent on a light navy tint).
- [ ] Image alt text: decorative inline SVG icons carry `aria-hidden="true"` (see `icons.jsx`);
      meaningful images have descriptive alt (hero = name, article covers/photos = caption or
      title). **No image is missing `alt`.**
- [ ] Icon-only / control names: the lightbox close is «Close photo viewer»; the photo tiles have
      «Open … in full screen»; social links have accessible names via visible labels; the map — n/a
      (no map on this site).
- [ ] Full keyboard operability: the carousel — n/a (no carousel); the lightbox (open/trap/Escape/
      return focus) and every link/button. Inactive elements are not keyboard-reachable.
- [ ] Visible focus ring on all keyboard-focused elements; confirm `#main-content:focus{outline:
      none}` only suppresses the ring for **programmatic** route-change focus, not real keyboard
      navigation.
- [ ] **Reduced-motion:** CSS animations/transitions and CSS smooth-scroll are disabled; reveal
      elements still end visible; JS `window.scrollTo({behavior})` now honors reduced-motion (nav
      clicks / hash jumps become instant) — verify it no longer animates under
      `prefers-reduced-motion: reduce`.

---

## 8. Performance

- [ ] Run **Lighthouse** (mobile + desktop) on home and one interior page against the built
      output; note Performance / Accessibility / Best-Practices / SEO scores and any actionable
      flags.
- [ ] LCP image (hero AVIF) is preloaded and loads promptly; `<picture>` negotiates
      AVIF→WebP→original (confirm in Network which format the browser fetches).
- [ ] No render-blocking surprises, no layout shift on load (watch CLS — note that inline article
      figures load below the fold at natural ratio; confirm no jarring shift), no oversized images.
- [ ] Cache-Control classes are correct: HTML → `no-cache, no-store, must-revalidate`; `/dist/*`
      or any `?v=` URL → `public, max-age=31536000, immutable`; feeds → `public, max-age=3600`;
      other static → `public, max-age=86400`. The static `build/_headers` must encode the same.

---

## 9. Security Headers, CSP & Console Cleanliness

- [ ] All **7 security headers** present on **every** response (including 404/403/405):
      `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`,
      `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()`,
      `Cross-Origin-Opener-Policy: same-origin`, and a full `Content-Security-Policy`. Check `/`,
      an interior route, an asset, and a 404. (`build/_headers` must reproduce them verbatim.)
- [ ] CSP is tight and matches what the page loads (Inter is self-hosted from `/vendor/fonts/`,
      so no font origins appear):
      `default-src 'self'; script-src 'self' https://plausible.io; style-src 'self'
      'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'
      https://plausible.io; object-src 'none'; base-uri 'self'; frame-ancestors 'none';
      form-action 'none'`. Confirm **Plausible** (`plausible.io`) is whitelisted in `script-src`
      **and** `connect-src`, and **nothing else external**. Note `style-src 'unsafe-inline'` is
      intentional (React inline `style` props) — a known trade-off.
- [ ] **Console + Network must be clean** while clicking through every page/interaction: **zero
      CSP violations**, zero JS errors, zero 404s (especially image AVIF/WebP siblings and the LCP
      preload). The Plausible script must load (or be gracefully absent) without CSP errors; the
      self-hosted Inter woff2 files must load from this origin.
- [ ] Server robustness (covered by `test/security.test.js`, spot-confirm): bad `%`-encoding /
      `%00` → 400; path traversal / private paths → 403/404 and never leak source; `OPTIONS` → 204
      with `Allow`; other methods → 405; the server stays up after malformed input.

---

## 10. Cross-Browser / Cross-Device

- [ ] Verify the above in **Chromium**; smoke-test **WebKit** via Playwright (Safari focus-return
      on the lightbox mouse-open path is the known risk).
- [ ] Emulate real mobile (iPhone-class width + touch) and tablet: nav fits, tap targets ≥44px,
      inline photos and the lightbox behave.
- [ ] Confirm no console errors or visual breakage specific to any one viewport/engine.

---

## Required Deliverable / Report Format

Produce a single report with these sections, in this order:

### 1. Verdict
One line: **READY** or **NOT READY**, with a one-sentence justification.

### 2. Issues by Severity
A grouped list. For each issue: **severity (P0–P3), file:line (if code), what's wrong, how it
manifests for the user, recommended fix.**

### 3. Polish Fixes Applied
Every tiny change actually made, each with a diff or `file:line` and a one-line rationale. If
none, say so. (No client-facing copy edits without flagging; no non-trivial changes.)

### 4. Open Questions for the Owner
Anything needing a human decision: copy/spelling confirmations, factual claims (publication
details, awards, dates, co-authors, statistics), email/social-profile verification, future-dated
articles, the "3rd/Third" award wording, and any "is this intended?" behavior (About/Contact never
active off-home; publications not in feeds).

### 5. Test & Build Evidence
The result of `npm install` / `npm run build` / `npm run build:static` / `npm test` (pass counts,
any failures), the Lighthouse scores, and confirmation of a clean console/network across the
click-through.

Be direct and specific. Prefer "the news preview leaves a stretched lonely card at 800px" over
"looks a bit off." Cite file:line wherever you can.
