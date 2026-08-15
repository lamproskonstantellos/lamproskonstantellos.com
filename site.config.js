/* ============================================================
   site.config.js — single source of truth
   ------------------------------------------------------------
   Values that appear in multiple places (JSON-LD, OG tags,
   canonical URL, sitemap, contact section). Change them here.

   Loads in both the browser (window.SITE) and Node (require).
   ============================================================ */

const SITE = {
  url: "https://lamproskonstantellos.com",
  name: "Lampros Konstantellos",
  jobTitle: "Electrical & Computer Engineer",
  email: "info@lamproskonstantellos.com",
  // JPEG, not PNG: the social card is photographic, and scrapers (WhatsApp
  // especially) skip oversized preview images — the JPEG is ~35 KB vs 733 KB.
  defaultImage: "/og-image.jpg",
  heroImage: "/lampros-konstantellos-picture.jpg",
  // Natural dimensions of heroImage (px), shared by the browser <Picture>
  // and the server preload so both advertise the full variant's REAL width
  // (a 1023px square capped at "2200w" over-claimed by ~2x — ui-helpers).
  heroImageWidth: 1023,
  heroImageHeight: 1023,
  // The CV PDF the header's "CV" chip opens; the static build copies the
  // file because it is listed in public-files.js ROOT_PLAIN_FILES.
  cvPath: "/lampros-konstantellos-cv.pdf",
  defaultDescription:
    "Exploring renewable energy, battery storage, grid flexibility, and electricity markets through engineering, modelling, and applied research.",
  socialLinks: [
    "https://www.linkedin.com/in/lampros-konstantellos/",
    "https://scholar.google.com/citations?user=In1MHMwAAAAJ&hl=en",
    "https://ieeexplore.ieee.org/author/975219948451552",
    "https://orcid.org/0009-0006-9424-2087",
    "https://zenodo.org/search?page=1&size=20&q=Lampros+Konstantellos",
    "https://www.researchgate.net/profile/Lampros-Konstantellos",
    "https://www.scopus.com/authid/detail.uri?authorId=60778137200",
    "https://github.com/lamproskonstantellos",
  ],
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SITE;
} else if (typeof window !== "undefined") {
  window.SITE = SITE;
}
