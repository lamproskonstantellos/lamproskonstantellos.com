/* ============================================================
   feeds.js — single source of truth for the generated feeds
   ------------------------------------------------------------
   Pure builders for sitemap.xml, rss.xml and feed.json, shared
   by the live server (server.js, request time) and the static
   build (build-static.js, build time) so the two outputs can
   never drift. Each builder takes the already-loaded, validated
   article meta objects plus the site config and returns the
   EXACT response body string the server serves.

   `articles` are the objects produced by loadArticleMeta:
     { slug, date, title, excerpt, body, cover?, keywords?, ... }
   buildSitemap emits one <url> per article in the order given
   (folder order, matching server.js); buildRss and buildFeed
   sort newest-first via the shared comparator.

   Node-only (require), like server.js — never loaded in the
   browser. Depends only on the dual article-schema module, so it
   has no require cycle with server.js.
   ============================================================ */

"use strict";

// escapeHtml comes from the shared dual module (no require cycle with
// server.js — server.js imports it from the same place), so the RSS feed
// escapes EXACTLY as the served HTML does by construction. The two modules
// used to carry hand-synchronized copies whose byte-identity was enforced
// only by a comment.
const { compareByDateDesc, plainBody, escapeHtml } = require("./article-schema.js");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// sitemap.xml — home, /news and /publications, then one <url> per article in
// the order given. Each index page's lastmod tracks ITS OWN content: /news the
// newest article, /publications the newest publication year (as YYYY-01-01 —
// publications carry no finer date — capped at the newest article date so a
// future issue year never emits a future lastmod), and / the later of the
// two, so a value only changes when that page's content actually changes.
function buildSitemap({ articles, siteCfg, publicationYears }) {
  const list = Array.isArray(articles) ? articles : [];

  const articleDates = list
    .map((a) => a && a.date)
    .filter((d) => d && ISO_DATE.test(d))
    .sort()
    .reverse();
  // null when there is no dated content at all: <lastmod> is optional in the
  // sitemap protocol, and omitting it beats fabricating a date (a hardcoded
  // fallback here aged into an ever-staler lie, and new Date() would make the
  // output nondeterministic between server and static build).
  const latestContentDate = articleDates[0] || null;

  const years = (Array.isArray(publicationYears) ? publicationYears : [])
    .filter(Number.isFinite);
  // Year-derived, then capped at the newest real content date (ISO dates
  // compare correctly as strings): an in-press article carrying a FUTURE
  // journal-issue year must not advertise a lastmod that hasn't happened —
  // search engines distrust future lastmod values. The cap can only ever
  // under-state, and only while the publication year is still ahead of the
  // newest dated content; a same-or-past year passes through unchanged.
  const yearLastmod = years.length ? `${Math.max(...years)}-01-01` : latestContentDate;
  const publicationsLastmod =
    latestContentDate && yearLastmod <= latestContentDate ? yearLastmod : latestContentDate;
  // The home page previews news AND publications, so it changes whenever the
  // newer of the two does. publicationsLastmod is capped at latestContentDate
  // above, so the max is always latestContentDate — spelled as such.
  const homeLastmod = latestContentDate;

  const entries = [
    { path: "/", lastmod: homeLastmod },
    { path: "/news", lastmod: latestContentDate },
    { path: "/publications", lastmod: publicationsLastmod },
  ];

  for (const a of list) {
    entries.push({
      path: `/news/${a.slug}`,
      lastmod: a && ISO_DATE.test(a.date) ? a.date : latestContentDate,
    });
  }

  // The slug charset is enforced by validateArticle, so escapeHtml on the URL
  // is a no-op today — it is here so this module's XML safety does not depend
  // on a precondition enforced in another file.
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) =>
        `  <url>\n    <loc>${escapeHtml(`${siteCfg.url}${e.path}`)}</loc>\n` +
        (e.lastmod ? `    <lastmod>${escapeHtml(e.lastmod)}</lastmod>\n` : "") +
        `  </url>`)
      .join("\n") +
    `\n</urlset>\n`
  );
}

