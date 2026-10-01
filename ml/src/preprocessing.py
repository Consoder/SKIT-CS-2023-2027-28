"""
Sprint 1, Task 4 — ML-ready feature preprocessing and schema finalization.
Preprocessing steps:
1. Handle missing values
2. Scale numeric features
3. Encode categorical features (TLD, second_level_domain)
4. Create train/test split
5. Export ML-ready features
Usage:
    from src.preprocessing import prepare_training_data
    X_train, X_test, y_train, y_test = prepare_training_data(
        "data/processed/urls_enriched.csv",
        test_size=0.2
    )
"""
from __future__ import annotations
import logging
from pathlib import Path
from typing import NamedTuple
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
logger = logging.getLogger(__name__)

class PreprocessingConfig(NamedTuple):
    test_size: float = 0.2
    random_state: int = 42
    handle_missing: str = "drop"
    scale_features: bool = True
    encode_categoricals: bool = True

NUMERIC_FEATURES = [
    "url_length",
    "domain_length",
    "path_length",
    "query_length",
    "fragment_length",
    "num_dots",
    "num_hyphens",
    "num_underscores",
    "num_slashes",
    "num_query_params",
    "num_subdomains",
    "domain_entropy",
    "url_entropy",
    "subdomain_count",
]
CATEGORICAL_FEATURES = [
    "tld",
    "second_level_domain",
]
BOOLEAN_FEATURES = [
    "has_ip_address",
    "has_http",
    "has_https",
    "has_suspicious_chars",
    "is_ipv4",
    "is_ipv6",
    "has_numeric_domain",
    "is_resolvable",
    "has_a_record",
    "has_aaaa_record",
    "has_mx_record",
    "resolves_to_private_ip",
]

def load_data(filepath: str | Path) -> pd.DataFrame:
    """Load enriched dataset."""
    logger.info("Loading data from %s", filepath)
    df = pd.read_csv(filepath)
    logger.info("Loaded %d rows, %d columns", len(df), len(df.columns))
    return df

def handle_missing_values(df: pd.DataFrame, strategy: str = "drop") -> pd.DataFrame:
    """Handle missing values in features."""
    df = df.copy()
    missing = df.isnull().sum()
    if missing.sum() > 0:
        logger.info("Missing values found:\n%s", missing[missing > 0])
        if strategy == "drop":
            before = len(df)
            df = df.dropna()
            logger.info("Dropped %d rows with missing values", before - len(df))
        elif strategy == "mean":
            for col in NUMERIC_FEATURES:
                if col in df.columns and df[col].isnull().any():
                    df[col].fillna(df[col].mean(), inplace=True)
        elif strategy == "median":
            for col in NUMERIC_FEATURES:
                if col in df.columns and df[col].isnull().any():
                    df[col].fillna(df[col].median(), inplace=True)
    return df

def encode_categorical_features(
    df: pd.DataFrame, fit_encoders: bool = True
) -> tuple[pd.DataFrame, dict]:
    """Encode categorical features using label encoding."""
    df = df.copy()
    encoders = {}
    for col in CATEGORICAL_FEATURES:
        if col not in df.columns:
            continue
        if fit_encoders:
            encoder = LabelEncoder()
            df[f"{col}_encoded"] = encoder.fit_transform(df[col].astype(str))
            encoders[col] = encoder
            logger.info("Encoded %s: %d unique values", col, len(encoder.classes_))
        else:
            if col in encoders:
                df[f"{col}_encoded"] = encoders[col].transform(df[col].astype(str))
    return df, encoders
