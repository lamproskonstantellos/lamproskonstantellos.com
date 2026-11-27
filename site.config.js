/* ============================================================
   site.config.js — single source of truth
   ------------------------------------------------------------
   Values that appear in multiple places (JSON-LD, OG tags,
   canonical URL, sitemap, contact section). Change them here.

   Loads in both the browser (window.SITE) and Node (require).
   ============================================================ */

// Both TUM affiliation chains below end at the same university node.
const TUM_ORG = {
  type: "CollegeOrUniversity",
  name: "Technical University of Munich",
  url: "https://www.tum.de",
};

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
  heroImageWidth: 1254,
  heroImageHeight: 1254,
  // The CV PDF the header's "CV" chip opens; the static build copies the
  // file because it is listed in public-files.js ROOT_PLAIN_FILES.
  cvPath: "/lampros-konstantellos-cv.pdf",
  defaultDescription:
    "Exploring renewable energy, battery storage, grid flexibility, and electricity markets through engineering, modelling, and applied research.",
  // The name in Greek, for searches typed in Greek script. It goes into the
  // home meta description and the JSON-LD alternateName; it is not shown on
  // the page.
  alternateName: "Λάμπρος Κωνσταντέλλος",
  // Home page meta description (the snippet under the link when someone
  // searches the name): who, role, affiliation, topics. Keep within ~160
  // characters. Update it together with worksFor when the role changes.
  homeDescription:
    "Lampros Konstantellos (Λάμπρος Κωνσταντέλλος), Research Associate and doctoral candidate at TUM. Research on energy management, renewables, and storage.",
  // Home-page Person JSON-LD: a one-sentence description and the topics the
  // person works on (schema.org knowsAbout).
  personDescription:
    "Research Associate and doctoral candidate at the Technical University of Munich (TUM), working on home energy management systems, renewable energy, grid flexibility, and battery storage.",
  knowsAbout: [
    "Renewable energy",
    "Battery storage",
    "Grid flexibility",
    "Home energy management systems",
    "Energy markets",
    "Techno-economic assessment",
    "Vehicle-to-grid",
  ],
  // Home-page Person JSON-LD affiliations, mirroring the CV. Each unit
  // climbs to its institution through `parent` (JSON-LD
  // parentOrganization); `type` defaults to Organization. Update them when
  // the role changes.
  // Research Associate — the employment:
  worksFor: {
    name: "Center for Combined Smart Energy Systems (CoSES)",
    parent: {
      name: "Munich Institute of Integrated Materials, Energy and Process Engineering (MEP)",
      parent: TUM_ORG,
    },
  },
  // Doctoral Candidate (Dr.-Ing.) — the doctorate:
  affiliation: {
    name: "Chair of Renewable and Sustainable Energy Systems",
    parent: {
      name: "Department of Energy & Process Engineering",
      parent: { name: "TUM School of Engineering and Design", parent: TUM_ORG },
    },
  },
  // The degree-granting university:
  alumniOf: [
    { type: "CollegeOrUniversity", name: "University of Patras", url: "https://www.upatras.gr" },
  ],
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
