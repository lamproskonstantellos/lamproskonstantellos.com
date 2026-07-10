# News Articles

Each article is a self-contained package inside its own folder under `news/<slug>/`: the text, the cover image, and any in-article photos all live together. Articles are sorted automatically by `date` (newest first), both on the homepage News preview (capped at 3) and on the full `/news` list page.

The static build (`build-static.js`) discovers `news/` at build time and injects a `<script>` tag for each `news/<slug>/article.js` it finds, and the local preview server (`server.js`) does the same on each request, so adding an article requires no edits to `data.js` or `index.html`.

## Add a new article

1. Create a new folder: `news/<slug>/`.
2. Drop the cover image as `news/<slug>/cover.jpg` (16:10 ratio works best for the card thumbnail). Optionally drop in-article photos as `photo-01.jpg`, `photo-02.jpg`, … You commit only the source `.jpg`/`.png`; `npm run build` (which runs `optimize-images`) generates the `.webp`/`.avif` siblings the site serves, and Cloudflare does this automatically on deploy.
3. Create `news/<slug>/article.js` using the template below:

```js
/* ============================================================
   Title of the article
   ============================================================ */

defineArticle({
  slug: "my-article-slug",
  date: "2026-05-12",                        // YYYY-MM-DD, used for sorting
  dateLabel: "May 12, 2026",                 // human-readable, shown on the card
  location: "Athens",                        // optional, shown after the date
  title: "Title of the article",
  excerpt: "One- or two-sentence preview shown on the card.",
  cover: "news/my-article-slug/cover.jpg",   // optional: card + article cover
  coverAlign: "top",                         // optional: crop the cover + thumbnail from the top instead of centre
  photos: [                                  // optional: article photos — see "Photos" below
    // Inline, right after body paragraph index 1, with a caption:
    { src: "news/my-article-slug/photo-01.jpg", after: 1, caption: "What the photo shows." },
    // No `after` → end-of-article gallery. `align: "top"` crops a gallery photo from the top:
    { src: "news/my-article-slug/photo-02.jpg", align: "top" },
    "news/my-article-slug/photo-03.jpg",     // a bare string also works (end gallery, no caption)
  ],
  video: "news/my-article-slug/video.mp4",         // optional: self-hosted <video>
  videoWebm: "news/my-article-slug/video.webm",    // optional: VP9/AV1 open-codec fallback source
  poster: "news/my-article-slug/video-cover.jpg",  // optional: still shown before the video plays
  captions: "news/my-article-slug/video.vtt",      // optional: WebVTT captions track for the video
  body: [
    "First paragraph. Use **double asterisks** for inline bold.",
    "• A bullet — prefix a paragraph with a literal '• ' (there is no Markdown list syntax).",
    "Second paragraph.",
  ],
  // ---- Optional SEO fields (used in JSON-LD / RSS / JSON Feed) ----
  keywords: ["topic one", "topic two"],      // string[] → Article.keywords + feed tags
  articleSection: "Conferences and Awards",  // string   → Article.articleSection
  topics: [                                  // {name, sameAs}[] → Article.about
    { name: "Vehicle-to-Grid", sameAs: "https://en.wikipedia.org/wiki/Vehicle-to-grid" },
  ],
  sources: [                                 // optional, shown under the article
    { label: "Source name", href: "https://example.com" },
  ],
});
```

4. That's it: the article is auto-discovered at build time and, on the next deploy (a git push), will appear at `/news/my-article-slug`, on the homepage News preview (if among the 3 most recent), and on the `/news` list page. No edits to `data.js` or `index.html` needed.

### Fields

