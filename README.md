# URL Attack Detection

## Team Members
- Kartik Bhargava
- Ishanvi Agarwal
- Diya Garg

## Project Description / Problem Statement
Traditional blacklist-based security systems can't catch newly created (zero-day) malicious URLs, since they only block links that are already known to be bad. This project detects and classifies URLs in real time — as Benign, Phishing, Malware, or Suspicious — by analyzing the URL's structure, host, and domain information together with live threat intelligence, instead of relying on the URL having been seen before.

## Objectives
- Dataset collection
- Feature extraction
- ML model training
- Detection system

## Tech Stack
- Python
- FastAPI
- PostgreSQL
- Scikit-learn / XGBoost

## Repository Structure
```
backend/
ml/
docs/
weekly_reports/
```

## Current Progress

### Week 1
- Built FastAPI backend skeleton (routing, environment config, CORS, health check)
- Assembled benign and malicious URL datasets
- Built dataset ingestion scripts

## Setup Instructions (optional for now)
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
