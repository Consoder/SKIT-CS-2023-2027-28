# Frontend — URLShield AI

React + Vite + Tailwind dashboard for the "Identifying URL-Based Attacks using IP Data" project.
Owner: Diya Garg (Sprints 2 & 5). Product requirements: [docs/FRONTEND_PRD.md](docs/FRONTEND_PRD.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # vitest
npm run lint       # oxlint
npm run build
```

By default the app runs in **Demo mode**: URL features are computed in the browser, and the verdict and threat intel are
simulated (always labelled as such), so every screen works before the backend's `/analyze` exists.
Switch to **Settings → Live API** to use FastAPI (`uvicorn app.main:app --reload` in `backend/`).

Copy `.env.example` to `.env.local` to change the defaults.

## Screens

| Route | Screen |
|---|---|
| `/` | Landing page + scanner |
| `/dashboard` | KPIs, trends, verdict and risk breakdowns, recent scans |
| `/scan` | Single and bulk scan (`?tab=bulk`) |
| `/results/:id` | Verdict, risk gauge, signals, features, IP/DNS, WHOIS/SSL, threat intel, audit record |
| `/history` | Search, filter, export, delete |
| `/reports` | Printable report, CSV / JSON / PDF |
| `/intel` | Hosting hotspots, IOC blocklist |
| `/audit` | SHA-256 hash-chain log, verification, tamper demo |
| `/api` | Request/response contract for the backend |
| `/settings` | Engine mode, API URL, health check, data |

## Structure

```
src/
  api/          axios client + analyzeUrl / checkHealth (demo or live)
  components/   UI primitives, layouts, scan form, charts
  config/       brand + verdict / risk-level definitions
  hooks/        useScanner (pipeline progress)
  lib/          validateUrl, features (port of ml/src/features.py), demoEngine,
                normalize, ledger (hash chain), analytics, exporters, storage
  pages/        one file per route
  store/        AppStoreProvider (history, audit chain, settings → localStorage)
```
