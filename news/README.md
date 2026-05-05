# News Articles

Each article lives in its own folder under `news/`. Articles are sorted automatically by `date` (newest first) — both on the homepage News preview (capped at 3) and on the full `/news` list page.

## Add a new article

1. Create a new folder: `news/<slug>/`
2. Drop the cover image as `news/<slug>/cover.jpg` (16:10 ratio works best for the card thumbnail).
3. Optionally drop in-article photos as `photo-01.jpg`, `photo-02.jpg`, …
4. Add a new entry to `PROFILE.news` in `/data.js`:

```js
{
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
}
```

That's it — the article will appear at `/news/my-article-slug`, on the homepage News preview (if among the 3 most recent), and on the `/news` list page.

## Folder structure

```
news/
├── README.md
└── 7th-power-gas-forum-athens/
    ├── cover.jpg              ← card / article cover
    ├── photo-01.jpg           ← optional in-article gallery
    └── photo-02.jpg
```

## Routes

- `/`               — homepage with News preview (max 3, newest first)
- `/news`           — full list of all articles
- `/news/<slug>`    — single article view

## Tweaking the homepage cap

Edit `LIMITS.newsPreview` in `/data.js` (default: `3`). The "All N articles" link automatically appears on the homepage when there are more articles than the cap.
