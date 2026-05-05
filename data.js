/* ============================================================
   PROFILE DATA
   ============================================================ */

const PROFILE = {
  name: "Lampros Konstantellos",
  role: "Electrical & Computer Engineer",
  hero: {
    headlinePre: "Electrical & Computer Engineer working on",
    headlineEm: "renewable energy, grid flexibility, and storage.",
    sub: "Applied energy systems modelling, techno-economic evaluation, and industry-driven research for PV, wind, battery storage, and flexible electricity systems.",
  },
  about: [
    "I am an Electrical & Computer Engineer focused on renewable energy systems, grid integration, and techno-economic evaluation of PV, wind, and battery energy storage projects.",
    "I currently work as a Renewable Energy Consultant, supporting technical due diligence, feasibility studies, and financial assessments for energy investments across public and private-sector contexts.",
    "My research experience includes real-time Hardware-in-the-Loop grid simulation at TUM, AI-based electric vehicle charging modelling at Fraunhofer ISE, and an award-winning IEEE publication on Vehicle-to-Grid integration in autonomous island systems.",
    "I am particularly interested in applied energy system modelling, grid flexibility, storage integration, and industry-driven research at the intersection of engineering, energy markets, and finance.",
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
      date: "2026-04-08",
      dateLabel: "April 8, 2026",
      location: "Athens",
      title: "Insights from the 7th Power & Gas Forum in Athens",
      excerpt: "Reflections from two days of discussions on the Greek energy transition, grid bottlenecks, flexibility, and the rise of battery storage.",
      cover: null,
      photos: [],
      body: [
        "On 6–7 April 2026, I attended the **7th Power & Gas Forum** in Athens, organised by **energypress** at **Zeus Wyndham Grand Athens**. The forum brought together representatives from the political leadership, regulators, system operators, market participants, utilities, investors, technology providers and the academic community to discuss the new realities shaping the Greek electricity and gas markets.",
        "As an Electrical Engineer, what stood out to me was that the energy transition discussion has clearly moved beyond the simple question of how much new renewable capacity can be added. Greece has already entered a phase where the main challenge is not only capacity growth, but the ability of the system to manage constraints, integrate flexibility, modernise infrastructure and operate efficiently under increasingly complex market conditions.",
        "A central theme of the forum was that grid development remains one of the most critical bottlenecks for the next phase of renewable energy growth and electrification. From an engineering perspective, adding more RES projects is not sufficient if the network cannot absorb, dispatch and balance this production in a reliable and economically efficient way.",
        "Another important takeaway was that curtailment is becoming a structural issue rather than a temporary inconvenience. This makes storage, demand response, forecasting and grid reinforcement essential parts of the transition.",
        "Battery energy storage was therefore one of the most relevant topics of the forum. Storage is no longer a theoretical future solution: it is becoming a central asset class for the Greek electricity market. Its full value comes from multi-market participation, optimisation quality and operational discipline.",
        "The forum also highlighted the growing importance of energy management, risk management and advanced market tools, as well as the strategic role of smart meters and real-time data for enabling flexibility and modern retail market design.",
        "The discussion around data centers was also highly relevant, with direct implications for grid capacity allocation, connection queues, system adequacy and planning priorities. At the same time, gas infrastructure remains important for security of supply during the transition.",
        "Overall, my main reflection from the 7th Power & Gas Forum is that the Greek energy transition is entering a more mature and demanding phase. The conversation is increasingly about implementation quality: network planning, flexibility integration, data use, market design and real-time operation.",
      ],
      sources: [
        { label: "Power & Gas Supply Forum", href: "https://powergassupplyforum.gr/" },
        { label: "Forum Program",            href: "https://powergassupplyforum.gr/forum-program/" },
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
  footer: {
    links: [
      { label: "LinkedIn",       href: "https://www.linkedin.com/in/lampros-konstantellos/" },
      { label: "Google Scholar", href: "https://scholar.google.com/citations?user=In1MHMwAAAAJ&hl=en" },
      { label: "Email",          href: "mailto:lampros.konstantellos@gmail.com" },
    ],
  },
};

Object.assign(window, { PROFILE });
