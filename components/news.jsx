/* global React, Icon, getRecentNews, getArticle, LIMITS,
   asset, routeToPath, handleAnchorClick,
   useReveal, renderInline, SectionHeader, ViewAllLink */

/* ============================================================
   NEWS / ARTICLES
   - NewsCard:        reusable preview card
   - NewsPreview:     homepage section, capped at LIMITS
   - NewsListPage:    /news full list
   - Article:         /news/<slug> full article view
   ============================================================ */

function NewsCard({ article, index = 0, navigate, revealKey, isVisible, from }) {
  const route = { page: "article", slug: article.slug };
  return (
    <a
      className={`news-card reveal ${isVisible ? "in" : ""}`}
      data-reveal={revealKey}
      style={{ transitionDelay: `${index * 80}ms` }}
      href={routeToPath(route)}
      onClick={(e) => handleAnchorClick(e, navigate, route, { from })}
    >
      <div className="cover">
        {article.cover
          ? <img src={asset(article.cover)} alt="" />
          : <div className="ph">[ news/{article.slug}/cover.jpg ]</div>}
      </div>
      <div className="body">
        <div className="meta">
          {article.dateLabel}{article.location ? ` · ${article.location}` : ""}
        </div>
        <h3>{article.title}</h3>
        <p>{article.excerpt}</p>
        <span className="read">
          Read article <Icon.arrowRight style={{ width: 13, height: 13 }} />
        </span>
      </div>
    </a>
  );
}

function NewsPreview({ navigate }) {
  const visible = useReveal();
  const limit = LIMITS.newsPreview;
  const items = getRecentNews(limit);
  const total = getRecentNews().length;
  const showViewAll = total > limit;

  return (
    <section className="block" id="news">
      <SectionHeader
        title="News"
        action={showViewAll ? (
          <ViewAllLink
            label={`All ${total} articles`}
            navigate={navigate}
            route={{ page: "news-list" }}
          />
        ) : null}
      />
      <div className="news-grid">
        {items.map((n, i) => (
          <NewsCard
            key={n.slug}
            article={n}
            index={i}
            navigate={navigate}
            revealKey={`news-${i}`}
            isVisible={visible.has(`news-${i}`)}
            from="home"
          />
        ))}
      </div>
    </section>
  );
}

function NewsListPage({ navigate }) {
  const visible = useReveal();
  const items = getRecentNews();

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const backRoute = { page: "home", section: "news" };

  return (
    <div className="page list-page">
      <a
        className="back-link"
        href={routeToPath(backRoute)}
        onClick={(e) => handleAnchorClick(e, navigate, backRoute)}
      >
        <Icon.arrowLeft style={{ width: 14, height: 14 }} /> Back to Home
      </a>
      <header className="list-header">
        <h1>News</h1>
      </header>
      {items.length === 0 ? (
        <p className="list-empty">No articles yet.</p>
      ) : (
        <div className="news-grid">
          {items.map((n, i) => (
            <NewsCard
              key={n.slug}
              article={n}
              index={i}
              navigate={navigate}
              revealKey={`news-list-${i}`}
              isVisible={visible.has(`news-list-${i}`)}
              from="news-list"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({ src, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <img
        className="lightbox-img"
        src={src}
        alt=""
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function Article({ slug, navigate }) {
  const article = React.useMemo(() => getArticle(slug), [slug]);
  const [lightboxSrc, setLightboxSrc] = React.useState(null);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [slug]);

  const from = window.history.state?.from;
  const backRoute = from === "home"
    ? { page: "home", section: "news" }
    : { page: "news-list" };
  const backLabel = from === "home" ? "Back to Home" : "Back to News";
  const backLink = (
    <a
      className="back-link"
      href={routeToPath(backRoute)}
      onClick={(e) => handleAnchorClick(e, navigate, backRoute)}
    >
      <Icon.arrowLeft style={{ width: 14, height: 14 }} /> {backLabel}
    </a>
  );

  if (!article) {
    return (
      <div className="page article">
        {backLink}
        <p style={{ color: "var(--muted)" }}>Article not found.</p>
      </div>
    );
  }

  return (
    <div className="page article">
      {backLink}
      <div className="article-meta">
        {article.dateLabel}{article.location ? ` · ${article.location}` : ""}
      </div>
      <h1>{article.title}</h1>
      {article.cover && (
        <div className="article-cover">
          <img src={asset(article.cover)} alt="" />
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
            <div
              className={
                "photo" +
                (src.includes("ieee-pess-2025-best-paper-award/photo-01.jpg")
                  ? " photo-align-top"
                  : "")
              }
              key={i}
              onClick={() => setLightboxSrc(asset(src))}
            >
              <img src={asset(src)} alt="" />
            </div>
          ))}
        </div>
      )}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
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

Object.assign(window, { NewsCard, NewsPreview, NewsListPage, Article });
