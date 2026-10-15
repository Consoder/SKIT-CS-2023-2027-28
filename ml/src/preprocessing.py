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


def scale_numeric_features(
    df: pd.DataFrame, fit_scaler: bool = True, scaler: StandardScaler = None
) -> tuple[pd.DataFrame, StandardScaler]:
    """Scale numeric features using StandardScaler."""
    df = df.copy()
    numeric_cols = [c for c in NUMERIC_FEATURES if c in df.columns]

    if fit_scaler:
        scaler = StandardScaler()
        df[numeric_cols] = scaler.fit_transform(df[numeric_cols])
        logger.info("Scaled %d numeric features", len(numeric_cols))
    elif scaler:
        df[numeric_cols] = scaler.transform(df[numeric_cols])

    return df, scaler


def build_feature_matrix(df: pd.DataFrame, encoders: dict = None) -> pd.DataFrame:
    """Build final feature matrix for model training."""
    df = df.copy()

    feature_cols = []

    feature_cols.extend([c for c in NUMERIC_FEATURES if c in df.columns])
    feature_cols.extend([f"{c}_encoded" for c in CATEGORICAL_FEATURES if f"{c}_encoded" in df.columns])
    feature_cols.extend([c for c in BOOLEAN_FEATURES if c in df.columns])

    missing_cols = [c for c in feature_cols if c not in df.columns]
    if missing_cols:
        logger.warning("Missing columns: %s", missing_cols)
        feature_cols = [c for c in feature_cols if c in df.columns]

    logger.info("Final feature matrix: %d features", len(feature_cols))
    return df[feature_cols].copy()


def prepare_training_data(
    filepath: str | Path,
    config: PreprocessingConfig = PreprocessingConfig(),
    return_scaler: bool = False,
    return_encoders: bool = False,
    return_feature_names: bool = False,
) -> tuple:
    """
    Prepare complete training dataset.

    Returns:
        (X_train, X_test, y_train, y_test) or with scaler/encoders/feature_names if requested
    """
    df = load_data(filepath)

    df = handle_missing_values(df, strategy=config.handle_missing)

    if config.encode_categoricals:
        df, encoders = encode_categorical_features(df, fit_encoders=True)
    else:
        encoders = {}

    if config.scale_features:
        df, scaler = scale_numeric_features(df, fit_scaler=True)
    else:
        scaler = None

    X = build_feature_matrix(df, encoders)
    y = df["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=config.test_size,
        random_state=config.random_state,
        stratify=y,
    )

    logger.info(
        "Train/test split: %d train, %d test (%.1f%%)",
        len(X_train),
        len(X_test),
        config.test_size * 100,
    )
    logger.info("Class distribution (train): %s", dict(y_train.value_counts()))
    logger.info("Class distribution (test): %s", dict(y_test.value_counts()))

    result = [X_train, X_test, y_train, y_test]
    if return_scaler:
        result.append(scaler)
    if return_encoders:
        result.append(encoders)
    if return_feature_names:
        result.append(list(X.columns))

    return tuple(result)


if __name__ == "__main__":
    processed_dir = Path(__file__).resolve().parent.parent / "data" / "processed"
    input_file = processed_dir / "urls_enriched.csv"

    X_train, X_test, y_train, y_test, scaler, encoders = prepare_training_data(
        input_file, return_scaler=True, return_encoders=True
    )

    print(f"\nX_train shape: {X_train.shape}")
    print(f"X_test shape: {X_test.shape}")
    print(f"\nFeature names: {list(X_train.columns)}")
    print(f"\nTraining data summary:")
    print(X_train.describe())

    output_dir = processed_dir
    X_train.to_csv(output_dir / "X_train.csv", index=False)
    X_test.to_csv(output_dir / "X_test.csv", index=False)
    y_train.to_csv(output_dir / "y_train.csv", index=False)
    y_test.to_csv(output_dir / "y_test.csv", index=False)

    print(f"\nSaved training/test data to {output_dir}/")
