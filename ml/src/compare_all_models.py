"""
Compare all models: Baseline + Advanced with class imbalance handling.

Baseline Models:
- Logistic Regression
- Random Forest
- Gradient Boosting
- SVM

Advanced Models (with SMOTE + class weights):
- LightGBM
- CatBoost

Usage:
    python -m src.compare_all_models
"""

from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from src.preprocessing import prepare_training_data
from src.models import train_baseline_models
from src.advanced_models import train_advanced_models
from src.evaluation import create_evaluation_report, print_detailed_metrics

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
logger = logging.getLogger(__name__)


def main():
    """Run complete model comparison pipeline."""
    print("\n" + "="*70)
    print("COMPLETE MODEL COMPARISON - BASELINE vs ADVANCED")
    print("="*70)

    processed_dir = Path(__file__).resolve().parent.parent / "data" / "processed"
    enriched_file = processed_dir / "urls_enriched.csv"

    if not enriched_file.exists():
        print(f"\nError: {enriched_file} not found.")
        print("Please run enrichment first: python -m src.enrichment")
        return

    print(f"\nLoading training data from {enriched_file}...")
    X_train, X_test, y_train, y_test, feature_names = prepare_training_data(str(enriched_file), return_feature_names=True)
    print(f"Loaded: {len(X_train)} train samples, {len(X_test)} test samples")
    print(f"Features: {len(feature_names)}")
    print(f"Class distribution (train):")
    unique, counts = np.unique(y_train, return_counts=True)
    for label, count in zip(unique, counts):
        print(f"  - {label}: {count} ({100*count/len(y_train):.1f}%)")

    all_results = {
        'baseline': None,
        'advanced': None,
        'comparison': {},
    }

    print("\n" + "="*70)
    print("TRAINING BASELINE MODELS (Logistic Regression, RF, GB, SVM)")
    print("="*70)

    try:
        baseline_results = train_baseline_models(X_train, X_test, y_train, y_test)
        all_results['baseline'] = baseline_results
        print("\nBaseline models trained successfully!")
    except Exception as e:
        logger.error(f"Error training baseline models: {e}")

    print("\n" + "="*70)
    print("TRAINING ADVANCED MODELS (LightGBM, CatBoost with SMOTE + Class Weights)")
    print("="*70)

    try:
        advanced_results = train_advanced_models(X_train, X_test, y_train, y_test)
        all_results['advanced'] = advanced_results
        print("\nAdvanced models trained successfully!")
    except Exception as e:
        logger.error(f"Error training advanced models: {e}")

    print("\n" + "="*70)
    print("MODEL PERFORMANCE SUMMARY")
    print("="*70)

    all_metrics = {}

    if baseline_results:
        for model_result in baseline_results:
            all_metrics[model_result.model_name] = model_result
            print_detailed_metrics(model_result, model_result.model_name)

    if advanced_results and 'metrics' in advanced_results:
        for model_name, metrics in advanced_results['metrics'].items():
            all_metrics[model_name] = metrics
            print_detailed_metrics(metrics, model_name)

    print("\n" + "="*70)
    print("GENERATING EVALUATION REPORT & VISUALIZATIONS")
    print("="*70)

    if advanced_results:
        comparison_table = create_evaluation_report(
            advanced_results,
            X_test,
            np.array([1 if y == 'malicious' else 0 for y in y_test]),
            feature_names=feature_names,
            output_dir="reports"
        )

        print("\n" + "="*70)
        print("MODEL RANKING")
        print("="*70)

        metrics_data = []
        for model_name, metrics in all_metrics.items():
            metrics_data.append({
                'Model': model_name,
                'Accuracy': metrics.accuracy,
                'Precision': metrics.precision,
                'Recall': metrics.recall,
                'F1': metrics.f1,
                'ROC-AUC': metrics.roc_auc,
            })

        ranking_df = pd.DataFrame(metrics_data).sort_values('F1', ascending=False)

        print("\nRanked by F1 Score (best balance of precision & recall):")
        for idx, row in ranking_df.iterrows():
            print(f"{idx+1}. {row['Model']:20s} - F1: {row['F1']:.4f}, ROC-AUC: {row['ROC-AUC']:.4f}")

        ranking_df.to_csv("reports/model_ranking.csv", index=False)

    print("\n" + "="*70)
    print("ANALYSIS COMPLETE")
    print("="*70)
    print("\nReports saved to: reports/")
    print("  - model_comparison.csv")
    print("  - model_ranking.csv")
    print("  - <model_name>/roc_curve.png")
    print("  - <model_name>/pr_curve.png")
    print("  - <model_name>/confusion_matrix.png")
    print("  - <model_name>/feature_importance.png")


if __name__ == "__main__":
    main()
