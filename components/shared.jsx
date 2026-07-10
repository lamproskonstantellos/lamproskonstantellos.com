/* global React, routeToPath */

/* ============================================================
   SHARED HELPERS & SMALL UI PRIMITIVES
   - asset:         normalize relative asset paths (cover/photos)
                    so they resolve from site root regardless of
                    the current SPA URL (e.g. /news/<slug>)
   - renderInline:  inline **bold** parser for body paragraphs
   - copyTextToClipboard: one clipboard write for every copy
                    control (article share, publication cite,
                    contact email)
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

// Write `text` to the clipboard, resolving true on success: the async
// clipboard API first, then the legacy execCommand("copy") textarea path for
// browsers where the API is missing or blocked (it needs a selected element
// in the document).
function copyTextToClipboard(text) {
  const fallback = () => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  }
  return Promise.resolve(fallback());
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
  asset, handleAnchorClick, renderInline, copyTextToClipboard,
  SectionHeader, ViewAllLink,
});
