const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");
const SITE_CFG = require("./site.config.js");
const { parseRoute, isValidSpaRoute: routeIsValidSpa, pageTitle } = require("./routes.js");
const { validateArticle } = require("./article-schema.js");
const { buildSitemap, buildRss, buildFeed } = require("./feeds.js");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// Unique per server start - forces browser to re-fetch JS/CSS on every deploy.
// Railway exposes the deploying commit SHA at build time; falling back to
// the boot timestamp keeps local dev working.
const DEPLOY_VERSION = process.env.RAILWAY_GIT_COMMIT_SHA
  ? process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 12)
  : Date.now();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jsx": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

// Scan news/ for subfolders containing an article.js, returning sorted slugs.
function discoverArticleSlugs() {
  const newsDir = path.join(PUBLIC_DIR, "news");
  let entries;
  try { entries = fs.readdirSync(newsDir, { withFileTypes: true }); }
  catch { return []; }
  return entries
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(newsDir, d.name, "article.js")))
    .map((d) => d.name)
    .sort();
}

// Read the esbuild metafile and map logical entry names → hashed output paths.
function loadAssetMap() {
  const manifestPath = path.join(PUBLIC_DIR, "dist", "manifest.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const map = {};
    for (const [outputPath, info] of Object.entries(manifest.outputs || {})) {
      if (!info.entryPoint) continue;
      // entryPoint: "app.jsx" → key "app"
      // entryPoint: "components/news.jsx" → key "components/news"
      const key = info.entryPoint.replace(/\.jsx$/, "");
      map[key] = "/" + outputPath.replace(/\\/g, "/");
    }
    return map;
  } catch {
    return {};
  }
}

// Read an image's pixel dimensions from its header bytes — the PNG IHDR or the
// JPEG Start-Of-Frame marker — with no external dependency. Used to declare
// accurate og:image:width/height per route: the article cover images are not
// 1200x630, so a single hardcoded pair would misreport every article to social
// crawlers. Returns { width, height }, or null if missing/unparseable.
function imageDims(absPath) {
  let buf;
  try { buf = fs.readFileSync(absPath); } catch { return null; }
  // PNG: 8-byte signature, IHDR length(4)+type(4), then width@16 height@20 (BE).
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // JPEG: walk the segments to the SOF marker (SOF0..SOF15, excluding the
  // non-frame C4/C8/CC); its payload is height then width as 16-bit BE.
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xff) { i++; continue; } // padding fill byte
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      // Standalone markers carry no length: TEM (01), RSTn (D0-D7), SOI/EOI (D8/D9).
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if (len < 2) return null;
      i += 2 + len;
    }
  }
  return null;
}

const DEFAULT_IMAGE = `${SITE_CFG.url}${SITE_CFG.defaultImage}`;
const DEFAULT_IMAGE_DIMS = imageDims(path.join(PUBLIC_DIR, SITE_CFG.defaultImage.replace(/^\//, "")));
const DEFAULT_DESCRIPTION = SITE_CFG.defaultDescription;
// The hero is the LCP image; preload the AVIF sibling the <picture> will pick.
// Derived from the same SITE_CFG.heroImage the Hero component renders, so the
// preload can never point at a renamed/missing file.
const HERO_PRELOAD_IMAGE = SITE_CFG.heroImage.replace(/\.(jpe?g|png)$/i, ".avif");

const PROFILE_JSONLD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "name": SITE_CFG.name,
      "url": SITE_CFG.url
    },
    {
      "@type": "ProfilePage",
      "mainEntity": {
        "@type": "Person",
        "name": SITE_CFG.name,
        "jobTitle": SITE_CFG.jobTitle,
        "url": SITE_CFG.url,
        "image": DEFAULT_IMAGE,
        "sameAs": SITE_CFG.socialLinks
      }
    }
  ]
};

