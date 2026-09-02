# 📄 Product Requirements Document (PRD)

**Product:** Identifying URL-Based Attacks using IP Data
**Project ID:** SKIT/AI/2023-2027/07
**Version:** 1.0 &nbsp;·&nbsp; **Date:** 2026-09-03 &nbsp;·&nbsp; **Owner:** Kartik Bhargava (Team Lead)

> Scope in this document is derived strictly from the approved Project Abstract & Sprint form. Nothing here adds new features beyond it — it breaks the same commitments into requirements that are traceable back to a sprint task.

---

## 1. Executive Summary

A hybrid cybersecurity platform that classifies submitted URLs as `Benign` / `Phishing` / `Malware` / `Suspicious` in real time, using a machine-learning model informed by URL/host/domain features and live external threat intelligence (VirusTotal, AbuseIPDB). Every verdict is written to a tamper-evident, blockchain-anchored audit log, and surfaced through an analytics dashboard with exportable reports.

---

## 2. Goals & Success Metrics

| Goal | Proposed Target | Notes |
|---|---|---|
| Accurate classification | ≥ 90% accuracy on held-out test set, minimized false-positive rate | Benchmarked in Sprint 4 (baseline → tuned XGBoost) |
| Low-latency verdicts | p95 `/analyze` response < 2s on cache miss, < 200ms on cache hit | Cache-miss budget includes external API round-trip |
| Reliable external dependency handling | Zero unhandled failures when VirusTotal/AbuseIPDB rate-limit or time out | Retries + graceful degradation, Sprint 6 |
| Tamper-evident audit trail | 100% of verdicts anchored on-chain; any post-hoc edit to `URL_Analysis` is detectable | Core trust guarantee of the project |
| Usable analytics | Analyst can go from dashboard to an exported report in ≤ 3 actions | Sprint 5 |

*These are team-authored engineering targets to give "production-ready" concrete meaning — the form does not mandate specific numbers, so these should be revisited as real data becomes available in Sprint 4/6.*

---

## 3. Non-Goals / Out of Scope

- Real-time network traffic interception or inline blocking (this is an on-demand analysis API, not an inline proxy/firewall).
- Training threat-intel APIs' own detection models — VirusTotal/AbuseIPDB are consumed, not rebuilt.
- Mainnet blockchain deployment — Ganache (local/test chain) per the approved tech stack; not a production public-chain claim.
- Mobile native apps — web dashboard only, per the frontend stack (React).
- Multi-tenant billing/subscription systems — out of scope for an academic R&D project.

---

## 4. Users & Personas

Derived directly from the sprint user stories in the project form:

| Persona | Need | Primary Sprint(s) |
|---|---|---|
| **Security Analyst** | Submit URLs, get structured, ML-ready threat evaluation | 1, 4 |
| **End User** | Simple scanner UI, view results/history/reports | 2 |
| **API Consumer** | One REST endpoint returning a consistent, low-latency verdict | 3 |
| **Decision Maker** | Trend analytics, exportable audit-ready summaries | 5 |
| **System Administrator** | Live threat intel, caching, optimized DB, production deployment | 6 |
| **Auditor** | Tamper-proof, independently verifiable logs | 6 |

---

## 5. Functional Requirements

Each requirement is traceable to its sprint task (`Sn.m`) in [PROGRESS.md](PROGRESS.md).

### 5.1 URL Intelligence & Feature Engineering (Sprint 1)
- **FR-1.1** System shall ingest labeled benign/malicious URL datasets from configurable sources. *(S1.1 — ✅ done)*
- **FR-1.2** System shall extract lexical and host-based features (length, entropy, special-char ratios, IP-vs-domain, subdomain count) from any URL. *(S1.2)*
- **FR-1.3** System shall enrich URLs with domain-age, registrar, and DNS features via WHOIS/DNS lookups. *(S1.3)*
- **FR-1.4** System shall expose a versioned, ML-ready feature schema with a repeatable preprocessing pipeline. *(S1.4)*

### 5.2 Frontend Dashboard (Sprint 2)
- **FR-2.1** Users shall have a responsive React + Tailwind interface with a reusable component library. *(S2.1)*
- **FR-2.2** Users shall submit a URL via a scanner input with client-side validation. *(S2.2)*
- **FR-2.3** Users shall view analysis results, scan history, and generated reports. *(S2.3)*
- **FR-2.4** Dashboard shall integrate with the backend via Axios/React Router across all screen sizes. *(S2.4)*

### 5.3 Backend Orchestration (Sprint 3)
- **FR-3.1** Backend shall expose a FastAPI service with versioned routing and environment-based config. *(S3.1 — ✅ done)*
- **FR-3.2** Backend shall validate and sanitize all submitted URLs via Pydantic schemas before processing. *(S3.2)*
- **FR-3.3** Backend shall coordinate feature-extraction, threat-intel, and ML modules through one orchestration service. *(S3.3)*
- **FR-3.4** Backend shall expose a single unified `POST /api/v1/analyze` endpoint returning one consistent verdict object. *(S3.4)*