// rss.xml — RSS 2.0 channel, newest-first items built from the articles.
function buildRss({ articles, siteCfg }) {
  const items = (Array.isArray(articles) ? articles : [])
    .filter((a) => a && a.date)
    .sort(compareByDateDesc);

  const itemXml = items
    .map((a) => {
      // Slug charset is validateArticle-enforced; escapeHtml keeps this
      // module's XML safety self-contained anyway (see buildSitemap).
      const link = escapeHtml(`${siteCfg.url}/news/${a.slug}`);
      const pubDate = new Date(`${a.date}T00:00:00Z`).toUTCString();
      return (
        `  <item>\n` +
        `    <title>${escapeHtml(a.title)}</title>\n` +
        `    <link>${link}</link>\n` +
        `    <guid isPermaLink="true">${link}</guid>\n` +
        `    <pubDate>${pubDate}</pubDate>\n` +
        `    <description>${escapeHtml(a.excerpt || "")}</description>\n` +
        `  </item>`
      );
    })
    .join("\n");

  // <lastBuildDate> is optional in RSS 2.0 and omitted when there are no
  // dated items: a new Date() fallback made the body time-dependent, which
  // (a) diverged between the server and the static build and (b) broke the
  // constant-key compression cache's assumption that the body is
  // deterministic per process.
  const lastBuildDate = items.length
    ? `  <lastBuildDate>${new Date(`${items[0].date}T00:00:00Z`).toUTCString()}</lastBuildDate>\n`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `<channel>\n` +
    `  <title>${escapeHtml(siteCfg.name)} - News</title>\n` +
    `  <link>${escapeHtml(`${siteCfg.url}/news`)}</link>\n` +
    `  <description>${escapeHtml(siteCfg.defaultDescription)}</description>\n` +
    `  <language>en</language>\n` +
    lastBuildDate +
    `  <atom:link href="${escapeHtml(`${siteCfg.url}/rss.xml`)}" rel="self" type="application/rss+xml" />\n` +
    (itemXml ? itemXml + `\n` : "") +
    `</channel>\n` +
    `</rss>\n`
  );
}

// feed.json — JSON Feed 1.1, newest-first, pretty-printed (2-space) exactly as
// the server serves it. socialImages (optional) maps slug → the article's
// versioned social-crop URL path (e.g. "news/x/cover-og.jpg?v=abc"), the same
// image og:image uses; items fall back to the raw cover when no crop exists.
function buildFeed({ articles, siteCfg, socialImages }) {
  const items = (Array.isArray(articles) ? articles : [])
    .filter((a) => a && a.date)
    .sort(compareByDateDesc);
  const social = socialImages || {};

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${siteCfg.name} - News`,
    home_page_url: `${siteCfg.url}/news`,
    feed_url: `${siteCfg.url}/feed.json`,
    description: siteCfg.defaultDescription,
    language: "en",
    authors: [
      { name: siteCfg.name, url: siteCfg.url }
    ],
    items: items.map((a) => {
      const url = `${siteCfg.url}/news/${a.slug}`;
      const item = {
        id: url,
        url,
        title: a.title,
        // JSON Feed 1.1 content_text is plain text — plainBody strips the
        // inline **bold** markers the on-page renderer consumes.
        content_text: plainBody(a.body),
        summary: a.excerpt || "",
        date_published: new Date(`${a.date}T00:00:00Z`).toISOString(),
      };
      // Prefer the same optimized, cache-busted 1200x630 social crop og:image
      // serves; the raw cover (multi-MB, unversioned) is the fallback only.
      const socialPath = Object.prototype.hasOwnProperty.call(social, a.slug)
        ? social[a.slug]
        : null;
      if (socialPath) item.image = `${siteCfg.url}/${socialPath}`;
      else if (a.cover) item.image = `${siteCfg.url}/${a.cover}`;
      if (a.keywords && a.keywords.length) item.tags = a.keywords;
      return item;
    }),
  };

  return JSON.stringify(feed, null, 2);
}

module.exports = { buildSitemap, buildRss, buildFeed };
