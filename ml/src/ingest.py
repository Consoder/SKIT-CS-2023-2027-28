"""
Sprint 1, Task 1 — assemble benign/malicious URL datasets for the
URL threat-detection model.

Downloads raw labeled URL data from public sources, validates and
normalizes it into a single clean dataset with columns:
    url, label ("benign" | "malicious"), source, ingested_at

Usage:
    python -m src.ingest
    python -m src.ingest --force        # re-download even if raw file exists
"""

from __future__ import annotations

import argparse
import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import pandas as pd
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
PROCESSED_DIR = BASE_DIR / "data" / "processed"


@dataclass(frozen=True)
class Source:
    name: str
    url: str
    url_col: str
    label_col: str
    label_map: dict[str, str]  # raw label -> "benign" | "malicious"


SOURCES: list[Source] = [
    Source(
        name="faizann24_urldata",
        url="https://raw.githubusercontent.com/faizann24/Using-machine-learning-to-detect-malicious-URLs/master/data/data.csv",
        url_col="url",
        label_col="label",
        label_map={"good": "benign", "bad": "malicious"},
    ),
]


def download_raw(source: Source, force: bool = False) -> Path:
    dest = RAW_DIR / f"{source.name}.csv"
    if dest.exists() and not force:
        logger.info("raw file already present, skipping download: %s", dest.name)
        return dest

    logger.info("downloading %s -> %s", source.url, dest.name)
    response = requests.get(source.url, timeout=30)
    response.raise_for_status()
    dest.write_bytes(response.content)
    return dest


def _is_valid_url(value: str) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    candidate = value.strip()
    if "://" not in candidate:
        candidate = f"http://{candidate}"
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return False
    return bool(parsed.netloc)


def load_and_clean(source: Source, raw_path: Path) -> pd.DataFrame:
    df = pd.read_csv(raw_path, usecols=[source.url_col, source.label_col], on_bad_lines="skip", engine="python")
    df = df.rename(columns={source.url_col: "url", source.label_col: "label"})

    df["label"] = df["label"].astype(str).str.strip().str.lower().map(source.label_map)
    df = df.dropna(subset=["url", "label"])

    df["url"] = df["url"].astype(str).str.strip()
    df = df[df["url"].apply(_is_valid_url)]

    df["source"] = source.name
    logger.info(
        "%s: kept %d rows (benign=%d, malicious=%d) after cleaning",
        source.name,
        len(df),
        (df["label"] == "benign").sum(),
        (df["label"] == "malicious").sum(),
    )
    return df[["url", "label", "source"]]


def ingest(force: bool = False) -> pd.DataFrame:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    frames = []
    for source in SOURCES:
        raw_path = download_raw(source, force=force)
        frames.append(load_and_clean(source, raw_path))

    combined = pd.concat(frames, ignore_index=True)
    before = len(combined)
    combined = combined.drop_duplicates(subset=["url"]).reset_index(drop=True)
    logger.info("dropped %d duplicate URLs across sources", before - len(combined))

    combined["ingested_at"] = datetime.now(timezone.utc).isoformat()

    out_path = PROCESSED_DIR / "urls_dataset.csv"
    combined.to_csv(out_path, index=False)

    logger.info(
        "wrote %d rows to %s (benign=%d, malicious=%d)",
        len(combined),
        out_path,
        (combined["label"] == "benign").sum(),
        (combined["label"] == "malicious").sum(),
    )
    return combined


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest benign/malicious URL datasets.")
    parser.add_argument("--force", action="store_true", help="re-download raw sources even if cached")
    args = parser.parse_args()
    ingest(force=args.force)


if __name__ == "__main__":
    main()
