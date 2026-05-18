const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");
const SITE_CFG = require("./site.config.js");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

// Unique per server start — forces browser to re-fetch JS/CSS on every deploy
const DEPLOY_VERSION = Date.now();

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
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8"
};

// Scan news/ for subfolders containing an article.js and build <script> tags
function discoverArticleScripts() {
  const newsDir = path.join(PUBLIC_DIR, "news");
  let entries;
  try { entries = fs.readdirSync(newsDir, { withFileTypes: true }); }
  catch { return ""; }
  return entries
    .filter((d) => d.isDirectory())
    .map((d) => ({ slug: d.name, file: path.join(newsDir, d.name, "article.js") }))
    .filter((x) => fs.existsSync(x.file))
    .map((x) => `<script src="/news/${x.slug}/article.js"></script>`)
    .sort()
    .join("\n");
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

const DEFAULT_IMAGE = `${SITE_CFG.url}${SITE_CFG.defaultImage}`;
const DEFAULT_DESCRIPTION = SITE_CFG.defaultDescription;

const PROFILE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "mainEntity": {
    "@type": "Person",
    "name": SITE_CFG.name,
    "jobTitle": SITE_CFG.jobTitle,
    "url": SITE_CFG.url,
    "image": DEFAULT_IMAGE,
    "sameAs": SITE_CFG.socialLinks
  }
};

// Evaluate a single article.js in a tiny sandbox to extract its metadata.
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
    };
    new Function("window", "defineArticle", code)(fakeWindow, capture);
    return captured;
  } catch (e) {
    console.error(`Failed to parse article meta for "${slug}":`, e.message);
    return null;
  }
}

// Serialize JSON-LD for embedding inside <script type="application/ld+json">.
// Escaping "<" keeps a stray "</script>" in article text from closing the tag.
function jsonLdScript(obj) {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function computePageMeta(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";

  if (p === "/") {
    return {
      title: `${SITE_CFG.name} — ${SITE_CFG.jobTitle}`,
      description: DEFAULT_DESCRIPTION,
      url: `${SITE_CFG.url}/`,
      image: DEFAULT_IMAGE,
      ogType: "website",
      jsonLd: PROFILE_JSONLD,
    };
  }

  if (p === "/news") {
    return {
      title: `News — ${SITE_CFG.name}`,
      description:
        "Reflections from conferences, forums, awards, and projects in renewable energy, battery storage, grid flexibility, and electricity markets.",
      url: `${SITE_CFG.url}/news`,
      image: DEFAULT_IMAGE,
      ogType: "website",
      jsonLd: null,
    };
  }

  if (p === "/publications") {
    return {
      title: `Publications — ${SITE_CFG.name}`,
      description:
        "Peer-reviewed publications and conference papers on renewable energy, V2G integration, real-time grid simulation, and EV charging.",
      url: `${SITE_CFG.url}/publications`,
      image: DEFAULT_IMAGE,
      ogType: "website",
      jsonLd: null,
    };
  }

  const m = p.match(/^\/news\/([^/]+)$/);
  if (m) {
    const article = loadArticleMeta(m[1]);
    if (article) {
      const image = article.cover ? `${SITE_CFG.url}/${article.cover}` : DEFAULT_IMAGE;
      return {
        title: `${article.title} — ${SITE_CFG.name}`,
        description: article.excerpt,
        url: `${SITE_CFG.url}/news/${article.slug}`,
        image,
        ogType: "article",
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": article.title,
          "description": article.excerpt,
          "image": image,
          "datePublished": article.date,
          "dateModified": article.date,
          "author": {
            "@type": "Person",
            "name": SITE_CFG.name,
            "url": SITE_CFG.url,
          },
          "publisher": {
            "@type": "Person",
            "name": SITE_CFG.name,
            "url": SITE_CFG.url,
          },
          "mainEntityOfPage": `${SITE_CFG.url}/news/${article.slug}`,
        },
      };
    }
  }

  // Unknown route — used by the SPA NotFound page
  return {
    title: `Page not found — ${SITE_CFG.name}`,
    description: DEFAULT_DESCRIPTION,
    url: `${SITE_CFG.url}${pathname}`,
    image: DEFAULT_IMAGE,
    ogType: "website",
    jsonLd: null,
  };
}

function cacheHeaderFor(req, contentType) {
  if (contentType.startsWith("text/html")) {
    return "no-cache, no-store, must-revalidate";
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.searchParams.has("v") || url.pathname.startsWith("/dist/")) {
    return "public, max-age=31536000, immutable";
  }
  return "public, max-age=86400";
}

function isCompressible(contentType) {
  return /^(text\/|application\/(javascript|json|xml|xhtml\+xml)|image\/svg)/.test(contentType);
}

