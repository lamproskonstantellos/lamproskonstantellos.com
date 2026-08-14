const http = require("http");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");
const { URL } = require("url");
const SITE_CFG = require("./site.config.js");
const { parseRoute, isValidSpaRoute: routeIsValidSpa, pageTitle } = require("./routes.js");
const { validateArticle, plainBody, escapeHtml } = require("./article-schema.js");
const { buildSitemap, buildRss, buildFeed } = require("./feeds.js");
// Shared responsive-image vocabulary (same module the browser loads), so the
// preload's imagesrcset/imagesizes can never drift from what <Picture> renders.
const { imageSrcset, HERO_IMG_SIZES, ARTICLE_COVER_SIZES, IMAGE_WIDTH_VARIANTS } = require("./ui-helpers.js");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
// Symlink-resolved document root, computed once: the per-request containment
// check compares fs.realpath(requestedPath) against THIS, so the comparison
// still holds when the checkout itself lives behind a symlink (e.g. /tmp on
// macOS resolving to /private/tmp).
const PUBLIC_DIR_REAL = fs.realpathSync(PUBLIC_DIR);

// Unique per server start - forces browser to re-fetch JS/CSS on every deploy.
// This is the local preview server; the static build (build-static.js) stamps
// its own version from CF_PAGES_COMMIT_SHA. The same commit SHA is honoured here
// if present, falling back to the boot timestamp for local dev.
const DEPLOY_VERSION = process.env.CF_PAGES_COMMIT_SHA
  ? process.env.CF_PAGES_COMMIT_SHA.slice(0, 12)
  : Date.now();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  // WebVTT captions for article videos (article-schema validates `captions`,
  // <track> refuses the file under nosniff without the right type).
  ".vtt": "text/vtt; charset=utf-8"
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

// Short content hash of an image file, appended to its og:image URL as a ?v=
// cache-buster. LinkedIn/Facebook and CDNs cache the share image by URL, so
// replacing a cover in place (same filename) would otherwise keep serving the
// old preview. The hash changes only when the bytes do, so a replaced image is
// re-fetched automatically while an unchanged one keeps a stable URL. Returns
// null if the file is missing/unreadable (the URL then stays un-versioned).
function imageVersion(absPath) {
  try {
    return crypto.createHash("sha1").update(fs.readFileSync(absPath)).digest("hex").slice(0, 12);
  } catch {
    return null;
  }
}

