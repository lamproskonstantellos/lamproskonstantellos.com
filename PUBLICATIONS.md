# Publications

Every publication on the site — peer-reviewed papers, theses, and reports —
lives in **exactly one place**: the `publications` array in [`data.js`](./data.js).
Add one object there and it appears everywhere automatically:

- the **homepage preview** (the 3 most recent, as equal-height white cards),
- the **`/publications` page** (all entries, newest first, grouped under large
  year labels),
- the **filter pills** on `/publications` (`All (…) / Journal articles (…) /
  Conference papers (…) / Theses & reports (…)` — the counts update by
  themselves).

There is no per-publication page or URL — entries render inside those two
views — so adding one never touches routes, HTML, or the build setup.

## Journal articles vs conference papers vs theses & reports — how the split works

Two optional fields drive everything: **`type`** and **`kind`**.

| You set | The entry is treated as | What renders |
|---------|------------------------|--------------|
| `kind: "journal"` (no `type`) | Peer-reviewed **journal article** | No badge (unless it has an `award`) |
| `kind: "conference"` or *(neither field)* | Peer-reviewed **conference paper** | No badge (unless it has an `award`) |
| `type: "Master's Thesis"` (or `"Internship Report"`, `"PhD Thesis"`, …) | **Thesis / report** | A **navy outline badge** with that exact text |

- The `/publications` filters split every entry into exactly one of
  **Journal articles** (`kind: "journal"`, no `type`), **Conference papers**
  (the remaining entries without `type`), and **Theses & reports** (entries
  *with* `type`). The counts in the pill labels are computed from the data —
  never edit them by hand.
- A peer-reviewed entry without `kind` counts as a **conference paper** (the
  historical default). Set `kind: "conference"` anyway — the explicit value
  is what keeps the split scannable in the data. `kind` is ignored on typed
  (thesis / report) entries — don't set both.
- **`award`** (e.g. `"3rd Best Paper Award"`) renders as a **gold badge**. Use
  `award` *or* `type` on an entry, not both — they occupy the same badge slot
  on the meta row, and an awarded paper is by definition peer-reviewed.
- Badge text renders verbatim, at its natural width — keep it short
  (2–4 words).

## Add a new publication — step by step

1. Open [`data.js`](./data.js) and find the `publications: [ … ]` array.
2. Add a new object **at the position that keeps the array newest-first**
   (entries sort by `Number(year)` descending automatically, but entries
   *within the same year* keep their array order — so put the newest of a
   year above the older ones).
3. Use this template:

```js
{
  // Pick the entry's category:
  //  - peer-reviewed journal article  → kind: "journal"      (no `type`)
  //  - peer-reviewed conference paper → kind: "conference"   (no `type`)
  //  - thesis / report → OMIT `kind` and SET `type` instead — it becomes
  //    the navy badge and files the entry under "Theses & reports":
  kind: "conference",
  // type: "Master's Thesis",

  venue: "University of Patras",     // REQUIRED — first token of the meta line
                                     // (conference, journal, or institution)
  location: "Patras, Greece",        // optional — second token of the meta line
                                     // (omit for journals — they have no venue city)
  year: "2025",                      // REQUIRED — a STRING; drives sorting and
                                     // the big year label on /publications

  title: "Full publication title exactly as published",   // REQUIRED

  // REQUIRED — wrap YOUR name in ** so it renders bold; end with the year
  // in parentheses, matching the existing citation style:
  authors: "**Konstantellos, L.**, Coauthor, A., & Coauthor, B. (2025)",

  award: "3rd Best Paper Award",     // optional — gold badge (peer-reviewed only)
  description: "Optional one-line summary shown under the authors.",

  // optional — the EXACT IEEE-style reference the Cite button copies
  // (pages, DOI, venue as published). When omitted, the button falls back
  // to a line assembled from the fields above:
  citation: 'L. Konstantellos and A. Coauthor, "Full publication title," Venue, City, Country, 2025, pp. 1-6, doi: 10.xxxx/xxxxxx.',

  links: [                           // REQUIRED — at least one, https only
    { label: "IEEE Xplore", href: "https://ieeexplore.ieee.org/document/…" },
    { label: "Zenodo",      href: "https://zenodo.org/records/…" },
  ],
},
```

4. Rebuild and check (see the checklist below). That's the whole job — no
   other file changes.

## Field reference

