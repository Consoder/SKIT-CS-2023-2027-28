"""Tests for preprocessing pipeline."""

from __future__ import annotations

import pandas as pd
import pytest

from src.preprocessing import (
    build_feature_matrix,
    encode_categorical_features,
    handle_missing_values,
    scale_numeric_features,
)


class TestHandlingMissingValues:
    def test_drop_missing_values(self):
        df = pd.DataFrame({
            "feature1": [1, 2, None, 4],
            "feature2": [5, None, 7, 8],
            "label": ["a", "b", "c", "d"],
        })

        result = handle_missing_values(df, strategy="drop")
        assert len(result) == 2
        assert result.isnull().sum().sum() == 0

    def test_no_missing_values(self):
        df = pd.DataFrame({
            "feature1": [1, 2, 3, 4],
            "feature2": [5, 6, 7, 8],
        })

        result = handle_missing_values(df, strategy="drop")
        assert len(result) == 4


class TestCategoricalEncoding:
    def test_encode_tld(self):
        df = pd.DataFrame({
            "tld": ["com", "org", "com", "net"],
            "second_level_domain": ["example", "test", "google", "mozilla"],
        })

        result, encoders = encode_categorical_features(df, fit_encoders=True)

        assert "tld_encoded" in result.columns
        assert "second_level_domain_encoded" in result.columns
        assert len(encoders) == 2
        assert len(set(result["tld_encoded"])) == 3


class TestNumericScaling:
    def test_scale_numeric_features(self):
        df = pd.DataFrame({
            "url_length": [10, 20, 30, 40],
            "domain_length": [5, 10, 15, 20],
        })

        result, scaler = scale_numeric_features(df, fit_scaler=True)

        assert result["url_length"].mean() < 0.1
        # Real bug found 2026-09-24: StandardScaler normalizes to population
        # std (ddof=0), which is exactly 1.0 by construction - but pandas'
        # .std() defaults to SAMPLE std (ddof=1), giving 1.1547 for n=4 here.
        # That's not a bug in scale_numeric_features, it's this assertion
        # comparing two different definitions of "standard deviation".
        assert result["domain_length"].std(ddof=0) < 1.1

    def test_scaler_reusable(self):
        df1 = pd.DataFrame({
            "url_length": [10, 20],
            "domain_length": [5, 10],
        })

        df2 = pd.DataFrame({
            "url_length": [15, 25],
            "domain_length": [7, 12],
        })

        result1, scaler = scale_numeric_features(df1, fit_scaler=True)
        result2, _ = scale_numeric_features(df2, fit_scaler=False, scaler=scaler)

        assert result2 is not None
        assert len(result2) == len(df2)


class TestFeatureMatrix:
    def test_build_feature_matrix(self):
        df = pd.DataFrame({
            "url_length": [10, 20],
            "domain_length": [5, 10],
            "has_https": [True, False],
            "tld_encoded": [0, 1],
            "label": ["benign", "malicious"],
        })

        result = build_feature_matrix(df)

        assert "url_length" in result.columns
        assert "has_https" in result.columns
        assert "label" not in result.columns
        assert len(result.columns) >= 3
