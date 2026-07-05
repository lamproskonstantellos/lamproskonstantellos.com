/* global React, PROFILE, SectionHeader, renderInline */

/* ============================================================
   ABOUT
   - Clean text-based section. No leading numbers, no scroll-based
     active highlight, no entrance animation — the content is
     simply there.
   - Sticky "Focus areas" sidebar on desktop; stacks on mobile.
   ============================================================ */

function About() {
  const focus = ["Renewable Energy", "Battery Storage", "Grid Flexibility", "Energy Markets"];

  return (
    <section className="block" id="about">
      <SectionHeader title="About" />
      <div className="about-shell">
        <aside className="about-side">
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
