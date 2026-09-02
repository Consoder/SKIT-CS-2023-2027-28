# ML — URL Dataset Ingestion

Sprint 1 (Task 1): assemble benign/malicious URL datasets for model training.

## What it does

`src/ingest.py` downloads labeled URL data from public sources, validates and
normalizes it, dedupes across sources, and writes a single clean dataset to
`data/processed/urls_dataset.csv` with columns: `url, label, source, ingested_at`.

Current source:
- [`faizann24/Using-machine-learning-to-detect-malicious-URLs`](https://github.com/faizann24/Using-machine-learning-to-detect-malicious-URLs) — ~420k labeled URLs (`good`/`bad`), mapped to `benign`/`malicious`.

Sources are declared as a list in `ingest.py` (`SOURCES`) — add another `Source(...)`
entry to bring in more data later (e.g. PhishTank, OpenPhish, Tranco top sites)
without changing the pipeline logic.

## Setup

```bash
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt
```

## Run

```bash
python -m src.ingest            # uses cached raw file if present
python -m src.ingest --force    # re-download raw sources
```

Latest run: 410,457 rows after cleaning/dedup (344,800 benign / 65,657 malicious).

## Tests

```bash
pytest -q
```

Covers URL validation edge cases (including malformed bracket sequences that
crash Python's stdlib `urlparse`) and label normalization — no network needed.

## Roadmap (per project sprint plan)

- [x] Sprint 1.1 — benign/malicious URL dataset ingestion
- [ ] Sprint 1.2 — lexical & host-based feature extraction (due 30-09-2026)
- [ ] Sprint 1.3 — domain/content features via WHOIS/DNS enrichment (due 25-10-2026)
- [ ] Sprint 1.4 — ML-ready feature schema + preprocessing pipeline (due 20-11-2026)
- [ ] Sprint 4.1 — baseline Scikit-Learn classifiers (due 15-12-2026)
- [ ] Sprint 4.2 — 4-class XGBoost model (Benign/Phishing/Malware/Suspicious) (due 15-01-2027)
- [ ] Sprint 4.3 — hyperparameter tuning & k-fold cross-validation (due 10-02-2027)
- [ ] Sprint 4.4 — confidence-based risk scoring + model export (due 10-03-2027)
