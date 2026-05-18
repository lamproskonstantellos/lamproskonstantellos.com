/* ============================================================
   PROFILE DATA  —  single source of truth
   ------------------------------------------------------------
   Add new entries to `publications` and they will automatically
   appear on the homepage preview and on the /publications list
   page, sorted newest-first.

   Publications fields:
     - venue, year, title, authors, links   (required)
     - location, description, award         (optional)

   News articles live in their own folders under news/<slug>/ as
   self-contained article.js files — see news/README.md.
   ============================================================ */

const PROFILE = {
  name: window.SITE.name,
  role: window.SITE.jobTitle,
  hero: {
    headlinePre: "Electrical & Computer Engineer focusing on",
    headlineEm: "renewable energy, grid flexibility, and battery storage.",
    sub: "Focused on applied energy system modelling, techno-economic assessment, and industry-driven research for PV, wind, storage, and flexible electricity systems.",
  },
  about: [
    "Electrical & Computer Engineer working at the intersection of renewable energy, grid flexibility, battery storage, and energy markets. Focused on techno-economic assessment, feasibility studies, and investment-oriented analysis for PV, wind, BESS, and flexible electricity systems.",
    "Currently working as a Renewable Energy Consultant, supporting technical due diligence and feasibility work for energy projects across public- and private-sector contexts. Research experience includes real-time Hardware-in-the-Loop grid simulation at TUM, BiGRU-based EV charging modelling at Fraunhofer ISE, and peer-reviewed work on EV charging behaviour and Vehicle-to-Grid integration, including a 3rd Best Paper Award at IEEE PESS 2025.",
  ],
  publications: [
    {
      venue: "IEEE PESS",
      location: "Munich, Germany",
      year: "2025",
      title: "Integration of PV and V2G Technology in an Island Grid: A Real-Time Simulation Study of Kastellorizo",
      authors: "Konstantellos, L., Mohapatra, A., Kavvathas, T., Konstantopoulos, G., & Hamacher, T. (2025)",
      award: "3rd Best Paper Award",
      links: [
        { label: "IEEE Xplore", href: "https://ieeexplore.ieee.org/document/11443073" },
        { label: "VDE Verlag",  href: "https://www.vde-verlag.de/proceedings-en/566656006.html" },
      ],
    },
    {
      venue: "EVS38",
      location: "Gothenburg, Sweden",
      year: "2025",
      title: "Financial Impact Analysis of Electric Vehicle Charging Behavior with RNN Model and Validation Against Real-World Data",
      authors: "Konstantellos, L., Kamacı, Z., Pekmezci, D., & Köpfer, B. (2025)",
      links: [
        { label: "Proceedings", href: "https://evs38-program.org/images/Proceedings/D%20Charging%20Infrastructure%20and%20grid%20integration/448_Financial_Impact_Analysis_of_Electric_Vehicle_Charging_Behavior_with_RNN_Model_and_Validation_Against_Real_World_Data.pdf" },
        { label: "Zenodo",      href: "https://zenodo.org/records/15882802" },
      ],
    },
  ],
  contact: [
    { id: "linkedin", label: "LinkedIn",       href: "https://www.linkedin.com/in/lampros-konstantellos/" },
    { id: "scholar",  label: "Google Scholar", href: "https://scholar.google.com/citations?user=In1MHMwAAAAJ&hl=en" },
    { id: "ieee",     label: "IEEE Xplore",    href: "https://ieeexplore.ieee.org/author/975219948451552" },
    { id: "orcid",    label: "ORCID",          href: "https://orcid.org/0009-0006-9424-2087" },
    { id: "zenodo",   label: "Zenodo",         href: "https://zenodo.org/search?page=1&size=20&q=Lampros+Konstantellos" },
    { id: "email",    label: "Email",          href: `mailto:${window.SITE.email}` },
  ],
};

/* ---- Display caps for homepage previews ---- */
const LIMITS = {
  newsPreview: 3,
  publicationsPreview: 5,
};

/* ---- Selectors (auto-sorted, newest first) ---- */
function sortedNews() {
  const items = window.NEWS_ARTICLES || [];
  return [...items].sort((a, b) => (a.date < b.date ? 1 : -1));
}

function sortedPublications() {
  return [...PROFILE.publications].sort((a, b) => Number(b.year) - Number(a.year));
}

function getRecentNews(limit) {
  const items = sortedNews();
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function getRecentPublications(limit) {
  const items = sortedPublications();
  return typeof limit === "number" ? items.slice(0, limit) : items;
}

function getArticle(slug) {
  const items = window.NEWS_ARTICLES || [];
  return items.find((n) => n.slug === slug);
}

function defineArticle(article) {
  const required = ["slug", "date", "dateLabel", "title", "excerpt", "body"];
  for (const field of required) {
    if (article[field] === undefined || article[field] === null || article[field] === "") {
      throw new Error(
        `[defineArticle] Article "${article.slug || "(no slug)"}" is missing required field: ${field}`
      );
    }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(article.date)) {
    throw new Error(
      `[defineArticle] Article "${article.slug}" has invalid date "${article.date}" — expected YYYY-MM-DD`
    );
  }
  if (!Array.isArray(article.body) || article.body.length === 0) {
    throw new Error(
      `[defineArticle] Article "${article.slug}" has empty or non-array body`
    );
  }
  if (article.photos && !Array.isArray(article.photos)) {
    throw new Error(`[defineArticle] Article "${article.slug}" has non-array photos`);
  }
  if (article.sources && !Array.isArray(article.sources)) {
    throw new Error(`[defineArticle] Article "${article.slug}" has non-array sources`);
  }
  // Optional SEO fields validated for type only
  if (article.keywords && !Array.isArray(article.keywords)) {
    throw new Error(`[defineArticle] Article "${article.slug}" has non-array keywords`);
  }
  if (article.topics && !Array.isArray(article.topics)) {
    throw new Error(`[defineArticle] Article "${article.slug}" has non-array topics`);
  }
  (window.NEWS_ARTICLES = window.NEWS_ARTICLES || []).push(article);
}

window.defineArticle = defineArticle;

Object.assign(window, {
  PROFILE,
  LIMITS,
  getRecentNews,
  getRecentPublications,
  getArticle,
  defineArticle,
});
