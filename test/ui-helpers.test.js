"use strict";

// Unit tests for ui-helpers.js — the pure logic behind the article share row
// (shareLinks), the homepage scroll-spy nav (pickActiveSection), the
// /publications filter pills + year grouping, and the hero headline joiners.
// The module follows the dual Node/browser pattern of routes.js, so it is
// exercised here directly via require, with no JSX compilation involved.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const {
  shareLinks,
  pickActiveSection,
  PUB_FILTERS,
  groupPublicationsByYear,
  headlineJoiner,
} = require("../ui-helpers.js");

// ---- shareLinks --------------------------------------------------------------

test("shareLinks builds the LinkedIn share-offsite URL with the target encoded", () => {
  const url = "https://lamproskonstantellos.com/news/some-slug";
  assert.deepEqual(shareLinks(url), {
    linkedin:
      "https://www.linkedin.com/sharing/share-offsite/?url=" +
      "https%3A%2F%2Flamproskonstantellos.com%2Fnews%2Fsome-slug",
  });
});

test("shareLinks percent-encodes every URL-significant character", () => {
  const { linkedin } = shareLinks("https://x.com/a?b=c&d=e#f");
  const encoded = linkedin.split("?url=")[1];
  assert.equal(encoded, "https%3A%2F%2Fx.com%2Fa%3Fb%3Dc%26d%3De%23f");
  // The encoded target must not leak raw separators into the share URL.
  assert.ok(!encoded.includes("&"));
  assert.ok(!encoded.includes("#"));
  assert.equal(decodeURIComponent(encoded), "https://x.com/a?b=c&d=e#f");
});

// ---- pickActiveSection -------------------------------------------------------

const IDS = ["about", "publications", "news", "contact"];

// Entry helper: above(px) = top edge still below the band by px.
const e = (id, ratio, top) => ({ id, ratio, top });

test("pickActiveSection: null above the first section (hero in view)", () => {
  const entries = [
    e("about", 0, 320),
    e("publications", 0, 900),
    e("news", 0, 1500),
    e("contact", 0, 2100),
  ];
  assert.equal(pickActiveSection(entries, IDS), null);
});

test("pickActiveSection: the single section crossing the band wins", () => {
  const entries = [
    e("about", 0, -700),
    e("publications", 0.04, -120),
    e("news", 0, 480),
    e("contact", 0, 1100),
  ];
  assert.equal(pickActiveSection(entries, IDS), "publications");
});

test("pickActiveSection: when two sections straddle the band, the later one wins", () => {
  // The about/publications boundary sits inside the thin band: about still
  // touches it from above, publications' top edge has just entered it.
  const entries = [
    e("about", 0.02, -800),
    e("publications", 0.01, 12),
    e("news", 0, 700),
  ];
  assert.equal(pickActiveSection(entries, IDS), "publications");
});

test("pickActiveSection: nothing crossing → last section whose top passed the band", () => {
  // Bottom of the page: the short contact section sits entirely above the
  // band, so no section intersects it — contact must stay highlighted.
  const entries = [
    e("about", 0, -2400),
    e("publications", 0, -1700),
    e("news", 0, -900),
    e("contact", 0, -300),
  ];
  assert.equal(pickActiveSection(entries, IDS), "contact");
});

test("pickActiveSection: entry order does not matter, ids order does", () => {
  const entries = [
    e("contact", 0, 1100),
    e("publications", 0.04, -10),
    e("about", 0, -600),
    e("news", 0, 480),
  ];
  assert.equal(pickActiveSection(entries, IDS), "publications");
});

test("pickActiveSection: tolerates missing entries and empty input", () => {
  assert.equal(pickActiveSection([], IDS), null);
  assert.equal(pickActiveSection([e("news", 0.5, -4)], IDS), "news");
  assert.equal(pickActiveSection(undefined, IDS), null);
});

// ---- browser wiring ----------------------------------------------------------

test("index.html loads ui-helpers.js after article-schema.js and before data.js", () => {
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  const schema = html.indexOf('<script src="/article-schema.js"></script>');
  const helpers = html.indexOf('<script src="/ui-helpers.js"></script>');
  const data = html.indexOf('<script src="/data.js"></script>');
  assert.ok(schema !== -1 && helpers !== -1 && data !== -1, "all three script tags present");
  assert.ok(schema < helpers && helpers < data, "ui-helpers.js must load between them");
});

test("ui-helpers.js assigns its API to window in the browser", () => {
  const src = fs.readFileSync(path.join(__dirname, "../ui-helpers.js"), "utf8");
  assert.match(src, /Object\.assign\(window,\s*api\)/);
});

// ---- PUB_FILTERS (publications filter pills) ----------------------------------

test("PUB_FILTERS splits real publications into peer-reviewed vs theses/reports", () => {
  // Reproduce the component's predicates against the real data via the data.js
  // shim (the same technique the news preview cap test uses in ux.test.js).
  const SITE = require("../site.config.js");
  const schema = require("../article-schema.js");
  const window = {
    SITE,
    validateArticle: schema.validateArticle,
    compareByDateDesc: schema.compareByDateDesc,
  };
  // eslint-disable-next-line no-new-func
  new Function("window", fs.readFileSync(path.join(__dirname, "../data.js"), "utf8"))(window);
  const pubs = window.getRecentPublications();

  const byId = Object.fromEntries(PUB_FILTERS.map((f) => [f.id, f]));
  assert.deepEqual(Object.keys(byId), ["all", "peer-reviewed", "reports"]);

  const all = pubs.filter(byId["all"].match);
  const papers = pubs.filter(byId["peer-reviewed"].match);
  const reports = pubs.filter(byId["reports"].match);
  assert.equal(all.length, pubs.length, "All must match every entry");
  // The two type filters partition the set: no overlap, nothing dropped.
  assert.equal(papers.length + reports.length, pubs.length);
  assert.ok(papers.every((p) => !p.type), "peer-reviewed must exclude typed entries");
  assert.ok(reports.every((p) => p.type), "reports must only include typed entries");
});

// ---- groupPublicationsByYear ---------------------------------------------------

test("groupPublicationsByYear groups consecutive years, newest-first order kept", () => {
  const items = [
    { year: "2025", title: "a" },
    { year: "2025", title: "b" },
    { year: "2023", title: "c" },
  ];
  assert.deepEqual(groupPublicationsByYear(items), [
    { year: "2025", items: [items[0], items[1]] },
    { year: "2023", items: [items[2]] },
  ]);
  assert.deepEqual(groupPublicationsByYear([]), []);
  assert.deepEqual(groupPublicationsByYear(undefined), []);
});

test("groupPublicationsByYear only merges CONSECUTIVE equal years", () => {
  // The input contract is a sorted list; an unsorted list must not be silently
  // re-merged across the gap (that would hide a broken sort upstream).
  const items = [{ year: "2025" }, { year: "2023" }, { year: "2025" }];
  const groups = groupPublicationsByYear(items);
  assert.deepEqual(groups.map((g) => g.year), ["2025", "2023", "2025"]);
});

// ---- headlineJoiner ------------------------------------------------------------

test("headlineJoiner renders an Oxford-comma list ending in a period", () => {
  const join = (phrases) =>
    phrases.map((p, i) => p + headlineJoiner(i, phrases.length)).join("");
  assert.equal(join(["a"]), "a.");
  assert.equal(join(["a", "b"]), "a, and b.");
  assert.equal(
    join(["renewable energy", "grid flexibility", "battery storage"]),
    "renewable energy, grid flexibility, and battery storage."
  );
});
