"use strict";

// Cross-module consistency (class C): every duplicated fact now has one owner.
// These tests fail if a consumer drifts from its source of truth.

const { test, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { start, stop, request, loadDataWindow } = require("./helper");

const ROOT = path.join(__dirname, "..");
const SITE = require("../site.config.js");
const routes = require("../routes.js");
const schema = require("../article-schema.js");
const server = require("../server.js");

let base;
before(async () => { ({ base } = await start()); });
after(async () => { await stop(); });

// ---- C1: route table agreement (parseRoute / computePageMeta / isValid) ----

test("parseRoute, computePageMeta and isValidSpaRoute agree on a corpus", () => {
  const corpus = [
    "/", "/news", "/publications",
    "/news/ieee-pess-2025-best-paper-award",
    "/news/unknown-slug-xyz",
    "/random", "/news/", "/publications/", "/news/a/b",
  ];
  for (const p of corpus) {
    const r = routes.parseRoute(p);
    const meta = server.computePageMeta(p);
    const valid = server.isValidSpaRoute(p);

    if (r.page === "home") {
      assert.equal(meta.ogType, "website");
      assert.ok(meta.title.includes(SITE.jobTitle), `${p}: home title`);
      assert.equal(valid, true, `${p}: home valid`);
    } else if (r.page === "news-list") {
      assert.match(meta.title, /^News - /, p);
      assert.equal(valid, true, p);
    } else if (r.page === "publications-list") {
      assert.match(meta.title, /^Publications - /, p);
      assert.equal(valid, true, p);
    } else if (r.page === "article") {
      // computePageMeta only yields article meta when the slug exists; the same
      // existence check drives isValidSpaRoute, so they must agree.
      const isArticleMeta = meta.ogType === "article";
      assert.equal(isArticleMeta, valid, `${p}: article meta vs valid mismatch`);
    } else {
      assert.match(meta.title, /^Page not found/, p);
      assert.equal(valid, false, p);
    }
  }
});

// ---- C2: a single newest-first comparator drives every ordered surface -----

test("feed.json and rss.xml share one newest-first order", async () => {
  const feed = JSON.parse((await request(base, "/feed.json")).body.toString("utf8"));
  const feedSlugs = feed.items.map((i) => i.url.split("/news/")[1]);

  const rss = (await request(base, "/rss.xml")).body.toString("utf8");
  const rssSlugs = [...rss.matchAll(/\/news\/([^<]+)<\/link>/g)].map((m) => m[1]);

  assert.deepEqual(feedSlugs, rssSlugs, "feed and rss order diverged");

  // And that order is exactly compareByDateDesc over the article dates.
  const dates = feed.items.map((i) => i.date_published);
  const sorted = [...dates].sort((a, b) => schema.compareByDateDesc({ date: a }, { date: b }));
  assert.deepEqual(dates, sorted, "feed order is not compareByDateDesc");
});

// ---- C4: site identity comes only from site.config.js ----------------------

test("index.html source hardcodes no site identity", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.ok(!html.includes(SITE.name), "index.html still hardcodes the site name");
});

test("served og:site_name / application-name come from SITE.name", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  assert.match(html, new RegExp(`<meta property="og:site_name" content="${SITE.name}"`));
  assert.match(html, new RegExp(`<meta name="application-name" content="${SITE.name}"`));
});

// ---- C5: preload target derived from the same image the Hero renders -------

