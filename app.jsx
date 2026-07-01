/* global React, ReactDOM, SITE, PROFILE, Icon, SectionHeader, Picture,
   parseRoute, routeToPath, pageTitle, getArticle, handleAnchorClick,
   pickActiveSection,
   About, PublicationsPreview, PublicationsListPage,
   NewsPreview, NewsListPage, Article */

const { useState, useEffect, useCallback, useRef } = React;

// An explicit behavior:"smooth" in scrollTo() bypasses the CSS
// `scroll-behavior:auto` reduced-motion override, so gate it in JS too: users
// who asked for reduced motion get an instant jump instead of an animated one.
function scrollBehavior() {
  return typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/* ============================================================
   ROUTING — URL-based (parseRoute lives in routes.js, shared
   with server.js so the route table can never diverge)
   /                     home
   /news                 news list page
   /news/<slug>          single article
   /publications         publications list page
   ============================================================ */

/* ============================================================
   HEADER
   ============================================================ */

function Header({ route, navigate, activeSection }) {
  const items = [
    { id: "about",        label: "About" },
    { id: "publications", label: "Publications" },
    { id: "news",         label: "News" },
    { id: "contact",      label: "Contact" },
  ];

  // On the homepage the highlight follows the scroll-spy (activeSection,
  // null while the hero is in view); list and article pages keep their
  // route-derived highlight. The two states carry different aria-current
  // tokens: "location" for a scroll position within the homepage, "page" for
  // the actual list/article route you are on.
  const currentToken = (it) => {
    if (route.page === "home" && activeSection === it.id) return "location";
    if (
      (route.page === "publications-list" && it.id === "publications") ||
      (route.page === "news-list" && it.id === "news") ||
      (route.page === "article" && it.id === "news")
    ) {
      return "page";
    }
    return undefined;
  };
  const isActive = (it) => Boolean(currentToken(it));

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a
          className="brand"
          href="/"
          aria-label={`${PROFILE.name} — home`}
          onClick={(e) => handleAnchorClick(e, navigate, { page: "home" })}
        >
          {/* Raster logo (not the SVG): the icon art uses Space Grotesk, which
              the page doesn't load, so an <img> of the SVG would fall back to a
              different font. The PNG bakes the type in and stays on-brand. */}
          <img className="brand-logo" src="/icon-192.png" alt="" width="36" height="36" />
          <span className="brand-text">
            <span className="brand-name">{PROFILE.name}</span>
            <span className="brand-role">{PROFILE.role}</span>
          </span>
        </a>
        <nav className="nav">
          {items.map((it) => {
            const target = { page: "home", section: it.id };
            return (
              <a
                key={it.id}
                className={isActive(it) ? "active" : ""}
                aria-current={currentToken(it)}
                href={routeToPath(target)}
                onClick={(e) => handleAnchorClick(e, navigate, target)}
              >
                {it.label}
              </a>
            );
          })}
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
          <a
            className="btn btn-primary"
            href="/#publications"
            onClick={(e) => handleAnchorClick(e, navigate, { page: "home", section: "publications" })}
          >
            View publications <Icon.arrowUR className="arrow" style={{ width: 14, height: 14 }} />
          </a>
          <a
            className="btn btn-ghost"
            href="/#news"
            onClick={(e) => handleAnchorClick(e, navigate, { page: "home", section: "news" })}
          >
            Read news
          </a>
          <a
            className="btn btn-ghost"
            href="/#contact"
            onClick={(e) => handleAnchorClick(e, navigate, { page: "home", section: "contact" })}
          >
            Contact
          </a>
        </div>
      </div>
      <div className="hero-photo">
        <Picture
          src={SITE.heroImage}
          alt={PROFILE.name}
          width="720"
          height="900"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    </section>
  );
}

/* ============================================================
   CONTACT
   ============================================================ */

