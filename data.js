/* ============================================================
   PROFILE DATA  —  single source of truth
   ------------------------------------------------------------
   Add new entries to `publications` and they will automatically
   appear on the homepage preview and on the /publications list
   page, sorted newest-first.

   Publications fields (full guide: PUBLICATIONS.md):
     - venue, year, title, authors, links       (required)
     - location, description, award, type,
       citation (IEEE reference for the Cite
       button; auto-assembled when omitted)      (optional)

   News articles live in their own folders under news/<slug>/ as
   self-contained article.js files — see news/README.md.
   ============================================================ */

const PROFILE = {
  name: window.SITE.name,
  role: window.SITE.jobTitle,
  hero: {
    headlinePre: "Electrical & Computer Engineer focusing on",
    // Each phrase is emphasized (accent color + highlight underline) on its
    // own; the joining commas / "and" / final period stay plain ink.
    headlineHighlights: ["renewable energy", "grid flexibility", "battery storage"],
    sub: "Applied energy system modelling, techno-economic assessment, and industry-driven research for PV, wind, storage, and flexible electricity systems.",
  },
  about: [
    "Electrical & Computer Engineer working at the intersection of renewable energy, grid flexibility, battery storage, and energy markets. The work centres on techno-economic assessment, feasibility studies, and investment-oriented analysis for PV, wind, BESS, and flexible electricity systems.",
    "Currently working as a Renewable Energy Consultant, supporting technical due diligence and feasibility work for energy projects across public- and private-sector contexts. Research experience includes real-time Hardware-in-the-Loop grid simulation at **TUM**, BiGRU-based EV charging modelling at **Fraunhofer ISE**, and peer-reviewed work on EV charging behaviour and Vehicle-to-Grid integration, including a **3rd Best Paper Award at IEEE PESS 2025**.",
  ],
  publications: [
    {
      venue: "IEEE PESS",
      location: "Munich, Germany",
      year: "2025",
      title: "Integration of PV and V2G Technology in an Island Grid: A Real-Time Simulation Study of Kastellorizo",
      authors: "**Konstantellos, L.**, Mohapatra, A., Kavvathas, T., Konstantopoulos, G., & Hamacher, T. (2025)",
      award: "3rd Best Paper Award",
      citation: 'L. Konstantellos, A. Mohapatra, T. Kavvathas, G. Konstantopoulos and T. Hamacher, "Integration of PV and V2G Technology in an Island Grid: A Real-Time Simulation Study of Kastellorizo," PESS 2025; IEEE Power and Energy Student Summit, Munich, Germany, 2025, pp. 31-36, doi: 10.30420/566656006.',
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
      authors: "**Konstantellos, L.**, Kamacı, Z., Pekmezci, D., & Köpfer, B. (2025)",
      citation: 'L. Konstantellos, Z. Kamacı, D. Pekmezci and B. Köpfer, "Financial Impact Analysis of Electric Vehicle Charging Behavior with RNN Model and Validation Against Real-World Data", presented at the 38th International Electric Vehicle Symposium and Exhibition (EVS38), Zenodo, Jun. 2025. doi: 10.5281/zenodo.15882802.',
      links: [
        { label: "Proceedings", href: "https://evs38-program.org/images/Proceedings/D%20Charging%20Infrastructure%20and%20grid%20integration/448_Financial_Impact_Analysis_of_Electric_Vehicle_Charging_Behavior_with_RNN_Model_and_Validation_Against_Real_World_Data.pdf" },
        { label: "Zenodo",      href: "https://zenodo.org/records/15882802" },
      ],
    },
    {
      // `type` marks non-peer-reviewed work (thesis / report) so the card shows
      // a distinguishing tag and it reads apart from the conference papers.
      type: "Master's Thesis",
      venue: "University of Patras",
      location: "Patras, Greece",
      year: "2025",
      title: "Integration of Photovoltaic Power and Vehicle-to-Grid Technology in Electric Power Systems of Non-Interconnected Islands: A Case Study of Kastellorizo",
      authors: "**Konstantellos, L.** (2025)",
      citation: 'L. Konstantellos, G. Konstantopoulos and T. Hamacher, "Integration of Photovoltaic Power and Vehicle-to-Grid Technology in Electric Power Systems of Non-Interconnected Islands: A Case Study of Kastellorizo", Feb. 12, 2025, Zenodo. doi: 10.5281/zenodo.14871102.',
      links: [
        { label: "Nemertes", href: "https://hdl.handle.net/10889/28931" },
        { label: "Zenodo",   href: "https://zenodo.org/records/14871102" },
      ],
    },
    {
      type: "Internship Report",
      venue: "Technical University of Munich",
      location: "Munich, Germany",
      year: "2023",
      title: "Novel Optimization Model Applied for Decarbonization Scenarios of Non-Interconnected Mediterranean Islands – A Kastellorizo Case Study",
      authors: "**Konstantellos, L.** (2023)",
      citation: 'L. Konstantellos, "Novel Optimization Model Applied for Decarbonization Scenarios of Non-Interconnected Mediterranean Islands – A Kastellorizo Case Study", Technical University of Munich, Munich, Germany, 2023. doi: 10.5281/zenodo.13936256.',
      links: [
        { label: "Zenodo", href: "https://zenodo.org/records/13936256" },
      ],
    },
  ],
  contact: [
    { id: "linkedin",     label: "LinkedIn",       href: "https://www.linkedin.com/in/lampros-konstantellos/" },
    { id: "scholar",      label: "Google Scholar", href: "https://scholar.google.com/citations?user=In1MHMwAAAAJ&hl=en" },
    { id: "ieee",         label: "IEEE Xplore",    href: "https://ieeexplore.ieee.org/author/975219948451552" },
    { id: "orcid",        label: "ORCID",          href: "https://orcid.org/0009-0006-9424-2087" },
    { id: "zenodo",       label: "Zenodo",         href: "https://zenodo.org/search?page=1&size=20&q=Lampros+Konstantellos" },
    { id: "researchgate", label: "ResearchGate",   href: "https://www.researchgate.net/profile/Lampros-Konstantellos" },
    { id: "github",       label: "GitHub",         href: "https://github.com/lamproskonstantellos" },
    { id: "email",        label: "Email",          href: `mailto:${window.SITE.email}` },
  ],
};

/* ---- Display caps for homepage previews ---- */
const LIMITS = {
  newsPreview: 3,
  publicationsPreview: 3,
};

/* ---- Selectors (auto-sorted, newest first) ---- */
function sortedNews() {
  const items = window.NEWS_ARTICLES || [];
  return [...items].sort(window.compareByDateDesc);
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
  // Validation rules live in article-schema.js (loaded before this file) so
  // the browser and the server enforce exactly the same schema.
  window.validateArticle(article);
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
