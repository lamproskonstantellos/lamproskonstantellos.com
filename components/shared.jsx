/* global React, routeToPath */

/* ============================================================
   SHARED HELPERS & SMALL UI PRIMITIVES
   - asset:         normalize relative asset paths (cover/photos)
                    so they resolve from site root regardless of
                    the current SPA URL (e.g. /news/<slug>)
   - renderInline:  inline **bold** parser for body paragraphs
   - SectionHeader: <h2> + optional right-aligned action
   - ViewAllLink:   "View all" pill CTA
   (routeToPath now lives in routes.js, shared with the server.)
   ============================================================ */

function asset(path) {
  if (!path) return "";
  if (/^(https?:|\/)/.test(path)) return path;
  return "/" + path;
}

// routeToPath lives in routes.js (shared with the server's route table).

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

function SectionHeader({ title, action }) {
  return (
    <div className="section-label">
      <h2>{title}</h2>
      {action ? <div className="section-label-action">{action}</div> : null}
    </div>
  );
}

function ViewAllLink({ href, onClick }) {
  return (
    <a className="view-all" href={href} onClick={onClick}>
      View all
    </a>
  );
}

Object.assign(window, {
  asset, handleAnchorClick, renderInline,
  SectionHeader, ViewAllLink,
});
