/* global React, Icon, getRecentPublications, LIMITS,
   routeToPath, handleAnchorClick,
   useReveal, SectionHeader, ViewAllLink, renderInline */

/* ============================================================
   PUBLICATIONS
   - PublicationCard:        reusable single-entry card
   - PublicationsPreview:    homepage section, capped at LIMITS
   - PublicationsListPage:   /publications full list
   ============================================================ */

// Meta line (venue · location · year) with the award / type pill inline on the
// same row. The pill sits OUTSIDE .pub-meta so the uppercase/dot-separator
// styling of the meta items never leaks into it, and the last meta item keeps
// its :last-child status (no stray "·" before the pill). The year is omitted on
// the /publications list, where the year-group label already carries it.
function PubMetaRow({ pub, showYear = true }) {
  return (
    <div className="pub-meta-row">
      <div className="pub-meta">
        {/* Each separator is glued to the token BEFORE it (inside the same
            nowrap item) so a wrapped meta line never starts with a stray "·"
            at narrow widths. */}
        <span className="pub-meta-item">{pub.venue}</span>
        {pub.location && <span className="pub-meta-item">{pub.location}</span>}
        {showYear && <span className="pub-meta-item">{pub.year}</span>}
      </div>
      {pub.award && <span className="pub-award">{pub.award}</span>}
      {pub.type && <span className="pub-type">{pub.type}</span>}
    </div>
  );
}

function PubLinks({ links }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="pub-links">
      {links.map((l, j) => (
        <a key={j} href={l.href} target="_blank" rel="noopener noreferrer">
          {l.label}
          <Icon.external style={{ width: 12, height: 12 }} />
        </a>
      ))}
    </div>
  );
}

function PublicationCard({ pub, index = 0, revealKey, isVisible, headingLevel = "h3" }) {
  const Title = headingLevel;
  return (
    <article
      className={`pub-card reveal ${isVisible ? "in" : ""}`}
      data-reveal={revealKey}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="pub-body">
        <PubMetaRow pub={pub} />
        <Title className="pub-title">{pub.title}</Title>
        <p className="pub-authors">{renderInline(pub.authors)}</p>
        {pub.description && <p className="pub-description">{pub.description}</p>}
        <PubLinks links={pub.links} />
      </div>
    </article>
  );
}

function PublicationsPreview({ navigate }) {
  const visible = useReveal();
  const limit = LIMITS.publicationsPreview;
  const items = getRecentPublications(limit);
  const showViewAll = getRecentPublications().length > limit;

  return (
    <section className="block" id="publications">
      <SectionHeader
        title="Publications"
        action={showViewAll ? (
          <ViewAllLink
            href="/publications"
            onClick={(e) => handleAnchorClick(e, navigate, { page: "publications-list" })}
          />
        ) : null}
      />
      <div className="pub-list">
        {items.map((p, i) => (
          <PublicationCard
            key={i}
            pub={p}
            index={i}
            revealKey={`pub-${i}`}
            isVisible={visible.has(`pub-${i}`)}
          />
        ))}
      </div>
    </section>
  );
}

function PublicationsListPage({ navigate }) {
  const visible = useReveal();
  const items = getRecentPublications();

  // Scroll-to-top on arrival is handled by App.navigate (fresh navigations
  // only), so Back/Forward restores the prior scroll position natively.

  const backRoute = { page: "home", section: "publications" };

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
        <h1>Publications</h1>
        <p>Peer-reviewed papers, plus theses and reports, ordered from most recent.</p>
      </header>
      <div className="pub-list">
        {items.map((p, i) => (
          <PublicationCard
            key={i}
            pub={p}
            index={i}
            revealKey={`pub-list-${i}`}
            isVisible={visible.has(`pub-list-${i}`)}
            headingLevel="h2"
          />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PublicationCard, PublicationsPreview, PublicationsListPage });