// Execute a single article.js to extract its metadata.
//
// This is NOT a security sandbox: article.js files are first-party content in
// this repo (the trust boundary is the repository, not the request), so they
// are run with a plain Function. The fake `window`/`defineArticle` shim only
// captures the object the article registers. The captured article is then run
// through the SAME validateArticle the browser uses, so a field the client
// would reject is logged and skipped here instead of silently shipping into
// the RSS / JSON-LD / sitemap output.
function loadArticleMeta(slug) {
  const file = path.join(PUBLIC_DIR, "news", slug, "article.js");
  if (!fs.existsSync(file)) return null;
  try {
    const code = fs.readFileSync(file, "utf8");
    let captured = null;
    const capture = (article) => { captured = article; };
    const fakeWindow = {
      NEWS_ARTICLES: { push: capture },
      defineArticle: capture,
      validateArticle,
    };
    new Function("window", "defineArticle", code)(fakeWindow, capture);
    if (captured) {
      validateArticle(captured);
      // The folder name is the single owner of the slug: it drives discovery,
      // routing, the sitemap <loc> and the injected <script src>. The article's
      // own `slug` field drives the RSS/feed <link>/guid and the canonical
      // URL. If the two disagree the canonical/feed URLs point at a path the
      // server cannot route — so reject the divergence here instead of shipping
      // it (the same fail-loud policy as an invalid field).
      if (captured.slug !== slug) {
        throw new Error(
          `folder "${slug}" does not match article slug "${captured.slug}"`
        );
      }
    }
    return captured;
  } catch (e) {
    console.error(`Skipping article "${slug}" — ${e.message}`);
    return null;
  }
}

