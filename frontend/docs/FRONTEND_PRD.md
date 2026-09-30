# Frontend PRD — URLShield AI

**Project:** Identifying URL-Based Attacks using IP Data (SKIT/AI/2023-2027/07)
**Owner:** Diya Garg (Frontend & UI/UX) · **Sprints:** 2 and 5 · **Status:** v1.0, 30-09-2026
**Depends on:** Kartik Bhargava (backend `/analyze`, Sprints 3 & 6), Ishanvi Agarwal (features + model, Sprints 1 & 4)

---

## 1. Problem & goal

Blacklist-based tools only catch URLs that have already been reported, and they show a bare "safe / unsafe" answer with no
evidence. Our backend combines URL features, IP/domain intelligence, threat-intel feeds and an ML model. The frontend's job
is to make that evidence **usable**:

1. Anyone can check a link in seconds and know what to do next.
2. An analyst can see *why* a URL was flagged and trust the record afterwards.
3. A decision maker can see trends and export audit-ready reports.

## 2. Users

| Persona | Need | Primary screens |
|---|---|---|
| **End user** (student, employee) | "Is this link safe to click?" | Landing scanner → Result |
| **Security analyst** | Evidence, triage many links, block indicators | Result tabs, Bulk scan, History, Threat Intel |
| **Decision maker / mentor** | Trends and summary reports | Dashboard, Reports (CSV / JSON / PDF) |
| **Auditor / forensics** | Proof that logs weren't edited | Blockchain Audit |
| **Developer** (backend team, integrators) | The API contract | API Access, Settings |

## 3. What existing products do (and what we took from them)

| Product | Pattern | What we took |
|---|---|---|
| VirusTotal | Engine detection ratio ("23 / 94"), tabbed detail page | Detection ratio + stacked engine bar; tabbed result page |
| urlscan.io | Summary first (IP, ASN, country), then deep tabs; recent-scans feed | Key-facts card; "Recent scans" on the dashboard |
| Google Safe Browsing / Transparency Report | One plain-language status + advice | Verdict card with a **recommended action** |
| AbuseIPDB | 0–100 confidence score for the IP | Risk gauge + AbuseIPDB score |
| Cloudflare Radar URL scanner | Security / network / behaviour sections | IP & DNS and WHOIS & SSL tabs |

**Gaps none of them fill, and our differentiators:** an **explainable verdict** (each signal with its weight),
**zero-day detection** from URL structure, and a **tamper-evident audit trail**.

## 4. Scope (v1.0)

### In scope
- **Landing page:** pitch, live scanner with examples, how-it-works pipeline, features, verdict classes, comparison with existing tools (from the literature survey), FAQ.
- **Scanner:** client-side validation that mirrors `backend/app/schemas/url.py`; live 7-stage pipeline progress; single and bulk scans (paste text or upload a .txt/.csv, up to 50 URLs).
- **Result page:** verdict + advice, 0–100 risk gauge, confidence, key facts; tabs for Overview ("Why this verdict"), URL Features, IP & DNS, WHOIS & SSL, Threat Intelligence and Audit Record; Rescan; export to JSON / CSV / PDF.
- **Dashboard:** KPI tiles with 7-day deltas; scans per day; average risk per day; verdict breakdown; risk distribution; top signals; recent scans; 7 / 14 / 30-day range.
- **History:** search by URL or IP, verdict and risk filters, sort, pagination, multi-select export and delete.
- **Reports:** scope picker, printable report preview, export to CSV / JSON / PDF.
- **Threat Intel:** intelligence-source status, top hosting countries / ASNs / TLDs, IOC table with a blocklist export.
- **Blockchain Audit:** SHA-256 hash chain of every verdict, integrity verification, and a tamper-detection demo.
- **API Access:** the request / response / error contract, plus a curl example.
- **Settings:** Demo vs Live engine, API base URL, backend health check, local data management.

### Out of scope (v1.0)
- Login and user accounts. There is no auth in the backend plan yet; the "Users" table is Sprint 6.3.
- Server-side history. It stays in `localStorage` until `/history` ships.
- Screenshot / sandbox rendering of the page, and browser extension / email modules (listed as future work in the proposal).

## 5. Key requirements