### 5.4 ML Classification Engine (Sprint 4)
- **FR-4.1** System shall train baseline Scikit-Learn classifiers as an accuracy benchmark. *(S4.1)*
- **FR-4.2** System shall classify URLs into 4 classes (Benign/Phishing/Malware/Suspicious) via a tuned XGBoost model. *(S4.2)*
- **FR-4.3** Model shall be validated via hyperparameter tuning and k-fold cross-validation. *(S4.3)*
- **FR-4.4** System shall emit a confidence-based risk score alongside every verdict, packaged for backend serving. *(S4.4)*

### 5.5 Analytics & Reporting (Sprint 5)
- **FR-5.1** Dashboard shall render interactive risk-trend and detection-statistics charts (Chart.js). *(S5.1)*
- **FR-5.2** Dashboard shall visualize threat-category distribution and trends over time. *(S5.2)*
- **FR-5.3** Users shall export scan data/reports as CSV, JSON, or PDF. *(S5.3)*
- **FR-5.4** UI shall be demo-ready with finalized polish. *(S5.4)*

### 5.6 Threat Intelligence, Data & Deployment (Sprint 6)
- **FR-6.1** Backend shall integrate live VirusTotal and AbuseIPDB lookups with response normalization, retries, and rate-limit handling. *(S6.1)*
- **FR-6.2** Backend shall cache repeat URL/IP lookups in Redis to reduce latency and external API calls. *(S6.2)*
- **FR-6.3** System shall persist analyses in a normalized, indexed PostgreSQL schema (`Users`, `URL_Analysis`, `Threat_Intelligence`, `Audit_Logs`). *(S6.3)*
- **FR-6.4** System shall anchor a hash of every audit log entry on-chain via a Solidity contract (Web3.py), and be containerized with Docker and deployed via GitHub Actions CI/CD. *(S6.4)*

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | `/analyze` responds within the latency budgets in §2; cache-first lookups avoid redundant external API calls |
| **Scalability** | Stateless FastAPI service (horizontally scalable behind a load balancer); Redis absorbs read-heavy repeat-lookup load |
| **Reliability** | External threat-intel failures degrade gracefully (serve ML-only verdict + flag) rather than failing the request |
| **Security** | Input sanitization on all URL submissions; secrets (API keys, DB credentials) via environment config, never hardcoded |
| **Data Integrity** | Blockchain-anchored hashes make silent edits to `Audit_Logs`/`URL_Analysis` detectable |
| **Observability** | Structured logging across all backend services for debugging and audit trail correlation |
| **Maintainability** | Modular boundaries matching team ownership (ML / backend / frontend) with independent test suites per module |
| **Portability** | Dockerized services; reproducible local dev via `.env.example` + pinned dependency versions |

---

## 7. Assumptions & Constraints

- VirusTotal/AbuseIPDB are used on free/rate-limited tiers — caching (FR-6.2) is a functional requirement, not an optimization, to keep the system usable within those limits.
- Blockchain component targets **Ganache** (local test chain), consistent with an academic R&D deployment, not a mainnet claim.
- Team is 3 students; scope and dates are fixed by the approved form — no scope changes are in flight regardless of PRD framing.
- ML training data starts as binary (benign/malicious); reaching the 4-class target (FR-4.2) requires relabeling/enrichment before Sprint 4 model training begins.

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| External API rate limits hit during demo/grading | Broken live demo | Redis cache (FR-6.2) + pre-warmed cache of demo URLs |
| "Why blockchain vs. a signed hash-chain log?" — evaluator pushback | Weak viva answer | Prepare explicit tradeoff answer: independent verifiability vs. cheaper hash-chaining; documented in README |
| Core ML idea perceived as generic/saturated | Undersells real differentiation | Lead presentation with blockchain audit trail + production infra, not classification alone |
| 4-class dataset not ready in time for Sprint 4 | Model training delayed | Flag as an explicit dependency of S4.2 in PROGRESS.md; relabeling work should start before Sprint 4 opens |
| 7-month scope across exams/coursework | Missed dates | Sprint dates already fixed per form; PROGRESS.md tracks slippage early |

---

## 9. Data Model Reference

See [README.md § Data Model](README.md#-data-model-proposed) for the proposed entity-relationship diagram (`Users`, `URL_Analysis`, `Threat_Intelligence`, `Audit_Logs`). Finalized in Sprint 6 Task 3 (S6.3).

---

## 10. Milestones

Full dated task-by-task tracking lives in **[PROGRESS.md](PROGRESS.md)**. Sprint-level milestones:

| Sprint | Ends | Deliverable |
|---|---|---|
| 1 | 10-03-2027 | Production ML feature pipeline, packaged risk-scoring model |
| 2 | 10-03-2027 | Component-based scanner UI |
| 3 | 20-11-2026 | Unified `/analyze` API live end-to-end |
| 4 | 10-03-2027 | Tuned 4-class model serving real verdicts |
| 5 | 10-03-2027 | Full analytics dashboard with exports |
| 6 | 10-03-2027 | Threat intel + caching + DB + blockchain + CI/CD — production deployment |

---

## 11. Glossary

- **Benign** — URL shows no malicious indicators.
- **Phishing** — URL designed to impersonate a trusted entity to steal credentials/data.
- **Malware** — URL serves or links to malicious executable content.
- **Suspicious** — Ambiguous signal; insufficient confidence for a definitive verdict.
- **Risk Score** — Confidence-weighted numeric score (0–100) accompanying every verdict.
- **Audit Anchor** — A hash of an analysis record committed to the blockchain, making later tampering detectable.
