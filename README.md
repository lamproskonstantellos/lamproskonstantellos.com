# lamproskonstantellos.com

[![License: All Rights Reserved](https://img.shields.io/badge/license-All%20Rights%20Reserved-red.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Deployed on Railway](https://img.shields.io/badge/deployed%20on-Railway-0B0D0E?logo=railway&logoColor=white)](https://railway.com/)
[![Live site](https://img.shields.io/badge/live-lamproskonstantellos.com-0a66c2)](https://lamproskonstantellos.com)

The personal website of **Lampros Konstantellos**, Electrical & Computer
Engineer. A single-page application presenting bio, publications, and news
around renewable energy, battery storage, grid flexibility, and electricity
markets.

## Stack

- **Frontend:** React 18 loaded via UMD with in-browser Babel Standalone, plain
  CSS, Inter and JetBrains Mono via Google Fonts.
- **Backend:** Minimal Node.js HTTP server (`server.js`) that serves static
  assets and appends a per-deploy version query string to local CSS/JS URLs to
  bust browser caches on every deploy.
- **Container:** `node:20-alpine` (see `Dockerfile`).
- **Hosting:** [Railway](https://railway.com/).

## Local development

```bash
npm install
npm start
```

The site is served on `http://localhost:3000`.

## Project structure

```
.
├── app.jsx        Root React component and router
├── components/    About, Publications, News, and shared UI
├── data.js        Bio, publications, and news content
├── icons.jsx      Inline SVG icon set
├── styles.css     Global stylesheet
├── index.html     Single HTML entry point
├── server.js      Static file server
├── Dockerfile     Production container
└── news/          News articles
```

## License

This repository is published for portfolio visibility only. All rights are
reserved by the author. See [`LICENSE`](./LICENSE) for the full terms —
copying, modification, redistribution, or any derivative use of the source
code or assets requires prior written permission.
