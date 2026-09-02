# Project Progress Tracker

**Project:** Identifying URL-Based Attacks using IP Data (SKIT/AI/2023-2027/07)
**Last updated:** 2026-09-03

> Legend: ✅ Done &nbsp;·&nbsp; 🟡 In Progress &nbsp;·&nbsp; ⚠️ Due Soon / At Risk &nbsp;·&nbsp; ⬜ Not Started

---

## Overall Progress

```
[██░░░░░░░░░░░░░░░░░░░░░░] 2 / 24 tasks complete  (~8%)
```

| Track | Owner | Progress |
|---|---|---|
| Backend (Sprint 3 & 6) | Kartik Bhargava | 1 / 8 ✅ |
| ML (Sprint 1 & 4) | Ishanvi Agarwal | 1 / 8 ✅ |
| Frontend (Sprint 2 & 5) | Diya Garg | 0 / 8 ⬜ |

---

## 🧑‍💻 Kartik Bhargava — Backend & Integration (Sprint 3 & 6)

| # | User Story | Start | End | Status | Notes |
|---|---|---|---|---|---|
| 1 | FastAPI project skeleton with routing & config | 10-08-2026 | 05-09-2026 | ✅ Done | `backend/app/` — pydantic-settings config, CORS, versioned router, `/api/v1/health`, tests passing, verified live |
| 2 | URL validation & request/response schemas | 06-09-2026 | 30-09-2026 | ⬜ Not Started | Pydantic models + sanitization layer |
| 3 | Orchestration service (feature-extraction + threat-intel + ML) | 01-10-2026 | 25-10-2026 | ⬜ Not Started | |
| 4 | Unified `/analyze` endpoint + integration tests | 26-10-2026 | 20-11-2026 | ⬜ Not Started | Wires backend ↔ frontend |
| 5 | VirusTotal & AbuseIPDB integration | 21-11-2026 | 15-12-2026 | ⬜ Not Started | Retries, rate-limit handling, normalization |
| 6 | Redis caching for repeat URL/IP lookups | 16-12-2026 | 15-01-2027 | ⬜ Not Started | |
| 7 | PostgreSQL schema — normalized & indexed | 16-01-2027 | 10-02-2027 | ⬜ Not Started | `Users`, `URL_Analysis`, `Threat_Intelligence`, `Audit_Logs` |
| 8 | Blockchain audit logging + Docker + CI/CD | 11-02-2027 | 10-03-2027 | ⬜ Not Started | Solidity/Web3.py contract, GitHub Actions |

---

## 🤖 Ishanvi Agarwal — ML Engineer (Sprint 1 & 4)

| # | User Story | Start | End | Status | Notes |
|---|---|---|---|---|---|
| 1 | Benign/malicious URL dataset ingestion | 10-08-2026 | 05-09-2026 | ✅ Done | `ml/src/ingest.py` — 410,457 clean rows (344,800 benign / 65,657 malicious), tests passing |
| 2 | Lexical & host-based feature extraction | 06-09-2026 | 30-09-2026 | ⬜ Not Started | |
| 3 | Domain/content features via WHOIS/DNS enrichment | 01-10-2026 | 25-10-2026 | ⬜ Not Started | |
| 4 | ML-ready feature schema + preprocessing pipeline | 26-10-2026 | 20-11-2026 | ⬜ Not Started | |
| 5 | Baseline Scikit-Learn classifiers | 21-11-2026 | 15-12-2026 | ⬜ Not Started | Train/test split + evaluation metrics |
| 6 | 4-class XGBoost model (Benign/Phishing/Malware/Suspicious) | 16-12-2026 | 15-01-2027 | ⬜ Not Started | Needs relabeling beyond current binary dataset |
| 7 | Hyperparameter tuning & k-fold cross-validation | 16-01-2027 | 10-02-2027 | ⬜ Not Started | |
| 8 | Confidence-based risk scoring + model export | 11-02-2027 | 10-03-2027 | ⬜ Not Started | Packaged for backend serving |

---

## 🎨 Diya Garg — Frontend & UI/UX Developer (Sprint 2 & 5)

| # | User Story | Start | End | Status | Notes |
|---|---|---|---|---|---|
| 1 | React + Tailwind base with component library | 10-08-2026 | 05-09-2026 | ⚠️ Due Soon | Not started — `frontend/` still empty, due in 2 days |
| 2 | Landing page & URL-scanner input UI | 06-09-2026 | 30-09-2026 | ⬜ Not Started | |
| 3 | Results / scan-history / reports pages | 01-10-2026 | 25-10-2026 | ⬜ Not Started | |
| 4 | Responsive layout + Axios/React Router integration | 26-10-2026 | 20-11-2026 | ⬜ Not Started | |
| 5 | Chart.js risk-trend & detection-statistics charts | 21-11-2026 | 15-12-2026 | ⬜ Not Started | |
| 6 | Threat-category & trend visualizations | 16-12-2026 | 15-01-2027 | ⬜ Not Started | |
| 7 | CSV/JSON/PDF report export | 16-01-2027 | 10-02-2027 | ⬜ Not Started | |
| 8 | UI/UX polish for project demonstration | 11-02-2027 | 10-03-2027 | ⬜ Not Started | |

---

## ⚠️ Open Items

- **Diya's Task 1 is due 05-09-2026** and `frontend/` is still an empty folder — flag with her directly.
- Repo is not yet under a project-scoped git repository (see below) — nothing has been committed anywhere.
- ML dataset is currently **binary** (benign/malicious); Sprint 4 Task 6 (4-class XGBoost) will require relabeling/enrichment before training.

## 🔧 Infra Note

Git repo root currently resolves to `C:\Users\Kartik` (entire home directory), not this project folder — tracking unrelated files from other projects. A clean, project-scoped git repo should be initialized inside `FinalYearProject/` before any commits are made.

---

*This file is updated as work lands — re-check before status meetings or mentor sign-off, dates/status may move as tasks complete.*
