/* global React, Icon, Picture, SITE, getRecentNews, getArticle, LIMITS,
   asset, routeToPath, handleAnchorClick, shareLinks, copyTextToClipboard,
   renderInline, SectionHeader, ViewAllLink, ARTICLE_COVER_SIZES */

/* ============================================================
   NEWS / ARTICLES
   - NewsCard:        reusable preview card
   - NewsPreview:     homepage section, capped at LIMITS
   - NewsListPage:    /news full list
   - Article:         /news/<slug> full article view
   ============================================================ */

function NewsCard({ article, navigate, from, headingLevel = "h3" }) {
  const Title = headingLevel;
  const route = { page: "article", slug: article.slug };
  return (
    <a
      className="news-card"
      href={routeToPath(route)}
      onClick={(e) => handleAnchorClick(e, navigate, route, { from })}
    >
      <div className={"cover" + (article.coverAlign === "top" ? " cover-align-top" : "")}>
        {/* alt="" — the card is ONE link whose accessible name is the visible
            title below; a title-alt here would announce it twice. */}
        {article.cover
          ? <Picture
              src={asset(article.cover)}
              alt=""
              width="640"
              height="400"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          : <div className="ph">[ news/{article.slug}/cover.jpg ]</div>}
      </div>
      <div className="body">
        <div className="meta">
          {article.dateLabel}{article.location ? ` · ${article.location}` : ""}
        </div>
        <Title className="news-title">{article.title}</Title>
        <p>{article.excerpt}</p>
        <span className="read">Read article</span>
      </div>
    </a>
  );
}

function NewsPreview({ navigate }) {
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
        {items.map((n) => (
          <NewsCard key={n.slug} article={n} navigate={navigate} from="home" />
        ))}
      </div>
    </section>
  );
}

