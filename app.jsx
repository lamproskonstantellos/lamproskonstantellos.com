/* global React, ReactDOM, PROFILE, Icon, SectionHeader,
   About, PublicationsPreview, PublicationsListPage,
   NewsPreview, NewsListPage, Article */

const { useState, useEffect, useCallback } = React;

/* ============================================================
   ROUTING — URL-based
   /                     home
   /news                 news list page
   /news/<slug>          single article
   /publications         publications list page
   ============================================================ */

function parseRoute(pathname) {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/" || p === "") return { page: "home", section: null };
  if (p === "/news") return { page: "news-list" };
  if (p === "/publications") return { page: "publications-list" };
  const m = p.match(/^\/news\/([^/]+)$/);
  if (m) return { page: "article", slug: m[1] };
  return { page: "home", section: null };
}

function routeToPath(route) {
  if (route.page === "news-list") return "/news";
  if (route.page === "publications-list") return "/publications";
  if (route.page === "article") return `/news/${route.slug}`;
  return "/";
}

/* ============================================================
   HEADER
   ============================================================ */

function Header({ route, navigate }) {
  const items = [
    { id: "about",        label: "About" },
    { id: "publications", label: "Publications" },
    { id: "news",         label: "News" },
    { id: "contact",      label: "Contact" },
  ];

  const isActive = (it) =>
    (route.page === "home" && route.section === it.id) ||
    (route.page === "publications-list" && it.id === "publications") ||
    (route.page === "news-list" && it.id === "news") ||
    (route.page === "article" && it.id === "news");

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand" onClick={() => navigate({ page: "home" })}>
          <span className="brand-name">{PROFILE.name}</span>
          <span className="brand-role">{PROFILE.role}</span>
        </div>
        <nav className="nav">
          {items.map((it) => (
            <button
              key={it.id}
              className={isActive(it) ? "active" : ""}
              onClick={() => navigate({ page: "home", section: it.id })}
            >
              {it.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

/* ============================================================
   HERO
   ============================================================ */

function Hero({ navigate }) {
  return (
    <section className="hero">
      <div className="hero-text">
        <h1>
          {PROFILE.hero.headlinePre}{" "}
          <em>{PROFILE.hero.headlineEm}</em>
        </h1>
        <p>{PROFILE.hero.sub}</p>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => navigate({ page: "home", section: "publications" })}>
            View publications <Icon.arrowUR className="arrow" style={{ width: 14, height: 14 }} />
          </button>
          <button className="btn btn-ghost" onClick={() => navigate({ page: "home", section: "news" })}>
            Read news
          </button>
          <button className="btn btn-ghost" onClick={() => navigate({ page: "home", section: "contact" })}>
            Contact
          </button>
        </div>
      </div>
      <div className="hero-photo">
        <img src="/lampros-konstantellos-picture.jpg" alt={PROFILE.name} />
      </div>
    </section>
  );
}

/* ============================================================
   CONTACT
   ============================================================ */

function Contact() {
  const map = {
    linkedin: { I: Icon.brandLinkedin, tint: "rgba(10,102,194,0.10)" },
    scholar:  { I: Icon.brandScholar,  tint: "rgba(66,133,244,0.10)" },
    ieee:     { I: Icon.brandIeee,     tint: "rgba(0,98,155,0.10)"   },
    orcid:    { I: Icon.brandOrcid,    tint: "rgba(166,206,57,0.15)" },
    zenodo:   { I: Icon.brandZenodo,   tint: "rgba(31,71,152,0.10)"  },
    email:    { I: Icon.brandEmail,    tint: "rgba(10,31,68,0.08)"   },
  };
  return (
    <section className="block" id="contact">
      <SectionHeader title="Contact" />
      <div className="contact-grid">
        {PROFILE.contact.map((c) => {
          const { I, tint } = map[c.id];
          return (
            <a
              className="contact-card"
              key={c.id}
              href={c.href}
              target={c.href.startsWith("mailto") ? undefined : "_blank"}
              rel="noopener noreferrer"
            >
              <span className="ico-badge" style={{ background: tint }}>
                <I style={{ width: 22, height: 22 }} />
              </span>
              <span className="label">{c.label}</span>
              <Icon.external className="ext" style={{ width: 13, height: 13 }} />
            </a>
          );
        })}
      </div>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */

function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="copy">© 2026 {PROFILE.name}</div>
      </div>
    </footer>
  );
}

/* ============================================================
   HOME PAGE
   ============================================================ */

function HomePage({ navigate }) {
  return (
    <div className="page">
      <Hero navigate={navigate} />
      <About />
      <PublicationsPreview navigate={navigate} />
      <NewsPreview navigate={navigate} />
      <Contact />
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((next, opts = {}) => {
    const targetPath = routeToPath(next);
    const stateData = opts.from !== undefined ? { from: opts.from } : {};
    if (window.location.pathname !== targetPath) {
      window.history.pushState(stateData, "", targetPath);
    } else if (opts.from !== undefined) {
      window.history.replaceState(stateData, "", targetPath);
    }
    setRoute(next);

    if (next.page === "home" && next.section) {
      requestAnimationFrame(() => {
        const el = document.getElementById(next.section);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 70;
          window.scrollTo({ top: y, behavior: "smooth" });
        }
      });
    } else if (next.page === "home" && !next.section) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return (
    <>
      <Header route={route} navigate={navigate} />
      <main>
        {route.page === "home" && <HomePage navigate={navigate} />}
        {route.page === "news-list" && <NewsListPage navigate={navigate} />}
        {route.page === "publications-list" && <PublicationsListPage navigate={navigate} />}
        {route.page === "article" && <Article slug={route.slug} navigate={navigate} />}
      </main>
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
