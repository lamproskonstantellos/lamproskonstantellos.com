/* ============================================================
   routes.js — single source of truth for the route table
   ------------------------------------------------------------
   One parser shared by every consumer so the URL→view mapping
   can never silently diverge:
     - app.jsx           uses parseRoute (client router)
     - components/*       use routeToPath (link hrefs)
     - server.js          uses parseRoute (computePageMeta) and
                          isValidSpaRoute (200 vs 404 fallback)

   Pure string logic only — no React, no DOM, no Node APIs — so it
   loads identically in the browser (window globals) and in Node
   (require), exactly like site.config.js.

   Routes:
     /                 home        { page: "home", section: null }
     /news             news list   { page: "news-list" }
     /publications     pubs list   { page: "publications-list" }
     /news/<slug>      article     { page: "article", slug }
     (anything else)   not found   { page: "not-found" }
   ============================================================ */

(function () {
  function parseRoute(pathname) {
    const p = String(pathname || "/").replace(/\/+$/, "") || "/";
    if (p === "/" || p === "") return { page: "home", section: null };
    if (p === "/news") return { page: "news-list" };
    if (p === "/publications") return { page: "publications-list" };
    const m = p.match(/^\/news\/([^/]+)$/);
    if (m) return { page: "article", slug: m[1] };
    return { page: "not-found" };
  }

  function routeToPath(route) {
    if (!route) return "/";
    if (route.page === "news-list") return "/news";
    if (route.page === "publications-list") return "/publications";
    if (route.page === "article") return "/news/" + route.slug;
    if (route.page === "home" && route.section) return "/#" + route.section;
    return "/";
  }

  // True when pathname maps to a renderable SPA route. When knownSlugs is
  // supplied (server side), an article route is only valid if its slug exists;
  // omit it (client side) to accept any well-formed article path.
  function isValidSpaRoute(pathname, knownSlugs) {
    const route = parseRoute(pathname);
    if (route.page === "not-found") return false;
    if (route.page === "article") {
      if (!knownSlugs) return true;
      const set = Array.isArray(knownSlugs) ? new Set(knownSlugs) : knownSlugs;
      return set.has(route.slug);
    }
    return true;
  }

  // The document <title> for a route. Single source of truth shared by the
  // server (computePageMeta, injected into the served HTML) and the client
  // (navigate, which keeps the tab title correct after SPA navigation).
  // ctx: { siteName, jobTitle, articleTitle }.
  function pageTitle(route, ctx) {
    switch (route && route.page) {
      case "home":
        return `${ctx.siteName} - ${ctx.jobTitle}`;
      case "news-list":
        return `News - ${ctx.siteName}`;
      case "publications-list":
        return `Publications - ${ctx.siteName}`;
      case "article":
        return ctx.articleTitle
          ? `${ctx.articleTitle} - ${ctx.siteName}`
          : `Page not found - ${ctx.siteName}`;
      default:
        return `Page not found - ${ctx.siteName}`;
    }
  }

  const api = { parseRoute, routeToPath, isValidSpaRoute, pageTitle };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    Object.assign(window, api);
  }
})();
