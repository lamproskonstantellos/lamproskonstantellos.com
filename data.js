/* ============================================================
   PROFILE DATA  —  single source of truth
   ------------------------------------------------------------
   Add new entries to `publications` or `news` and they will
   automatically appear on the homepage previews and on the
   /publications and /news list pages, sorted newest-first.

   Publications fields:
     - venue, year, title, authors, links   (required)
     - location, description, award         (optional)

   News fields:
     - slug, date (YYYY-MM-DD), dateLabel,
       title, excerpt, body                 (required)
     - location, cover, photos, sources     (optional)
   ============================================================ */

const PROFILE = {
  name: "Lampros Konstantellos",
  role: "Electrical & Computer Engineer",
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
  news: [
    {
      slug: "7th-power-gas-forum-athens",
      date: "2026-04-07",
      dateLabel: "April 7, 2026",
      location: "Athens",
      title: "Insights from the 7th Power & Gas Forum in Athens",
      excerpt: "Reflections on grid constraints, flexibility, storage, data infrastructure, and the increasingly operational nature of the Greek energy transition.",
      cover: "news/7th-power-gas-forum-athens/cover.jpg",
      photos: [],
      body: [
        "On 6–7 April 2026, I attended the **7th Power & Gas Forum** in Athens, organised by **energypress**. The forum focused on the changing structure of the Greek electricity and gas markets, including grid development, system adequacy, flexibility, storage, gas infrastructure, retail market evolution, and the growing impact of large electricity consumers such as data centers.",
        "What stood out to me most is that the Greek energy transition is moving from a capacity-growth discussion to an implementation-quality discussion. The key question is no longer only how much renewable capacity can be added, but whether the system can absorb, dispatch, balance, and value this capacity efficiently.",
        "**Key points I took from the forum:**",
        "• **Grid capacity is becoming the central constraint.** Renewable deployment, electrification, storage, and new demand from data centers all depend on how quickly transmission and distribution infrastructure can be reinforced, digitalised, and operated with greater visibility.",
        "• **Curtailment is becoming structural.** As RES penetration increases, curtailment can no longer be treated as an occasional operational issue. It is becoming a signal that flexibility, storage, forecasting, and market design need to evolve together.",
        "• **Battery storage is shifting from policy topic to operational asset class.** The value of BESS will depend not only on installed capacity, but on dispatch strategy, multi-market participation, forecasting quality, and the ability to manage revenue uncertainty.",
        "• **Data and metering infrastructure are becoming market enablers.** Smart meters, real-time data, and advanced energy management tools are essential for unlocking demand response, dynamic retail products, and more efficient system operation.",
        "• **Gas remains part of the transition discussion.** Even as renewables and storage expand, gas infrastructure continues to play a role in security of supply, adequacy, and system flexibility during the transition period.",
        "My main takeaway is that Greece is entering a more mature and technically demanding phase of the energy transition. The challenge is no longer only project development, but the coordinated operation of networks, markets, storage assets, flexible demand, and real-time data systems.",
      ],
      sources: [
        { label: "Power & Gas Supply Forum", href: "https://powergassupplyforum.gr/" },
      ],
    },
    {
      slug: "ieee-pess-2025-best-paper-award",
      date: "2025-10-10",
      dateLabel: "October 10, 2025",
      location: "Munich, Germany",
      title: "Third Best Paper Award at IEEE PESS 2025",
      excerpt: "Our work on PV and Vehicle-to-Grid integration in the isolated island grid of Kastellorizo received the 3rd Best Paper Award at IEEE PESS 2025 in Munich.",
      cover: "news/ieee-pess-2025-best-paper-award/cover.jpg",
      photos: [
        "news/ieee-pess-2025-best-paper-award/photo-01.jpg",
      ],
      body: [
        "From 8–10 October 2025, I attended the **IEEE Power and Energy Student Summit (PESS) 2025** in Munich, hosted at the **Chair of Electric Power Transmission and Distribution** of the **Technical University of Munich**. The summit brought together students, researchers, and engineers working on smart grids, renewable energy systems, storage, and the practical challenges of the energy transition.",
        "I was honoured that our paper, **\"Integration of PV and V2G Technology in an Island Grid: A Real-Time Simulation Study of Kastellorizo\"**, received the **3rd Best Paper Award**. The work originated from my thesis at the **Department of Electrical and Computer Engineering** of the **University of Patras**, supervised by Prof. **George Konstantopoulos**, and was carried out in co-supervision with Prof. **Thomas Hamacher** at the Chair of Renewable and Sustainable Energy Systems of the **Technical University of Munich**.",
        "The paper examines how **photovoltaic generation** and **Vehicle-to-Grid (V2G)** technology can support the operation of a small non-interconnected island grid. The case study focused on **Kastellorizo**, using actual grid data from **HEDNO**, and the island's medium-voltage network was modelled on the **Typhoon HIL** real-time simulation platform.",
        "The results showed that V2G can improve the grid's frequency response during disturbances, while also reducing diesel generator output and CO₂ emissions in the simulated scenarios. More broadly, the study points to the potential of combining renewables and electric mobility in small, vulnerable power systems.",
        "Many thanks to my co-authors **Theodoros Kavvathas**, Prof. **George Konstantopoulos**, Dr. **Anurag Mohapatra**, and Prof. **Thomas Hamacher** for the guidance and collaboration throughout this work.",
        "Beyond the award itself, PESS 2025 was a valuable opportunity to discuss energy system research with people working on similar challenges from different perspectives. It strengthened my interest in island grids, storage, electric mobility, and real-time simulation as part of the future power system.",
      ],
      sources: [
        { label: "IEEE Xplore, Paper",     href: "https://ieeexplore.ieee.org/document/11443073" },
        { label: "VDE Verlag, Proceedings", href: "https://www.vde-verlag.de/proceedings-de/566656006.html" },
      ],
    },
    {
      slug: "ai-hub-mayor-western-achaia",
      date: "2024-07-25",
      dateLabel: "July 25, 2024",
      location: "Western Achaia, Greece",
      title: "AI-Hub Meeting with the Mayor of Western Achaia",
      excerpt: "A meeting between the University of Patras AI-Hub team and the Municipality of Western Achaia on practical AI applications for municipal services, including water-quality monitoring.",
      cover: "news/ai-hub-mayor-western-achaia/cover.jpg",
      photos: [
        "news/ai-hub-mayor-western-achaia/photo-01.jpg",
        "news/ai-hub-mayor-western-achaia/photo-02.jpg",
        "news/ai-hub-mayor-western-achaia/photo-03.jpg",
      ],
      body: [
        "On 25 July 2024, the **Artificial Intelligence Hub (AI-Hub)** of the **Department of Electrical and Computer Engineering** at the **University of Patras** met with the Mayor of Western Achaia, **Grigoris Alexopoulos**, to discuss how artificial intelligence and data-driven tools could support municipal services.",
        "AI-Hub is an academic initiative focused on education, research, and the development of applications, services, and products in the field of **Artificial Intelligence**. Based at the Department of Electrical and Computer Engineering of the University of Patras, it operates as an outward-looking hub connecting academics, researchers, students, and professionals working on AI-related topics.",
        "At the time, **Georgios Sotiropoulos** and I were involved in AI-Hub as **collaborating undergraduate students**. The meeting was a chance to present applied work developed within the university and discuss how it could connect with real operational needs at municipal level.",
        "**Application presented:**",
        "• The AI-Hub team presented a working prototype of **Nireas**, an intelligent system for the automatic monitoring of water quality in the municipality's water distribution network.",
        "• The prototype focused on monitoring **pH, temperature, and chlorine levels**, turning operational measurements into clearer indicators and early warnings for the people responsible for maintaining the network.",
        "• The broader goal was to show how AI, sensing, and analytics workflows can support preventive maintenance, infrastructure monitoring, and more responsive municipal services.",
        "**Context:**",
        "• The meeting included Associate Professors **Kyriakos Sgarbas** and **Epaminondas Mitronikas**, **Fotis Sotiropoulos** from the AI-Hub administrative committee, and collaborating undergraduate students **Georgios Sotiropoulos** and myself.",
        "• The discussion was part of a broader effort to connect university-based AI work with practical local-government use cases, from water quality and infrastructure monitoring to citizen-facing services.",
        "For me, this meeting was valuable because it showed how engineering and AI tools can move beyond academic prototypes and become useful in local public-sector environments. The most meaningful part was seeing how a technical demo could connect directly to the needs of a municipality and the daily life of its residents.",
      ],
      sources: [
        { label: "Municipality of Western Achaia article (Greek)", href: "https://ddachaias.gr/grigoris-alexopoulos-agkaliazoume-tin-kainotomia-pros-ofelos-ton-syboliton-mas-synantisi-tou-dimarchou-dytikis-achaias-me-to-kentro-technitis-noimosynis-tou-panepistimiou-patron/" },
        { label: "AI-Hub homepage (Greek)",                        href: "https://sites.google.com/g.upatras.gr/ai-hub/%CE%B1%CF%81%CF%87%CE%B9%CE%BA%CE%AE-%CF%83%CE%B5%CE%BB%CE%AF%CE%B4%CE%B1" },
      ],
    },
    {
      slug: "7th-renewable-storage-forum",
      date: "2025-10-23",
      dateLabel: "October 23, 2025",
      location: "Athens, Greece",
      title: "Reflections from the 7th Renewable & Storage Forum",
      excerpt: "Notes on renewable deployment, storage, curtailment, grid access, and the regulatory conditions shaping the next phase of the Greek electricity market.",
      cover: "news/7th-renewable-storage-forum/cover.jpg",
      body: [
        "On 22–23 October 2025, I attended the **7th Renewable & Storage Forum** in Athens, organised by **energypress**. The forum focused on the next stage of the Greek energy transition, with particular emphasis on renewable energy development, storage deployment, grid constraints, curtailment, auctions, investment conditions, and the regulatory framework for new market participants.",
        "The discussion made clear that storage is no longer treated as a future add-on to the power system. It is becoming one of the key tools for managing high renewable penetration, reducing curtailment, supporting system flexibility, and improving the economic performance of renewable assets.",
        "**Key points I took from the forum:**",
        "• **Stand-alone BESS is becoming a central part of the Greek energy mix.** As projects move from auction results to implementation, the focus is shifting toward connection conditions, dispatch strategy, market access, and long-term revenue visibility.",
        "• **Behind-the-meter storage is becoming increasingly relevant for existing PV parks.** For assets facing curtailment, negative prices, or constrained export capacity, co-located BESS can improve operational flexibility and help recover otherwise lost value.",
        "• **Curtailment is changing the economics of renewable projects.** The value of a RES asset can no longer be assessed only through annual production. Timing, grid availability, market prices, and flexibility options are becoming equally important.",
        "• **Regulatory clarity is critical for investment.** Storage projects require stable rules around licensing, grid connection, market participation, charging behaviour, and revenue stacking in order to become bankable at scale.",
        "• **The market is becoming more optimisation-driven.** As storage, intraday trading, balancing markets, and hybrid project structures become more important, engineering analysis needs to be combined with market modelling and operational decision-making.",
        "My main takeaway is that the Greek renewable sector is entering a phase where flexibility will define value. The most interesting projects will not necessarily be those with the highest installed capacity, but those that can operate intelligently within a constrained and increasingly dynamic power system.",
      ],
      sources: [
        { label: "Renewable & Storage Forum", href: "https://renewablestorageforum.gr/" },
      ],
    },
  ],
  contact: [
    { id: "linkedin", label: "LinkedIn",       href: "https://www.linkedin.com/in/lampros-konstantellos/" },
    { id: "scholar",  label: "Google Scholar", href: "https://scholar.google.com/citations?user=In1MHMwAAAAJ&hl=en" },
    { id: "ieee",     label: "IEEE Xplore",    href: "https://ieeexplore.ieee.org/author/975219948451552" },
    { id: "orcid",    label: "ORCID",          href: "https://orcid.org/0009-0006-9424-2087" },
    { id: "zenodo",   label: "Zenodo",         href: "https://zenodo.org/search?page=1&size=20&q=Lampros+Konstantellos" },
    { id: "email",    label: "Email",          href: "mailto:lampros.konstantellos@gmail.com" },
  ],
};

/* ---- Display caps for homepage previews ---- */
const LIMITS = {
  newsPreview: 3,
  publicationsPreview: 5,
};

/* ---- Selectors (auto-sorted, newest first) ---- */
function sortedNews() {
  return [...PROFILE.news].sort((a, b) => (a.date < b.date ? 1 : -1));
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
  return PROFILE.news.find((n) => n.slug === slug);
}

Object.assign(window, {
  PROFILE,
  LIMITS,
  getRecentNews,
  getRecentPublications,
  getArticle,
});
