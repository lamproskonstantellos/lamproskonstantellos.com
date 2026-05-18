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

function routeToPath(route) {
  if (!route) return "/";
  if (route.page === "news-list") return "/news";
  if (route.page === "publications-list") return "/publications";
  if (route.page === "article") return "/news/" + route.slug;
  if (route.page === "home" && route.section) return "/#" + route.section;
  return "/";
}

function handleAnchorClick(e, navigate, route, opts) {
  // Let the browser handle modifier-clicks and non-left clicks normally
  if (e.defaultPrevented) return;
  if (e.button !== undefined && e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  navigate(route, opts);
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

function ViewAllLink({ label, navigate, route }) {
  return (
    <a
      className="view-all"
      href={routeToPath(route)}
      onClick={(e) => handleAnchorClick(e, navigate, route)}
    >
      {label} <Icon.arrowRight style={{ width: 13, height: 13 }} />
    </a>
  );
}

Object.assign(window, {
  asset, routeToPath, handleAnchorClick, renderInline,
  useReveal, SectionHeader, ViewAllLink,
});
