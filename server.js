const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { URL } = require("url");

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

function cacheHeaderFor(req, contentType) {
  if (contentType.startsWith("text/html")) {
    return "no-cache, no-store, must-revalidate";
  }
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.searchParams.has("v")) {
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

function serveIndex(req, res, filePath, statusCode = 200) {
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    // Inject auto-discovered article scripts right after data.js
    const articleScripts = discoverArticleScripts();
    const withArticles = articleScripts
      ? html.replace(
          '<script src="/data.js"></script>',
          `<script src="/data.js"></script>\n${articleScripts}`
        )
      : html;
    // Inject deploy version into all local asset URLs so browser always fetches fresh
    const versioned = withArticles.replace(
      /((?:src|href)=")(\/[^"?]+\.(?:css|js|jsx))(")/g,
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

const server = http.createServer((req, res) => {
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
    const base = "https://lamproskonstantellos.com";
    const today = new Date().toISOString().slice(0, 10);
    const newsDir = path.join(PUBLIC_DIR, "news");
    let articleSlugs = [];
    try {
      articleSlugs = fs.readdirSync(newsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .filter((d) => fs.existsSync(path.join(newsDir, d.name, "article.js")))
        .map((d) => d.name)
        .sort();
    } catch {}

    const urls = ["/", "/news", "/publications", ...articleSlugs.map((s) => `/news/${s}`)];
    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      urls
        .map((u) => `  <url>\n    <loc>${base}${u}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
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
        serveIndex(req, res, requestedPath);
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
    serveIndex(req, res, path.join(PUBLIC_DIR, "index.html"), statusCode);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lampros Konstantellos website running on port ${PORT}`);
});
