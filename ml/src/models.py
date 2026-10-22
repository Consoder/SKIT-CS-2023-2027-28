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


