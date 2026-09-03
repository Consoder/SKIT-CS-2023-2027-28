# 🛡️ URL Attack Detection

Real-time detection and classification of malicious URLs using Machine Learning, IP/domain threat intelligence, and a FastAPI backend.

## 👥 Team Members
- Kartik Bhargava — Backend & Integration
- Ishanvi Agarwal — Machine Learning
- Diya Garg — Frontend & UI/UX

---

## 🎯 Problem Statement

Traditional blacklist-based security systems can't catch newly created (zero-day) malicious URLs, since they only block links that are already known to be bad. They also stitch together URL, IP, and threat-intelligence signals poorly.

This project detects and classifies URLs in real time — as **Benign**, **Phishing**, **Malware**, or **Suspicious** — by analyzing the URL's structure, host, and domain information together with live threat intelligence, instead of relying on the URL having been seen before.

## 🧩 What We're Building

A system that takes a submitted URL and returns:
- A **verdict** (Benign / Phishing / Malware / Suspicious)
- A **confidence-based risk score**
- The **evidence** behind it — extracted URL features and threat-intel signals

Plus a dashboard for scan history, threat-trend analytics, and exportable reports.

## ⚙️ How We're Building It

1. **Feature engineering first** — every URL is broken into lexical, host-based, and domain features before any model sees it.
2. **ML does the classification** — a trained model (Scikit-learn / XGBoost) scores each URL, so even previously-unseen (zero-day) URLs can be flagged on structural signal, not just a known-bad list.
3. **External threat intel corroborates the verdict** — VirusTotal / AbuseIPDB results are merged in, not blindly trusted.
4. **Backend orchestrates everything** — one FastAPI endpoint validates the URL, runs feature extraction + ML + threat-intel, and returns one unified result.

---

## 🏗️ Architecture

```mermaid
flowchart TD
    U["User"] -->|submits URL| FE["Frontend Dashboard"]
    FE -->|POST /api/v1/analyze| API["FastAPI Backend"]
    API --> FEAT["Feature Extraction"]
    API --> TI["Threat Intelligence\n(VirusTotal / AbuseIPDB)"]
    FEAT --> ML["ML Classification\n(Scikit-learn / XGBoost)"]
    ML --> API
    TI --> API
    API --> DB[("PostgreSQL")]
    API -->|verdict + risk score| FE
```

## 🔄 Request Flow

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as FastAPI /analyze
    participant Feat as Feature Extraction
    participant TI as VirusTotal / AbuseIPDB
    participant ML as ML Model
    participant DB as PostgreSQL

    User->>FE: Submit URL
    FE->>API: POST /api/v1/analyze
    API->>API: Validate & sanitize
    API->>Feat: Extract features
    API->>TI: Query reputation
    Feat-->>API: Feature vector
    TI-->>API: Reputation signal
    API->>ML: Classify(features)
    ML-->>API: Verdict + confidence
    API->>DB: Persist analysis
    API-->>FE: Verdict + risk score + evidence
    FE-->>User: Rendered result
```

## 🗃️ Data Model (proposed)

```mermaid
erDiagram
    USERS ||--o{ URL_ANALYSIS : submits
    URL_ANALYSIS ||--|| THREAT_INTELLIGENCE : enriched_by

    USERS {
        uuid id PK
        string email
        timestamp created_at
    }
    URL_ANALYSIS {
        uuid id PK
        uuid user_id FK
        string url
        string verdict
        float risk_score
        timestamp analyzed_at
    }
    THREAT_INTELLIGENCE {
        uuid id PK
        uuid analysis_id FK
        string source
        jsonb raw_response
    }
```

---

## 🎯 Objectives
- Dataset collection
- Feature extraction
- ML model training
- Detection system

## 🧰 Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React.js, Tailwind CSS, Chart.js |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| ML | Scikit-learn, XGBoost, Pandas, NumPy |
| Threat Intel | WHOIS/DNS, VirusTotal, AbuseIPDB |
| Data | PostgreSQL |

## 📂 Repository Structure

```
backend/
ml/
docs/
weekly_reports/
```

## 📅 Timeline

```mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    axisFormat %b %y

    section ML
    Dataset ingestion         :done, ml1, 2026-08-10, 2026-09-05
    Feature extraction        : ml2, 2026-09-06, 2026-10-25
    Model training            : ml3, 2026-10-26, 2027-01-15

    section Backend
    FastAPI skeleton          :done, be1, 2026-08-10, 2026-09-05
    Orchestration + /analyze  : be2, 2026-09-06, 2026-11-20
    Threat intel + deploy     : be3, 2026-11-21, 2027-03-10

    section Frontend
    Dashboard base            : fe1, 2026-08-10, 2026-09-05
    Scanner + results UI      : fe2, 2026-09-06, 2026-10-25
    Analytics + export        : fe3, 2026-10-26, 2027-03-10
```

## 📈 Current Progress

### Week 1
- Built FastAPI backend skeleton (routing, environment config, CORS, health check)
- Assembled benign and malicious URL datasets
- Built dataset ingestion scripts

## 🚀 Setup Instructions

```bash
git clone <repo-url>

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload

# ML
cd ml
pip install -r requirements.txt
python -m src.ingest
```
