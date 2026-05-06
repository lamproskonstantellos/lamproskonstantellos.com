/* global React, PROFILE, SectionHeader */

/* ============================================================
   ABOUT
   - Clean text-based section. No leading numbers, no scroll-based
     active highlight. A single, gentle fade-in on first reveal —
     nothing changes once the section has been read.
   - Sticky "Focus areas" sidebar on desktop; stacks on mobile.
   ============================================================ */

function About() {
  const ref = React.useRef(null);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  const focus = ["Renewable Energy", "Battery Storage", "Grid Flexibility", "Energy Markets"];

  return (
    <section className="block" id="about">
      <SectionHeader title="About" />
      <div className="about-shell">
        <aside className="about-side">
          <div className="about-side-label">Focus areas</div>
          <div className="chip-list">
            {focus.map((f, i) => (
              <span className="chip" key={i} style={{ animationDelay: `${i * 60}ms` }}>{f}</span>
            ))}
          </div>
        </aside>
        <div ref={ref} className={`about-stream ${revealed ? "in" : ""}`}>
          {PROFILE.about.map((p, i) => (
            <p
              key={i}
              className={`about-paragraph${i === 0 ? " about-lead" : ""}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              {p}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

window.About = About;