| # | Requirement | Acceptance |
|---|---|---|
| R1 | Invalid input never reaches the API | Same rules as the backend: http(s) only, ≤ 2048 chars, no control chars, valid port and host; scheme-less input becomes `http://` |
| R2 | Every verdict shows its evidence | "Why this verdict" lists signals with severity and weight; missing evidence reads "Not available", never crashes |
| R3 | Verdicts are never communicated by colour alone | Icon + label + status colour everywhere |
| R4 | The UI works before the backend is ready | Demo mode produces the exact `/analyze` response shape |
| R5 | Demo data is never mistaken for real data | "Demo mode" pill, "Simulated" tags, a notice on results, "Sample data" badge |
| R6 | Logs are tamper-evident | Editing or deleting any stored record fails verification at that index |
| R7 | Exports are safe | CSV cells are escaped and spreadsheet-formula-neutralised |
| R8 | Responsive and accessible | Usable at 390 px; keyboard-navigable tabs, skip links, labelled inputs, chart "view as table" |

## 6. Information architecture

```
/            Landing + scanner (public)
/dashboard   Metrics & trends
/scan        Single | Bulk (?tab=bulk, ?url=…&auto=1 for rescans)
/results/:id Result detail
/history     All scans
/reports     Report builder
/intel       Threat intelligence & IOCs
/audit       Hash-chain audit log
/api         API contract
/settings    Engine, backend connection, data
```

## 7. API contract (frontend ↔ backend)

`POST {API_BASE}/analyze` with body `{ "url": "…" }` returns the backend's `URLAnalysisResponse`:
`url`, `verdict` (benign | suspicious | phishing | malware), `risk_score` (0–100) and `evidence`.

The frontend proposes this shape for `evidence`. Every key is optional; the full example is on the in-app API Access page.

| Key | Source (owner) |
|---|---|
| `confidence`, `model` | ML model (Ishanvi, Sprint 4) |
| `features` | `ml/src/features.py` names (Ishanvi, Sprint 1.2) |
| `signals[]` `{id, label, severity, weight, detail}` | Explainability (model feature importance or rules) |
| `dns` | `ml/src/enrichment.py` `DomainEnrichment` fields (Sprint 1.3) |
| `ip`, `whois`, `ssl` | Backend enrichment (Kartik) |
| `threat_intel.virustotal / abuseipdb / safe_browsing` | Backend integrations (Kartik, Sprint 6.1) |
| `audit {tx_hash, block_number, recorded_at}` | Solidity contract receipt (Kartik, Sprint 6.4) |

Errors use the envelope from `core/errors.py`: `{ "error": { "code", "message", "details" } }`.

## 8. Demo mode — what's real, what's simulated

| Part | Demo mode |
|---|---|
| URL validation | Real (mirrors the backend) |
| Lexical / host features | Real (JavaScript port of `features.py`) |
| Verdict and risk score | A transparent rule-based score, **not** the ML model |
| DNS, WHOIS, IP, SSL, VirusTotal, AbuseIPDB, Safe Browsing | Simulated deterministically from the URL, tagged "Simulated" |
| Audit hash chain | Real SHA-256 chain (browser-side) |

Switching to **Settings → Live API** sends the same requests to FastAPI; no UI changes are needed.

## 9. Design system

- Dark "security operations" theme matching the proposal mock-ups; Inter for text, JetBrains Mono for URLs and hashes.
- Verdict colours use a fixed status palette: good `#0ca30c`, warning `#fab219`, serious `#ec835a`, critical `#d03b3b`.
- Charts are single-series blue with no dual axes; category breakdowns are labelled bar rows instead of donuts.
- Risk bands: Low 0–24 · Medium 25–49 · High 50–74 · Critical 75–100.

## 10. Success metrics (for the demo and the evaluation)

- A first-time user reaches a verdict in ≤ 2 interactions (paste, then Analyze).
- 100 % of threat verdicts show at least one explanatory signal.
- The tamper demo detects 100 % of edited or deleted records.
- The frontend test suite passes (validation parity, engine, ledger, analytics, full scan flow).

## 11. Open questions for the team

1. **Kartik:** can `/analyze` return `evidence` in the §7 shape? The contract page is the reference.
2. **Ishanvi:** `_entropy()` in `ml/src/features.py` computes `-Σ p·√p`, not Shannon entropy (`-Σ p·log₂p`). The Sprint 1.2 summary's 1.15–6.01 range looks like Shannon. Worth confirming before training.
3. **Branding:** the deck uses both "URLShield AI" and "ChainScan". Pick one; it's a single constant in `src/config/brand.js`.