| Field | Required | Type | Used for |
|-------|----------|------|----------|
| `venue` | ✅ | string | First token of the uppercase meta line (conference, journal, or institution) |
| `year` | ✅ | string (`"2025"`) | Newest-first sorting and the `/publications` year-group label; homepage cards also show it on the meta line |
| `title` | ✅ | string | The entry heading |
| `authors` | ✅ | string | Author line; `**…**` renders bold (use it on your own name); keep the `(YYYY)` suffix |
| `links` | ✅ | `{ label, href }[]` | Quiet text links with the ↗ mark; each opens in a new tab |
| `location` | optional | string | Second token of the meta line (`City, Country`); omit for journals |
| `kind` | optional | `"journal"` / `"conference"` | Files a peer-reviewed entry under the **Journal articles** or **Conference papers** filter; without it a peer-reviewed entry counts as a conference paper. Ignored on typed entries |
| `type` | optional | string | Navy badge text **and** what files the entry under **Theses & reports** (see above) |
| `award` | optional | string | Gold badge text (e.g. an award); use instead of `type`, never together |
| `citation` | optional | string | The exact IEEE-style reference the **Cite** button copies (pages, DOI, venue as published) — **end it with the DOI** (`… doi: 10.xxxx/yyyy.`): the `/publications` JSON-LD extracts the DOI from exactly that tail position (see SEO notes). When omitted the button falls back to a line assembled from the fields above |
| `description` | optional | string | One-line summary under the authors (also the place to explain e.g. an online-first year vs the printed issue year) |

## Where and how entries render

- **Homepage** — the 3 most recent entries as stacked, full-width white cards.
  All three cards share **one height** (the tallest sets it) and the links pin
  to the bottom edge, so the set reads as a uniform block; a new, longer entry
  simply raises the shared height. The cap lives in `LIMITS.publicationsPreview`
  (`data.js`, default `3`); a "View all" link appears automatically when there
  are more entries than the cap.
- **`/publications`** — every entry as a hairline-separated row, grouped under
  a large muted year label. The year is *not* repeated on the row's meta line
  (the group label carries it); it still appears in the `(YYYY)` of the author
  line. Filter pills sit above the list.
- The meta line separates its tokens with `·` dots and wraps gracefully on
  small screens; the badge drops to its own line when the row gets narrow.

## Publishing checklist

These rules are ENFORCED, not advisory: `server.js` (`validatePublications`)
throws on load — so `npm start`, `npm test` and the Cloudflare build all fail
loudly — for a missing/empty `title`/`authors`/`venue`/`citation`, a `year`
that is not a `"YYYY"` string, an empty `links` array, a link without an
`https://` href, or an entry setting both `award` and `type`.

1. `npm run build && npm test` — the suite validates the rendered pages and
   must stay green (it also asserts filter predicates split the set cleanly).
2. `npm start` → open `http://localhost:3000/#publications` and
   `http://localhost:3000/publications`: check the entry text, the badge, the
   filter counts, and click every link.
3. Verify each `href` opens the right page in a browser (links are external —
   nothing on the site checks them for you).
4. Commit + push: Cloudflare Pages builds and deploys automatically.

## SEO notes

- **Every entry emits structured data.** The `/publications` page carries a
  JSON-LD `ItemList` with one node per entry (built in `server.js` →
  `PUBLICATIONS_ITEMLIST`), typed from your fields: `type` containing
  "thesis" → `Thesis`, any other `type` → `Report`, otherwise
  `ScholarlyArticle`. Getting the fields right is what keeps this block
  truthful:
  - **DOI** — extracted from the **tail** of `citation`
    (`… doi: 10.xxxx/yyyy.` — trailing punctuation is stripped). A citation
    without a DOI at the end, or a missing `citation`, silently drops the
    `identifier`/`sameAs` from that entry's node (the first `links` href is
    used as `sameAs` instead). Keep the DOI last, as the template shows.
  - **Authors** — parsed from the visible `authors` line into one `Person`
    node per author, so keep it in the `Surname, I., Surname, I., &
    Surname, I. (YYYY)` shape the template uses. The full list ships to the
    schema; never list fewer authors than the DOI registration.
  - **Title** — must be unique across entries (a consistency test enforces
    it; the list rows and the schema both key on it).
- The `/publications` page's `<title>`, meta description, canonical URL, and
  breadcrumb JSON-LD are pre-rendered automatically. The meta description text
  lives in `routes.js` (`PUBLICATIONS_DESCRIPTION` — shared by the server
  render and the client head-sync); refresh it only if the character of the
  list changes materially (e.g. a new publication domain).
- Accurate titles/venues matter more than markup here: Google Scholar and the
  contact-section profile links (Scholar, ORCID, IEEE) are the canonical
  discovery surface for the papers themselves.

## Common mistakes

- **`year` as a number** — write `"2025"` (a string), like every existing entry.
- **Forgetting `kind: "journal"` on a journal article** — the entry silently
  files under **Conference papers** (the default for peer-reviewed entries).
- **Both `award` and `type` on one entry** — pick one; they share the badge slot.
- **Forgetting `**…**` around your name** in `authors` — the bold is what makes
  authorship scannable.
- **Appending an entry at the end of the array** — same-year entries keep array
  order, so a new 2025 paper added *below* an older 2025 one renders after it.
  Keep the array newest-first top to bottom.
- **Editing the filter counts** — they are computed; only the data changes.