test("home preload is the AVIF sibling of SITE.heroImage", async () => {
  const html = (await request(base, "/")).body.toString("utf8");
  const expected = SITE.heroImage.replace(/\.(jpe?g|png)$/i, ".avif");
  assert.match(html, new RegExp(`<link rel="preload"[^>]*href="${expected}"`));
  // And the Hero <img>/<source> chain is built from SITE.heroImage, not a
  // separately hardcoded path.
  assert.ok(fs.existsSync(path.join(ROOT, SITE.heroImage.replace(/^\//, ""))));
});

// ---- C6: copyright year is derived, not hardcoded --------------------------

test("Footer derives the year (no hardcoded © 20xx)", () => {
  const appjsx = fs.readFileSync(path.join(ROOT, "app.jsx"), "utf8");
  assert.ok(!/©\s*20\d\d/.test(appjsx), "app.jsx still hardcodes a copyright year");
  assert.ok(appjsx.includes("getFullYear()"), "Footer should derive the year");
});

// ---- C7: photo alignment is article data, not a filename check -------------

test("photo alignment lives in article data", () => {
  const newsjsx = fs.readFileSync(path.join(ROOT, "components/news.jsx"), "utf8");
  assert.ok(
    !newsjsx.includes("photo-01.jpg"),
    "news.jsx still hardcodes a content-specific filename"
  );
  const ieee = server.loadArticleMeta("ieee-pess-2025-best-paper-award");
  assert.equal(typeof ieee.photos[0], "object");
  assert.equal(ieee.photos[0].align, "top");
});

// ---- C8: the folder name is the single owner of an article's slug ----------

test("every discovered article's folder name equals its slug field", () => {
  for (const slug of server.discoverArticleSlugs()) {
    const a = server.loadArticleMeta(slug);
    assert.ok(a, `${slug} failed to load`);
    assert.equal(a.slug, slug, `folder "${slug}" diverges from slug field "${a.slug}"`);
  }
});

test("loadArticleMeta skips an article whose slug field diverges from its folder", () => {
  // Fixture in an OS temp dir, NOT the real news/ tree: node --test runs test
  // files in parallel, and a transient folder under news/ would leak into any
  // concurrently running article discovery (e.g. parity's static build).
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "consistency-"));
  const folder = "__consistency_divergent__";
  const dir = path.join(base, "news", folder);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "article.js"),
    // Valid in every respect EXCEPT that slug !== folder — which would make the
    // RSS/feed/canonical URL (/news/elsewhere) unroutable and break the browser
    // getArticle(folder) lookup while the server still returns 200.
    `defineArticle({ slug: "elsewhere", date: "2026-01-01", dateLabel: "x", title: "t", excerpt: "e", body: ["b"] });`
  );
  try {
    assert.equal(server.loadArticleMeta(folder, base), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// ---- C9: an article slug must be URL-safe (both worlds) --------------------

test("validateArticle rejects a slug with URL-unsafe characters", () => {
  const base = { date: "2026-01-01", dateLabel: "x", title: "t", excerpt: "e", body: ["b"] };
  for (const bad of ["a/b", "a b", "R&D", "a<b", "Upper"]) {
    assert.throws(() => schema.validateArticle({ ...base, slug: bad }), /invalid slug/, bad);
  }
  assert.doesNotThrow(() => schema.validateArticle({ ...base, slug: "7th-power-gas-forum-athens" }));
});

// ---- C10: contact links never diverge from site.config socialLinks ---------

// PublicationRow uses the title as its React key, and the /publications
// ScholarlyArticle ItemList treats each title as one work — both assume
// titles are unique, which nothing else enforces.
test("publication titles are unique", () => {
  const pubs = loadDataWindow().PROFILE.publications;
  const titles = pubs.map((p) => p.title);
  assert.equal(new Set(titles).size, titles.length, "duplicate publication title");
});

test("PROFILE.contact hrefs (minus email) are exactly site.config.socialLinks", () => {
  const social = loadDataWindow().PROFILE.contact
    .filter((c) => c.id !== "email")
    .map((c) => c.href);
  // Same set, same order: the contact row and JSON-LD sameAs share one list.
  assert.deepEqual(social, SITE.socialLinks, "contact links drifted from socialLinks");
});

// ---- C3: server and browser validate articles identically ------------------

test("validateArticle rejects the same invalid article in both worlds", () => {
  const bad = { slug: "x", date: "bad", dateLabel: "d", title: "t", excerpt: "e", body: ["b"] };
  assert.throws(() => schema.validateArticle(bad), /invalid date/);
});

test("validateArticle rejects calendar-impossible dates (feed builders would throw)", () => {
  const base = { slug: "x", dateLabel: "d", title: "t", excerpt: "e", body: ["b"] };
  // Each matches the YYYY-MM-DD regex but is not a real day; unchecked, these
  // reach buildFeed's .toISOString() and 500 /feed.json (and fail the build).
  for (const bad of ["2025-13-01", "2025-02-30", "2025-00-10", "2026-04-31"]) {
    assert.throws(() => schema.validateArticle({ ...base, date: bad }), /impossible date/, bad);
  }
  assert.doesNotThrow(() => schema.validateArticle({ ...base, date: "2024-02-29" })); // real leap day
});

test("validateArticle rejects a non-string cover (path.join would kill the boot)", () => {
  const base = { slug: "x", date: "2026-01-01", dateLabel: "d", title: "t", excerpt: "e", body: ["b"] };
  assert.throws(() => schema.validateArticle({ ...base, cover: 123 }), /non-string cover/);
  assert.doesNotThrow(() => schema.validateArticle({ ...base, cover: "news/x/cover.jpg" }));
});

test("validateArticle enforces the documented rules the corpus previously missed", () => {
  const base = { slug: "x", date: "2026-01-01", dateLabel: "d", title: "t", excerpt: "e", body: ["b"] };
  // Asset paths must stay inside the article's own folder, lowercase charset.
  assert.throws(() => schema.validateArticle({ ...base, cover: "news/other/cover.jpg" }), /invalid cover path/);
  assert.throws(() => schema.validateArticle({ ...base, cover: "news/x/../../etc/passwd" }), /invalid cover path/);
  assert.throws(() => schema.validateArticle({ ...base, cover: "news/x/IMG_1234.JPG" }), /invalid cover path/);
  // sources shape + scheme.
  assert.throws(() => schema.validateArticle({ ...base, sources: [{ href: "javascript:alert(1)", label: "x" }] }), /not http/);
  assert.throws(() => schema.validateArticle({ ...base, sources: ["https://a.example"] }), /invalid sources entry/);
  // Control characters — now including body paragraphs and keywords (they
  // reach the feeds and the article:* meta).
  assert.throws(() => schema.validateArticle({ ...base, title: "a\x0Bb" }), /control character/);
  assert.throws(() => schema.validateArticle({ ...base, body: ["ok", "bad\x01"] }), /control character in body\[1\]/);
  assert.throws(() => schema.validateArticle({ ...base, keywords: ["ok", "bad\x02"] }), /control character in a keyword/);
  // videoWidth/videoHeight and coverWidth/coverHeight: positive, set together.
  assert.throws(() => schema.validateArticle({ ...base, videoWidth: 1280 }), /together/);
  assert.throws(() => schema.validateArticle({ ...base, coverWidth: 100 }), /together/);
  assert.throws(() => schema.validateArticle({ ...base, coverWidth: -5, coverHeight: 10 }), /invalid coverWidth/);
  assert.doesNotThrow(() => schema.validateArticle({ ...base, coverWidth: 2048, coverHeight: 1536 }));
  // Placement indices must land on a real paragraph.
  assert.throws(() => schema.validateArticle({ ...base, videoAfter: 1, video: "news/x/video.mp4" }), /videoAfter/);
  assert.throws(
    () => schema.validateArticle({ ...base, photos: [{ src: "news/x/p.jpg", after: 7 }] }),
    /after/
  );
});

// ---- C14: publications obey the rules PUBLICATIONS.md promises --------------
// The doc long claimed links/year/award-vs-type rules that nothing enforced;
// validatePublications now throws at boot/build, and this corpus locks it.

test("validatePublications enforces the PUBLICATIONS.md rules", () => {
  const { validatePublications } = server;
  const good = {
    kind: "journal", venue: "V", year: "2026", title: "T", authors: "A, B.",
    citation: "c", links: [{ label: "DOI", href: "https://doi.org/10.1/x" }],
  };
  assert.doesNotThrow(() => validatePublications([good]));
  assert.throws(() => validatePublications([{ ...good, links: [] }]), /non-empty array/);
  assert.throws(() => validatePublications([{ ...good, links: [{ label: "x", href: "http://a" }] }]), /https/);
  assert.throws(() => validatePublications([{ ...good, year: 2026 }]), /STRING/);
  assert.throws(() => validatePublications([{ ...good, award: "Best", type: "Thesis" }]), /mutually exclusive/);
  assert.throws(() => validatePublications([{ ...good, title: "" }]), /title/);
  // And the REAL data passes (it already loaded at require time — this makes
  // the guarantee explicit).
  assert.doesNotThrow(() => validatePublications(loadDataWindow().PROFILE.publications));
});

test("loadArticleMeta skips an invalid article (returns null, fails loudly)", () => {
  // Same temp-dir isolation as the divergent-slug case above.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "consistency-"));
  const slug = "__consistency_invalid__";
  const dir = path.join(base, "news", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "article.js"),
    // Missing required `excerpt` — defineArticle would throw in the browser.
    `defineArticle({ slug: "${slug}", date: "2026-01-01", dateLabel: "x", title: "t", body: ["b"] });`
  );
  try {
    assert.equal(server.loadArticleMeta(slug, base), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// ---- C11: the SSR premise — one React version in both worlds ----------------
// Hydration only attaches cleanly when the browser bundle (vendored UMD) and
// the server renderer (npm react-dom/server) are the SAME React: a version
// bump on either side alone risks markup drift and a hooks-dispatcher
// mismatch that no other test would attribute to the real cause.

test("vendored React UMD builds match the npm react/react-dom versions", () => {
  const reactVersion = require("react/package.json").version;
  const domVersion = require("react-dom/package.json").version;
  assert.equal(reactVersion, domVersion, "react and react-dom must be pinned to one version");
  const umd = fs.readFileSync(path.join(ROOT, "vendor/react.production.min.js"), "utf8");
  assert.ok(
    umd.includes(`version="${reactVersion}"`),
    `vendor/react.production.min.js is not version ${reactVersion} — update the vendored UMD ` +
      "and the npm pin together"
  );
  const domUmd = fs.readFileSync(path.join(ROOT, "vendor/react-dom.production.min.js"), "utf8");
  assert.ok(
    domUmd.includes(`"${domVersion}"`),
    `vendor/react-dom.production.min.js is not version ${domVersion} — update the vendored UMD ` +
      "and the npm pin together"
  );
});

// ---- C12: IndexNow key — file name, content, allowlist, workflow ------------
// The protocol's ownership proof is `GET /<key>.txt` returning the key. Four
// copies of the fact exist (file name, file content, ROOT_PLAIN_FILES entry,
// workflow constant); any one drifting silently breaks the ping.

test("IndexNow key file, content, allowlist and workflow agree", async () => {
  const { ROOT_PLAIN_FILES } = require("../public-files.js");
  const keyFiles = ROOT_PLAIN_FILES.filter((f) => /^[0-9a-f]{32}\.txt$/.test(f));
  assert.equal(keyFiles.length, 1, "exactly one IndexNow key file must be allowlisted");
  const key = keyFiles[0].replace(/\.txt$/, "");
  assert.equal(
    fs.readFileSync(path.join(ROOT, keyFiles[0]), "utf8").trim(),
    key,
    "the key file's content must be the key itself (its own basename)"
  );
  const wf = fs.readFileSync(path.join(ROOT, ".github", "workflows", "indexnow.yml"), "utf8");
  assert.ok(wf.includes(`KEY = "${key}"`), "indexnow.yml KEY drifted from the key file");
  // The workflow's HOST is the fifth hardcoded copy of a fact site.config.js
  // owns — a domain move that misses it would poll the OLD domain's sitemap
  // forever and ping IndexNow for the wrong site.
  assert.ok(
    wf.includes(`HOST = "${new URL(SITE.url).host}"`),
    "indexnow.yml HOST drifted from site.config.js url"
  );
  // And the wiring end-to-end: the live server serves the proof.
  const res = await request(base, `/${keyFiles[0]}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.toString("utf8").trim(), key);
});

// ---- C13: script loading order — ssr.js mirrors index.html ------------------
// The SSR sandbox executes the same scripts in the same order the browser
// does; a script added to index.html but not ssr.js (or re-ordered) renders
// an SSR page from DIFFERENT code than the client hydrates.

test("ssr.js GLOBAL_SCRIPTS + BUNDLE_ORDER mirror index.html and ENTRY_POINTS", () => {
  const { GLOBAL_SCRIPTS, BUNDLE_ORDER } = require("../ssr.js");
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(
    srcs,
    [
      "/vendor/react.production.min.js",
      "/vendor/react-dom.production.min.js",
      ...GLOBAL_SCRIPTS.map((s) => `/${s}`),
      ...BUNDLE_ORDER.map((b) => `/dist/${b}.js`),
    ],
    "index.html script tags diverged from ssr.js's execution order"
  );
  // Every SSR bundle is a real esbuild entry point and vice versa (order
  // differs by design: esbuild builds app first, the page loads it last).
  const { ENTRY_POINTS } = require("../build.config.js");
  assert.deepEqual(
    [...BUNDLE_ORDER].sort(),
    ENTRY_POINTS.map((e) => e.replace(/\.jsx$/, "")).sort(),
    "ssr.js BUNDLE_ORDER and build.config.js ENTRY_POINTS cover different bundles"
  );
});
