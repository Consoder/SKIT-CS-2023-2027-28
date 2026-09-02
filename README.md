<div align="center">

# 🛡️ Identifying URL-Based Attacks using IP Data

### Hybrid ML + Threat Intelligence + Blockchain platform for real-time malicious URL detection and tamper-proof digital forensics.

![Status](https://img.shields.io/badge/status-in--progress-yellow)
![Track](https://img.shields.io/badge/track-R%26D-blueviolet)
![SDG](https://img.shields.io/badge/SDG%209-Industry%2C%20Innovation%20%26%20Infrastructure-orange)
![Python](https://img.shields.io/badge/backend-FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/frontend-React-61DAFB?logo=react&logoColor=black)
![ML](https://img.shields.io/badge/ML-XGBoost-EC4A3F)
![Blockchain](https://img.shields.io/badge/audit%20log-Solidity%20%2F%20Web3.py-3C3C3D?logo=ethereum&logoColor=white)

**Project ID** `SKIT/AI/2023-2027/07` &nbsp;·&nbsp; **Branch** CSE &nbsp;·&nbsp; **Session** 2026–27 &nbsp;·&nbsp; **Eval** Research Paper Publication

[Problem](#-problem-statement) · [What We're Building](#-what-were-building) · [Architecture](#-high-level-architecture) · [Request Flow](#-request-flow) · [Data Model](#-data-model-proposed) · [Timeline](#-sprint-timeline) · [Stack](#-technology-stack) · [Team](#-team) · [PRD](PRD.md) · [Progress](PROGRESS.md)

</div>

---

## 🎯 Problem Statement

Traditional **blacklist-based** security systems fail to catch **zero-day malicious URLs** — links generated too recently to appear on any known-bad list. They also stitch together URL, IP, and threat-intel signals poorly, and keep logs that can be quietly edited after the fact, so even a correct detection can't always be *proven* later.

**Our fix:** fuse URL feature analysis, IP intelligence, domain reputation, and live threat intelligence into one ML-driven verdict — then anchor that verdict in an **immutable blockchain audit log**, so the record of what was detected, when, and why, can't be tampered with.

---

## 🧩 What We're Building

```
 Input:  a URL, submitted through the dashboard
 Output: ┌─────────────────────────────────────────────┐
         │  Verdict           Benign / Phishing /       │
         │                    Malware / Suspicious       │
         │  Risk Score        0–100, confidence-based    │
         │  Evidence          features + threat-intel    │
         │  Audit Record      hash anchored on-chain      │
         └─────────────────────────────────────────────┘
```

Beyond single-URL scanning: scan history, threat-trend analytics, and exportable audit-ready reports (CSV / JSON / PDF) for decision-makers.

---

## 🏗️ High-Level Architecture

```mermaid
flowchart TD
    U["👤 User"] -->|submits URL| FE["🖥️ Frontend Dashboard\nReact · Tailwind · Chart.js"]
    FE -->|"POST /api/v1/analyze"| API["⚙️ FastAPI Orchestration Layer"]

    API --> VAL["✅ Validation & Sanitization\n(Pydantic)"]
    VAL --> ORCH{{"🧭 Orchestration Service"}}

    ORCH -->|cache check| CACHE[("⚡ Redis\nrepeat lookups")]
    ORCH --> FEAT["🔍 Feature Extraction\nLexical · Host · Domain · Content"]
    ORCH --> TI["🌐 Threat Intelligence\nVirusTotal + AbuseIPDB"]

    FEAT --> ML["🧠 ML Classification\nXGBoost — 4-class + risk score"]
    ML --> ORCH
    TI --> ORCH

    ORCH --> DB[("🗄️ PostgreSQL\nUsers · URL_Analysis ·\nThreat_Intelligence · Audit_Logs")]
    ORCH --> CHAIN[("⛓️ Blockchain Audit Log\nSolidity + Web3.py")]

    ORCH -->|verdict + risk score + evidence| FE
    FE -->|analytics · history · exports| U

    style CHAIN fill:#3c3c3d,color:#fff
    style ML fill:#EC4A3F,color:#fff
    style CACHE fill:#dc382d,color:#fff
```

---

## 🔄 Request Flow

*What happens the instant a URL is submitted:*

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as FastAPI /analyze
    participant Cache as Redis
    participant Feat as Feature Extraction
    participant TI as VirusTotal / AbuseIPDB
    participant ML as XGBoost Model
    participant DB as PostgreSQL
    participant Chain as Blockchain Audit Log

    User->>FE: Submit URL
    FE->>API: POST /api/v1/analyze
    API->>API: Validate & sanitize
    API->>Cache: Lookup URL/IP
    alt cache hit
        Cache-->>API: Cached verdict
    else cache miss
        API->>Feat: Extract features
        API->>TI: Query reputation
        Feat-->>API: Feature vector
        TI-->>API: Reputation signal
        API->>ML: Classify(features)
        ML-->>API: Verdict + confidence
        API->>DB: Persist analysis
        API->>Chain: Anchor audit hash
        API->>Cache: Store result
    end
    API-->>FE: Verdict + risk score + evidence
    FE-->>User: Rendered result + dashboard update
```

---

## 🗃️ Data Model (proposed)

*Finalized in Sprint 6 (due 10-02-2027) — shown here to size the schema early.*

```mermaid
erDiagram
    USERS ||--o{ URL_ANALYSIS : submits
    URL_ANALYSIS ||--|| THREAT_INTELLIGENCE : enriched_by
    URL_ANALYSIS ||--|| AUDIT_LOGS : anchored_by

    USERS {
        uuid id PK
        string email
        string role
        timestamp created_at
    }
    URL_ANALYSIS {
        uuid id PK
        uuid user_id FK
        string url
        string verdict
        float risk_score
        jsonb features
        timestamp analyzed_at
    }
    THREAT_INTELLIGENCE {
        uuid id PK
        uuid analysis_id FK
        string source
        jsonb raw_response
        timestamp fetched_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid analysis_id FK
        string tx_hash
        string content_hash
        timestamp anchored_at
    }
```

---

## 📅 Sprint Timeline

```mermaid
gantt
    title Backend, ML & Frontend — Dated Sprint Plan
    dateFormat YYYY-MM-DD
    axisFormat %b %y

    section Ishanvi — ML (S1 · S4)
    Dataset ingestion              :done,    ml1, 2026-08-10, 2026-09-05
    Lexical/host features          :         ml2, 2026-09-06, 2026-09-30
    Domain/content (WHOIS/DNS)     :         ml3, 2026-10-01, 2026-10-25
    ML-ready feature schema        :         ml4, 2026-10-26, 2026-11-20
    Baseline classifiers           :         ml5, 2026-11-21, 2026-12-15
    4-class XGBoost model          :         ml6, 2026-12-16, 2027-01-15
    Hyperparameter tuning          :         ml7, 2027-01-16, 2027-02-10
    Risk scoring + export          :         ml8, 2027-02-11, 2027-03-10

    section Kartik — Backend (S3 · S6)
    FastAPI skeleton & config      :done,    be1, 2026-08-10, 2026-09-05
    Validation & schemas           :         be2, 2026-09-06, 2026-09-30
    Orchestration service          :         be3, 2026-10-01, 2026-10-25
    Unified /analyze endpoint      :         be4, 2026-10-26, 2026-11-20
    VirusTotal/AbuseIPDB           :         be5, 2026-11-21, 2026-12-15
    Redis caching                  :         be6, 2026-12-16, 2027-01-15
    PostgreSQL schema              :         be7, 2027-01-16, 2027-02-10
    Blockchain + Docker + CI/CD    :         be8, 2027-02-11, 2027-03-10

    section Diya — Frontend (S2 · S5)
    React + Tailwind base          :active,  fe1, 2026-08-10, 2026-09-05
    Landing page + scanner UI      :         fe2, 2026-09-06, 2026-09-30
    Results/history/reports pages  :         fe3, 2026-10-01, 2026-10-25
    Responsive layout + API wiring :         fe4, 2026-10-26, 2026-11-20
    Chart.js analytics             :         fe5, 2026-11-21, 2026-12-15
    Threat-trend visualizations    :         fe6, 2026-12-16, 2027-01-15
    Report export                  :         fe7, 2027-01-16, 2027-02-10
    UI polish + demo prep          :         fe8, 2027-02-11, 2027-03-10
```

Live status with notes lives in **[PROGRESS.md](PROGRESS.md)**.

---

## 🧰 Technology Stack

| Layer | Stack | Purpose |
|---|---|---|
| 🖥️ **Frontend** | React.js · Tailwind CSS · Chart.js · Axios · React Router | Scanner UI, dashboards, analytics charts |
| ⚙️ **Backend** | Python · FastAPI · Pydantic · Uvicorn | REST APIs, validation, orchestration |
| 🧠 **ML** | Scikit-Learn · XGBoost · Pandas · NumPy | Feature extraction, 4-class classification |
| 🌐 **Threat Intel** | WHOIS/DNS · Scapy · VirusTotal · AbuseIPDB | IP/domain reputation, live signal |
| 🗄️ **Data & Infra** | PostgreSQL · Redis · Solidity · Ganache · Web3.py · Docker | Storage, caching, tamper-proof logs, deployment |

---

## 📂 Repository Layout

```
FinalYearProject/
├── frontend/    React dashboard          — Diya   (Sprint 2 & 5)
├── backend/     FastAPI orchestration    — Kartik (Sprint 3 & 6)
├── ml/          Feature eng + training   — Ishanvi (Sprint 1 & 4)
├── docs/        Diagrams, research notes
├── README.md    ← this file
├── PRD.md       Product requirements
└── PROGRESS.md  Live sprint/task tracker
```

Each of `frontend/`, `backend/`, `ml/` has its own `README.md` with setup steps for that layer.

---

## 👥 Team

| | Name | Role | Sprints |
|---|---|---|---|
| 🧑‍💻 | **Kartik Bhargava** | Team Lead — Backend & Integration | 3, 6 |
| 🤖 | **Ishanvi Agarwal** | ML Engineer | 1, 4 |
| 🎨 | **Diya Garg** | Frontend & UI/UX Developer | 2, 5 |

---

## 🚀 Getting Started

```bash
# Backend
cd backend && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload          # → http://127.0.0.1:8000/docs

# ML
cd ml && python -m venv .venv && .venv/Scripts/activate
pip install -r requirements.txt
python -m src.ingest

# Frontend (once scaffolded)
cd frontend && npm install && npm run dev
```

Full Docker Compose orchestration lands with the Sprint 6 deployment task.

---

<div align="center">

📄 Full requirements → **[PRD.md](PRD.md)** &nbsp;·&nbsp; 📊 Live status → **[PROGRESS.md](PROGRESS.md)**

</div>
