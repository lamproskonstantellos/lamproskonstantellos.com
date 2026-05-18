const http = require("http");
const fs = require("fs");
const path = require("path");
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
  ".pdf": "application/pdf"
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

function serveIndex(res, filePath) {
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
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });
    res.end(versioned);
  });
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname.endsWith("/")) {
    pathname += "index.html";
  }

  const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));

  if (!requestedPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  fs.stat(requestedPath, (err, stats) => {
    if (!err && stats.isFile()) {
      if (requestedPath.endsWith(".html")) {
        serveIndex(res, requestedPath);
      } else {
        sendFile(res, requestedPath);
      }
      return;
    }

    serveIndex(res, path.join(PUBLIC_DIR, "index.html"));
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Lampros Konstantellos website running on port ${PORT}`);
});
