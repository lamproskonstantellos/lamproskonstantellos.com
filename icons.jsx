/* global React */

/* ============================================================
   ICONS
   - UI icons stay monochrome stroke.
   - Brand icons for Contact are filled with official colors,
     wrapped in a soft tinted badge.
   ============================================================ */

const Icon = {
  arrowUR: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <path d="M5 11L11 5" /><path d="M6 5h5v5" />
    </svg>
  ),
  external: (p) => (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <path d="M5 9L9 5" /><path d="M6 5h3v3" />
    </svg>
  ),
  download: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <path d="M8 2.5V10" /><path d="M4.5 7L8 10.5 11.5 7" /><path d="M3 13.5h10" />
    </svg>
  ),
  copy: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M10.5 3.5h-6A1.5 1.5 0 0 0 3 5v6" />
    </svg>
  ),
  link: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <path d="M6.5 9.5l3-3" />
      <path d="M7.5 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1" />
      <path d="M8.5 11.5l-1 1a2.5 2.5 0 0 1-3.5-3.5l1-1" />
    </svg>
  ),
  check: (p) => (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...p}>
      <path d="M3 8.5l3.5 3.5L13 4.5" />
    </svg>
  ),
  /* ---- Brand icons ---- */
  brandLinkedin: (p) => (
    <svg viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true" focusable="false" {...p}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.37V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/>
    </svg>
  ),
  brandScholar: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      <path d="M12 3.2 1.5 9 12 14.8 22.5 9 12 3.2z" fill="#4285F4"/>
      <path d="M5 11.5v3.7c0 1.7 3.13 3.4 7 3.4s7-1.7 7-3.4v-3.7L12 15.4 5 11.5z" fill="#A1C2FA"/>
      <rect x="20.4" y="9" width="1.2" height="5.5" rx="0.6" fill="#4285F4"/>
    </svg>
  ),
  brandIeee: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="#00629B"/>
      <text x="12" y="15.2" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="7" fontWeight="700" fill="#fff" letterSpacing="0.3">IEEE</text>
    </svg>
  ),
  brandOrcid: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      <circle cx="12" cy="12" r="10" fill="#A6CE39"/>
      <path d="M7.4 8.6h1.5v8.5H7.4V8.6zM8.15 7.6a.95.95 0 1 1 0-1.9.95.95 0 0 1 0 1.9zM10.7 8.6h3.4c2.55 0 4.25 1.85 4.25 4.25 0 2.6-1.95 4.25-4.4 4.25H10.7V8.6zm1.5 7.15h1.7c2.05 0 2.95-1.45 2.95-2.9 0-1.6-1.05-2.9-2.95-2.9h-1.7v5.8z" fill="#fff"/>
    </svg>
  ),
  brandZenodo: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      <circle cx="12" cy="12" r="10" fill="#1F4798"/>
      <path d="M7.5 8h9l-6 8h6" stroke="#fff" strokeWidth="1.7" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  brandResearchgate: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2.5" fill="#00CCBB"/>
      <text x="12" y="15.2" textAnchor="middle" fontFamily="Helvetica,Arial,sans-serif" fontSize="9" fontWeight="700" fill="#fff" letterSpacing="0.3">RG</text>
    </svg>
  ),
  brandGithub: (p) => (
    <svg viewBox="0 0 24 24" fill="#181717" aria-hidden="true" focusable="false" {...p}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  brandEmail: (p) => (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...p}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="#0A1F44"/>
      <path d="M2.5 7l9.5 6 9.5-6" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

Object.assign(window, { Icon });