function NewsListPage({ navigate }) {
  const items = getRecentNews();

  // Scroll-to-top on arrival is handled by App.navigate (fresh navigations
  // only), so Back/Forward restores the prior scroll position natively.

  const backRoute = { page: "home", section: "news" };

  return (
    <div className="page list-page">
      <a
        className="back-link"
        href={routeToPath(backRoute)}
        aria-label="Back to home"
        onClick={(e) => handleAnchorClick(e, navigate, backRoute)}
      >
        Back
      </a>
      <header className="list-header">
        <h1>News</h1>
        <p>Conferences, forums, awards, and project milestones, ordered from most recent.</p>
      </header>
      {items.length === 0 ? (
        <p className="list-empty">No articles yet.</p>
      ) : (
        <div className="news-grid">
          {items.map((n) => (
            <NewsCard
              key={n.slug}
              article={n}
              navigate={navigate}
              from="news-list"
              headingLevel="h2"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Lightbox({ photos, index, onIndex, onClose }) {
  const closeRef = React.useRef(null);
  const dialogRef = React.useRef(null);
  const count = photos.length;
  const multi = count > 1;
  const current = photos[index] || photos[0];

  // Keep the latest index/handlers in a ref so the key listener (bound once, so
  // the scroll lock + focus restore run only on open/close) always sees the
  // current photo when Arrow keys page through a multi-photo gallery.
  const nav = React.useRef();
  nav.current = { index, count, onIndex, onClose };

  React.useEffect(() => {
    const triggerEl = document.activeElement;
    const onKey = (e) => {
      const s = nav.current;
      if (e.key === "Escape") { s.onClose(); return; }
      if (s.count > 1 && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const delta = e.key === "ArrowRight" ? 1 : -1;
        s.onIndex((s.index + delta + s.count) % s.count);
        return;
      }
      // Trap Tab / Shift+Tab within the dialog's controls (close + prev/next).
      if (e.key === "Tab") {
        const focusables = dialogRef.current
          ? Array.from(dialogRef.current.querySelectorAll("button"))
          : [];
        if (!focusables.length) { e.preventDefault(); return; }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        const inside = dialogRef.current && dialogRef.current.contains(active);
        if (e.shiftKey && (active === first || !inside)) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (active === last || !inside)) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    // Scroll lock goes on <html>, not just <body>: styles.css sets an explicit
    // overflow-y on the root element (scrollbar-gutter reservation), and once
    // the root has its own overflow the body's no longer propagates to the
    // viewport — so hiding only body left the page scrollable behind the modal.
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (closeRef.current) closeRef.current.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      if (triggerEl && typeof triggerEl.focus === "function") triggerEl.focus();
    };
  }, []);

  const page = (delta) => (e) => {
    e.stopPropagation();
    onIndex((index + delta + count) % count);
  };

  // Same AVIF → WebP → original negotiation the in-page <Picture> uses, so the
  // full-screen view doesn't re-download the multi-megabyte original when an
  // optimized sibling exists. display:contents (styles.css) keeps the <img>
  // the direct flex child so its max-width/height sizing is unchanged.
  const src = current.src;
  const isRaster = /\.(jpe?g|png)$/i.test(src);
  const base = isRaster ? src.replace(/\.(jpe?g|png)$/i, "") : null;
  const img = (
    <img
      className="lightbox-img"
      src={src}
      alt={current.alt || ""}
      loading="eager"
      decoding="async"
      onClick={(e) => e.stopPropagation()}
    />
  );

  return (
    <div
      className="lightbox"
      ref={dialogRef}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={multi ? `Photo viewer, ${index + 1} of ${count}` : "Photo viewer"}
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
      {multi && (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          aria-label="Previous photo"
          onClick={page(-1)}
        >
          ‹
        </button>
      )}
      {isRaster ? (
        <picture>
          <source srcSet={`${base}.avif`} type="image/avif" />
          <source srcSet={`${base}.webp`} type="image/webp" />
          {img}
        </picture>
      ) : img}
      {multi && (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          aria-label="Next photo"
          onClick={page(1)}
        >
          ›
        </button>
      )}
      {multi && (
        <div className="lightbox-counter" aria-hidden="true">{index + 1} / {count}</div>
      )}
      {/* Paging keeps focus on the Prev/Next button, so nothing re-announces on
          its own: this live region speaks each photo change. (The visible
          counter above is aria-hidden — this is its accessible counterpart.) */}
      {multi && (
        <span className="sr-only" aria-live="polite">
          {`Photo ${index + 1} of ${count}${current.alt ? `: ${current.alt}` : ""}`}
        </span>
      )}
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

  // Clipboard write (async API + execCommand fallback) lives in shared.jsx —
  // the same helper the publication Cite button and the contact email use.
  const copyUrl = () => {
    copyTextToClipboard(url).then((ok) => { if (ok) markCopied(); });
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
  // The lightbox pages across ALL of an article's photos; it holds the index of
  // the open photo (null when closed) into the flat `openable` list built below.
  const [lightboxIndex, setLightboxIndex] = React.useState(null);
  const closeLightbox = React.useCallback(() => setLightboxIndex(null), []);

  // Scroll-to-top on a fresh navigation is handled centrally in App.navigate
  // (push/link only), so Back/Forward keeps the browser's native scroll
  // restoration instead of being yanked to the top on every popstate remount.

  // The visible label is always "Back"; the destination still depends on where
  // the reader came from (home News section vs the /news list), so the
  // aria-label names it — identically-labelled links with different targets
  // are ambiguous in a screen reader's link list.
  const from = window.history.state?.from;
  const backRoute = from === "home"
    ? { page: "home", section: "news" }
    : { page: "news-list" };
  const backLink = (
    <a
      className="back-link"
      href={routeToPath(backRoute)}
      aria-label={from === "home" ? "Back to home" : "Back to news"}
      onClick={(e) => handleAnchorClick(e, navigate, backRoute)}
    >
      Back
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
  const photoAlt = (photo) => photo.caption || `Photo from “${article.title}”`;
  // Flat list of every openable photo, in author order, that the lightbox pages
  // through with prev/next + Arrow keys. Each figure/gallery tile opens at its
  // own index into this list.
  const openable = photos.map((photo) => ({ src: asset(photo.src), alt: photoAlt(photo) }));

  const inlineAfter = new Map();
  const galleryPhotos = [];
  photos.forEach((photo, index) => {
    const entry = { photo, index };
    if (Number.isInteger(photo.after)) {
      const list = inlineAfter.get(photo.after) || [];
      list.push(entry);
      inlineAfter.set(photo.after, list);
    } else {
      galleryPhotos.push(entry);
    }
  });

  const openPhoto = (index) => (e) => {
    // Focus the trigger first so the Lightbox returns focus here on close, even
    // in browsers that don't focus a clicked div on mousedown (e.g. Safari).
    if (e && e.currentTarget && e.currentTarget.focus) e.currentTarget.focus();
    setLightboxIndex(index);
  };

  const renderInlineFigure = ({ photo, index }, key) => {
    const alt = photoAlt(photo);
    const open = openPhoto(index);
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
          {/* width/height (when the article provides them) let the browser
              reserve the figure's box from the intrinsic ratio before the
              image decodes — no layout shift mid-article. */}
          <Picture
            src={asset(photo.src)}
            alt={alt}
            width={photo.width}
            height={photo.height}
            sizes={ARTICLE_COVER_SIZES}
          />
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
      {/* videoWidth/videoHeight (when the article provides them) reserve the
          frame before the poster loads, like width/height on an <img>. */}
      <video
        controls
        preload="metadata"
        aria-label={`Video: ${article.title}`}
        poster={article.poster ? asset(article.poster) : undefined}
        width={article.videoWidth}
        height={article.videoHeight}
      >
        <source src={asset(article.video)} type="video/mp4" />
        {/* Open-codec fallback: browsers built without the proprietary H.264
            decoder (e.g. some Linux Chromium packages) skip the MP4 and use the
            VP9/WebM here. Listed second so the universally hardware-decoded
            H.264 stays the default everywhere it is supported. */}
        {article.videoWebm && (
          <source src={asset(article.videoWebm)} type="video/webm" />
        )}
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
          {/* Eager + high priority: the cover is the page's LCP element and the
              server preloads its AVIF sibling — the two must stay in step. */}
          <Picture
            src={asset(article.cover)}
            alt={article.title}
            width="1280"
            height="720"
            sizes={ARTICLE_COVER_SIZES}
            loading="eager"
            fetchPriority="high"
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
          {galleryPhotos.map(({ photo, index }) => {
            const alt = photoAlt(photo);
            const open = openPhoto(index);
            return (
              <div
                className={"photo" + (photo.align === "top" ? " photo-align-top" : "")}
                key={index}
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
                <Picture
                  src={asset(photo.src)}
                  alt={alt}
                  width="800"
                  height="600"
                  sizes="(max-width: 520px) 100vw, (max-width: 776px) 50vw, 230px"
                />
              </div>
            );
          })}
        </div>
      )}
      {lightboxIndex !== null && (
        <Lightbox
          photos={openable}
          index={lightboxIndex}
          onIndex={setLightboxIndex}
          onClose={closeLightbox}
        />
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
