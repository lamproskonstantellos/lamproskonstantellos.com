/* global React, Icon, getRecentNews, getArticle, LIMITS,
   asset, useReveal, renderInline, SectionHeader, ViewAllLink */

/* ============================================================
   NEWS / ARTICLES
   - NewsCard:        reusable preview card
   - NewsPreview:     homepage section, capped at LIMITS
   - NewsListPage:    /news full list
   - Article:         /news/<slug> full article view
   ============================================================ */

function NewsCard({ article, index = 0, navigate, revealKey, isVisible, from }) {
  return (
    <article
      className={`news-card reveal ${isVisible ? "in" : ""}`}
      data-reveal={revealKey}
      style={{ transitionDelay: `${index * 80}ms` }}
      onClick={() => navigate({ page: "article", slug: article.slug }, { from })}
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
    </article>
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
            onClick={() => navigate({ page: "news-list" })}
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

  return (
    <div className="page list-page">
      <button
        className="back-link"
        onClick={() => navigate({ page: "home", section: "news" })}
      >
        <Icon.arrowLeft style={{ width: 14, height: 14 }} /> Back to Home
      </button>
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
  const goBack = () =>
    from === "home"
      ? navigate({ page: "home", section: "news" })
      : navigate({ page: "news-list" });
  const backLabel = from === "home" ? "Back to Home" : "Back to News";

  if (!article) {
    return (
      <div className="page article">
        <button className="back-link" onClick={goBack}>
          <Icon.arrowLeft style={{ width: 14, height: 14 }} /> {backLabel}
        </button>
        <p style={{ color: "var(--muted)" }}>Article not found.</p>
      </div>
    );
  }

  return (
    <div className="page article">
      <button className="back-link" onClick={goBack}>
        <Icon.arrowLeft style={{ width: 14, height: 14 }} /> {backLabel}
      </button>
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
