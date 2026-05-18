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

(window.NEWS_ARTICLES = window.NEWS_ARTICLES || []).push({
  slug: "my-article-slug",
  date: "2026-05-12",                       // YYYY-MM-DD — used for sorting
  dateLabel: "May 12, 2026",                // human-readable
  location: "Athens",                       // optional
  title: "Title of the article",
  excerpt: "One- or two-sentence preview shown on the card.",
  cover: "news/my-article-slug/cover.jpg",  // optional
  photos: [                                 // optional
    "news/my-article-slug/photo-01.jpg",
    "news/my-article-slug/photo-02.jpg",
  ],
  body: [
    "First paragraph. Use **double asterisks** for inline bold.",
    "Second paragraph.",
  ],
  sources: [                                // optional
    { label: "Source name", href: "https://example.com" },
  ],
});
```

4. That's it — the article is auto-discovered on the next request and will appear at `/news/my-article-slug`, on the homepage News preview (if among the 3 most recent), and on the `/news` list page. No edits to `data.js` or `index.html` needed.

The `window.NEWS_ARTICLES = window.NEWS_ARTICLES || []` guard means file load order between articles does not matter.

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

Edit `LIMITS.newsPreview` in `/data.js` (default: `3`). The "All N articles" link automatically appears on the homepage when there are more articles than the cap.
