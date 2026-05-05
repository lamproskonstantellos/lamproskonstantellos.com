/* global React */

/* ============================================================
   ICONS
   - UI icons stay monochrome stroke.
   - Brand icons for Contact are filled with official colors,
     wrapped in a soft tinted badge.
   ============================================================ */

const Icon = {
  arrowUR: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 11L11 5" /><path d="M6 5h5v5" />
    </svg>
  ),
  arrowRight: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 8h10" /><path d="M9 4l4 4-4 4" />
    </svg>
  ),
  arrowLeft: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M13 8H3" /><path d="M7 4L3 8l4 4" />
    </svg>
  ),
  external: (p) => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 9L9 5" /><path d="M6 5h3v3" />
    </svg>
  ),
  trophy: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 2h6v3a3 3 0 0 1-6 0V2z" />
      <path d="M5 3.5H3v1a2 2 0 0 0 2 2" />
      <path d="M11 3.5h2v1a2 2 0 0 1-2 2" />
      <path d="M8 8v2.5" />
      <path d="M5.5 13h5l-.3-2.5h-4.4L5.5 13z" />
    </svg>
  ),

  /* ---- Brand icons ---- */
  brandLinkedin: (p) => (
    <svg viewBox="0 0 24 24" fill="#0A66C2" {...p}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/>
    </svg>
  ),
  brandScholar: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <path d="M12 3.2 1.5 9 12 14.8 22.5 9 12 3.2z" fill="#4285F4"/>
      <path d="M5 11.5v3.7c0 1.7 3.13 3.4 7 3.4s7-1.7 7-3.4v-3.7L12 15.4 5 11.5z" fill="#A1C2FA"/>
      <rect x="20.4" y="9" width="1.2" height="5.5" rx="0.6" fill="#4285F4"/>
    </svg>
  ),
  brandIeee: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="#00629B"/>
      <text x="12" y="15.2" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="7" fontWeight="700" fill="#fff" letterSpacing="0.3">IEEE</text>
    </svg>
  ),
  brandOrcid: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="10" fill="#A6CE39"/>
      <path d="M7.4 8.6h1.5v8.5H7.4V8.6zM8.15 7.6a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zM10.7 8.6h3.4c2.55 0 4.25 1.85 4.25 4.25 0 2.6-1.95 4.25-4.4 4.25H10.7V8.6zm1.5 7.15h1.7c2.05 0 2.95-1.45 2.95-2.9 0-1.6-1.05-2.9-2.95-2.9h-1.7v5.8z" fill="#fff"/>
    </svg>
  ),
  brandZenodo: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <circle cx="12" cy="12" r="10" fill="#1F4798"/>
      <path d="M7.5 8h9l-6 8h6" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  brandEmail: (p) => (
    <svg viewBox="0 0 24 24" {...p}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="#0A1F44"/>
      <path d="M2.5 7l9.5 6 9.5-6" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

Object.assign(window, { Icon });
