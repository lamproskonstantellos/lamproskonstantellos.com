/* ============================================================
   ui-helpers.js — shared UI logic (share links, scroll-spy)
   ------------------------------------------------------------
   Pure functions behind the article share row and the homepage
   scroll-spy nav. No React, no DOM, no Node APIs — so the logic
   loads identically in the browser (window globals) and in Node
   (require) and is unit-testable without compiling JSX, exactly
   like routes.js / site.config.js.
   ============================================================ */

(function () {
  // Social share targets for a canonical article URL.
  function shareLinks(url) {
    return {
      linkedin:
        "https://www.linkedin.com/sharing/share-offsite/?url=" +
        encodeURIComponent(url),
    };
  }

  // Scroll-spy: which section should the nav highlight?
  //
  // `entries` — the latest observation per section, in any order, each
  // { id, ratio, top }:
  //   - ratio: intersection ratio with the thin band near the viewport
  //            top (> 0 means the section currently crosses the band)
  //   - top:   the section's top edge relative to the band top, in px
  //            (negative = its top edge has scrolled above the band)
  // `ids` — the section ids in document order.
  //
  // Returns the id of the section crossing the band; when two sections
  // straddle the band boundary, the later one (whose top edge has
  // entered the band) wins. When nothing crosses — e.g. a short last
  // section fully above the band at the bottom of the page — returns
  // the last section whose top edge has passed above the band. Returns
  // null while the viewport is still above the first section.
  function pickActiveSection(entries, ids) {
    const byId = {};
    for (const e of entries || []) {
      if (e && e.id) byId[e.id] = e;
    }
    let crossing = null;
    let passed = null;
    for (const id of ids || []) {
      const e = byId[id];
      if (!e) continue;
      if (e.ratio > 0) crossing = id;
      else if (e.top < 0) passed = id;
    }
    return crossing || passed;
  }

  const api = { shareLinks, pickActiveSection };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    Object.assign(window, api);
  }
})();
