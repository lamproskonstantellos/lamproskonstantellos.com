/* global React, Icon, Picture, getRecentNews, getArticle, LIMITS,
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
          ? <Picture src={asset(article.cover)} alt={article.title} width="640" height="400" />
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
  const showViewAll = getRecentNews().length > limit;

  return (
    <section className="block" id="news">
      <SectionHeader
        title="News"
        action={showViewAll ? (
          <ViewAllLink
            href="/news"
            onClick={(e) => handleAnchorClick(e, navigate, { page: "news-list" })}
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
    window.scrollTo({ top: 0 });
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

function Lightbox({ src, alt, onClose }) {
  const closeRef = React.useRef(null);

  React.useEffect(() => {
    const triggerEl = document.activeElement;
    const onKey = (e) => {
      if (e.key === "Escape") { onClose(); return; }
      // Single focusable element — keep focus trapped inside the modal
      if (e.key === "Tab") {
        e.preventDefault();
        if (closeRef.current) closeRef.current.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (closeRef.current) closeRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      if (triggerEl && typeof triggerEl.focus === "function") triggerEl.focus();
    };
  }, [onClose]);

  return (
    <div
      className="lightbox"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
    >
      <button
        type="button"
        className="lightbox-close"
        ref={closeRef}
        aria-label="Close photo viewer"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      >
        ×
      </button>
      <img
        className="lightbox-img"
        src={src}
        alt={alt || ""}
        loading="eager"
        decoding="async"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

function Article({ slug, navigate }) {
  const article = React.useMemo(() => getArticle(slug), [slug]);
  const [lightboxSrc, setLightboxSrc] = React.useState(null);
  const closeLightbox = React.useCallback(() => setLightboxSrc(null), []);

  React.useEffect(() => {
    window.scrollTo({ top: 0 });
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
          <Picture
            src={asset(article.cover)}
            alt={article.title}
            width="1280"
            height="720"
            loading="eager"
          />
        </div>
      )}
      <div className="article-body">
        {article.body.map((p, i) => (
          <p key={i}>{renderInline(p)}</p>
        ))}
      </div>
      {article.photos && article.photos.length > 0 && (
        <div className="article-gallery">
          {article.photos.map((photo, i) => {
            // A photo is a path string or { src, align } — alignment is article
            // data, never a filename check inside the component.
            const photoSrc = typeof photo === "string" ? photo : photo.src;
            const alignTop = typeof photo === "object" && photo.align === "top";
            const photoAlt = `Photo ${i + 1} from “${article.title}”`;
            const open = () => setLightboxSrc({ src: asset(photoSrc), alt: photoAlt });
            return (
              <div
                className={"photo" + (alignTop ? " photo-align-top" : "")}
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`Open ${photoAlt} in full screen`}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open();
                  }
                }}
              >
                <Picture src={asset(photoSrc)} alt={photoAlt} width="800" height="600" />
              </div>
            );
          })}
        </div>
      )}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={closeLightbox} />
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

Object.assign(window, { NewsCard, NewsPreview, NewsListPage, Article });
