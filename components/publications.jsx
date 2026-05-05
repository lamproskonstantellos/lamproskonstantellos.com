/* global React, Icon, getRecentPublications, LIMITS,
   useReveal, SectionHeader, ViewAllLink */

/* ============================================================
   PUBLICATIONS
   - PublicationCard:        reusable single-entry card
   - PublicationsPreview:    homepage section, capped at LIMITS
   - PublicationsListPage:   /publications full list
   ============================================================ */

function PublicationCard({ pub, index = 0, revealKey, isVisible }) {
  return (
    <article
      className={`pub-card reveal ${isVisible ? "in" : ""}`}
      data-reveal={revealKey}
      style={{ transitionDelay: `${index * 80}ms` }}
    >
      <div className="pub-body">
        {pub.award && (
          <div className="pub-award">
            <Icon.trophy />
            {pub.award}
          </div>
        )}
        <div className="pub-meta">
          <span>{pub.venue}</span>
          {pub.location && (
            <>
              <span className="dot" />
              <span>{pub.location}</span>
            </>
          )}
          <span className="dot" />
          <span>{pub.year}</span>
        </div>
        <h3>{pub.title}</h3>
        <p className="pub-authors">{pub.authors}</p>
        {pub.description && <p className="pub-description">{pub.description}</p>}
        {pub.links && pub.links.length > 0 && (
          <div className="pub-links">
            {pub.links.map((l, j) => (
              <a key={j} href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label}
                <Icon.external style={{ width: 12, height: 12 }} />
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function PublicationsPreview({ navigate }) {
  const visible = useReveal();
  const limit = LIMITS.publicationsPreview;
  const items = getRecentPublications(limit);
  const total = getRecentPublications().length;
  const showViewAll = total > limit;

  return (
    <section className="block" id="publications">
      <SectionHeader
        title="Publications"
        action={showViewAll ? (
          <ViewAllLink
            label={`All ${total} publications`}
            onClick={() => navigate({ page: "publications-list" })}
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

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <div className="page list-page">
      <button
        className="back-link"
        onClick={() => navigate({ page: "home", section: "publications" })}
      >
        <Icon.arrowLeft style={{ width: 14, height: 14 }} /> Back to Home
      </button>
      <header className="list-header">
        <h1>Publications</h1>
        <p>Peer-reviewed publications and conference papers, ordered from most recent.</p>
      </header>
      <div className="pub-list">
        {items.map((p, i) => (
          <PublicationCard
            key={i}
            pub={p}
            index={i}
            revealKey={`pub-list-${i}`}
            isVisible={visible.has(`pub-list-${i}`)}
          />
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { PublicationCard, PublicationsPreview, PublicationsListPage });