const DEFAULT_IMAGE_PATH = path.join(PUBLIC_DIR, SITE_CFG.defaultImage.replace(/^\//, ""));
const DEFAULT_IMAGE_VERSION = imageVersion(DEFAULT_IMAGE_PATH);
const DEFAULT_IMAGE = `${SITE_CFG.url}${SITE_CFG.defaultImage}${DEFAULT_IMAGE_VERSION ? `?v=${DEFAULT_IMAGE_VERSION}` : ""}`;
const DEFAULT_IMAGE_DIMS = imageDims(DEFAULT_IMAGE_PATH);
const DEFAULT_DESCRIPTION = SITE_CFG.defaultDescription;
// The home page's one spelling, WITH the trailing slash — the same form the
// canonical tag and the sitemap emit. Every machine-readable home reference
// (JSON-LD WebSite/Person/author/publisher URLs, breadcrumb item 1) uses this
// constant so the site cannot reference its own root under two spellings.
const HOME_URL = `${SITE_CFG.url}/`;
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
      "url": HOME_URL
    },
    {
      "@type": "ProfilePage",
      "mainEntity": {
        "@type": "Person",
        "name": SITE_CFG.name,
        "jobTitle": SITE_CFG.jobTitle,
        "url": HOME_URL,
        "image": DEFAULT_IMAGE,
        // sameAs must hold URLs that IDENTIFY the person (profile pages,
        // authority records). The Zenodo entry in socialLinks is a paginated
        // full-text SEARCH — useful on the contact row, but as an identity
        // claim it matches anyone whose name appears in a record — so search
        // URLs are excluded here. (ORCID already covers the Zenodo deposits.)
        "sameAs": SITE_CFG.socialLinks.filter((u) => !u.includes("/search?"))
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
// baseDir is the parent of the news/ tree (PUBLIC_DIR in production). Tests
// pass their own temp directory so fixture articles never touch the real
// news/ folder — `node --test` runs test FILES in parallel, and a fixture
// folder existing for even a moment desynchronised any concurrently running
// discovery (parity's static build, the slug-consistency sweep).
function loadArticleMeta(slug, baseDir = PUBLIC_DIR) {
  const file = path.join(baseDir, "news", slug, "article.js");
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

// Publications live in data.js as a browser global (PROFILE.publications).
// Node needs them twice: the sitemap wants their newest year so
// /publications' lastmod tracks that page's own content, and the
// /publications JSON-LD wants the full entries for its ScholarlyArticle list.
// Same plain-Function shim — and the same repository trust boundary — as
// loadArticleMeta above; a broken data.js degrades to an empty list (the
// sitemap falls back to the article dates) rather than crashing the server.
function loadPublications() {
  try {
    const code = fs.readFileSync(path.join(PUBLIC_DIR, "data.js"), "utf8");
    const fakeWindow = { SITE: SITE_CFG };
    new Function("window", code)(fakeWindow);
    return fakeWindow.PROFILE && Array.isArray(fakeWindow.PROFILE.publications)
      ? fakeWindow.PROFILE.publications
      : [];
  } catch (e) {
    console.error(`Could not load publications from data.js — ${e.message}`);
    return [];
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
// Prototype-less maps: these are looked up with an attacker-controlled key
// (the URL slug), and on a plain object literal ARTICLE_META["__proto__"] /
// ["constructor"] return truthy inherited values — which sent /news/__proto__
// through the article meta branch and emitted garbage og/canonical/JSON-LD on
// a 404 response. Object.create(null) has no inherited properties at all.
const ARTICLE_META = Object.create(null);
// Pixel dimensions of each article's cover (its og:image), read once at startup
// so computePageMeta can declare accurate og:image:width/height without touching
// the (multi-megabyte) image files on every request.
const ARTICLE_COVER_DIMS = Object.create(null);
// Content hash of each cover, appended to its og:image URL as a ?v= cache-buster
// so a same-name cover replacement is re-fetched by social scrapers and CDNs.
const ARTICLE_COVER_VERSION = Object.create(null);
// Dedicated 1200x630 social crop (cover-og.jpg) per article, generated by
// scripts/optimize-images.js. Social cards want a landscape ~1.91:1 image; the
// raw covers are full-res and sometimes portrait/4:3, which platforms crop
// badly and are slow to fetch. When the crop exists it becomes the article's
// og:image; when it does not (e.g. before a build) the raw cover is used, so
// this only ever improves the share card. { path, dims, version } per slug.
const ARTICLE_SOCIAL = Object.create(null);
for (const slug of ARTICLE_SLUGS) {
  const meta = loadArticleMeta(slug);
  ARTICLE_META[slug] = meta;
  if (meta && meta.cover) {
    ARTICLE_COVER_DIMS[slug] = imageDims(path.join(PUBLIC_DIR, meta.cover));
    ARTICLE_COVER_VERSION[slug] = imageVersion(path.join(PUBLIC_DIR, meta.cover));
    const ogRel = meta.cover.replace(/\.(jpe?g|png)$/i, "-og.jpg");
    const ogDims = imageDims(path.join(PUBLIC_DIR, ogRel));
    if (ogDims) {
      ARTICLE_SOCIAL[slug] = {
        path: ogRel,
        dims: ogDims,
        version: imageVersion(path.join(PUBLIC_DIR, ogRel)),
      };
    }
  }
}
// slug → versioned social-crop URL path ("news/x/cover-og.jpg?v=abc"), handed
// to buildFeed so the JSON Feed advertises the SAME optimized, cache-busted
// card image og:image serves instead of the raw multi-MB cover.
const ARTICLE_SOCIAL_PATHS = Object.create(null);
for (const slug of Object.keys(ARTICLE_SOCIAL)) {
  const s = ARTICLE_SOCIAL[slug];
  ARTICLE_SOCIAL_PATHS[slug] = `${s.path}${s.version ? `?v=${s.version}` : ""}`;
}

// The loaded, validated articles in folder order — the single input shared by
// the feed builders here and by the static build (feeds.js stays the one place
// sitemap/rss/feed bytes are produced, so the live server and the build cannot
// diverge).
const ARTICLES = ARTICLE_SLUGS.map((slug) => ARTICLE_META[slug]).filter(Boolean);
const PUBLICATIONS = loadPublications();
const PUBLICATION_YEARS = PUBLICATIONS.map((p) => Number(p.year)).filter(Number.isFinite);

// /publications JSON-LD: the page carries the site's richest machine-readable
// dataset (DOI-bearing peer-reviewed entries), so it is exposed as an
// ItemList of ScholarlyArticle nodes rather than a bare BreadcrumbList.
// Static data — built once at startup like PROFILE_JSONLD.
const PUBLICATIONS_ITEMLIST = {
  "@type": "ItemList",
  "itemListElement": PUBLICATIONS.map((p, i) => {
    // The DOI lives at the tail of the IEEE-style citation string
    // ("… doi: 10.xxxx/yyyy."); the trailing period is citation punctuation,
    // not part of the DOI.
    const doiMatch = typeof p.citation === "string" && p.citation.match(/\bdoi:\s*(10\.\S+?)\.?\s*$/i);
    const item = {
      "@type": "ScholarlyArticle",
      "headline": p.title,
      "datePublished": String(p.year),
      "author": { "@type": "Person", "name": SITE_CFG.name, "url": HOME_URL },
    };
    if (doiMatch) {
      item.identifier = { "@type": "PropertyValue", "propertyID": "DOI", "value": doiMatch[1] };
      item.sameAs = `https://doi.org/${doiMatch[1]}`;
    } else if (Array.isArray(p.links) && p.links[0] && p.links[0].href) {
      item.sameAs = p.links[0].href;
    }
    return { "@type": "ListItem", "position": i + 1, "item": item };
  }),
};
// Only articles that PASSED validation ship to the client. A folder that
// loadArticleMeta rejected must not have its script injected into every page
// (the SPA would happily render the article the server refused to put in the
// feeds) and must not count as a valid /news/<slug> route.
const VALID_ARTICLE_SLUGS = ARTICLES.map((a) => a.slug);
const ARTICLE_SCRIPTS = VALID_ARTICLE_SLUGS
  .map((slug) => `<script src="/news/${slug}/article.js"></script>`)
  .join("\n");
const ASSET_MAP = loadAssetMap();

// Live view of the asset map for the REQUEST path: re-read whenever
// dist/manifest.json changes, so the local `npm run watch` workflow serves
// fresh bundles on the next refresh without a server restart (README promises
// exactly that). The rendered-HTML compression cache is dropped on a change —
// the cached bytes embed the old hashed names. In production every deploy is
// a fresh process and the mtime never changes, so this costs one fs.stat per
// HTML render. The exported ASSET_MAP snapshot (used by build-static.js, one
// fresh process per build) is unaffected.
let liveAssetMap = ASSET_MAP;
let liveAssetMapMtime = assetManifestMtime();
function assetManifestMtime() {
  try {
    return fs.statSync(path.join(PUBLIC_DIR, "dist", "manifest.json")).mtimeMs;
  } catch {
    return 0;
  }
}
function currentAssetMap() {
  const mtime = assetManifestMtime();
  if (mtime !== liveAssetMapMtime) {
    liveAssetMapMtime = mtime;
    liveAssetMap = loadAssetMap();
    COMPRESSION_CACHE.clear();
  }
  return liveAssetMap;
}

// Default robots directive for real, indexable routes: allow indexing and give
// crawlers the large image/snippet previews. The not-found route overrides this
// with a noindex directive (below) — an error page must not ask to be indexed.
const ROBOTS_INDEX =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
const ROBOTS_NOINDEX = "noindex,follow";

function computePageMeta(pathname) {
  // parseRoute is the shared route table (routes.js) — same matcher the client
  // and isValidSpaRoute use, so the meta branch can never drift from routing.
  const route = parseRoute(pathname);
  const titleCtx = { siteName: SITE_CFG.name, jobTitle: SITE_CFG.jobTitle };

  if (route.page === "home") {
    return {
      title: pageTitle(route, titleCtx),
      description: DEFAULT_DESCRIPTION,
      url: HOME_URL,
      image: DEFAULT_IMAGE,
      imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
      imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
      imageAlt: `${SITE_CFG.name} - ${SITE_CFG.jobTitle}`,
      ogType: "website",
      // og:title without the "- <site name>" suffix pageTitle appends for the
      // browser tab: social cards render og:site_name on its own line, so the
      // suffixed form printed the name twice and truncated the headline.
      socialTitle: SITE_CFG.name,
      jsonLd: PROFILE_JSONLD,
      preloadImage: HERO_PRELOAD_IMAGE,
      preloadImageSrcset: imageSrcset(SITE_CFG.heroImage, "avif"),
      preloadImageSizes: HERO_IMG_SIZES,
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
      socialTitle: "News",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": HOME_URL },
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
        "Peer-reviewed journal and conference papers on renewable energy, battery storage, PV systems, V2G integration, grid simulation, and EV charging.",
      url: `${SITE_CFG.url}/publications`,
      image: DEFAULT_IMAGE,
      imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
      imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
      imageAlt: `Publications by ${SITE_CFG.name}`,
      ogType: "website",
      socialTitle: "Publications",
      jsonLd: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "Home", "item": HOME_URL },
              { "@type": "ListItem", "position": 2, "name": "Publications", "item": `${SITE_CFG.url}/publications` },
            ],
          },
          PUBLICATIONS_ITEMLIST,
        ],
      },
    };
  }

  if (route.page === "article") {
    const article = ARTICLE_META[route.slug];
    if (article) {
      const coverVersion = ARTICLE_COVER_VERSION[route.slug];
      const social = ARTICLE_SOCIAL[route.slug];
      // Prefer the dedicated 1200x630 social crop; fall back to the raw cover,
      // then to the default share image.
      const image = social
        ? `${SITE_CFG.url}/${social.path}${social.version ? `?v=${social.version}` : ""}`
        : article.cover
          ? `${SITE_CFG.url}/${article.cover}${coverVersion ? `?v=${coverVersion}` : ""}`
          : DEFAULT_IMAGE;
      // og:image dimensions track whichever image `image` points at: the social
      // crop (1200x630) when built, else the article's own cover, else default.
      const imageDimensions = social
        ? social.dims
        : article.cover ? ARTICLE_COVER_DIMS[route.slug] : DEFAULT_IMAGE_DIMS;

      // plainBody strips the inline **bold** markers the on-page renderer
      // consumes, so JSON-LD (and its wordCount) carries clean prose.
      const articleBody = plainBody(article.body);
      const wordCount = articleBody ? articleBody.trim().split(/\s+/).length : 0;
      // Meta/OG/Twitter/JSON-LD description: a dedicated, SERP-length (<=~160
      // char) seoDescription when the article provides one, else the fuller
      // card/feed excerpt. Keeps the meta description within Google's snippet
      // window without shortening the visible card text or the feed summaries.
      const description = article.seoDescription || article.excerpt;

      // dateUpdated is the optional "content edited after publication" field
      // (validated in article-schema.js); without it dateModified mirrors the
      // publish date. Hardwiring dateModified to article.date made editing an
      // article invisible to search engines.
      const modifiedDate = article.dateUpdated || article.date;

      const articleSchema = {
        "@type": "Article",
        "headline": article.title,
        "description": description,
        "image": image,
        "datePublished": article.date,
        "dateModified": modifiedDate,
        "author": { "@type": "Person", "name": SITE_CFG.name, "url": HOME_URL },
        "publisher": { "@type": "Person", "name": SITE_CFG.name, "url": HOME_URL },
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
          { "@type": "ListItem", "position": 1, "name": "Home", "item": HOME_URL },
          { "@type": "ListItem", "position": 2, "name": "News", "item": `${SITE_CFG.url}/news` },
          { "@type": "ListItem", "position": 3, "name": article.title, "item": `${SITE_CFG.url}/news/${article.slug}` },
        ],
      };

      return {
        title: pageTitle(route, { ...titleCtx, articleTitle: article.title }),
        description,
        url: `${SITE_CFG.url}/news/${article.slug}`,
        image,
        imageWidth: imageDimensions && imageDimensions.width,
        imageHeight: imageDimensions && imageDimensions.height,
        imageAlt: article.title,
        ogType: "article",
        // Social cards want the bare headline: og:site_name already carries
        // the author's name on its own line.
        socialTitle: article.title,
        // article:* Open Graph properties (published/modified time, author,
        // section, tags) let LinkedIn/Facebook/Slack surface the publish date
        // and topic on shares. All derived from already-validated article
        // data. article:author is typed as a PROFILE URL in the OG article
        // vertical — a display-string value is ignored by scrapers.
        articleMeta: {
          publishedTime: `${article.date}T00:00:00+00:00`,
          modifiedTime: `${modifiedDate}T00:00:00+00:00`,
          author: HOME_URL,
          section: article.articleSection || undefined,
          tags: article.keywords && article.keywords.length ? article.keywords : undefined,
        },
        jsonLd: {
          "@context": "https://schema.org",
          "@graph": [breadcrumbs, articleSchema],
        },
        // The cover is the article page's LCP element, and with an empty #root
        // (client-side render) the browser cannot discover it until the whole
        // script chain has run — preload the AVIF sibling the <Picture> source
        // list resolves to, exactly like the home hero.
        preloadImage: article.cover
          ? `/${article.cover.replace(/\.(jpe?g|png)$/i, ".avif")}`
          : undefined,
        preloadImageSrcset: article.cover ? imageSrcset(`/${article.cover}`, "avif") : undefined,
        preloadImageSizes: article.cover ? ARTICLE_COVER_SIZES : undefined,
      };
    }
  }

  // Unknown route — used by the SPA NotFound page (served with HTTP 404) and by
  // the static 404.html. og:url points at the home root rather than reflecting
  // the requested (attacker-controllable) pathname back into shared metadata.
  // canonical is null — no rel=canonical tag at all: noindex plus a canonical
  // to a different URL is a conflicting-signal anti-pattern. robots is noindex
  // (an error page must not ask to be indexed) and jsonLd is null (no
  // structured-data block emitted at all — an empty
  // <script type="application/ld+json"></script> is invalid JSON that
  // rich-results validators flag).
  return {
    title: pageTitle(route, titleCtx),
    description: DEFAULT_DESCRIPTION,
    url: HOME_URL,
    canonical: null,
    socialTitle: "Page not found",
    image: DEFAULT_IMAGE,
    imageWidth: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.width,
    imageHeight: DEFAULT_IMAGE_DIMS && DEFAULT_IMAGE_DIMS.height,
    imageAlt: `${SITE_CFG.name} - ${SITE_CFG.jobTitle}`,
    ogType: "website",
    robots: ROBOTS_NOINDEX,
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
  // /dist/ bundles carry a content hash in their FILENAME — new content is a
  // new URL, so a year of immutable is always sound.
  if (url.pathname.startsWith("/dist/")) {
    return "public, max-age=31536000, immutable";
  }
  // ?v=-stamped assets: only the token the CURRENT deploy stamps earns the
  // immutable class. Any-?v= qualified before, which (a) let third parties
  // pin arbitrary cache keys (…?v=anything) for a year, and (b) froze
  // styles.css/data.js/article.js in the browser for the whole of a local dev
  // session — DEPLOY_VERSION is fixed at boot, so the stamped URLs never
  // changed while files on disk did. In production (CF_PAGES_COMMIT_SHA set)
  // every deploy is a new token, so immutable is correct; in dev, revalidate.
  if (url.searchParams.get("v") === String(DEPLOY_VERSION)) {
    return process.env.CF_PAGES_COMMIT_SHA
      ? "public, max-age=31536000, immutable"
      : "no-cache";
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

// Pick the supported content coding the client ranks highest. Full qvalue
// handling per RFC 9110 §12.5.3: a coding refused with q=0 is never chosen,
// and an explicit ranking like "br;q=0.1, gzip;q=1.0" picks gzip — the old
// fixed br-first preference honoured refusals but ignored the ranking.
// Ties (including the common unranked "gzip, br") break toward br, the
// smaller output for this site's text content.
function negotiateEncoding(acceptHeader) {
  const explicit = {};
  let wildcard = null;
  for (const part of String(acceptHeader || "").split(",")) {
    const m = part.trim().match(/^(br|gzip|\*)\s*(?:;\s*q\s*=\s*([\d.]+))?$/i);
    if (!m) continue;
    const weight = m[2] === undefined ? 1 : Number(m[2]);
    if (Number.isNaN(weight)) continue;
    if (m[1] === "*") wildcard = weight;
    else explicit[m[1].toLowerCase()] = weight;
  }
  // An explicit coding entry beats the wildcard; unmentioned codings with no
  // wildcard rank 0 (not offered).
  const rank = (name) =>
    explicit[name] !== undefined ? explicit[name] : wildcard !== null ? wildcard : 0;
  const br = rank("br");
  const gzip = rank("gzip");
  if (br <= 0 && gzip <= 0) return null;
  if (gzip > br) return "gzip";
  return br > 0 ? "br" : null;
}

function writeCompressed(req, res, headers, data, cacheKey) {
  const status = headers.__status || 200;
  delete headers.__status;
  const isHead = req.method === "HEAD";
  const ct = headers["Content-Type"] || "";

  // Normalize to a Buffer so Content-Length is the true byte count. A string's
  // .length counts UTF-16 units, which understates the byte length whenever the
  // body contains multi-byte UTF-8 (e.g. the "—" in the home meta).
  const buf = data == null ? Buffer.alloc(0) : Buffer.isBuffer(data) ? data : Buffer.from(data);

  let encoding = null;
  if (isCompressible(ct) && buf.length > 1024) {
    encoding = negotiateEncoding(req.headers["accept-encoding"]);
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

  // Identity responses of compressible content still vary by Accept-Encoding:
  // without the header, a shared cache that first stores the identity variant
  // would serve it to gzip/brotli clients (and vice versa) without negotiating.
  const vary = isCompressible(ct) ? { Vary: "Accept-Encoding" } : null;
  res.writeHead(status, { ...headers, ...vary, "Content-Length": buf.length });
  res.end(isHead ? undefined : buf);
}

// True when pathname maps to a route the SPA can render. Delegates to the
// shared route table; an article route is valid only if its slug was
// discovered at startup AND passed validation (a rejected folder 404s like
// any unknown slug — its script is not injected either, see ARTICLE_SCRIPTS).
function isValidSpaRoute(pathname) {
  return routeIsValidSpa(pathname, VALID_ARTICLE_SLUGS);
}

// Replace the __META_*__ placeholders in index.html with per-route values.
// Every replacement uses a FUNCTION value, not a string: a string replacement
// would interpret $&, $`, $', $$ in the injected meta as special patterns,
// letting hostile article text (e.g. a title containing "$&") corrupt the
// served HTML and JSON-LD. A function value is inserted verbatim.
function injectMeta(html, meta) {
  const producers = {
    __META_SITE_NAME__: () => escapeHtml(SITE_CFG.name),
    __META_TITLE__: () => escapeHtml(meta.title),
    // og:title/twitter:title: the bare social headline (no "- <site name>"
    // suffix — og:site_name already renders the name as its own card line).
    __META_OG_TITLE__: () => escapeHtml(meta.socialTitle || meta.title),
    __META_DESCRIPTION__: () => escapeHtml(meta.description),
    __META_URL__: () => escapeHtml(meta.url),
    // rel=canonical is omitted entirely when meta.canonical is null (the 404
    // page): a noindex page that nominates a DIFFERENT URL as canonical sends
    // conflicting signals — search engines may consolidate the noindex onto
    // the canonical target. og:url keeps pointing at home for share safety.
    __META_CANONICAL__: () =>
      meta.canonical === null
        ? ""
        : `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    __META_IMAGE__: () => escapeHtml(meta.image),
    // Width/height plus og:image:type (derived from the image extension so a
    // future PNG cover stays correct; declaring it saves scrapers a probe).
    // The dims come from imageDims' binary header reads and are always
    // numbers, but they are coerced here anyway so this producer upholds the
    // same "nothing unescaped reaches the HTML" invariant as its siblings.
    __META_IMAGE_META__: () => {
      const lines = [];
      if (meta.imageWidth && meta.imageHeight) {
        lines.push(`<meta property="og:image:width" content="${Number(meta.imageWidth) || 0}" />`);
        lines.push(`<meta property="og:image:height" content="${Number(meta.imageHeight) || 0}" />`);
      }
      const ext = String(meta.image || "").split("?")[0].match(/\.(jpe?g|png)$/i);
      if (ext) {
        lines.push(
          `<meta property="og:image:type" content="${ext[1].toLowerCase().startsWith("p") ? "image/png" : "image/jpeg"}" />`
        );
      }
      return lines.join("\n");
    },
    __META_IMAGE_ALT__: () => escapeHtml(meta.imageAlt || meta.title),
    __META_OG_TYPE__: () => escapeHtml(meta.ogType),
    // article:* OG properties, emitted only on article pages (meta.articleMeta).
    __META_ARTICLE_OG__: () => {
      const a = meta.articleMeta;
      if (!a) return "";
      const lines = [];
      if (a.publishedTime) lines.push(`<meta property="article:published_time" content="${escapeHtml(a.publishedTime)}" />`);
      if (a.modifiedTime) lines.push(`<meta property="article:modified_time" content="${escapeHtml(a.modifiedTime)}" />`);
      if (a.author) lines.push(`<meta property="article:author" content="${escapeHtml(a.author)}" />`);
      if (a.section) lines.push(`<meta property="article:section" content="${escapeHtml(a.section)}" />`);
      for (const tag of a.tags || []) lines.push(`<meta property="article:tag" content="${escapeHtml(tag)}" />`);
      return lines.join("\n");
    },
    __META_ROBOTS__: () => escapeHtml(meta.robots || ROBOTS_INDEX),
    // Emit the whole <script type="application/ld+json"> block only when there
    // is schema to put in it; a route with no JSON-LD (the 404 page) gets no
    // tag at all rather than an empty, invalid one.
    __META_JSONLD__: () =>
      meta.jsonLd
        ? `<script type="application/ld+json">${jsonLdScript(meta.jsonLd)}</script>`
        : "",
    // imagesrcset/imagesizes mirror the <Picture> AVIF source exactly (both
    // built by ui-helpers.imageSrcset), so the browser preloads the SAME
    // candidate it will render; href stays as the fallback for browsers
    // without imagesrcset support.
    __META_PRELOAD__: () => meta.preloadImage
      ? `<link rel="preload" as="image" href="${escapeHtml(meta.preloadImage)}"${meta.preloadImageSrcset ? ` imagesrcset="${escapeHtml(meta.preloadImageSrcset)}" imagesizes="${escapeHtml(meta.preloadImageSizes || "")}"` : ""} type="image/avif" fetchpriority="high" />`
      : "",
  };
  // ONE pass over the template, not a chain of sequential .replace calls: a
  // produced value that happens to contain a later __META_*__ token (say, an
  // article title quoting one) is inserted verbatim and never re-expanded —
  // the sequential chain re-scanned earlier insertions and would inject the
  // raw JSON-LD block inside a <title>. Unknown tokens pass through untouched,
  // matching the old chain's behavior.
  return html.replace(/__META_[A-Z_]+__/g, (token) =>
    producers[token] ? producers[token]() : token
  );
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
    /((?:src|href)=")(\/(?!dist\/)[^"?]+\.(?:css|js))(")/g,
    `$1$2?v=${deployVersion}$3`
  );
  return versioned;
}

function serveIndex(req, res, filePath, pathname, statusCode = 200) {
  fs.readFile(filePath, "utf8", (err, html) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      });
      res.end("404 Not Found");
      return;
    }
    const versioned = renderHtml(html, pathname, {
      deployVersion: DEPLOY_VERSION,
      articleScripts: ARTICLE_SCRIPTS,
      assetMap: currentAssetMap(),
    });
    const contentType = "text/html; charset=utf-8";
    // Cache compressed variants by CONTENT, not by path: a path key served
    // stale compressed bytes after a template/data edit during `npm run watch`
    // (identity clients got the fresh render, gzip/brotli clients the cached
    // one), and gave every unknown 404 path its own entry although the
    // rendered not-found page is identical for all of them. Hashing the
    // rendered string keys equal bytes together and can never go stale.
    const contentKey = crypto.createHash("sha1").update(versioned).digest("hex").slice(0, 16);
    writeCompressed(req, res, {
      "Content-Type": contentType,
      "Cache-Control": cacheHeaderFor(req, contentType),
      __status: statusCode,
    }, versioned, `html:${contentKey}`);
  });
}

// Weak validator derived from size + mtime: cheap (the stat is already in
// hand), stable until the file is rewritten. Weak because the same entity is
// also served content-encoded — byte-equality across encodings is not claimed.
function entityTag(stats) {
  return `W/"${stats.size.toString(16)}-${Math.trunc(stats.mtimeMs).toString(16)}"`;
}

// True when the request's conditional headers show the client copy is current
// (→ 304). If-None-Match wins over If-Modified-Since (RFC 9110 §13.1.3).
// Without these validators every asset was re-downloaded IN FULL once its
// max-age expired — there was nothing for the browser to revalidate against.
function isNotModified(req, etag, mtimeMs) {
  const inm = req.headers["if-none-match"];
  if (inm) {
    return String(inm)
      .split(",")
      .map((t) => t.trim())
      .some((t) => t === etag || t === "*");
  }
  const ims = req.headers["if-modified-since"];
  if (ims) {
    const since = Date.parse(ims);
    // HTTP dates have whole-second resolution; truncate the mtime to match.
    if (!Number.isNaN(since)) return Math.trunc(mtimeMs / 1000) * 1000 <= since;
  }
  return false;
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
        res.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        });
        res.end("404 Not Found");
        return;
      }
      const size = stats.size;
      const etag = entityTag(stats);
      const lastModified = stats.mtime.toUTCString();
      let start = 0;
      let end = size > 0 ? size - 1 : 0;
      let status = 200;
      const headers = {
        "Content-Type": contentType,
        "Cache-Control": cacheHeaderFor(req, contentType),
        "Accept-Ranges": "bytes",
        "ETag": etag,
        "Last-Modified": lastModified,
      };

      if (isNotModified(req, etag, stats.mtimeMs)) {
        // 304: validators + caching headers only, no body, no Content-Length.
        res.writeHead(304, {
          "Cache-Control": headers["Cache-Control"],
          "ETag": etag,
          "Last-Modified": lastModified,
        });
        res.end();
        return;
      }

      // A Range is honoured only when If-Range (if present) still matches:
      // a client resuming across a file replacement must get the full new
      // entity, not a splice of two different versions.
      const ifRange = req.headers["if-range"];
      const ifRangeDate = ifRange && !String(ifRange).includes('"') ? Date.parse(ifRange) : NaN;
      const rangeValid =
        !ifRange ||
        ifRange === etag ||
        (!Number.isNaN(ifRangeDate) && Math.trunc(stats.mtimeMs / 1000) * 1000 <= ifRangeDate);

      const rangeHeader = req.headers["range"];
      if (rangeHeader && rangeValid) {
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
              "Cache-Control": "no-cache, no-store, must-revalidate",
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

  // Key the compressed variants by path + mtime, not path + size: a same-length
  // edit during `npm run watch` kept serving the stale compressed bytes while
  // identity clients saw the fresh file. The mtime changes on every write.
  fs.stat(filePath, (statErr, stats) => {
    const mtime = statErr ? 0 : stats.mtimeMs;
    // Same conditional-request handling as the streaming branch: text assets
    // in the 86400 class revalidate to a 304 instead of a full re-download.
    if (!statErr && stats.isFile()) {
      const etag = entityTag(stats);
      if (isNotModified(req, etag, stats.mtimeMs)) {
        res.writeHead(304, {
          "Cache-Control": cacheHeaderFor(req, contentType),
          "ETag": etag,
          "Last-Modified": stats.mtime.toUTCString(),
          "Vary": "Accept-Encoding",
        });
        res.end();
        return;
      }
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        });
        res.end("404 Not Found");
        return;
      }
      const validators = statErr || !stats.isFile()
        ? null
        : { "ETag": entityTag(stats), "Last-Modified": stats.mtime.toUTCString() };
      writeCompressed(req, res, {
        "Content-Type": contentType,
        "Cache-Control": cacheHeaderFor(req, contentType),
        ...(validators || {}),
      }, data, `file:${filePath}:${mtime}`);
    });
  });
}

// Applied to every response. CSP is tuned to this site: self-hosted scripts
// and self-hosted fonts (vendor/fonts). No third-party font or style origins —
// the webfonts are served from this origin. style-src carries NO
// 'unsafe-inline': React's style prop writes through the CSSOM (which CSP
// does not govern), the rendered markup contains no style attributes and no
// <style> blocks (locked by a characterization test), so the token would be
// pure attack surface.
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  // `preload` makes the domain eligible for the browser HSTS preload list, so
  // even a first-ever visit never has a plaintext hop.
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  // Companion to COOP: the site's images/fonts/PDF cannot be embedded or read
  // cross-origin (XS-Leaks surface). COEP is deliberately NOT set: with
  // require-corp, a Cloudflare-injected analytics beacon (allowed by the CSP
  // below) would be blocked unless CF serves it with a CORP header.
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": [
    "default-src 'self'",
    // Analytics origins: the Cloudflare Web Analytics beacon (script from
    // static.cloudflareinsights.com, RUM posts to cloudflareinsights.com) so
    // enabling it from the Cloudflare Pages dashboard is not silently blocked
    // by this CSP.
    "script-src 'self' https://static.cloudflareinsights.com",
    "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self' https://cloudflareinsights.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; "),
};

// The repo root is the document root, so the PUBLIC surface is declared
// explicitly and everything else is private BY DEFAULT. The two lists below
// are the single source of truth shared with build-static.js (which copies
// exactly these root files into the deploy), so a new root file is invisible
// on both surfaces until it is deliberately published here.
//
// Root files served (and copied to the build) verbatim:
const ROOT_PLAIN_FILES = [
  "styles.css",
  "site.config.js",
  "routes.js",
  "article-schema.js",
  "ui-helpers.js",
  "data.js",
  "site.webmanifest",
  "robots.txt",
  "favicon.ico",
  "favicon.svg",
  // The hero's "Download CV" target (site.config.js cvPath).
  "lampros-konstantellos-cv.pdf",
];
// Root images: served/copied along with their optimize-images siblings
// (.webp/.avif plus the -480/-960 width variants).
const ROOT_IMAGE_BASES = [
  "favicon-16x16.png",
  "favicon-32x32.png",
  "favicon-48x48.png",
  "favicon-64x64.png",
  "favicon-96x96.png",
  "favicon-128x128.png",
  "icon-192.png",
  "icon-256.png",
  "icon-512.png",
  // Maskable variant (safe-zone padding baked in) for Android/Chromium
  // adaptive icons — an "any"-only set gets letterboxed on the home screen.
  "icon-512-maskable.png",
  "apple-touch-icon.png",
  "og-image.jpg",
  "lampros-konstantellos-picture.jpg",
];

// Every root-level pathname the server may answer: the plain files, the image
// bases and their generated variants, the rendered pages/feeds (answered by
// dedicated branches before file serving, but they must not be classed
// private), and index.html itself (the "/" template).
const PUBLIC_ROOT_PATHS = new Set(
  [
    "/",
    "/index.html",
    "/sitemap.xml",
    "/rss.xml",
    "/feed.json",
    ...ROOT_PLAIN_FILES.map((f) => `/${f}`),
    ...ROOT_IMAGE_BASES.flatMap((f) => {
      const noExt = f.replace(/\.[^.]+$/, "");
      return [
        `/${f}`,
        ...[".webp", ".avif"].flatMap((ext) => [
          `/${noExt}${ext}`,
          ...IMAGE_WIDTH_VARIANTS.map((w) => `/${noExt}-${w}${ext}`),
        ]),
      ];
    }),
  ].map((p) => p.toLowerCase())
);

// Redundant explicit denylist kept as a second gate for the paths whose
// exposure would be worst — a regression in the allowlist logic above must
// ALSO get past this before a source file is served.
const PRIVATE_PATHS = new Set(
  [
    "/server.js",
    "/feeds.js",
    "/build-static.js",
    "/package.json",
    "/package-lock.json",
    "/.gitignore",
    "/LICENSE",
    "/dist/manifest.json",
  ].map((p) => p.toLowerCase())
);

function isPrivatePath(rawPathname) {
  // Case-normalized: every public asset path is lowercase, and on a
  // case-insensitive filesystem (a macOS dev machine) "/SERVER.JS" would
  // otherwise bypass the byte-exact matching and serve the source file.
  const pathname = rawPathname.toLowerCase();
  if (PRIVATE_PATHS.has(pathname)) return true;
  // Any dot-prefixed SEGMENT, not just a root dotfile: build-static.js
  // filters nested dotfiles out of the deploy for the same reason (a
  // .DS_Store inside an article folder must not ship), and the server must
  // not be the looser of the two.
  if (/(^|\/)\./.test(pathname)) return true;
  // No public asset is Markdown (covers README.md, news/README.md, and any
  // future notes) or raw JSX (the browser loads the compiled /dist/ bundles;
  // app.jsx / icons.jsx / components/*.jsx are source only).
  if (/\.(md|jsx)$/i.test(pathname)) return true;
  // Root level with an extension: a file request — allowlist only. Root level
  // WITHOUT an extension is a clean URL (/news, /publications, /any-typo):
  // never private here so the SPA fallback can answer it (friendly HTML 404
  // for unknown routes); the file-serving branch separately refuses to serve
  // a real-but-unlisted extensionless root file (see the stat callback).
  if (!pathname.slice(1).includes("/")) {
    if (pathname.includes(".")) return !PUBLIC_ROOT_PATHS.has(pathname);
    return false;
  }
  // Subdirectories: only the compiled bundles, the vendored runtime/fonts and
  // the article folders are public. scripts/, test/, docs/, node_modules/,
  // components/, build/, scratch/ and anything future all fall through here.
  return !(
    pathname.startsWith("/dist/") ||
    pathname.startsWith("/vendor/") ||
    pathname.startsWith("/news/")
  );
}

const ALLOWED_METHODS = "GET, HEAD, OPTIONS";

function sendStatus(res, code, message, extraHeaders) {
  if (res.headersSent) return;
  res.writeHead(code, {
    "Content-Type": "text/plain; charset=utf-8",
    // Error/status responses are heuristically cacheable per RFC 9110 §15.1
    // and carry no validators, so without an explicit directive a shared
    // cache may keep e.g. a 404 for a not-yet-published URL.
    "Cache-Control": "no-cache, no-store, must-revalidate",
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
      // No Content-Length: RFC 9110 §8.6 forbids it on a 204.
      res.writeHead(204, { "Allow": ALLOWED_METHODS });
      res.end();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendStatus(res, 405, "405 Method Not Allowed", { "Allow": ALLOWED_METHODS });
      return;
    }

    // A request target beginning "//" is origin-form, but new URL(target, base)
    // parses the second segment as an AUTHORITY: "//news" yields pathname "/",
    // so GET //news answered 200 with the home page (and //x/foo with /foo) —
    // a request-line/content mismatch that desyncs caches and diverges from
    // the static deploy. Reject rather than guess.
    if ((req.url || "/").startsWith("//")) {
      sendStatus(res, 400, "400 Bad Request");
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
    // A backslash is never part of a public path either. A RAW backslash is
    // already folded to "/" by the WHATWG URL parser, but an ENCODED one
    // (%5C) survives to here — and while the denylist below compares with
    // POSIX rules (where "\" is an ordinary character), path.join/normalize
    // use PLATFORM rules, where win32 treats "\" as a separator. On a Windows
    // dev machine /news/..%5Cserver.js therefore dodged isPrivatePath yet
    // resolved onto the source file. Reject the whole class.
    if (urlPathname.includes("\\")) {
      sendStatus(res, 400, "400 Bad Request");
      return;
    }

    // Collapse "." / ".." segments up front, BEFORE any allow/deny decision.
    // isPrivatePath (and the feed routes) match on exact pathnames, so an
    // ENCODED traversal like /news/..%2fserver.js — which `new URL` leaves
    // un-normalized and decodeURIComponent turns into "/news/../server.js",
    // a path NOT on the denylist — would otherwise slip past isPrivatePath and
    // only normalize back onto the private file when requestedPath is built
    // below. The existing boundary check only stops traversals that ESCAPE the
    // root; one that re-enters onto server.js / .git / package.json passed it.
    // URL paths are POSIX, so normalize with POSIX rules (path.sep-independent).
    urlPathname = path.posix.normalize(urlPathname);

    // /index.html is the home page under a second URL. Redirect to "/" so there
    // is one canonical home (previously it served 200 with "Page not found"
    // meta and a self-canonical to /index.html — a duplicate-content bug).
    if (urlPathname === "/index.html") {
      res.writeHead(301, { "Location": "/", "Content-Type": "text/plain; charset=utf-8" });
      res.end("Moved Permanently");
      return;
    }

    // Trailing slashes redirect to the slash-less form, mirroring Cloudflare
    // Pages (which 308s /foo/ → /foo for the flat foo.html layout). The dev
    // server used to answer /news/<slug>/ with a 200 of the full article — a
    // duplicate-content URL the deploy redirects, i.e. a status-code parity
    // break between the two environments.
    if (urlPathname !== "/" && urlPathname.endsWith("/")) {
      res.writeHead(301, {
        "Location": urlPathname.replace(/\/+$/, "") + (parsedUrl.search || ""),
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Moved Permanently");
      return;
    }

    let pathname = urlPathname;

    if (isPrivatePath(urlPathname)) {
      sendStatus(res, 404, "404 Not Found");
      return;
    }

    if (pathname === "/") {
      pathname = "/index.html";
    }

    const requestedPath = path.normalize(path.join(PUBLIC_DIR, pathname));

    // Boundary check with a trailing separator so a sibling directory whose
    // name merely starts with PUBLIC_DIR (e.g. "<dir>-secrets") cannot pass.
    if (requestedPath !== PUBLIC_DIR && !requestedPath.startsWith(PUBLIC_DIR + path.sep)) {
      sendStatus(res, 403, "403 Forbidden");
      return;
    }

  if (urlPathname === "/sitemap.xml") {
    const xml = buildSitemap({ articles: ARTICLES, siteCfg: SITE_CFG, publicationYears: PUBLICATION_YEARS });
    // Compressed like every other text response (the body is deterministic per
    // process, so it is keyed by a stable name and compressed at most once).
    writeCompressed(req, res, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    }, xml, "feed:sitemap");
    return;
  }

  if (urlPathname === "/feed.json") {
    const json = buildFeed({ articles: ARTICLES, siteCfg: SITE_CFG, socialImages: ARTICLE_SOCIAL_PATHS });
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
    // The outer try/catch ends when the synchronous handler returns — a throw
    // inside THIS callback would otherwise unwind to uncaughtException with
    // the response never written, leaving the socket open until the request
    // timeout. Answer 500 instead.
    try {
    // A root-level file may only be served off the declared allowlist, even
    // when it has no extension (isPrivatePath's extension rule cannot class
    // those): a future extensionless root file (Makefile, TODO, deploy) must
    // fall through to the SPA fallback's 404, not ship its bytes.
    const rootLevel = !urlPathname.slice(1).includes("/");
    const allowedFile =
      !rootLevel || PUBLIC_ROOT_PATHS.has(urlPathname.toLowerCase());
    if (!err && stats.isFile() && allowedFile) {
      // The lexical boundary check above cannot see symlinks: fs.stat and
      // createReadStream FOLLOW them, so a link committed or dropped anywhere
      // under the root whose target lies outside it would be served with a
      // 200. Re-apply the containment test against the RESOLVED path.
      fs.realpath(requestedPath, (rpErr, realPath) => {
        if (
          rpErr ||
          (realPath !== PUBLIC_DIR_REAL && !realPath.startsWith(PUBLIC_DIR_REAL + path.sep))
        ) {
          sendStatus(res, 403, "403 Forbidden");
          return;
        }
        if (requestedPath.endsWith(".html")) {
          serveIndex(req, res, requestedPath, urlPathname);
        } else {
          sendFile(req, res, requestedPath);
        }
      });
      return;
    }

    // Path has an extension → it's an asset request that missed → real 404
    if (path.extname(urlPathname) !== "") {
      sendStatus(res, 404, "404 Not Found");
      return;
    }

    // Clean URL → SPA fallback. Unknown routes get HTTP 404 but still serve the
    // SPA HTML so the client can render a friendly 404 page.
    const statusCode = isValidSpaRoute(urlPathname) ? 200 : 404;
    serveIndex(req, res, path.join(PUBLIC_DIR, "index.html"), urlPathname, statusCode);
    } catch (cbErr) {
      console.error("Request handler error:", cbErr && cbErr.message);
      sendStatus(res, 500, "500 Internal Server Error");
    }
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
  VALID_ARTICLE_SLUGS,
  ARTICLE_SOCIAL_PATHS,
  PUBLICATION_YEARS,
  ARTICLE_SCRIPTS,
  ASSET_MAP,
  SITE_CFG,
  // The declared public root surface — build-static.js copies exactly these
  // (so server allowlist and deploy contents cannot drift apart).
  ROOT_PLAIN_FILES,
  ROOT_IMAGE_BASES,
};
