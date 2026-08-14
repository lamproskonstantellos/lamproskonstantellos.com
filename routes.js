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

  // og:title / twitter:title — the bare social headline, WITHOUT the
  // "- <site name>" suffix pageTitle carries (social cards render
  // og:site_name on its own line, so a suffixed og:title printed the name
  // twice). Home uses the JOB TITLE for the same reason: og:site_name
  // already shows the name. Shared by computePageMeta (served HTML) and the
  // client head-sync on SPA navigation. ctx: { jobTitle, articleTitle }.
  function pageSocialTitle(route, ctx) {
    switch (route && route.page) {
      case "home":
        return ctx.jobTitle;
      case "news-list":
        return "News";
      case "publications-list":
        return "Publications";
      case "article":
        return ctx.articleTitle || "Page not found";
      default:
        return "Page not found";
    }
  }

  // Per-route meta description. Same dual consumers as pageSocialTitle.
  // ctx: { defaultDescription, articleDescription }.
  const NEWS_DESCRIPTION =
    "Reflections from conferences, forums, awards, and projects in renewable energy, battery storage, grid flexibility, and electricity markets.";
  // Covers ALL of the page's categories — the filter pills split into
  // journals / conferences / theses & reports.
  const PUBLICATIONS_DESCRIPTION =
    "Journal and conference papers, theses, and reports on renewable energy, battery storage, PV, V2G, and grid simulation.";
  function pageDescription(route, ctx) {
    switch (route && route.page) {
      case "news-list":
        return NEWS_DESCRIPTION;
      case "publications-list":
        return PUBLICATIONS_DESCRIPTION;
      case "article":
        return ctx.articleDescription || ctx.defaultDescription;
      default:
        return ctx.defaultDescription;
    }
  }

  // Robots directives — declared here (the shared route-truth module) so the
  // client head-sync emits byte-identical values to the served HTML.
  const ROBOTS_INDEX =
    "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const ROBOTS_NOINDEX = "noindex,follow";

  const api = {
    parseRoute,
    routeToPath,
    isValidSpaRoute,
    pageTitle,
    pageSocialTitle,
    pageDescription,
    ROBOTS_INDEX,
    ROBOTS_NOINDEX,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    Object.assign(window, api);
  }
})();