// Serialize JSON-LD for embedding inside <script type="application/ld+json">.
// Escaping "<" keeps a stray "</script>" in article text from closing the tag;
// U+2028/U+2029 are valid in JSON but are line terminators in a <script>, so
// they are escaped to keep the inline JSON parseable.
function jsonLdScript(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Built once at startup. Article folders and the esbuild asset map only change
// between deploys, and every deploy starts a fresh process - so there is no
// need to hit the filesystem on each request.
const ARTICLE_SLUGS = discoverArticleSlugs();
const ARTICLE_META = {};
// Pixel dimensions of each article's cover (its og:image), read once at startup
// so computePageMeta can declare accurate og:image:width/height without touching
// the (multi-megabyte) image files on every request.
const ARTICLE_COVER_DIMS = {};
for (const slug of ARTICLE_SLUGS) {
  const meta = loadArticleMeta(slug);
  ARTICLE_META[slug] = meta;
  if (meta && meta.cover) {
    ARTICLE_COVER_DIMS[slug] = imageDims(path.join(PUBLIC_DIR, meta.cover));
  }
}
// The loaded, validated articles in folder order — the single input shared by
// the feed builders here and by the static build (feeds.js stays the one place
// sitemap/rss/feed bytes are produced, so the live server and the build cannot
// diverge).
const ARTICLES = ARTICLE_SLUGS.map((slug) => ARTICLE_META[slug]).filter(Boolean);
const ARTICLE_SCRIPTS = ARTICLE_SLUGS
  .map((slug) => `<script src="/news/${slug}/article.js"></script>`)
  .join("\n");
const ASSET_MAP = loadAssetMap();

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function computePageMeta(pathname) {
  // parseRoute is the shared route table (routes.js) — same matcher the client
  // and isValidSpaRoute use, so the meta branch can never drift from routing.
  const route = parseRoute(pathname);
  const titleCtx = { siteName: SITE_CFG.name, jobTitle: SITE_CFG.jobTitle };

  if (route.page === "home") {
    return {
      title: pageTitle(route, titleCtx),
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_CFG.url}/`,
      image: DEFAULT_IMAGE,
      imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
      imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
      imageAlt: `${SITE_CFG.name} — ${SITE_CFG.jobTitle}`,
      ogType: "website",
      jsonLd: PROFILE_JSONLD,
      preloadImage: HERO_PRELOAD_IMAGE,
    };
  }

  if (route.page === "news-list") {
    return {
      title: pageTitle(route, titleCtx),
      description:
        "Reflections from conferences, forums, awards, and projects in renewable energy, battery storage, grid flexibility, and electricity markets.",
      url: `${SITE_CFG.url}/news`,
      image: DEFAULT_IMAGE,
      imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
      imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
      imageAlt: `News from ${SITE_CFG.name}`,
      ogType: "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_CFG.url },
              { "@type": "ListItem", "position": 2, "name": "News", "item": `${SITE_CFG.url}/news` },
            ],
          },
        ],
      },
    };
  }

  if (route.page === "publications-list") {
    return {
      title: pageTitle(route, titleCtx),
      description:
        "Peer-reviewed publications and conference papers on renewable energy, V2G integration, real-time grid simulation, and EV charging.",
      url: `${SITE_CFG.url}/publications`,
      image: DEFAULT_IMAGE,
      imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
      imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
      imageAlt: `Publications by ${SITE_CFG.name}`,
      ogType: "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_CFG.url },
              { "@type": "ListItem", "position": 2, "name": "Publications", "item": `${SITE_CFG.url}/publications` },
            ],
          },
        ],
      },
    };
  }

  if (route.page === "article") {
    const article = ARTICLE_META[route.slug];
    if (article) {
      const image = article.cover ? `${SITE_CFG.url}/${article.cover}` : DEFAULT_IMAGE;
      // og:image dimensions track whichever image `image` points at: the
      // article's own cover when it has one, else the default 1200x630 image.
      const imageDimensions = article.cover ? ARTICLE_COVER_DIMS[route.slug] : DEFAULT_IMAGE_DIMS;

      const articleBody = Array.isArray(article.body) ? article.body.join("\n\n") : "";
      const wordCount = articleBody ? articleBody.trim().split(/\s+/).length : 0;

      const articleSchema = {
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        "image": image,
        "datePublished": article.date,
        "dateModified": article.date,
        "author": { "@type": "Person", "name": SITE_CFG.name, "url": SITE_CFG.url },
        "publisher": { "@type": "Person", "name": SITE_CFG.name, "url": SITE_CFG.url },
        "mainEntityOfPage": `${SITE_CFG.url}/news/${article.slug}`,
        "articleBody": articleBody,
        "wordCount": wordCount,
        "inLanguage": "en",
      };
      if (article.keywords && article.keywords.length) {
        articleSchema.keywords = article.keywords.join(", ");
      }
      if (article.articleSection) {
        articleSchema.articleSection = article.articleSection;
      }
      if (article.topics && article.topics.length) {
        articleSchema.about = article.topics.map((t) => ({
          "@type": "Thing",
          "name": t.name,
          "sameAs": t.sameAs,
        }));
      }

      const breadcrumbs = {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE_CFG.url },
          { "@type": "ListItem", "position": 2, "name": "News", "item": `${SITE_CFG.url}/news` },
          { "@type": "ListItem", "position": 3, "name": article.title, "item": `${SITE_CFG.url}/news/${article.slug}` },
        ],
      };

      return {
        title: pageTitle(route, { ...titleCtx, articleTitle: article.title }),
        description: article.excerpt,
        url: `${SITE_CFG.url}/news/${article.slug}`,
        image,
        imageWidth: imageDimensions && imageDimensions.width,
        imageHeight: imageDimensions && imageDimensions.height,
        imageAlt: article.title,
        ogType: "article",
        jsonLd: {
          "@context": "https://schema.org",
          "@graph": [breadcrumbs, articleSchema],
        },
      };
    }
  }

  // Unknown route — used by the SPA NotFound page (served with HTTP 404).
  // Canonical/og:url point at the home root rather than reflecting the
  // requested (attacker-controllable) pathname back into shared metadata.
  return {
    title: pageTitle(route, titleCtx),
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_CFG.url}/`,
    image: DEFAULT_IMAGE,
    imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
    imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
    imageAlt: `${SITE_CFG.name} — ${SITE_CFG.jobTitle}`,
    ogType: "website",
    jsonLd: null,
  };
}

// Parse req.url against a FIXED base. The request host is never used (the site
// only ever builds URLs from SITE_CFG.url), so a missing or malformed Host
// header can no longer make `new URL` throw and crash the process.
function parseRequestUrl(req) {
  return new URL(req.url || "/", "http://localhost");
}

function cacheHeaderFor(req, contentType) {
  if (contentType.startsWith("text/html")) {
    return "no-cache, no-store, must-revalidate";
  }
  let url;
  try {
    url = parseRequestUrl(req);
  } catch {
    return "public, max-age=86400";
  }
  if (url.searchParams.has("v") || url.pathname.startsWith("/dist/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=86400";
}

function isCompressible(contentType) {
  // text/*, SVG, the bare application/{javascript,json,xml}, and any structured
  // syntax suffix (application/<x>+json or +xml — e.g. rss+xml, feed+json,
  // manifest+json) which the bare alternation above would otherwise miss.
  return (
    /^text\//.test(contentType) ||
    /^image\/svg/.test(contentType) ||
    /^application\/(javascript|json|xml|xhtml\+xml)(;|$)/.test(contentType) ||
    /^application\/[\w.+-]+\+(json|xml)(;|$)/.test(contentType)
  );
}

// Quality 6 (not the zlib default of 11). For this content, q11 cost ~250ms of
// blocking CPU per call vs ~8ms at q6 for ~10% larger output — and with the
// cache below, each unique body is only ever compressed once per process.
const BROTLI_QUALITY = 6;
const COMPRESSION_CACHE = new Map(); // cacheKey -> { br?: Buffer, gzip?: Buffer }
const COMPRESSION_CACHE_MAX = 128;

// Compress `data` for `encoding`, memoized by cacheKey so identical bytes are
// never recompressed. Without the cache the server burned full brotli CPU on
// every request for the same asset — a cheap denial-of-service amplifier.
function getCompressed(cacheKey, encoding, data) {
  let entry = cacheKey ? COMPRESSION_CACHE.get(cacheKey) : null;
  if (entry && entry[encoding]) return entry[encoding];

  const out =
    encoding === "br"
      ? zlib.brotliCompressSync(data, {
          params: { [zlib.constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
        })
      : zlib.gzipSync(data);

  if (cacheKey) {
    if (!entry) {
      if (COMPRESSION_CACHE.size >= COMPRESSION_CACHE_MAX) {
        COMPRESSION_CACHE.delete(COMPRESSION_CACHE.keys().next().value);
      }
      entry = {};
      COMPRESSION_CACHE.set(cacheKey, entry);
    }
    entry[encoding] = out;
  }
  return out;
}

function writeCompressed(req, res, headers, data, cacheKey) {
  const status = headers.__status || 200;
  delete headers.__status;
  const isHead = req.method === "HEAD";
  const accept = req.headers["accept-encoding"] || "";
  const ct = headers["Content-Type"] || "";

  // Normalize to a Buffer so Content-Length is the true byte count. A string's
  // .length counts UTF-16 units, which understates the byte length whenever the
  // body contains multi-byte UTF-8 (e.g. the "—" in the home meta).
  const buf = data == null ? Buffer.alloc(0) : Buffer.isBuffer(data) ? data : Buffer.from(data);

  let encoding = null;
  if (isCompressible(ct) && buf.length > 1024) {
    if (/\bbr\b/.test(accept)) encoding = "br";
    else if (/\bgzip\b/.test(accept)) encoding = "gzip";
  }

  if (encoding) {
    let compressed;
    try {
      compressed = getCompressed(cacheKey, encoding, buf);
    } catch {
      compressed = null; // fall back to identity on any compression failure
    }
    if (compressed) {
      res.writeHead(status, {
        ...headers,
        "Content-Encoding": encoding,
        "Content-Length": compressed.length,
        "Vary": "Accept-Encoding",
      });
      res.end(isHead ? undefined : compressed);
      return;
    }
  }

  res.writeHead(status, { ...headers, "Content-Length": buf.length });
  res.end(isHead ? undefined : buf);
}

// True when pathname maps to a route the SPA can render. Delegates to the
// shared route table; an article route is valid only if its slug was
// discovered at startup.
function isValidSpaRoute(pathname) {
  return routeIsValidSpa(pathname, ARTICLE_SLUGS);
}

// Replace the __META_*__ placeholders in index.html with per-route values.
// Every replacement uses a FUNCTION value, not a string: a string replacement
// would interpret $&, $`, $', $$ in the injected meta as special patterns,
// letting hostile article text (e.g. a title containing "$&") corrupt the
// served HTML and JSON-LD. A function value is inserted verbatim.
function injectMeta(html, meta) {
  return html
    .replace(/__META_SITE_NAME__/g, () => escapeHtml(SITE_CFG.name))
    .replace(/__META_TITLE__/g, () => escapeHtml(meta.title))
    .replace(/__META_DESCRIPTION__/g, () => escapeHtml(meta.description))
    .replace(/__META_URL__/g, () => escapeHtml(meta.url))
    .replace(/__META_IMAGE__/g, () => escapeHtml(meta.image))
    .replace(/__META_IMAGE_DIMS__/g, () =>
      meta.imageWidth && meta.imageHeight
        ? `<meta property="og:image:width" content="${meta.imageWidth}" />\n` +
          `<meta property="og:image:height" content="${meta.imageHeight}" />`
        : "")
    .replace(/__META_IMAGE_ALT__/g, () => escapeHtml(meta.imageAlt || meta.title))
    .replace(/__META_OG_TYPE__/g, () => escapeHtml(meta.ogType))
    .replace(/__META_JSONLD__/g, () => (meta.jsonLd ? jsonLdScript(meta.jsonLd) : ""))
    .replace(/__META_PRELOAD__/g, () => meta.preloadImage
      ? `<link rel="preload" as="image" href="${escapeHtml(meta.preloadImage)}" type="image/avif" fetchpriority="high" />`
      : "");
}

// Render the served HTML for a path from the index.html template. Pure given
// its inputs — the SINGLE source of truth for the HTML pipeline, called both by
// serveIndex (live server) and by the static build (build-static.js), so the
// two can never drift. Performs, in order: injectMeta(computePageMeta) → inject
// the auto-discovered article <script>s after the /data.js tag → rewrite
// /dist/<name>.js to content-hashed names via the asset map → stamp
// ?v=deployVersion on local non-dist css/js for cache busting.
function renderHtml(templateHtml, pathname, { deployVersion, articleScripts, assetMap } = {}) {
  const map = assetMap || {};
  const meta = computePageMeta(pathname);
  const processedHtml = injectMeta(templateHtml, meta);
  // Inject auto-discovered article scripts right after data.js (function
  // replacement so a slug containing a $-sequence cannot corrupt the markup).
  const withArticles = articleScripts
    ? processedHtml.replace(
        '<script src="/data.js"></script>',
        () => `<script src="/data.js"></script>\n${articleScripts}`
      )
    : processedHtml;
  // Rewrite /dist/<name>.js references to their content-hashed filenames
  const hashed = withArticles.replace(
    /(<script\s+src=")\/dist\/([^"?]+)\.js(")/g,
    (match, prefix, name, suffix) => {
      const mapped = map[name];
      return mapped ? `${prefix}${mapped}${suffix}` : match;
    }
  );
  // Inject deploy version into local asset URLs (except content-hashed /dist/).
  // Here $1/$2/$3 are deliberate capture-group backreferences, and the deploy
  // version is a commit SHA or a timestamp (no $), so the string form is
  // correct — this is not the same hazard as the meta injection above.
  const versioned = hashed.replace(
    /((?:src|href)=")(\/(?!dist\/)[^"?]+\.(?:css|js|jsx))(")/g,
    `$1$2?v=${deployVersion}$3`
  );
  return versioned;
}

function serveIndex(req, res, filePath, pathname, statusCode = 200) {
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    const versioned = renderHtml(html, pathname, {
      deployVersion: DEPLOY_VERSION,
      articleScripts: ARTICLE_SCRIPTS,
      assetMap: ASSET_MAP,
    });
    const contentType = "text/html; charset=utf-8";
    // The rendered HTML for a given path is deterministic within a process, so
    // cache its compressed variants by path.
    writeCompressed(req, res, {
      "Content-Type": contentType,
      "Cache-Control": cacheHeaderFor(req, contentType),
      __status: statusCode,
    }, versioned, `html:${pathname}`);
  });
}

function sendFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  // Non-compressible binaries (video, images, fonts) are byte-seekable, so they
  // are streamed straight from disk and honour HTTP Range requests. Streaming
  // (rather than reading the whole file into memory first) lets a browser scrub
  // an mp4 whose moov atom sits at the end without downloading the whole file,
  // and means a multi-megabyte asset is never buffered whole per request — which
  // was a cheap memory/DoS amplifier. Compressible text keeps the cached
  // brotli/gzip path below.
  if (!isCompressible(contentType)) {
    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("404 Not Found");
        return;
      }
      const size = stats.size;
      let start = 0;
      let end = size > 0 ? size - 1 : 0;
      let status = 200;
      const headers = {
        "Content-Type": contentType,
        "Cache-Control": cacheHeaderFor(req, contentType),
        "Accept-Ranges": "bytes",
      };

      const rangeHeader = req.headers["range"];
      if (rangeHeader) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
        if (m && (m[1] !== "" || m[2] !== "")) {
          if (m[1] === "") {
            // suffix range: the final N bytes
            start = Math.max(0, size - parseInt(m[2], 10));
            end = size - 1;
          } else {
            start = parseInt(m[1], 10);
            end = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1);
          }
          if (start > end || start >= size) {
            res.writeHead(416, {
              "Content-Type": "text/plain; charset=utf-8",
              "Content-Range": `bytes */${size}`,
            });
            res.end("416 Range Not Satisfiable");
            return;
          }
          status = 206;
          headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
        }
      }

      headers["Content-Length"] = size === 0 ? 0 : end - start + 1;
      res.writeHead(status, headers);

      if (req.method === "HEAD" || size === 0) {
        res.end();
        return;
      }

      const stream = fs.createReadStream(filePath, { start, end });
      // A read error after headers are sent can only be signalled by dropping the
      // socket; if the client goes away mid-stream (common when scrubbing a
      // video) tear the file read down so it does not leak.
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    });
    return;
  }

  // Static file bytes are immutable per deploy; key by path + size so the
  // brotli/gzip result is computed once and reused.
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    writeCompressed(req, res, {
      "Content-Type": contentType,
      "Cache-Control": cacheHeaderFor(req, contentType),
    }, data, `file:${filePath}:${data.length}`);
  });
}

