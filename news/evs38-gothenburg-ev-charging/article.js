/* ============================================================
   EV Charging Research at EVS38 in Gothenburg
   ============================================================ */

defineArticle({
  slug: "evs38-gothenburg-ev-charging",
  date: "2025-06-18",
  dateLabel: "June 18, 2025",
  location: "Gothenburg, Sweden",
  title: "EV Charging Research at EVS38 in Gothenburg",
  excerpt: "Our EVS38 paper used BiGRU neural networks to predict long-term EV charger behaviour from short-term test data, with a prediction error as low as 4.9% for chargers with consistent control logic.",
  keywords: [
    "EVS38",
    "EV charging",
    "BiGRU",
    "RNN",
    "Fraunhofer ISE",
    "smart charging",
    "machine learning",
  ],
  articleSection: "Research",
  cover: "news/evs38-gothenburg-ev-charging/cover.jpg",
  body: [
    "From **15–18 June 2025**, the **38th International Electric Vehicle Symposium & Exhibition (EVS38)** took place in **Gothenburg, Sweden**. Our paper, **\"Financial Impact Analysis of Electric Vehicle Charging Behavior with RNN Model and Validation Against Real-World Data\"**, was presented there by my co-author **Deniz Pekmezci**. As **first author**, I developed this work during my internship at the **Fraunhofer Institute for Solar Energy Systems ISE**.",
    "The study addresses a practical question for the EV charging industry: can the long-term behaviour of a charger be predicted from only short-term test data? The answer matters, because it determines how much testing a charger needs before it can be trusted in the field, and how well it can be matched to solar-optimised, smart-charging operation.",
    "To answer it, we used **BiGRU-based recurrent neural networks**, trained on short-term measurements and validated against real-world data. The models predicted long-term charging behaviour with a prediction error as low as **4.9%** for high-performing chargers. Accuracy was strongest for chargers with consistent control logic and weaker for those with more irregular behaviour, pointing to a clear conclusion: a charger's own control design shapes how predictable it is.",
    "**What the approach enables:**",
    "• Predicting long-term charger behaviour from short-term test data",
    "• Optimising solar-based smart charging systems",
    "• Reducing testing costs and accelerating product validation",
    "• Improving energy efficiency and environmental impact",
    "Many thanks to my co-authors **Zeliha Kamacı**, **Deniz Pekmezci**, and Dr. **Benedikt Köpfer** for the collaboration. The work was carried out at Fraunhofer ISE and is openly available in the EVS38 proceedings and on Zenodo.",
    "More broadly, the study reflects a direction I find compelling: using data-driven methods to make EV charging both cheaper to validate and better integrated with renewable generation, so that the more consistent a charger's control logic is, the more reliably short-term data can stand in for the long term.",
  ],
  sources: [
    { label: "EVS38 Proceedings", href: "https://evs38-program.org/images/Proceedings/D%20Charging%20Infrastructure%20and%20grid%20integration/448_Financial_Impact_Analysis_of_Electric_Vehicle_Charging_Behavior_with_RNN_Model_and_Validation_Against_Real_World_Data.pdf" },
    { label: "Zenodo",            href: "https://zenodo.org/records/15882802" },
  ],
});