function Contact() {
  const map = {
    linkedin:     { I: Icon.brandLinkedin,     tint: "rgba(10,102,194,0.10)" },
    scholar:      { I: Icon.brandScholar,      tint: "rgba(66,133,244,0.10)" },
    ieee:         { I: Icon.brandIeee,         tint: "rgba(0,98,155,0.10)"   },
    orcid:        { I: Icon.brandOrcid,        tint: "rgba(166,206,57,0.15)" },
    zenodo:       { I: Icon.brandZenodo,       tint: "rgba(31,71,152,0.10)"  },
    researchgate: { I: Icon.brandResearchgate, tint: "rgba(0,204,187,0.12)"  },
    github:       { I: Icon.brandGithub,       tint: "rgba(23,23,23,0.08)"   },
    email:        { I: Icon.brandEmail,        tint: "rgba(10,31,68,0.08)"   },
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

function Footer({ navigate }) {
  const year = new Date().getFullYear();
  const since = 2023;
  const years = year > since ? `${since}-${year}` : `${year}`;

  // Sitemap: the two standalone pages plus the two home-only sections.
  const explore = [
    { label: "About",        route: { page: "home", section: "about" } },
    { label: "Publications", route: { page: "publications-list" } },
    { label: "News",         route: { page: "news-list" } },
    { label: "Contact",      route: { page: "home", section: "contact" } },
  ];
  // A short set only — the full list lives in the Contact section just above,
  // so the footer keeps the essentials and doesn't repeat it.
  const connect = ["linkedin", "github", "email"]
    .map((id) => PROFILE.contact.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <a
              className="footer-brand-link"
              href="/"
              aria-label={`${PROFILE.name} — home`}
              onClick={(e) => handleAnchorClick(e, navigate, { page: "home" })}
            >
              <img className="footer-logo" src="/icon-192.png" alt="" width="40" height="40" />
              <span className="footer-brand-text">
                <span className="footer-name">{PROFILE.name}</span>
                <span className="footer-role">{PROFILE.role}</span>
              </span>
            </a>
            <p className="footer-tagline">{SITE.defaultDescription}</p>
          </div>

          <nav className="footer-col" aria-label="Site map">
            <h2 className="footer-col-title">Explore</h2>
            {explore.map((it) => (
              <a
                key={it.label}
                href={routeToPath(it.route)}
                onClick={(e) => handleAnchorClick(e, navigate, it.route)}
              >
                {it.label}
              </a>
            ))}
          </nav>

          <nav className="footer-col" aria-label="Connect">
            <h2 className="footer-col-title">Connect</h2>
            {connect.map((c) => (
              <a
                key={c.id}
                href={c.href}
                target={c.href.startsWith("mailto") ? undefined : "_blank"}
                rel="noopener noreferrer"
              >
                {c.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="footer-bottom">
          <span className="copy">© {years} {PROFILE.name}</span>
          <button
            type="button"
            className="footer-top-link"
            onClick={() => window.scrollTo({ top: 0, behavior: scrollBehavior() })}
          >
            Back to top ↑
          </button>
        </div>
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
   NOT FOUND
   ============================================================ */

function NotFound({ navigate }) {
  // Deliberately no search box: the site has no search index (yet) — routes
  // onward beat a dead end.
  return (
    <div className="page notfound">
      <div className="notfound-code" aria-hidden="true">404</div>
      <h1>Page not found</h1>
      <p className="notfound-sub">This page may have moved, or never existed.</p>
      <div className="notfound-actions">
        <a
          className="btn btn-primary"
          href="/"
          onClick={(e) => handleAnchorClick(e, navigate, { page: "home" })}
        >
          Back to home
        </a>
        <a
          className="btn btn-ghost"
          href="/news"
          onClick={(e) => handleAnchorClick(e, navigate, { page: "news-list" })}
        >
          News
        </a>
        <a
          className="btn btn-ghost"
          href="/publications"
          onClick={(e) => handleAnchorClick(e, navigate, { page: "publications-list" })}
        >
          Publications
        </a>
        <a
          className="btn btn-ghost"
          href="/#contact"
          onClick={(e) => handleAnchorClick(e, navigate, { page: "home", section: "contact" })}
        >
          Contact
        </a>
      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

const HOME_SECTION_IDS = ["about", "publications", "news", "contact"];

function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [activeSection, setActiveSection] = useState(null);
  const mainRef = useRef(null);
  const firstRender = useRef(true);

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Keep the tab title correct after client-side navigation (and back/forward).
  // Derived from the SAME pageTitle the server injects, so they cannot diverge.
  useEffect(() => {
    const articleTitle =
      route.page === "article" ? (getArticle(route.slug) || {}).title : undefined;
    document.title = pageTitle(route, {
      siteName: SITE.name,
      jobTitle: SITE.jobTitle,
      articleTitle,
    });
  }, [route]);

  // Move focus to the main region on a full page change so keyboard and
  // screen-reader users land in the new content. Skipped on first render and
  // during in-page section scrolls (which manage their own scroll position).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (route.page === "home" && route.section) return;
    // preventScroll: the page components manage their own scroll-to-top.
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [route]);

  // Scroll-spy (homepage only): observe the four sections against a thin band
  // just below the sticky header (15%–20% of the viewport height, via
  // rootMargin) and highlight the one crossing it. The band sits near the TOP
  // on purpose: nav clicks scroll a section's top to ~70px (the -70 offset
  // below), so the "active" line has to be up there too — a mid-viewport band
  // would land in the NEXT section right after a click and highlight it instead
  // (off-by-one). The observer reports only entries that CHANGED, so `latest`
  // keeps the most recent observation per section and pickActiveSection
  // (ui-helpers.js) resolves the winner — null while the hero is in view.
  // Disconnected when leaving home.
  useEffect(() => {
    if (route.page !== "home") {
      setActiveSection(null);
      return;
    }
    const sections = HOME_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!sections.length) return;
    const latest = new Map();
    const io = new IntersectionObserver(
      (entries) => {
        const bandTop = window.innerHeight * 0.15;
        for (const e of entries) {
          latest.set(e.target.id, {
            id: e.target.id,
            // isIntersecting is the authoritative "crosses the band" signal: a
            // tall section barely overlapping the thin band can round its
            // ratio down to 0, so clamp crossing entries to a positive value.
            ratio: e.isIntersecting ? Math.max(e.intersectionRatio, 1e-6) : 0,
            top: e.boundingClientRect.top - bandTop,
          });
        }
        setActiveSection(pickActiveSection([...latest.values()], HOME_SECTION_IDS));
      },
      { rootMargin: "-15% 0px -80% 0px" }
    );
    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [route.page]);

  // On first load, honor a #section hash (e.g. /#publications shared as a link).
  // parseRoute ignores the hash, so this is the only place it gets handled.
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 70;
        window.scrollTo({ top: y, behavior: scrollBehavior() });
      }
    });
  }, []);

  const navigate = useCallback((next, opts = {}) => {
    const targetPath = routeToPath(next).split("#")[0] || "/";
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
          window.scrollTo({ top: y, behavior: scrollBehavior() });
        }
      });
    } else if (next.page === "home" && !next.section) {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    }
  }, []);

  return (
    <>
      <Header route={route} navigate={navigate} activeSection={activeSection} />
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {route.page === "home" && <HomePage navigate={navigate} />}
        {route.page === "news-list" && <NewsListPage navigate={navigate} />}
        {route.page === "publications-list" && <PublicationsListPage navigate={navigate} />}
        {route.page === "article" && <Article slug={route.slug} navigate={navigate} />}
        {route.page === "not-found" && <NotFound navigate={navigate} />}
      </main>
      <Footer navigate={navigate} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