// Applied to every response. CSP is tuned to this site: self-hosted scripts
// plus the Plausible analytics script, Google Fonts, and inline style
// attributes emitted by React's style prop.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://plausible.io",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://plausible.io",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; "),
};

// The repo root is the document root, so anything not listed here is public.
// Intended public set: index.html, styles.css, the app scripts (site.config.js,
// routes.js, article-schema.js, ui-helpers.js, data.js), dist/* bundles, vendor/* React,
// favicons/og-image/manifest/robots, and news/<slug>/article.js + images.
// Everything below is source, config, tooling or docs and is blocked.
const PRIVATE_PATHS = new Set([
  "/server.js",
  "/package.json",
  "/package-lock.json",
  "/Dockerfile",
  "/.dockerignore",
  "/.gitignore",
  "/LICENSE",
  "/README.md",
  "/news/README.md",
  "/dist/manifest.json",
]);

function isPrivatePath(pathname) {
  if (PRIVATE_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/scripts/")) return true; // build tooling
  if (pathname.startsWith("/test/")) return true; // test suite
  if (pathname.startsWith("/.")) return true; // dotfiles (.git, .github, ...)
  return false;
}

const ALLOWED_METHODS = "GET, HEAD, OPTIONS";

function sendStatus(res, code, message, extraHeaders) {
  if (res.headersSent) return;
  res.writeHead(code, {
    "Content-Type": "text/plain; charset=utf-8",
    ...(extraHeaders || {}),
  });
  res.end(message);
}

const server = http.createServer((req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }

  // One try/catch around the whole synchronous handler: a malformed request
  // must never throw past here and take the process down.
  try {
    // Method policy: this is a read-only static site.
    if (req.method === "OPTIONS") {
      res.writeHead(204, { "Allow": ALLOWED_METHODS, "Content-Length": 0 });
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendStatus(res, 405, "405 Method Not Allowed", { "Allow": ALLOWED_METHODS });
      return;
    }

    // Parse against a fixed base (host-independent) and decode defensively.
    let parsedUrl;
    try {
      parsedUrl = parseRequestUrl(req);
    } catch {
      sendStatus(res, 400, "400 Bad Request");
      return;
    }
    let urlPathname;
    try {
      urlPathname = decodeURIComponent(parsedUrl.pathname);
    } catch {
      // Invalid percent-encoding (e.g. "/%zz") — decodeURIComponent throws.
      sendStatus(res, 400, "400 Bad Request");
      return;
    }
    // A NUL byte (%00) is never valid in a served path and would make the fs
    // layer throw; reject it cleanly as a bad request.
    if (urlPathname.includes("\x00")) {
      sendStatus(res, 400, "400 Bad Request");
      return;
    }

    // /index.html is the home page under a second URL. Redirect to "/" so there
    // is one canonical home (previously it served 200 with "Page not found"
    // meta and a self-canonical to /index.html — a duplicate-content bug).
    if (urlPathname === "/index.html") {
      res.writeHead(301, { "Location": "/", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Moved Permanently");
      return;
    }

    let pathname = urlPathname;

    if (isPrivatePath(urlPathname)) {
      sendStatus(res, 404, "404 Not Found");
      return;
    }

    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }

    const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));

    // Boundary check with a trailing separator so a sibling directory whose
    // name merely starts with PUBLIC_DIR (e.g. "<dir>-secrets") cannot pass.
    if (requestedPath !== PUBLIC_DIR && !requestedPath.startsWith(PUBLIC_DIR + path.sep)) {
      sendStatus(res, 403, "403 Forbidden");
      return;
    }

  if (urlPathname === "/sitemap.xml") {
    const xml = buildSitemap({ articles: ARTICLES, siteCfg: SITE_CFG });
    // Compressed like every other text response (the body is deterministic per
    // process, so it is keyed by a stable name and compressed at most once).
    writeCompressed(req, res, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    }, xml, "feed:sitemap");
    return;
  }

  if (urlPathname === "/feed.json") {
    const json = buildFeed({ articles: ARTICLES, siteCfg: SITE_CFG });
    writeCompressed(req, res, {
      "Content-Type": "application/feed+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    }, json, "feed:json");
    return;
  }

  if (urlPathname === "/rss.xml") {
    const xml = buildRss({ articles: ARTICLES, siteCfg: SITE_CFG });
    writeCompressed(req, res, {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    }, xml, "feed:rss");
    return;
  }

  fs.stat(requestedPath, (err, stats) => {
    if (!err && stats.isFile()) {
      if (requestedPath.endsWith(".html")) {
        serveIndex(req, res, requestedPath, urlPathname);
      } else {
        sendFile(req, res, requestedPath);
      }
      return;
    }

    // Path has an extension → it's an asset request that missed → real 404
    if (path.extname(urlPathname) !== "") {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    // Clean URL → SPA fallback. Unknown routes get HTTP 404 but still serve the
    // SPA HTML so the client can render a friendly 404 page.
    const statusCode = isValidSpaRoute(urlPathname) ? 200 : 404;
    serveIndex(req, res, path.join(PUBLIC_DIR, "index.html"), urlPathname, statusCode);
    });
  } catch (err) {
    console.error("Request handler error:", err && err.message);
    sendStatus(res, 500, "500 Internal Server Error");
  }
});

if (require.main === module) {
  // Malformed HTTP at the parser level (bad request line/headers) never reaches
  // the handler; answer it without tearing the socket down abruptly.
  server.on("clientError", (err, socket) => {
    if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });

  // Last-resort availability net: a static site should stay up even if some
  // unforeseen async path throws. Log loudly, but do not exit the process.
  process.on("uncaughtException", (err) => {
    console.error("uncaughtException:", (err && err.stack) || err);
  });
  process.on("unhandledRejection", (err) => {
    console.error("unhandledRejection:", err);
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Lampros Konstantellos website running on port ${PORT}`);
  });
}

// Exported for the test suite. Requiring this module (instead of running it as
// the entrypoint) does NOT start the listener, so tests can drive the handler
// on an ephemeral port and exercise the pure helpers directly.
module.exports = {
  server,
  renderHtml,
  computePageMeta,
  injectMeta,
  escapeHtml,
  jsonLdScript,
  cacheHeaderFor,
  isValidSpaRoute,
  loadArticleMeta,
  discoverArticleSlugs,
  SECURITY_HEADERS,
  isPrivatePath,
  // Build-time reuse: the static build (build-static.js) renders and writes the
  // exact bytes the server serves by reusing this already-loaded state.
  DEPLOY_VERSION,
  ARTICLES,
  ARTICLE_SCRIPTS,
  ASSET_MAP,
  SITE_CFG,
};
