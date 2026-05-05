# News Articles

Each article lives in its own folder. To add a new article:

1. Create a new folder: `news/<slug>/`
2. Add entry to `PROFILE.news` array in `/data.js`
3. Optionally drop images:
   - `cover.jpg` — card thumbnail (16:10 ratio works best)
   - `photo-01.jpg`, `photo-02.jpg`, … — in-article gallery

## Folder structure

```
news/
├── README.md                          ← this file
└── 7th-power-gas-forum-athens/
    ├── cover.jpg                      ← card cover image
    ├── photo-01.jpg                   ← article gallery
    └── photo-02.jpg
```

## Adding photos to an existing article

Drop images into the article folder, then update the `photos` array in `data.js`:

```js
photos: [
  "news/7th-power-gas-forum-athens/photo-01.jpg",
  "news/7th-power-gas-forum-athens/photo-02.jpg",
],
```

And set the cover:

```js
cover: "news/7th-power-gas-forum-athens/cover.jpg",
```
