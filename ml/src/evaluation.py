"""
Comprehensive evaluation suite with visualizations.

Features:
- Confusion matrices
- ROC curves
- Precision-Recall curves
- Feature importance plots
- Model comparison dashboard
- Detailed metrics reports

Usage:
    from src.evaluation import create_evaluation_report
    create_evaluation_report(models_results, X_test, y_test)
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    roc_curve,
    precision_recall_curve,
    roc_auc_score,
    auc,
)

try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
logger = logging.getLogger(__name__)


def plot_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, model_name: str, save_path: str = None):
    """Plot confusion matrix."""
    if not HAS_MATPLOTLIB:
        logger.warning("Matplotlib not installed. Skipping plots.")
        return

    from sklearn.metrics import confusion_matrix

    cm = confusion_matrix(y_true, y_pred)

    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=True)
    plt.title(f'Confusion Matrix - {model_name}')
    plt.xlabel('Predicted')
    plt.ylabel('True')

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"Saved confusion matrix: {save_path}")
    plt.close()


def plot_roc_curve(y_true: np.ndarray, y_pred_proba: np.ndarray, model_name: str, save_path: str = None):
    """Plot ROC curve."""
    if not HAS_MATPLOTLIB:
        return

    fpr, tpr, _ = roc_curve(y_true, y_pred_proba)
    roc_auc = auc(fpr, tpr)

    plt.figure(figsize=(8, 6))
    plt.plot(fpr, tpr, label=f'{model_name} (AUC = {roc_auc:.3f})', linewidth=2)
    plt.plot([0, 1], [0, 1], 'k--', label='Random Classifier')
    plt.xlabel('False Positive Rate')
    plt.ylabel('True Positive Rate')
    plt.title(f'ROC Curve - {model_name}')
    plt.legend(loc='lower right')
    plt.grid(alpha=0.3)

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"Saved ROC curve: {save_path}")
    plt.close()


def plot_precision_recall_curve(y_true: np.ndarray, y_pred_proba: np.ndarray, model_name: str, save_path: str = None):
    """Plot Precision-Recall curve."""
    if not HAS_MATPLOTLIB:
        return

    precision, recall, _ = precision_recall_curve(y_true, y_pred_proba)
    pr_auc = auc(recall, precision)

    plt.figure(figsize=(8, 6))
    plt.plot(recall, precision, label=f'{model_name} (AUC = {pr_auc:.3f})', linewidth=2)
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title(f'Precision-Recall Curve - {model_name}')
    plt.legend(loc='best')
    plt.grid(alpha=0.3)

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"Saved PR curve: {save_path}")
    plt.close()


def plot_feature_importance(
    model,
    feature_names: list,
    model_name: str,
    top_n: int = 15,
    save_path: str = None
):
    """Plot feature importance from model."""
    if not HAS_MATPLOTLIB:
        return

    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
    elif hasattr(model, 'feature_importance'):
        importances = model.feature_importance()
    else:
        logger.warning(f"Model {model_name} doesn't support feature importance")
        return

    indices = np.argsort(importances)[-top_n:]
    top_features = [feature_names[i] for i in indices]
    top_importances = importances[indices]

    plt.figure(figsize=(10, 6))
    plt.barh(range(len(top_features)), top_importances)
    plt.yticks(range(len(top_features)), top_features)
    plt.xlabel('Importance')
    plt.title(f'Top {top_n} Features - {model_name}')
    plt.tight_layout()

    if save_path:
        plt.savefig(save_path, dpi=300, bbox_inches='tight')
        logger.info(f"Saved feature importance plot: {save_path}")
    plt.close()


def create_metrics_comparison_table(metrics_dict: dict) -> pd.DataFrame:
    """Create comparison table of all models."""
    data = []

    for model_name, metrics in metrics_dict.items():
        data.append({
            'Model': model_name.upper(),
            'Accuracy': f"{metrics.accuracy:.4f}",
            'Precision': f"{metrics.precision:.4f}",
            'Recall': f"{metrics.recall:.4f}",
            'F1': f"{metrics.f1:.4f}",
            'ROC-AUC': f"{metrics.roc_auc:.4f}",
        })

    df = pd.DataFrame(data)
    return df


def create_evaluation_report(
    models_results: dict,
    X_test: np.ndarray,
    y_test: np.ndarray,
    feature_names: list = None,
    output_dir: str = "reports"
):
    """
    Create comprehensive evaluation report with visualizations.

    Args:
        models_results: Dictionary with models and metrics
        X_test: Test features
        y_test: Test labels (numeric)
        feature_names: List of feature names
        output_dir: Directory to save reports
    """
    if not HAS_MATPLOTLIB:
        logger.warning("Matplotlib not installed. Generating text report only.")
        return

    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    logger.info(f"\n" + "="*70)
    logger.info("GENERATING EVALUATION REPORT")
    logger.info("="*70)

    models = models_results.get('models', {})
    metrics = models_results.get('metrics', {})

    print("\n" + "="*70)
    print("MODEL PERFORMANCE COMPARISON")
    print("="*70)

    comparison_table = create_metrics_comparison_table(metrics)
    print(comparison_table.to_string(index=False))

    print("\n" + "="*70)
    print("SAVING VISUALIZATIONS")
    print("="*70)

    for model_name, model in models.items():
        logger.info(f"\nProcessing {model_name}...")

        plot_dir = output_path / model_name
        plot_dir.mkdir(exist_ok=True)

        try:
            if hasattr(model, 'predict_proba'):
                y_pred_proba = model.predict_proba(X_test)[:, 1]
            elif hasattr(model, 'predict'):
                y_pred_proba = model.predict(X_test)
                if hasattr(y_pred_proba[0], '__iter__'):
                    y_pred_proba = y_pred_proba[:, 1]
            else:
                y_pred_proba = None

            if y_pred_proba is not None:
                y_pred_binary = (y_pred_proba > 0.5).astype(int)

                plot_roc_curve(
                    y_test,
                    y_pred_proba,
                    model_name,
                    save_path=str(plot_dir / "roc_curve.png")
                )

                plot_precision_recall_curve(
                    y_test,
                    y_pred_proba,
                    model_name,
                    save_path=str(plot_dir / "pr_curve.png")
                )

                plot_confusion_matrix(
                    y_test,
                    y_pred_binary,
                    model_name,
                    save_path=str(plot_dir / "confusion_matrix.png")
                )

                if feature_names:
                    plot_feature_importance(
                        model,
                        feature_names,
                        model_name,
                        save_path=str(plot_dir / "feature_importance.png")
                    )

        except Exception as e:
            logger.warning(f"Error processing {model_name}: {e}")

    comparison_table.to_csv(output_path / "model_comparison.csv", index=False)
    logger.info(f"\nReport saved to: {output_path}")

    return comparison_table


def print_detailed_metrics(metrics: object, model_name: str):
    """Print detailed metrics for a model."""
    print(f"\n{model_name} - Detailed Metrics:")
    print(f"  Accuracy:         {metrics.accuracy:.4f}")
    print(f"  Precision:        {metrics.precision:.4f} (True Positives / Predicted Positives)")
    print(f"  Recall:           {metrics.recall:.4f} (True Positives / Actual Positives)")
    print(f"  F1 Score:         {metrics.f1:.4f} (Harmonic mean of Precision & Recall)")
    print(f"  ROC-AUC:          {metrics.roc_auc:.4f} (Area Under ROC Curve)")
    print(f"  Confusion Matrix:\n{metrics.confusion_matrix}")


if __name__ == "__main__":
    print("Evaluation module loaded. Use create_evaluation_report() to generate reports.")
