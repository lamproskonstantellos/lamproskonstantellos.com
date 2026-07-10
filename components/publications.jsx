/* global React, Icon, getRecentPublications, LIMITS,
   routeToPath, handleAnchorClick, PUB_FILTERS, groupPublicationsByYear,
   SectionHeader, ViewAllLink, renderInline */

/* ============================================================
   PUBLICATIONS
   - PubMetaRow / PubLinks:  shared entry fragments
   - PublicationCard:        homepage single-entry card
   - PublicationsPreview:    homepage section, capped at LIMITS
   - PublicationRow:         /publications flat list entry
   - PublicationsListPage:   /publications, filterable and
                             grouped by year
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

function PublicationCard({ pub }) {
  return (
    <article className="pub-card">
      <PubMetaRow pub={pub} />
      <h3 className="pub-title">{pub.title}</h3>
      <p className="pub-authors">{renderInline(pub.authors)}</p>
      {pub.description && <p className="pub-description">{pub.description}</p>}
      <PubLinks links={pub.links} />
    </article>
  );
}

function PublicationsPreview({ navigate }) {
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
          <PublicationCard key={i} pub={p} />
        ))}
      </div>
    </section>
  );
}

// One entry on the /publications list: a plain hairline-separated row (no card
// box). The year is carried by the group label (an h2), so the meta row omits
// it and the title is an h3.
function PublicationRow({ pub }) {
  return (
    <article className="pub-row">
      <PubMetaRow pub={pub} showYear={false} />
      <h3 className="pub-title">{pub.title}</h3>
      <p className="pub-authors">{renderInline(pub.authors)}</p>
      {pub.description && <p className="pub-description">{pub.description}</p>}
      <PubLinks links={pub.links} />
    </article>
  );
}

function PublicationsListPage({ navigate }) {
  const [filterId, setFilterId] = React.useState("all");
  const all = getRecentPublications();
  // PUB_FILTERS and the consecutive-year grouping live in ui-helpers.js
  // (pure, shared, unit-tested without compiling JSX).
  const activeFilter = PUB_FILTERS.find((f) => f.id === filterId) || PUB_FILTERS[0];
  const groups = groupPublicationsByYear(all.filter(activeFilter.match));

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
        Back
      </a>
      <header className="list-header">
        <h1>Publications</h1>
        <p>Peer-reviewed papers, plus theses and reports, ordered from most recent.</p>
      </header>
      <div className="pub-filters" role="group" aria-label="Filter publications">
        {PUB_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`pub-filter${f.id === filterId ? " active" : ""}`}
            aria-pressed={f.id === filterId}
            onClick={() => setFilterId(f.id)}
          >
            {f.label} ({all.filter(f.match).length})
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <p className="list-empty">No publications yet.</p>
      ) : (
        groups.map((g) => (
          <section className="pub-year-group" key={g.year}>
            <h2 className="pub-year">{g.year}</h2>
            <div className="pub-year-items">
              {g.items.map((p, i) => (
                <PublicationRow key={`${g.year}-${i}`} pub={p} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

Object.assign(window, { PublicationCard, PublicationsPreview, PublicationsListPage });
