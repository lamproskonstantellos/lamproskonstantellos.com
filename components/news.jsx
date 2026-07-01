/* global React, Icon, Picture, SITE, getRecentNews, getArticle, LIMITS,
   asset, routeToPath, handleAnchorClick, shareLinks,
   useReveal, renderInline, SectionHeader, ViewAllLink */

/* ============================================================
   NEWS / ARTICLES
   - NewsCard:        reusable preview card
   - NewsPreview:     homepage section, capped at LIMITS
   - NewsListPage:    /news full list
   - Article:         /news/<slug> full article view
   ============================================================ */

function NewsCard({ article, index = 0, navigate, revealKey, isVisible, from, headingLevel = "h3" }) {
  const Title = headingLevel;
  const route = { page: "article", slug: article.slug };
  return (
    <a
      className={`news-card reveal ${isVisible ? "in" : ""}`}
      data-reveal={revealKey}
      style={{ transitionDelay: `${index * 80}ms` }}
      href={routeToPath(route)}
      onClick={(e) => handleAnchorClick(e, navigate, route, { from })}
    >
      <div className={"cover" + (article.coverAlign === "top" ? " cover-align-top" : "")}>
        {article.cover
          ? <Picture src={asset(article.cover)} alt={article.title} width="640" height="400" />
          : <div className="ph">[ news/{article.slug}/cover.jpg ]</div>}
      </div>
      <div className="body">
        <div className="meta">
          {article.dateLabel}{article.location ? ` · ${article.location}` : ""}
        </div>
        <Title className="news-title">{article.title}</Title>
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
              headingLevel="h2"
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

function ArticleShare({ article }) {
  // Canonical URL from config — never window.location, which on this SPA can
  // carry transient state (hash, history entries) that must not be shared.
  const url = SITE.url + "/news/" + article.slug;
  const [copied, setCopied] = React.useState(false);
  const copyTimer = React.useRef(null);

  React.useEffect(() => () => clearTimeout(copyTimer.current), []);

  const markCopied = () => {
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  // Legacy path for browsers without the async clipboard API (or where it is
  // blocked): execCommand("copy") needs a selected element in the document.
  const fallbackCopy = () => {
    const ta = document.createElement("textarea");
    ta.value = url;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    if (ok) markCopied();
  };

  const copyUrl = () => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(markCopied, fallbackCopy);
    } else {
      fallbackCopy();
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;
  const nativeShare = () => {
    // Rejects with AbortError when the user dismisses the sheet — not an error.
    navigator.share({ title: article.title, url }).catch(() => {});
  };

  return (
    <div className="article-share">
      <span className="share-label">Share:</span>
      <a
        href={shareLinks(url).linkedin}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
      >
        <Icon.brandLinkedin style={{ width: 14, height: 14 }} /> LinkedIn
      </a>
      <button type="button" className={copied ? "copied" : ""} onClick={copyUrl}>
        {copied
          ? <Icon.check style={{ width: 14, height: 14 }} />
          : <Icon.link style={{ width: 14, height: 14 }} />}
        {copied ? "Copied!" : "Copy link"}
      </button>
      {canNativeShare && (
        <button type="button" onClick={nativeShare}>
          <Icon.arrowUR style={{ width: 14, height: 14 }} /> Share
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Link copied to clipboard" : ""}
      </span>
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

  // A photo is a path string or { src, align?, after?, caption? }. Photos with
  // an integer `after` render inline right after that body paragraph (with an
  // optional caption); the rest fall back to the end-of-article gallery, so
  // articles that don't use `after` are unchanged.
  const photos = (article.photos || []).map((p) =>
    typeof p === "string" ? { src: p } : p
  );
  const inlineAfter = new Map();
  const galleryPhotos = [];
  photos.forEach((photo) => {
    if (Number.isInteger(photo.after)) {
      const list = inlineAfter.get(photo.after) || [];
      list.push(photo);
      inlineAfter.set(photo.after, list);
    } else {
      galleryPhotos.push(photo);
    }
  });

  const photoAlt = (photo) => photo.caption || `Photo from “${article.title}”`;
  const openPhoto = (photo, alt) => (e) => {
    // Focus the trigger first so the Lightbox returns focus here on close, even
    // in browsers that don't focus a clicked div on mousedown (e.g. Safari).
    if (e && e.currentTarget && e.currentTarget.focus) e.currentTarget.focus();
    setLightboxSrc({ src: asset(photo.src), alt });
  };

  const renderInlineFigure = (photo, key) => {
    const alt = photoAlt(photo);
    const open = openPhoto(photo, alt);
    return (
      <figure className="article-figure" key={key}>
        <div
          className={"figure-frame" + (photo.align === "top" ? " photo-align-top" : "")}
          role="button"
          tabIndex={0}
          aria-label={`Open ${alt} in full screen`}
          onClick={open}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(e); }
          }}
        >
          <Picture src={asset(photo.src)} alt={alt} />
        </div>
        {photo.caption && <figcaption>{photo.caption}</figcaption>}
      </figure>
    );
  };

  // The video renders inline right after body paragraph `videoAfter` when that
  // is an integer; otherwise it falls back to its default spot after the body.
  const videoAfter = Number.isInteger(article.videoAfter) ? article.videoAfter : null;
  const renderVideo = () => (
    <div className="article-video">
      <video
        controls
        preload="metadata"
        aria-label={`Video: ${article.title}`}
        poster={article.poster ? asset(article.poster) : undefined}
      >
        <source src={asset(article.video)} type="video/mp4" />
        {/* Captions render only when the article supplies a WebVTT file, so a
            clip with speech can be made accessible without shipping an empty
            placeholder track for silent b-roll. */}
        {article.captions && (
          <track kind="captions" srcLang="en" label="English" src={asset(article.captions)} default />
        )}
      </video>
    </div>
  );

  return (
    <div className="page article">
      {backLink}
      <div className="article-meta">
        {article.dateLabel}{article.location ? ` · ${article.location}` : ""}
      </div>
      <h1>{article.title}</h1>
      {article.cover && (
        <div className={"article-cover" + (article.coverAlign === "top" ? " cover-align-top" : "")}>
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
          <React.Fragment key={i}>
            <p>{renderInline(p)}</p>
            {(inlineAfter.get(i) || []).map((photo, j) =>
              renderInlineFigure(photo, `fig-${i}-${j}`)
            )}
            {article.video && videoAfter === i && renderVideo()}
          </React.Fragment>
        ))}
      </div>
      {article.video && videoAfter === null && renderVideo()}
      {galleryPhotos.length > 0 && (
        <div className="article-gallery">
          {galleryPhotos.map((photo, i) => {
            const alt = photoAlt(photo);
            const open = openPhoto(photo, alt);
            return (
              <div
                className={"photo" + (photo.align === "top" ? " photo-align-top" : "")}
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`Open ${alt} in full screen`}
                onClick={open}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(e);
                  }
                }}
              >
                <Picture src={asset(photo.src)} alt={alt} width="800" height="600" />
              </div>
            );
          })}
        </div>
      )}
      {lightboxSrc && (
        <Lightbox src={lightboxSrc.src} alt={lightboxSrc.alt} onClose={closeLightbox} />
      )}
      <ArticleShare article={article} />
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
