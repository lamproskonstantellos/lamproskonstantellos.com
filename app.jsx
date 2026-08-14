/* global React, ReactDOM, SITE, PROFILE, Icon, SectionHeader, Picture,
   parseRoute, routeToPath, pageTitle, getArticle, handleAnchorClick,
   pickActiveSection, headlineJoiner, copyTextToClipboard, HERO_IMG_SIZES,
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

// The live height of the sticky header, used as the scroll offset so an
// anchored section's heading lands just below the header (not tucked under it).
// Measured from the DOM rather than hardcoded because the header height changes
// with viewport (padding/type shrink on small screens). Falls back to 70 before
// the header exists or in a non-DOM context.
function headerOffset() {
  if (typeof document === "undefined") return 70;
  const header = document.querySelector(".site-header");
  return header ? Math.round(header.getBoundingClientRect().height) : 70;
}

// Restore a saved scroll position after a Back/Forward navigation. The
// destination's images load asynchronously, so the document may still be too
// short to hold `y` on the first frame; re-apply across a few frames until the
// target is reached (or the page settles shorter), instead of clamping to a
// premature max and snapping to the top. `control` ({ raf, gen }) lets a later
// navigation cancel an in-flight restore so the two never fight over the scroll.
function restoreScroll(y, control) {
  const gen = (control.gen += 1);
  cancelAnimationFrame(control.raf);
  if (!y || y <= 0) { window.scrollTo(0, 0); return; }
  let tries = 0;
  const attempt = () => {
    if (control.gen !== gen) return; // superseded by a newer navigation
    window.scrollTo(0, y);
    tries += 1;
    if (Math.abs(window.scrollY - y) > 2 && tries < 30) {
      control.raf = requestAnimationFrame(attempt);
    }
  };
  control.raf = requestAnimationFrame(attempt);
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
  // tokens: "location" for a scroll position within the homepage, "true"
  // (current item of the set) on list/article pages. NOT "page": these links
  // point at the home sections (/#news, /#publications), and aria-current=
  // "page" asserts the link's TARGET is the page you are on — announcing
  // "current page" on a link that navigates away misleads screen-reader
  // users.
  const currentToken = (it) => {
    if (route.page === "home" && activeSection === it.id) return "location";
    if (
      (route.page === "publications-list" && it.id === "publications") ||
      (route.page === "news-list" && it.id === "news") ||
      (route.page === "article" && it.id === "news")
    ) {
      return "true";
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
          {/* The CV chip: the one filled action among the text links. Plain
              browser navigation — the PDF opens like any document link. */}
          <a
            className="nav-cv"
            href={SITE.cvPath}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download CV (PDF)"
          >
            CV
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ============================================================
   HERO
   ============================================================ */

