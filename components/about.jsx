/* global React, PROFILE, SITE, Picture, HERO_IMG_SIZES, SectionHeader, renderInline */

/* ============================================================
   ABOUT
   - Clean text-based section. No leading numbers, no scroll-based
     active highlight, no entrance animation — the content is
     simply there.
   - Sticky sidebar on desktop (portrait + "Focus areas"); stacks on mobile.
   - The portrait lives here, small, next to the biography — the hero is
     text only.
   ============================================================ */

function About() {
  const focus = ["Renewable Energy", "Battery Storage", "Grid Flexibility", "Energy Management", "Energy Markets"];

  return (
    <section className="block" id="about">
      <SectionHeader title="About" />
      <div className="about-shell">
        <aside className="about-side">
          <div className="about-portrait">
            {/* The one portrait on desktop and tablet (phones show the small
                card in the hero instead). sizes matches the server's preload
                imagesizes (both from ui-helpers.HERO_IMG_SIZES), so the
                preloaded candidate is the rendered one; eager for the same
                reason — a lazy image would leave the preload unused. */}
            <Picture
              src={SITE.heroImage}
              alt={PROFILE.name}
              width="264"
              height="264"
              natural={{ width: SITE.heroImageWidth, height: SITE.heroImageHeight }}
              sizes={HERO_IMG_SIZES}
              loading="eager"
            />
          </div>
          <div className="about-side-label">Focus areas</div>
          <div className="chip-list">
            {focus.map((f) => (
              <span className="chip" key={f}>{f}</span>
            ))}
          </div>
        </aside>
        <div className="about-stream">
          {PROFILE.about.map((p, i) => (
            <p key={i} className={`about-paragraph${i === 0 ? " about-lead" : ""}`}>
              {renderInline(p)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

window.About = About;
