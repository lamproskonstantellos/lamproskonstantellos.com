/* ============================================================
   article-schema.js — single source of truth for article data
   ------------------------------------------------------------
   Shared between the browser (data.js / defineArticle) and Node
   (server.js / loadArticleMeta) so an article is validated and
   ordered identically in both worlds. Before this module the
   browser validated articles but the server did not, so a field
   the browser would reject could still ship into RSS / JSON-LD /
   sitemap.

   Loads in both environments like site.config.js.
   ============================================================ */

(function () {
  // Throws on any field a published article must not have. Used by
  // defineArticle (browser, fails loudly in the console) and loadArticleMeta
  // (server, logs and skips the article so bad data never reaches a feed).
  function validateArticle(article) {
    const required = ["slug", "date", "dateLabel", "title", "excerpt", "body"];
    for (const field of required) {
      if (article[field] === undefined || article[field] === null || article[field] === "") {
        throw new Error(
          `[article] "${article.slug || "(no slug)"}" is missing required field: ${field}`
        );
      }
    }
    // The slug is a URL path segment (/news/<slug>) and a folder name, so it
    // must be URL-safe. Constraining it here (both worlds) keeps a stray
    // character out of the unescaped <loc>/<link>/<guid> interpolations in the
    // sitemap and RSS feed and out of the injected <script src> path.
    if (!/^[a-z0-9-]+$/.test(article.slug)) {
      throw new Error(
        `[article] "${article.slug}" has an invalid slug — use lowercase letters, digits and hyphens`
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date)) {
      throw new Error(
        `[article] "${article.slug}" has invalid date "${article.date}" — expected YYYY-MM-DD`
      );
    }
    if (!Array.isArray(article.body) || article.body.length === 0) {
      throw new Error(`[article] "${article.slug}" has empty or non-array body`);
    }
    if (article.photos && !Array.isArray(article.photos)) {
      throw new Error(`[article] "${article.slug}" has non-array photos`);
    }
    if (article.sources && !Array.isArray(article.sources)) {
      throw new Error(`[article] "${article.slug}" has non-array sources`);
    }
    if (article.keywords && !Array.isArray(article.keywords)) {
      throw new Error(`[article] "${article.slug}" has non-array keywords`);
    }
    if (article.topics && !Array.isArray(article.topics)) {
      throw new Error(`[article] "${article.slug}" has non-array topics`);
    }
    if (article.video !== undefined && typeof article.video !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string video`);
    }
    // Optional open-codec (VP9/AV1 WebM) fallback source for the video.
    if (article.videoWebm !== undefined && typeof article.videoWebm !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string videoWebm`);
    }
    // Optional SEO meta description (<=~160 chars) used for the meta/OG/Twitter
    // description in place of the fuller card/feed excerpt when present.
    if (article.seoDescription !== undefined && typeof article.seoDescription !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string seoDescription`);
    }
    if (article.poster !== undefined && typeof article.poster !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string poster`);
    }
    // Optional path to a WebVTT captions track for the article video.
    if (article.captions !== undefined && typeof article.captions !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string captions`);
    }
    // A photos entry is either a path string or { src, align? }.
    if (Array.isArray(article.photos)) {
      for (const p of article.photos) {
        const ok =
          typeof p === "string" || (p && typeof p === "object" && typeof p.src === "string");
        if (!ok) {
          throw new Error(
            `[article] "${article.slug}" has an invalid photos entry (expected a path string or { src })`
          );
        }
      }
    }
    return article;
  }

  // Newest first, by ISO date string. Stable for equal dates (returns 0).
  function compareByDateDesc(a, b) {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  }

  const api = { validateArticle, compareByDateDesc };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    Object.assign(window, { ArticleSchema: api, validateArticle, compareByDateDesc });
  }
})();
