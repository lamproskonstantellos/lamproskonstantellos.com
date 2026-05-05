/* global React, Icon */

/* ============================================================
   SHARED HELPERS & SMALL UI PRIMITIVES
   - asset:         normalize relative asset paths (cover/photos)
                    so they resolve from site root regardless of
                    the current SPA URL (e.g. /news/<slug>)
   - renderInline:  inline **bold** parser for body paragraphs
   - useReveal:     IntersectionObserver-driven reveal hook
   - SectionHeader: <h2> + optional right-aligned action
   - ViewAllLink:   "All N publications →" CTA
   ============================================================ */

function asset(path) {
  if (!path) return "";
  if (/^(https?:|\/)/.test(path)) return path;
  return "/" + path;
}

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

function useReveal() {
  const [visible, setVisible] = React.useState(new Set());
  React.useEffect(() => {
    const items = document.querySelectorAll("[data-reveal]");
    if (!items.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const k = e.target.dataset.reveal;
          setVisible((prev) => { const n = new Set(prev); n.add(k); return n; });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach((it) => io.observe(it));
    return () => io.disconnect();
  }, []);
  return visible;
}

function SectionHeader({ title, action }) {
  return (
    <div className="section-label">
      <h2>{title}</h2>
      {action ? <div className="section-label-action">{action}</div> : null}
    </div>
  );
}

function ViewAllLink({ label, onClick }) {
  return (
    <button className="view-all" onClick={onClick}>
      {label} <Icon.arrowRight style={{ width: 13, height: 13 }} />
    </button>
  );
}

Object.assign(window, { asset, renderInline, useReveal, SectionHeader, ViewAllLink });