| Field | Required | Type | Used for |
|-------|----------|------|----------|
| `slug` | ✅ | string | URL `/news/<slug>`; must equal the folder name (lowercase letters, digits and hyphens only) |
| `date` | ✅ | `YYYY-MM-DD` | Sorting (newest first), sitemap/RSS/feed dates |
| `dateLabel` | ✅ | string | Human-readable date on the card/article |
| `title` | ✅ | string | Heading, `<title>`, JSON-LD headline |
| `excerpt` | ✅ | string | Card preview, RSS/feed summary, and the meta description when `seoDescription` is absent |
| `body` | ✅ | string[] | Article paragraphs (`**bold**` supported); also JSON-LD `articleBody` |
| `seoDescription` | optional | string | Shorter (≤~160 char) meta/OG/Twitter/JSON-LD description; falls back to `excerpt` when omitted |
| `location` | optional | string | Shown after the date |
| `cover` | optional | path | Card thumbnail + article cover (`og:image` for the article) |
| `coverAlign` | optional | `"top"` | Crop the cover + card thumbnail from the top instead of the centre |
| `photos` | optional | (string \| `{ src, align?, after?, caption? }`)[] | Article photos — see [Photos](#photos) below |
| `video` | optional | path | Self-hosted `<video>` embed (e.g. `news/<slug>/video.mp4`) |
| `videoWebm` | optional | path | VP9/AV1 WebM fallback `<source>` for browsers without the H.264 decoder |
| `poster` | optional | path | Still image shown before the video plays (no poster is shown if omitted) |
| `captions` | optional | path | WebVTT (`.vtt`) captions track for the video; renders as a default `<track kind="captions">` (English) |
| `videoAfter` | optional | number | Render the video inline right after this body paragraph index (default: after the body) |
| `keywords` | optional | string[] | JSON-LD `keywords` + JSON Feed `tags` |
| `articleSection` | optional | string | JSON-LD `articleSection` |
| `topics` | optional | `{ name, sameAs }`[] | JSON-LD `about` |
| `sources` | optional | `{ label, href }`[] | Source links under the article |

### Photos

Each entry in `photos` is either a bare path string or an object `{ src, align?, after?, caption? }`:

- **`after`** (number) — render the photo **inline**, right after the `body` paragraph at that (0-based) index, instead of in the end gallery. Inline photos show whole, at their natural aspect ratio (portrait or landscape), capped in size.
- **`caption`** (string) — a short caption shown beneath an inline photo (also used as its alt text).
- **`align: "top"`** — for a **gallery** photo (one without `after`), crop from the top instead of the centre when the subject sits high in the frame. Gallery photos are shown in a 4:3 grid.
- A **bare string** is shorthand for `{ src }` — an uncaptioned gallery photo.

Photos without `after` collect into a gallery grid at the end of the article. Both inline and gallery photos open in a full-screen lightbox on click (or Enter/Space when focused).

**Render order** of an article: cover → body paragraphs (with any inline photos — and the video, if `videoAfter` is set — interleaved) → video (if not placed inline) → end gallery → share row → sources.

### SEO checklist

Everything page-level (title, canonical, Open Graph/Twitter tags, `Article`
JSON-LD, `sitemap.xml`, `rss.xml`, `feed.json`) is generated automatically at
build time — you only supply good inputs:

1. **`excerpt`** — one or two sentences; it is the card preview, the feed
   summary, and the meta description fallback.
2. **`seoDescription`** — add it when the excerpt runs past ~160 characters, so
   Google shows a clean snippet instead of truncating.
3. **`keywords` / `articleSection` / `topics`** — power JSON-LD rich results
   and feed tags; `topics` entries should point `sameAs` at a canonical page
   (e.g. Wikipedia).
4. **`cover.jpg`** — commit the raw image; the build derives the 1200×630
   `cover-og.jpg` social card (smart-cropped) that LinkedIn/WhatsApp show on
   shares, plus the `.webp`/`.avif` variants the page serves.
5. **Bold sparingly** — `**bold**` phrases render highlighted on the page and
   are stripped to plain text in JSON-LD and the feeds.

### Body formatting

`body` is an array of strings, each rendered as one `<p>`. The only inline formatting is **`**bold**`** (double asterisks) — there is no Markdown link or list syntax. For a bulleted list, make each bullet its own `body` entry beginning with a literal `• ` (see `renewable-energytech-expo-thessaloniki/article.js`).

Validation lives in `article-schema.js` (`validateArticle`) and runs in **both**
the browser (`defineArticle`, throwing a clear console error) and the server
(`loadArticleMeta`, which logs and skips an invalid article so bad data never
reaches the feeds). It enforces the required fields, the `YYYY-MM-DD` date
format, and that `body`/`photos`/`sources`/`keywords`/`topics` are arrays. The
legacy `(window.NEWS_ARTICLES = window.NEWS_ARTICLES || []).push({ ... })` form
still works if you ever need it.

## Publishing checklist

1. **Build:** `npm run build` — compiles the JSX and generates the `.webp`/`.avif`
   siblings plus the article's `cover-og.jpg` social crop.
2. **Test:** `npm test` — the suite must stay green (it validates every
   discovered article, the feeds, and the sitemap). Watch the log for a
   `Skipping article "<slug>"` error naming your slug: an invalid article is
   **skipped with a message**, not shipped broken (`npm start` prints the same
   error on boot).
3. **Preview:** `npm start` → open `http://localhost:3000/news/<slug>` and the
   homepage. Check the card, the cover crop, inline photos/captions, the
   gallery, the video (if any), and the share row.
4. **Ship:** commit the folder (only source `.jpg`/`.png`/`.mp4` — generated
   variants are gitignored) and push. Cloudflare Pages builds and deploys
   automatically; the article also enters `sitemap.xml`, `rss.xml`, and
   `feed.json` on its own.

## Common mistakes

- **`slug` ≠ folder name** — the two must match exactly, or the article is
  rejected at build time (the URLs would otherwise point nowhere).
- **Date format** — `date` must be `YYYY-MM-DD`; `dateLabel` is free-form and
  shown to readers. Articles sort by `date`, so a typo reorders the list.
- **Paths without the folder prefix** — every `cover`/`photos`/`video` path
  starts with `news/<slug>/…`, not just the filename.
- **Committing generated files** — never commit `.webp`, `.avif`, or
  `cover-og.jpg`; the build regenerates them (they are gitignored anyway).
- **Huge originals are fine** — the pipeline caps display variants at 2200px
  wide and serves those; the raw file stays as the fallback. But a video ships
  as-is: keep `video.mp4` reasonably sized (and remux with `+faststart` so
  playback starts before the whole file downloads).
- **`after` is 0-based** — `after: 1` places a photo after the *second* body
  paragraph.

## Folder structure

```
news/
├── README.md
└── ai-hub-mayor-western-achaia/
    ├── article.js            ← article text, metadata, sources
    ├── cover.jpg             ← card / article cover
    ├── photo-01.jpg          ← optional in-article gallery
    ├── photo-02.jpg
    └── photo-03.jpg
```

## Routes

- `/`: homepage with News preview (max 3, newest first)
- `/news`: full list of all articles
- `/news/<slug>`: single article view

## Tweaking the homepage cap

Edit `LIMITS.newsPreview` in `/data.js` (default: `3`). The "View all" link automatically appears on the homepage when there are more articles than the cap.
