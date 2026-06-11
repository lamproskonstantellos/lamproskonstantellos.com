# News Articles

Each article is a self-contained package inside its own folder under `news/<slug>/` — the text, the cover image, and any in-article photos all live together. Articles are sorted automatically by `date` (newest first) — both on the homepage News preview (capped at 3) and on the full `/news` list page.

`server.js` scans `news/` on every request and injects a `<script>` tag for each `news/<slug>/article.js` it finds, so adding an article requires no edits to `data.js` or `index.html`.

## Add a new article

1. Create a new folder: `news/<slug>/`.
2. Drop the cover image as `news/<slug>/cover.jpg` (16:10 ratio works best for the card thumbnail). Optionally drop in-article photos as `photo-01.jpg`, `photo-02.jpg`, …
3. Create `news/<slug>/article.js` using the template below:

```js
/* ============================================================
   Title of the article
   ============================================================ */

defineArticle({
  slug: "my-article-slug",
  date: "2026-05-12",                        // YYYY-MM-DD — used for sorting
  dateLabel: "May 12, 2026",                 // human-readable, shown on the card
  location: "Athens",                        // optional — shown after the date
  title: "Title of the article",
  excerpt: "One- or two-sentence preview shown on the card.",
  cover: "news/my-article-slug/cover.jpg",   // optional — card + article cover
  photos: [                                  // optional — gallery
    "news/my-article-slug/photo-01.jpg",
    // Or, to crop a photo from its top instead of centre:
    { src: "news/my-article-slug/photo-02.jpg", align: "top" },
  ],
  body: [
    "First paragraph. Use **double asterisks** for inline bold.",
    "Second paragraph.",
  ],
  // ---- Optional SEO fields (used in JSON-LD / RSS / JSON Feed) ----
  keywords: ["topic one", "topic two"],      // string[] → Article.keywords + feed tags
  articleSection: "Conferences and Awards",  // string   → Article.articleSection
  topics: [                                  // {name, sameAs}[] → Article.about
    { name: "Vehicle-to-Grid", sameAs: "https://en.wikipedia.org/wiki/Vehicle-to-grid" },
  ],
  sources: [                                 // optional — shown under the article
    { label: "Source name", href: "https://example.com" },
  ],
});
```

4. That's it — the article is auto-discovered on the next request and will appear at `/news/my-article-slug`, on the homepage News preview (if among the 3 most recent), and on the `/news` list page. No edits to `data.js` or `index.html` needed.

### Fields

| Field | Required | Type | Used for |
|-------|----------|------|----------|
| `slug` | ✅ | string | URL `/news/<slug>` — must equal the folder name; lowercase letters, digits and hyphens only |
| `date` | ✅ | `YYYY-MM-DD` | Sorting (newest first), sitemap/RSS/feed dates |
| `dateLabel` | ✅ | string | Human-readable date on the card/article |
| `title` | ✅ | string | Heading, `<title>`, JSON-LD headline |
| `excerpt` | ✅ | string | Card preview, meta description, RSS/feed summary |
| `body` | ✅ | string[] | Article paragraphs (`**bold**` supported); also JSON-LD `articleBody` |
| `location` | optional | string | Shown after the date |
| `cover` | optional | path | Card thumbnail + article cover (`og:image` for the article) |
| `photos` | optional | (string \| `{ src, align }`)[] | Gallery; `align: "top"` crops from the top |
| `keywords` | optional | string[] | JSON-LD `keywords` + JSON Feed `tags` |
| `articleSection` | optional | string | JSON-LD `articleSection` |
| `topics` | optional | `{ name, sameAs }`[] | JSON-LD `about` |
| `sources` | optional | `{ label, href }`[] | Source links under the article |

Validation lives in `article-schema.js` (`validateArticle`) and runs in **both**
the browser (`defineArticle`, throwing a clear console error) and the server
(`loadArticleMeta`, which logs and skips an invalid article so bad data never
reaches the feeds). It enforces the required fields, the `YYYY-MM-DD` date
format, and that `body`/`photos`/`sources`/`keywords`/`topics` are arrays. The
legacy `(window.NEWS_ARTICLES = window.NEWS_ARTICLES || []).push({ ... })` form
still works if you ever need it.

## Folder structure

```
news/
├── README.md
└── 7th-power-gas-forum-athens/
    ├── article.js            ← article text, metadata, sources
    ├── cover.jpg             ← card / article cover
    ├── photo-01.jpg          ← optional in-article gallery
    └── photo-02.jpg
```

## Routes

- `/`               — homepage with News preview (max 3, newest first)
- `/news`           — full list of all articles
- `/news/<slug>`    — single article view

## Tweaking the homepage cap

Edit `LIMITS.newsPreview` in `/data.js` (default: `3`). The "View all" link automatically appears on the homepage when there are more articles than the cap.