function writeCompressed(req, res, headers, data) {
  const status = headers.__status || 200;
  delete headers.__status;
  const accept = req.headers["accept-encoding"] || "";
  const ct = headers["Content-Type"] || "";
  if (isCompressible(ct) && data && data.length > 1024) {
    if (/\bbr\b/.test(accept)) {
      const compressed = zlib.brotliCompressSync(data);
      res.writeHead(status, {
        ...headers,
        "Content-Encoding": "br",
        "Content-Length": compressed.length,
        "Vary": "Accept-Encoding",
      });
      res.end(compressed);
      return;
    }
    if (/\bgzip\b/.test(accept)) {
      const compressed = zlib.gzipSync(data);
      res.writeHead(status, {
        ...headers,
        "Content-Encoding": "gzip",
        "Content-Length": compressed.length,
        "Vary": "Accept-Encoding",
      });
      res.end(compressed);
      return;
    }
  }
  res.writeHead(status, headers);
  res.end(data);
}

// True when pathname maps to a route the SPA can render.
function isValidSpaRoute(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/news" || p === "/publications") return true;
  const m = p.match(/^\/news\/([^/]+)$/);
  if (m) {
    return fs.existsSync(path.join(PUBLIC_DIR, "news", m[1], "article.js"));
  }
  return false;
}

function serveIndex(req, res, filePath, pathname, statusCode = 200) {
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    // Inject per-route meta first so later replacements see the populated HTML
    const meta = computePageMeta(pathname);
    const processedHtml = html
      .replace(/__META_TITLE__/g, escapeHtml(meta.title))
      .replace(/__META_DESCRIPTION__/g, escapeHtml(meta.description))
      .replace(/__META_URL__/g, escapeHtml(meta.url))
      .replace(/__META_IMAGE__/g, escapeHtml(meta.image))
      .replace(/__META_OG_TYPE__/g, escapeHtml(meta.ogType))
      .replace(/__META_JSONLD__/g, meta.jsonLd ? jsonLdScript(meta.jsonLd) : "");
    // Inject auto-discovered article scripts right after data.js
    const articleScripts = discoverArticleScripts();
    const withArticles = articleScripts
      ? processedHtml.replace(
          '<script src="/data.js"></script>',
          `<script src="/data.js"></script>\n${articleScripts}`
        )
      : processedHtml;
    // Rewrite /dist/<name>.js references to their content-hashed filenames
    const assetMap = loadAssetMap();
    const hashed = withArticles.replace(
      /(<script\s+src=")\/dist\/([^"?]+)\.js(")/g,
      (match, prefix, name, suffix) => {
        const mapped = assetMap[name];
        return mapped ? `${prefix}${mapped}${suffix}` : match;
      }
    );
    // Inject deploy version into local asset URLs (except content-hashed /dist/)
    const versioned = hashed.replace(
      /((?:src|href)=")(\/(?!dist\/)[^"?]+\.(?:css|js|jsx))(")/g,
      `$1$2?v=${DEPLOY_VERSION}$3`
    );
    const contentType = "text/html; charset=utf-8";
    writeCompressed(req, res, {
      "Content-Type": contentType,
      "Cache-Control": cacheHeaderFor(req, contentType),
      __status: statusCode,
    }, versioned);
  });
}

function sendFile(req, res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    writeCompressed(req, res, {
      "Content-Type": contentType,
      "Cache-Control": cacheHeaderFor(req, contentType),
    }, data);
  });
}

// Applied to every response. CSP is tuned to this site: React from unpkg,
// Google Fonts, and inline style attributes emitted by React's style prop.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://unpkg.com",
    "style-src 'self' https://fonts.googleapis.com 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

const server = http.createServer((req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const urlPathname = decodeURIComponent(parsedUrl.pathname);
  let pathname = urlPathname;

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  if (urlPathname === "/sitemap.xml") {
    const buildDate = new Date().toISOString().slice(0, 10);
    const newsDir = path.join(PUBLIC_DIR, "news");
    let articleSlugs = [];
    try {
      articleSlugs = fs.readdirSync(newsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => fs.existsSync(path.join(newsDir, d.name, "article.js")))
        .map((d) => d.name)
        .sort();
    } catch {}

    const entries = [
      { path: "/", lastmod: buildDate },
      { path: "/news", lastmod: buildDate },
      { path: "/publications", lastmod: buildDate },
    ];

    for (const slug of articleSlugs) {
      const article = loadArticleMeta(slug);
      entries.push({
        path: `/news/${slug}`,
        lastmod: article && /^\d{4}-\d{2}-\d{2}$/.test(article.date) ? article.date : buildDate,
      });
    }

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      entries
        .map((e) => `  <url>\n    <loc>${SITE_CFG.url}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n  </url>`)
        .join("\n") +
      `\n</urlset>\n`;

    res.writeHead(200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    });
    res.end(xml);
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
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lampros Konstantellos website running on port ${PORT}`);
});
