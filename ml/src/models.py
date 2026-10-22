"""
Sprint 4, Task 1 — Baseline Scikit-Learn classifiers for URL threat detection.

Models:
- Logistic Regression (baseline, interpretable)
- Random Forest (ensemble, feature importance)
- Gradient Boosting (strong baseline)
- SVM (non-linear boundary)

Evaluation:
- Accuracy, Precision, Recall, F1
- Confusion matrix
- ROC-AUC curve
- Feature importance

Usage:
    from src.models import train_baseline_models
    from src.preprocessing import prepare_training_data

    X_train, X_test, y_train, y_test = prepare_training_data("data/processed/urls_enriched.csv")
    results = train_baseline_models(X_train, X_test, y_train, y_test)
"""

from __future__ import annotations

import logging
from typing import NamedTuple

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.svm import SVC

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
logger = logging.getLogger(__name__)


class ModelMetrics(NamedTuple):
    model_name: str
    accuracy: float
    precision: float
    recall: float
    f1: float
    roc_auc: float
    confusion_matrix: list


def _encode_labels(y_true: np.ndarray) -> tuple[np.ndarray, dict]:
    """Convert string labels to numeric."""
    classes = np.unique(y_true)
    label_map = {cls: idx for idx, cls in enumerate(classes)}
    y_encoded = np.array([label_map[y] for y in y_true])
    return y_encoded, label_map


def evaluate_model(
    model_name: str,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_pred_proba: np.ndarray = None,
) -> ModelMetrics:
    """Evaluate model performance."""
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average="weighted", zero_division=0)
    recall = recall_score(y_true, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)

    if y_pred_proba is not None and y_pred_proba.ndim > 1:
        try:
            if y_pred_proba.shape[1] == 2:
                roc_auc = roc_auc_score(y_true, y_pred_proba[:, 1])
            else:
                roc_auc = roc_auc_score(y_true, y_pred_proba, multi_class="ovr", average="weighted")
        except Exception:
            roc_auc = 0.0
    else:
        roc_auc = 0.0

    conf_matrix = confusion_matrix(y_true, y_pred).tolist()

    return ModelMetrics(
        model_name=model_name,
        accuracy=accuracy,
        precision=precision,
        recall=recall,
        f1=f1,
        roc_auc=roc_auc,
        confusion_matrix=conf_matrix,
    )


def train_logistic_regression(X_train, X_test, y_train, y_test) -> ModelMetrics:
    """Train Logistic Regression baseline."""
    logger.info("Training Logistic Regression...")
    y_train_enc, label_map = _encode_labels(y_train.values)
    y_test_enc = np.array([label_map[y] for y in y_test.values])

    model = LogisticRegression(max_iter=1000, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train_enc)

    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    return evaluate_model("Logistic Regression", y_test_enc, y_pred, y_pred_proba)


def train_random_forest(X_train, X_test, y_train, y_test) -> ModelMetrics:
    """Train Random Forest baseline."""
    logger.info("Training Random Forest...")
    y_train_enc, label_map = _encode_labels(y_train.values)
    y_test_enc = np.array([label_map[y] for y in y_test.values])

    model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    model.fit(X_train, y_train_enc)

    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    logger.info("Top 10 important features:")
    feature_importance = sorted(
        zip(X_train.columns, model.feature_importances_),
        key=lambda x: x[1],
        reverse=True,
    )
    for feat, importance in feature_importance[:10]:
        logger.info("  %s: %.4f", feat, importance)

    return evaluate_model("Random Forest", y_test_enc, y_pred, y_pred_proba)


def train_gradient_boosting(X_train, X_test, y_train, y_test) -> ModelMetrics:
    """Train Gradient Boosting baseline."""
    logger.info("Training Gradient Boosting...")
    y_train_enc, label_map = _encode_labels(y_train.values)
    y_test_enc = np.array([label_map[y] for y in y_test.values])

    model = GradientBoostingClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train_enc)

    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    return evaluate_model("Gradient Boosting", y_test_enc, y_pred, y_pred_proba)


def train_svm(X_train, X_test, y_train, y_test) -> ModelMetrics:
    """Train SVM baseline."""
    logger.info("Training SVM (this may take a while)...")
    y_train_enc, label_map = _encode_labels(y_train.values)
    y_test_enc = np.array([label_map[y] for y in y_test.values])

    model = SVC(kernel="rbf", probability=True, random_state=42)
    model.fit(X_train, y_train_enc)

    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)

    return evaluate_model("SVM", y_test_enc, y_pred, y_pred_proba)


def train_baseline_models(X_train, X_test, y_train, y_test) -> dict:
    """Train all baseline models and return results."""
    results = {}

    results["logistic_regression"] = train_logistic_regression(X_train, X_test, y_train, y_test)
    results["random_forest"] = train_random_forest(X_train, X_test, y_train, y_test)
    results["gradient_boosting"] = train_gradient_boosting(X_train, X_test, y_train, y_test)
    results["svm"] = train_svm(X_train, X_test, y_train, y_test)

    return results


if __name__ == "__main__":
    from pathlib import Path

    from src.preprocessing import prepare_training_data

    processed_dir = Path(__file__).resolve().parent.parent / "data" / "processed"
    input_file = processed_dir / "urls_enriched.csv"

    X_train, X_test, y_train, y_test = prepare_training_data(input_file)

    results = train_baseline_models(X_train, X_test, y_train, y_test)

    print("\n" + "=" * 60)
    print("BASELINE MODEL RESULTS")
    print("=" * 60)
    for name, metrics in results.items():
        print(f"\n{metrics.model_name}:")
        print(f"  Accuracy:  {metrics.accuracy:.4f}")
        print(f"  Precision: {metrics.precision:.4f}")
        print(f"  Recall:    {metrics.recall:.4f}")
        print(f"  F1-Score:  {metrics.f1:.4f}")
        print(f"  ROC-AUC:   {metrics.roc_auc:.4f}")

    best_model = max(results.items(), key=lambda x: x[1].f1)
    print(f"\n{'=' * 60}")
    print(f"Best model (by F1): {best_model[1].model_name}")
    print(f"{'=' * 60}")
