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
    // The regex admits calendar-impossible dates ("2025-13-01"), which turn
    // into Invalid Date downstream — buildFeed's .toISOString() then throws,
    // 500ing /feed.json and failing the static build. Require the date to
    // round-trip through UTC back to the same string.
    const parsedDate = new Date(`${article.date}T00:00:00Z`);
    if (
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== article.date
    ) {
      throw new Error(
        `[article] "${article.slug}" has impossible date "${article.date}" — not a real calendar day`
      );
    }
    // Optional "content edited after publication" date, feeding dateModified /
    // article:modified_time. Same format and calendar checks as `date`.
    if (article.dateUpdated !== undefined) {
      const upd = new Date(`${article.dateUpdated}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(article.dateUpdated) ||
        Number.isNaN(upd.getTime()) ||
        upd.toISOString().slice(0, 10) !== article.dateUpdated
      ) {
        throw new Error(
          `[article] "${article.slug}" has invalid dateUpdated "${article.dateUpdated}" — expected a real YYYY-MM-DD day`
        );
      }
      if (article.dateUpdated < article.date) {
        throw new Error(
          `[article] "${article.slug}" has dateUpdated earlier than date`
        );
      }
    }
    if (!Array.isArray(article.body) || article.body.length === 0) {
      throw new Error(`[article] "${article.slug}" has empty or non-array body`);
    }
    // C0 control characters are illegal in XML 1.0, so a stray one in a title
    // or excerpt would produce an rss.xml every feed reader rejects (escapeHtml
    // only handles the five markup characters). Reject at the source instead.
    for (const field of ["title", "excerpt", "seoDescription", "dateLabel"]) {
      if (
        typeof article[field] === "string" &&
        /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(article[field])
      ) {
        throw new Error(
          `[article] "${article.slug}" has a control character in ${field}`
        );
      }
    }
    if (article.photos && !Array.isArray(article.photos)) {
      throw new Error(`[article] "${article.slug}" has non-array photos`);
    }
    if (article.sources && !Array.isArray(article.sources)) {
      throw new Error(`[article] "${article.slug}" has non-array sources`);
    }
    // Each source lands in an <a href> — require { href, label } and an
    // http(s) scheme so a malformed (or javascript:) value fails loudly at
    // load like every other invalid field instead of shipping as a link.
    if (Array.isArray(article.sources)) {
      for (const s of article.sources) {
        if (!s || typeof s !== "object" || typeof s.href !== "string" || typeof s.label !== "string") {
          throw new Error(
            `[article] "${article.slug}" has an invalid sources entry (expected { href, label })`
          );
        }
        if (!/^https?:\/\//.test(s.href)) {
          throw new Error(
            `[article] "${article.slug}" has a sources href that is not http(s): "${s.href}"`
          );
        }
      }
    }
    if (article.keywords && !Array.isArray(article.keywords)) {
      throw new Error(`[article] "${article.slug}" has non-array keywords`);
    }
    if (article.topics && !Array.isArray(article.topics)) {
      throw new Error(`[article] "${article.slug}" has non-array topics`);
    }
    // Each topic becomes a JSON-LD `about` entity ({ name, sameAs }) with no
    // other consumer to catch a malformed entry — a bare string (the natural
    // mistake, since the neighbouring `keywords` IS a string array) would
    // silently ship nameless Thing nodes, and a null entry would throw at
    // REQUEST time inside computePageMeta instead of loudly at load.
    if (Array.isArray(article.topics)) {
      for (const t of article.topics) {
        if (!t || typeof t !== "object" || typeof t.name !== "string" || typeof t.sameAs !== "string") {
          throw new Error(
            `[article] "${article.slug}" has an invalid topics entry (expected { name, sameAs })`
          );
        }
        if (!/^https?:\/\//.test(t.sameAs)) {
          throw new Error(
            `[article] "${article.slug}" has a topics sameAs that is not http(s): "${t.sameAs}"`
          );
        }
      }
    }
    // The cover path is joined with the article folder on the server, so a
    // non-string value would throw in path.join at require time and kill the
    // whole process instead of skipping the one bad article.
    if (article.cover !== undefined && typeof article.cover !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string cover`);
    }
    if (article.video !== undefined && typeof article.video !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string video`);
    }
    // Optional open-codec (VP9/AV1 WebM) fallback source for the video.
    if (article.videoWebm !== undefined && typeof article.videoWebm !== "string") {
      throw new Error(`[article] "${article.slug}" has non-string videoWebm`);
    }
    // Every asset path is read from disk at server startup (path.join with the
    // document root) and interpolated into public URLs and <link rel=preload>.
    // The slug/date fields are tightly constrained; the asset paths must be
    // too, or a "../" value would read a file OUTSIDE the document root at
    // boot and emit an og:image URL escaping the site. Each must live inside
    // THIS article's own folder and use a conservative filename charset.
    const assetPath = (value, field) => {
      if (value === undefined) return;
      const okPath =
        new RegExp(`^news\\/${article.slug}\\/(?!\\.)[a-z0-9._-]+$`).test(value) &&
        !value.includes("..");
      if (!okPath) {
        throw new Error(
          `[article] "${article.slug}" has an invalid ${field} path "${value}" — expected news/${article.slug}/<filename> (lowercase letters, digits, dot, dash and underscore only; rename e.g. IMG_1234.JPG before committing)`
        );
      }
    };
    assetPath(article.cover, "cover");
    assetPath(article.video, "video");
    assetPath(article.videoWebm, "videoWebm");
    assetPath(article.poster, "poster");
    assetPath(article.captions, "captions");
    if (Array.isArray(article.photos)) {
      for (const p of article.photos) {
        assetPath(typeof p === "string" ? p : p && p.src, "photos src");
      }
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
    // Optional intrinsic pixel dimensions of the video, used to reserve its
    // layout box before the poster/metadata load (no layout shift). Set both
    // or neither.
    for (const key of ["videoWidth", "videoHeight"]) {
      if (article[key] !== undefined && (!Number.isFinite(article[key]) || article[key] <= 0)) {
        throw new Error(`[article] "${article.slug}" has invalid ${key} (expected a positive number)`);
      }
    }
    if ((article.videoWidth === undefined) !== (article.videoHeight === undefined)) {
      throw new Error(`[article] "${article.slug}" must set videoWidth and videoHeight together`);
    }
    // Optional 0-based paragraph index the video is placed after. The renderer
    // quietly falls back to end-of-article for a non-integer, so without this
    // guard a typo like videoAfter: "8" changed the layout silently instead of
    // failing loudly like every other bad field.
    if (
      article.videoAfter !== undefined &&
      (!Number.isInteger(article.videoAfter) ||
        article.videoAfter < 0 ||
        article.videoAfter >= article.body.length)
    ) {
      // Out of range is worse than the type error: an index past the last
      // paragraph matches no render slot, so the video (or an inline photo,
      // below) VANISHES from the page — and with the pre-render, from the
      // build and the crawler view too.
      throw new Error(
        `[article] "${article.slug}" has invalid videoAfter (expected an integer between 0 and ${article.body.length - 1})`
      );
    }
    // A photos entry is either a path string or { src, align?, after?,
    // caption?, width?, height? } — width/height (set both or neither) are the
    // image's intrinsic pixels, reserving an inline figure's box before it
    // loads.
    if (Array.isArray(article.photos)) {
      for (const p of article.photos) {
        const ok =
          typeof p === "string" || (p && typeof p === "object" && typeof p.src === "string");
        if (!ok) {
          throw new Error(
            `[article] "${article.slug}" has an invalid photos entry (expected a path string or { src })`
          );
        }
        if (p && typeof p === "object") {
          for (const key of ["width", "height"]) {
            if (p[key] !== undefined && (!Number.isFinite(p[key]) || p[key] <= 0)) {
              throw new Error(`[article] "${article.slug}" has a photos entry with invalid ${key}`);
            }
          }
          if ((p.width === undefined) !== (p.height === undefined)) {
            throw new Error(
              `[article] "${article.slug}" has a photos entry that must set width and height together`
            );
          }
          // Same range rule as videoAfter: an inline index past the last
          // body paragraph renders NOWHERE (the photo is excluded from the
          // gallery too), silently deleting it from page, build and feeds.
          if (
            p.after !== undefined &&
            (!Number.isInteger(p.after) || p.after < 0 || p.after >= article.body.length)
          ) {
            throw new Error(
              `[article] "${article.slug}" has a photos entry with invalid after (expected an integer between 0 and ${article.body.length - 1})`
            );
          }
        }
      }
    }
    return article;
  }

  // HTML/XML escaping for the five markup characters. Lives HERE — the one
  // module both server.js and feeds.js already require — because the two used
  // to carry hand-synchronized copies whose "deliberately byte-identical"
  // contract was enforced only by a comment. The RSS feed must escape exactly
  // as the served HTML does, so there is exactly one implementation.
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Newest first, by ISO date string. Stable for equal dates (returns 0).
  function compareByDateDesc(a, b) {
    if (a.date < b.date) return 1;
    if (a.date > b.date) return -1;
    return 0;
  }

  // Flatten an article body to plain text for machine-readable consumers
  // (JSON-LD articleBody/wordCount, JSON Feed content_text). Body paragraphs
  // are authored with inline **bold** markers that the React renderer strips
  // (renderInline); machine output must not ship the raw asterisks.
  function plainBody(body) {
    return (Array.isArray(body) ? body.join("\n\n") : "").replace(/\*\*/g, "");
  }

  const api = { validateArticle, compareByDateDesc, plainBody, escapeHtml };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    // Only the names the browser actually consumes: data.js uses
    // validateArticle (defineArticle) and compareByDateDesc (sortedNews).
    // plainBody and escapeHtml are Node-side concerns (JSON-LD/feeds/meta) —
    // no component references them, so they are not put on window.
    Object.assign(window, { validateArticle, compareByDateDesc });
  }
})();
