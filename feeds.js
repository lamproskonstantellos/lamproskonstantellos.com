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

const { compareByDateDesc } = require("./article-schema.js");

// Local copy of server.js's escapeHtml so this module stays self-contained
// (no require cycle with server.js). Deliberately byte-identical to that one:
// the RSS feed must escape exactly as the served HTML does.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// sitemap.xml — home, /news and /publications, then one <url> per article in
// the order given. The index pages share the most-recent article date as their
// lastmod so the value only changes when content actually changes.
function buildSitemap({ articles, siteCfg }) {
  const list = Array.isArray(articles) ? articles : [];

  const articleDates = list
    .map((a) => a && a.date)
    .filter((d) => d && ISO_DATE.test(d))
    .sort()
    .reverse();
  const latestContentDate = articleDates[0] || "2026-01-01";

  const entries = [
    { path: "/", lastmod: latestContentDate },
    { path: "/news", lastmod: latestContentDate },
    { path: "/publications", lastmod: latestContentDate },
  ];

  for (const a of list) {
    entries.push({
      path: `/news/${a.slug}`,
      lastmod: a && ISO_DATE.test(a.date) ? a.date : latestContentDate,
    });
  }

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) => `  <url>\n    <loc>${siteCfg.url}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
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
      const link = `${siteCfg.url}/news/${a.slug}`;
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

  const lastBuildDate = items.length
    ? new Date(`${items[0].date}T00:00:00Z`).toUTCString()
    : new Date().toUTCString();

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n` +
    `<channel>\n` +
    `  <title>${escapeHtml(siteCfg.name)} - News</title>\n` +
    `  <link>${siteCfg.url}/news</link>\n` +
    `  <description>${escapeHtml(siteCfg.defaultDescription)}</description>\n` +
    `  <language>en</language>\n` +
    `  <lastBuildDate>${lastBuildDate}</lastBuildDate>\n` +
    `  <atom:link href="${siteCfg.url}/rss.xml" rel="self" type="application/rss+xml" />\n` +
    (itemXml ? itemXml + `\n` : "") +
    `</channel>\n` +
    `</rss>\n`
  );
}

// feed.json — JSON Feed 1.1, newest-first, pretty-printed (2-space) exactly as
// the server serves it.
function buildFeed({ articles, siteCfg }) {
  const items = (Array.isArray(articles) ? articles : [])
    .filter((a) => a && a.date)
    .sort(compareByDateDesc);

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
        content_text: Array.isArray(a.body) ? a.body.join("\n\n") : "",
        summary: a.excerpt || "",
        date_published: new Date(`${a.date}T00:00:00Z`).toISOString(),
      };
      if (a.cover) item.image = `${siteCfg.url}/${a.cover}`;
      if (a.keywords && a.keywords.length) item.tags = a.keywords;
      return item;
    }),
  };

  return JSON.stringify(feed, null, 2);
}

module.exports = { buildSitemap, buildRss, buildFeed };
