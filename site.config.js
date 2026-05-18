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
  defaultImage: "/og-image.png",
  defaultDescription:
    "Exploring renewable energy, battery storage, grid flexibility, and electricity markets through engineering, modelling, and applied research.",
  socialLinks: [
    "https://www.linkedin.com/in/lampros-konstantellos/",
    "https://scholar.google.com/citations?user=In1MHMwAAAAJ&hl=en",
    "https://ieeexplore.ieee.org/author/975219948451552",
    "https://orcid.org/0009-0006-9424-2087",
    "https://zenodo.org/search?page=1&size=20&q=Lampros+Konstantellos",
  ],
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = SITE;
} else if (typeof window !== "undefined") {
  window.SITE = SITE;
}