function Hero({ navigate }) {
  const phrases = PROFILE.hero.headlineHighlights;
  return (
    <section className="hero">
      <div className="hero-text">
        {/* Small profile card (photo + name + role), shown ONLY on small
            screens where the large portrait on the right is hidden — the
            single mobile carrier of the photo. aria-hidden: assistive tech
            already gets the name/role from the header brand link's
            aria-label, so this visual duplicate would be read twice. */}
        <div className="hero-intro" aria-hidden="true">
          <div className="hero-intro-photo">
            {/* Same (preloaded) asset as the big portrait, so this costs no
                extra download; eager because it is the mobile LCP image. */}
            <Picture src={SITE.heroImage} alt="" width="220" height="220" sizes={HERO_IMG_SIZES} loading="eager" fetchPriority="high" />
          </div>
          <div className="hero-intro-text">
            <span className="hero-intro-name">{PROFILE.name}</span>
            <span className="hero-intro-role">{PROFILE.role}</span>
          </div>
        </div>
        <h1>
          {PROFILE.hero.headlinePre}{" "}
          {phrases.map((phrase, i) => (
            <React.Fragment key={phrase}>
              <em>{phrase}</em>
              {/* Oxford-comma joiners (ui-helpers.js), kept OUTSIDE the <em>
                  so the commas, the "and", and the final period stay plain
                  ink. */}
              {headlineJoiner(i, phrases.length)}
            </React.Fragment>
          ))}
        </h1>
        <p>{PROFILE.hero.sub}</p>
        <div className="hero-actions">
          <a
            className="btn btn-primary"
            href="/#publications"
            onClick={(e) => handleAnchorClick(e, navigate, { page: "home", section: "publications" })}
          >
            View publications
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
        {/* sizes matches the server's preload imagesizes exactly (both come
            from ui-helpers.HERO_IMG_SIZES) so the preloaded candidate is the
            rendered one. */}
        <Picture
          src={SITE.heroImage}
          alt={PROFILE.name}
          width="720"
          height="900"
          sizes={HERO_IMG_SIZES}
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

// The email card carries a second action — copy the address — for the many
// visitors without a configured mailto handler. The button cannot nest inside
// the anchor (interactive-inside-interactive), so a wrapper positions it where
// the other cards show their external-link mark.
function EmailContactCard({ contact, BrandIcon, tint }) {
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef(null);
  // Guard against the clipboard promise resolving after unmount (see
  // ArticleShare) — it would otherwise arm a timer with no cleanup left.
  const mounted = React.useRef(true);
  React.useEffect(() => () => { mounted.current = false; clearTimeout(copyTimer.current); }, []);

  const copyEmail = () => {
    copyTextToClipboard(contact.href.replace(/^mailto:/, "")).then((ok) => {
      if (!ok || !mounted.current) return;
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div className="contact-card-wrap">
      <a className="contact-card" href={contact.href}>
        <span className="ico-badge" style={{ background: tint }}>
          <BrandIcon style={{ width: 22, height: 22 }} />
        </span>
        <span className="label">{contact.label}</span>
        {/* Same hover arrow as every other card — here it reads "opens your
            mail app". Positioned absolutely (styles.css) so the copy button
            outside the anchor can sit immediately to its left. */}
        <Icon.external className="ext" style={{ width: 13, height: 13 }} />
      </a>
      <button
        type="button"
        className={"contact-copy" + (copied ? " copied" : "")}
        aria-label="Copy email address"
        onClick={copyEmail}
      >
        {copied
          ? <Icon.check style={{ width: 15, height: 15 }} />
          : <Icon.copy style={{ width: 15, height: 15 }} />}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? "Email address copied to clipboard" : ""}
      </span>
    </div>
  );
}

function Contact() {
  const map = {
    linkedin:     { I: Icon.brandLinkedin,     tint: "rgba(10,102,194,0.10)" },
    scholar:      { I: Icon.brandScholar,      tint: "rgba(66,133,244,0.10)" },
    ieee:         { I: Icon.brandIeee,         tint: "rgba(0,98,155,0.10)"   },
    orcid:        { I: Icon.brandOrcid,        tint: "rgba(166,206,57,0.15)" },
    zenodo:       { I: Icon.brandZenodo,       tint: "rgba(31,71,152,0.10)"  },
    researchgate: { I: Icon.brandResearchgate, tint: "rgba(0,204,187,0.12)"  },
    scopus:       { I: Icon.brandScopus,       tint: "rgba(233,113,28,0.10)" },
    github:       { I: Icon.brandGithub,       tint: "rgba(23,23,23,0.08)"   },
    email:        { I: Icon.brandEmail,        tint: "rgba(10,31,68,0.08)"   },
  };
  return (
    <section className="block" id="contact">
      <SectionHeader title="Contact" />
      <div className="contact-grid">
        {PROFILE.contact.map((c) => {
          // A data.js contact id with no icon here must degrade to "not
          // shown", not crash the whole homepage render on a destructure.
          const entry = map[c.id];
          if (!entry) return null;
          const { I, tint } = entry;
          if (c.id === "email") {
            return <EmailContactCard key={c.id} contact={c} BrandIcon={I} tint={tint} />;
          }
          return (
            <a
              className="contact-card"
              key={c.id}
              href={c.href}
              target="_blank"
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
  // Current year only, derived — never hardcoded (locked by a test).
  const year = new Date().getFullYear();

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
            {/* The feeds exist since day one but were only discoverable via
                <link rel=alternate>; this makes them a visible destination. */}
            <a href="/rss.xml">RSS</a>
          </nav>
        </div>

        <div className="footer-bottom">
          <span className="copy">© {year} {PROFILE.name}</span>
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
          Back
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
  // route carries an optional `from` (which page linked here — drives the
  // article Back link) so components read it as a prop instead of pulling
  // window.history.state during render: a render-time read of mutable
  // external state is not tearing-safe under concurrent rendering and only
  // worked because navigate() happened to pushState before setRoute. The
  // initial value picks up history.state so a reload keeps its Back target.
  const [route, setRoute] = useState(() => ({
    ...parseRoute(window.location.pathname),
    from: (window.history.state || {}).from,
  }));
  const [activeSection, setActiveSection] = useState(null);
  const mainRef = useRef(null);
  const firstRender = useRef(true);
  // Manual scroll restoration. The browser's own restoration is unreliable in
  // this SPA: on popstate it restores synchronously, before React has re-rendered
  // the destination, so the page is too short to hold the old offset and the
  // scroll collapses to the top. Instead we tag every history entry with a `key`,
  // remember each entry's latest scroll position, and re-apply it after the new
  // view has rendered. Fresh (push) navigations still start at the top.
  // Bounded: every navigation mints a new entry, and entries for history
  // slots destroyed by pushState truncation are never revisited — without a
  // cap the map grew for the whole session.
  const SCROLL_POSITIONS_MAX = 50;
  const scrollPositions = useRef(new Map());
  const currentKey = useRef(0);
  const keyCounter = useRef(0);
  const restoreCtl = useRef({ raf: 0, gen: 0 });

  useEffect(() => {
    const supported = "scrollRestoration" in window.history;
    const prev = supported ? window.history.scrollRestoration : null;
    if (supported) window.history.scrollRestoration = "manual";
    // Seed the initial entry with a key so its scroll can be tracked/restored.
    const st = window.history.state || {};
    if (st.key === undefined) window.history.replaceState({ ...st, key: 0 }, "");
    currentKey.current = (window.history.state && window.history.state.key) || 0;
    // Seed the mint counter past the restored key: after a reload deep in a
    // session's history the entry might carry key 3 while the counter restarts
    // at 0, so the next pushState would mint key 1 — a key an EARLIER entry
    // still owns, cross-wiring the two entries' saved scroll positions.
    keyCounter.current = Math.max(keyCounter.current, currentKey.current);
    return () => { if (supported) window.history.scrollRestoration = prev; };
  }, []);

  // Continuously remember the current entry's scroll position (throttled to one
  // write per frame) so Back/Forward can restore it.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        scrollPositions.current.set(currentKey.current, window.scrollY);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    const onPop = () => {
      const state = window.history.state;
      // An UNKEYED entry is not one of ours: the user edited a #hash in the
      // address bar (same-document navigation fires popstate with fresh null
      // state). Give it its own key — aliasing it to key 0 both clobbered
      // entry 0's saved scroll and restored a stale position over the
      // browser's native scroll-to-anchor. With a hash, defer to the native
      // anchor scroll; without one, this is still a same-document jump the
      // browser positions itself, so no restore either way.
      if (!state || state.key === undefined) {
        const key = ++keyCounter.current;
        window.history.replaceState({ ...(state || {}), key }, "");
        currentKey.current = key;
        setRoute({ ...parseRoute(window.location.pathname), from: state && state.from });
        return;
      }
      currentKey.current = state.key;
      setRoute({ ...parseRoute(window.location.pathname), from: state.from });
      restoreScroll(scrollPositions.current.get(state.key) || 0, restoreCtl.current);
    };
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
  // "In-page" means the page itself did not change: a section target alone is
  // not enough — every nav/back link targets { page: "home", section }, so a
  // cross-page navigation (say /publications → /#publications) unmounts the
  // focused element and must still move focus to the new main region.
  const prevFocusPage = useRef(route.page);
  useEffect(() => {
    const pageChanged = route.page !== prevFocusPage.current;
    prevFocusPage.current = route.page;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!pageChanged && route.page === "home" && route.section) return;
    // preventScroll: the page components manage their own scroll-to-top.
    if (mainRef.current) mainRef.current.focus({ preventScroll: true });
  }, [route]);

  // Scroll-spy (homepage only): observe the four sections against a thin band
  // just below the sticky header (15%–20% of the viewport height, via
  // rootMargin) and highlight the one crossing it. The band sits near the TOP
  // on purpose: nav clicks scroll a section's top to ~70px (the -70 offset
  // below), so the "active" line has to be up there too — a mid-viewport band
  // would land in the NEXT section right after a click and highlight it instead
  // (off-by-one). Every trigger recomputes ALL four sections' geometry fresh
  // (getBoundingClientRect) rather than caching observer entries: the observer
  // only reports sections whose intersection CHANGED, so cached entries went
  // stale after an INSTANT jump (reduced-motion back-to-top / brand click) and
  // left a section highlighted while the hero was in view. The passive scroll
  // listener covers jumps that flip no section's intersection state at all.
  // pickActiveSection (ui-helpers.js) resolves the winner — null while the
  // hero is in view. Disconnected when leaving home.
  useEffect(() => {
    if (route.page !== "home") {
      setActiveSection(null);
      return;
    }
    const sections = HOME_SECTION_IDS
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!sections.length) return;
    const recompute = () => {
      // The band the rootMargin below describes: 15%–20% of viewport height.
      const bandTop = window.innerHeight * 0.15;
      const bandBottom = window.innerHeight * 0.2;
      const observations = sections.map((el) => {
        const rect = el.getBoundingClientRect();
        const overlap = Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop);
        return {
          id: el.id,
          // A tall section barely overlapping the thin band can round its
          // ratio down to 0, so clamp crossing sections to a positive value.
          ratio: overlap > 0 ? Math.max(overlap / Math.max(rect.height, 1), 1e-6) : 0,
          top: rect.top - bandTop,
        };
      });
      setActiveSection(pickActiveSection(observations, HOME_SECTION_IDS));
    };
    // Feature-detected: a constructor throw inside an effect would unmount
    // the whole root (blank page) for a purely decorative highlight. The
    // passive scroll listener below drives recompute on its own regardless.
    const io = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(recompute, { rootMargin: "-15% 0px -80% 0px" })
      : null;
    if (io) sections.forEach((el) => io.observe(el));
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; recompute(); });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    recompute();
    return () => {
      if (io) io.disconnect();
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [route.page]);

  // On first load, honor a #section hash (e.g. /#publications shared as a link).
  // parseRoute ignores the hash, so this is the only place it gets handled.
  // The jump is INSTANT, not smooth: a smooth scroll here races the images
  // still loading above the target, which shift the layout mid-animation and
  // strand the heading under the sticky header. Like restoreScroll above, the
  // target offset is re-measured across a few frames so late image loads can't
  // leave the section misaligned.
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    let tries = 0;
    let raf = 0;
    // The re-assert loop must yield to the user: a wheel/touch/key scroll in
    // the first ~half second would otherwise be snapped back to the section
    // until the 30 frames run out. pointerdown covers a mouse CLICK inside
    // that window — navigate()'s own smooth scroll was yanked back to the
    // hash target every frame without it — and popstate covers an immediate
    // Back/Forward whose restoreScroll would fight the same loop.
    const stop = () => cancelAnimationFrame(raf);
    const cancelOpts = { passive: true, once: true };
    window.addEventListener("wheel", stop, cancelOpts);
    window.addEventListener("touchstart", stop, cancelOpts);
    window.addEventListener("keydown", stop, cancelOpts);
    window.addEventListener("pointerdown", stop, cancelOpts);
    window.addEventListener("popstate", stop, cancelOpts);
    const attempt = () => {
      const el = document.getElementById(id);
      if (!el) return;
      const y = Math.round(el.getBoundingClientRect().top + window.scrollY - headerOffset());
      if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
      tries += 1;
      if (tries < 30) raf = requestAnimationFrame(attempt);
    };
    raf = requestAnimationFrame(attempt);
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      window.removeEventListener("pointerdown", stop);
      window.removeEventListener("popstate", stop);
    };
  }, []);

  // Expose the live header height to CSS as --header-offset so native fragment
  // navigation (scroll-margin-top on sections) clears the header by the same
  // measured amount the JS scrolls use. Kept in sync on resize.
  useEffect(() => {
    const setVar = () =>
      document.documentElement.style.setProperty("--header-offset", headerOffset() + "px");
    setVar();
    window.addEventListener("resize", setVar);
    return () => window.removeEventListener("resize", setVar);
  }, []);

  const navigate = useCallback((next, opts = {}) => {
    // A fresh navigation supersedes any in-flight Back/Forward scroll restore, so
    // the two don't fight over the scroll position.
    restoreCtl.current.gen += 1;
    cancelAnimationFrame(restoreCtl.current.raf);
    // Full target path, keeping any "#section" so a section link is copyable
    // from the address bar; the pathname alone drives the pushState/replaceState
    // decision (parseRoute ignores the hash, so history entries stay route-based).
    const targetPath = routeToPath(next);
    const targetPathname = targetPath.split("#")[0] || "/";
    const desiredUrl = next.page === "home" && next.section ? targetPath : targetPathname;
    const fromState = opts.from !== undefined ? { from: opts.from } : {};
    const currentUrl = window.location.pathname + window.location.hash;
    if (window.location.pathname !== targetPathname) {
      // Remember where we were before leaving, then start a freshly-keyed entry.
      scrollPositions.current.set(currentKey.current, window.scrollY);
      // Evict the oldest entries beyond the cap (Map preserves insertion
      // order; keys for truncated history slots are never read again anyway).
      while (scrollPositions.current.size > SCROLL_POSITIONS_MAX) {
        scrollPositions.current.delete(scrollPositions.current.keys().next().value);
      }
      const key = ++keyCounter.current;
      window.history.pushState({ ...fromState, key }, "", desiredUrl);
      currentKey.current = key;
    } else if (currentUrl !== desiredUrl || opts.from !== undefined) {
      // Same page: update (or clear) the hash without piling on history entries
      // for in-page section jumps. Keep the current entry's key.
      window.history.replaceState({ ...fromState, key: currentKey.current }, "", desiredUrl);
    }
    // Mirror `from` onto the route so consumers get it as a prop (the history
    // entry keeps carrying it for reload/Back-Forward restoration).
    setRoute(opts.from !== undefined ? { ...next, from: opts.from } : next);

    if (next.page === "home" && next.section) {
      requestAnimationFrame(() => {
        const el = document.getElementById(next.section);
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - headerOffset();
          window.scrollTo({ top: y, behavior: scrollBehavior() });
        }
      });
    } else if (next.page === "home") {
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
    } else {
      // List/article: a fresh (push/link) navigation lands at the top. This runs
      // ONLY from navigate() — i.e. on real navigations, never on popstate — so
      // the app's own restoreScroll (scrollRestoration is "manual", see the
      // popstate handler) still returns you to your prior position when you
      // press Back/Forward into a page you had scrolled.
      window.scrollTo({ top: 0 });
    }
  }, []);

  return (
    <>
      <Header route={route} navigate={navigate} activeSection={activeSection} />
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        {route.page === "home" && <HomePage navigate={navigate} />}
        {route.page === "news-list" && <NewsListPage navigate={navigate} />}
        {route.page === "publications-list" && <PublicationsListPage navigate={navigate} />}
        {route.page === "article" && <Article slug={route.slug} from={route.from} navigate={navigate} />}
        {route.page === "not-found" && <NotFound navigate={navigate} />}
      </main>
      <Footer navigate={navigate} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
