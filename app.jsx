/* global React, ReactDOM, PROFILE, Icon */
const { useState, useEffect, useMemo, useCallback } = React;

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
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
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="brand" onClick={() => navigate({ page: "home" })}>
          <span className="brand-name">{PROFILE.name}</span>
          <span className="brand-role">{PROFILE.role}</span>
        </div>
        <nav className="nav">
          {items.map(it => (
            <button
              key={it.id}
              className={route.page === "home" && route.section === it.id ? "active" : ""}
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
   ABOUT
   ============================================================ */

function About() {
  const [visible, setVisible] = useState(new Set());
  const [active, setActive] = useState(0);

  useEffect(() => {
    const items = document.querySelectorAll(".about-item");
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = Number(e.target.dataset.idx);
          setVisible(prev => { const n = new Set(prev); n.add(idx); return n; });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -10% 0px" });
    items.forEach(it => io.observe(it));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const items = Array.from(document.querySelectorAll(".about-item"));
    if (!items.length) return;
    let raf = 0;
    const update = () => {
      const target = window.innerHeight * 0.4;
      let best = 0, bestDist = Infinity;
      items.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const c = r.top + r.height / 2;
        const d = Math.abs(c - target);
        if (d < bestDist) { bestDist = d; best = i; }
      });
      setActive(best);
    };
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const focus = ["Renewable Energy", "Battery Storage", "Grid Flexibility", "Energy Markets"];

  return (
    <section className="block" id="about">
      <div className="section-label"><h2>About</h2></div>
      <div className="about-shell">
        <aside className="about-side">
          <div className="about-side-label">Focus areas</div>
          <div className="chip-list">
            {focus.map((f, i) => (
              <span className="chip" key={i} style={{ animationDelay: `${i * 60}ms` }}>{f}</span>
            ))}
          </div>
        </aside>
        <div className="about-stream">
          {PROFILE.about.map((p, i) => (
            <div
              key={i}
              data-idx={i}
              className={`about-item ${visible.has(i) ? "in" : ""} ${active === i ? "active" : ""}`}
            >
              <span className="about-num">0{i + 1}</span>
              <p>{p}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PUBLICATIONS
   ============================================================ */

function useReveal() {
  const [visible, setVisible] = useState(new Set());
  useEffect(() => {
    const items = document.querySelectorAll("[data-reveal]");
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const k = e.target.dataset.reveal;
          setVisible(prev => { const n = new Set(prev); n.add(k); return n; });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(it => io.observe(it));
    return () => io.disconnect();
  }, []);
  return visible;
}

function Publications() {
  const visible = useReveal();
  return (
    <section className="block" id="publications">
      <div className="section-label"><h2>Publications</h2></div>
      <div className="pub-list">
        {PROFILE.publications.map((p, i) => (
          <article
            className={`pub-card reveal ${visible.has(`pub-${i}`) ? "in" : ""}`}
            key={i}
            data-reveal={`pub-${i}`}
            style={{ transitionDelay: `${i * 80}ms` }}
          >
            {p.award && (
              <div className="pub-award">
                <Icon.trophy />
                {p.award}
              </div>
            )}
            <div className="pub-body">
              <div className="pub-meta">
                <span>{p.venue}</span>
                <span className="dot" />
                <span>{p.location}</span>
                <span className="dot" />
                <span>{p.year}</span>
              </div>
              <h3>{p.title}</h3>
              <p className="pub-authors">{p.authors}</p>
              <div className="pub-links">
                {p.links.map((l, j) => (
                  <a key={j} href={l.href} target="_blank" rel="noopener noreferrer">
                    {l.label}
                    <Icon.external style={{ width: 12, height: 12 }} />
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   NEWS LIST
   ============================================================ */

function NewsList({ navigate }) {
  const visible = useReveal();
  return (
    <section className="block" id="news">
      <div className="section-label"><h2>News</h2></div>
      <div className="news-grid">
        {PROFILE.news.map((n, i) => (
          <article
            className={`news-card reveal ${visible.has(`news-${i}`) ? "in" : ""}`}
            key={n.slug}
            data-reveal={`news-${i}`}
            style={{ transitionDelay: `${i * 80}ms` }}
            onClick={() => navigate({ page: "article", slug: n.slug })}
          >
            <div className="cover">
              {n.cover
                ? <img src={n.cover} alt="" />
                : <div className="ph">[ news/{n.slug}/cover.jpg ]</div>
              }
            </div>
            <div className="body">
              <div className="meta">{n.dateLabel} · {n.location}</div>
              <h3>{n.title}</h3>
              <p>{n.excerpt}</p>
              <span className="read">
                Read article <Icon.arrowRight style={{ width: 13, height: 13 }} />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   ARTICLE
   ============================================================ */

function Article({ slug, navigate }) {
  const article = useMemo(() => PROFILE.news.find(n => n.slug === slug), [slug]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  if (!article) {
    return (
      <div className="page article">
        <button className="back-link" onClick={() => navigate({ page: "home", section: "news" })}>
          <Icon.arrowLeft style={{ width: 14, height: 14 }} /> Back to News
        </button>
        <p style={{ color: "var(--muted)" }}>Article not found.</p>
      </div>
    );
  }

  return (
    <div className="page article">
      <button className="back-link" onClick={() => navigate({ page: "home", section: "news" })}>
        <Icon.arrowLeft style={{ width: 14, height: 14 }} /> Back to News
      </button>
      <div className="article-meta">{article.dateLabel} · {article.location}</div>
      <h1>{article.title}</h1>
      {article.cover && (
        <div className="article-cover">
          <img src={article.cover} alt="" />
        </div>
      )}
      <div className="article-body">
        {article.body.map((p, i) => (
          <p key={i}>{renderInline(p)}</p>
        ))}
      </div>
      {article.photos && article.photos.length > 0 && (
        <div className="article-gallery">
          {article.photos.map((src, i) => (
            <div className="photo" key={i}>
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      )}
      {article.sources && article.sources.length > 0 && (
        <div className="article-sources">
          Sources:{" "}
          {article.sources.map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && " · "}
              <a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
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
      <div className="section-label"><h2>Contact</h2></div>
      <div className="contact-grid">
        {PROFILE.contact.map(c => {
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
        <div className="site-footer-links">
          {PROFILE.footer.links.map((l, i) => (
            <a key={i} href={l.href} target={l.href.startsWith("mailto") ? undefined : "_blank"} rel="noopener noreferrer">
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   APP
   ============================================================ */

function App() {
  const [route, setRoute] = useState({ page: "home", section: null, slug: null });

  const navigate = useCallback((next) => {
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
        {route.page === "home" && (
          <div className="page">
            <Hero navigate={navigate} />
            <About />
            <Publications />
            <NewsList navigate={navigate} />
            <Contact />
          </div>
        )}
        {route.page === "article" && (
          <Article slug={route.slug} navigate={navigate} />
        )}
      </main>
      <Footer />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
