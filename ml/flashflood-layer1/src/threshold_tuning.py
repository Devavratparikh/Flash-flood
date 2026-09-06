"""
Threshold tuning for the Layer 1 nowcast model.

IMPORTANT: threshold is chosen using a VALIDATION set carved out of the
training years (2020-2022 train / 2023 validate), NOT the test set (2024).
Picking a threshold by looking at test-set performance would let test
information leak into a modeling decision -- the same category of mistake
as a random train/test split, just subtler. The test set is only touched
once, at the very end, with the threshold already locked in.

Optimizes for F2 score (weights recall 2x as much as precision) by default,
since for a flood warning system a missed flood is far more costly than a
false alarm. Also prints a table across thresholds so the tradeoff is visible
and the final choice is a documented decision, not a default.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.metrics import (
    precision_recall_curve, fbeta_score,
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score,
)
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN

TRAIN_PATH = Path("data/processed/train.csv")
TEST_PATH = Path("data/processed/test.csv")

VAL_CUTOFF_DATE = "2023-01-01"  # train: 2020-2022, validate: 2023
BETA = 2.0  # F2 score: recall weighted 2x as important as precision


def train_xgb(X_train, y_train):
    n_neg, n_pos = (y_train == 0).sum(), (y_train == 1).sum()
    model = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=n_neg / n_pos,
        eval_metric="aucpr", random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def find_best_threshold(y_true, y_proba, beta=BETA):
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
    # precision_recall_curve returns one more point than thresholds; align them
    precisions, recalls = precisions[:-1], recalls[:-1]

    f_beta_scores = (1 + beta**2) * (precisions * recalls) / (beta**2 * precisions + recalls + 1e-9)
    best_idx = np.argmax(f_beta_scores)

    print(f"=== Threshold sweep (validation set, optimizing F{beta:.0f}) ===")
    sample_idxs = np.linspace(0, len(thresholds) - 1, 15).astype(int)
    for i in sample_idxs:
        marker = "  <-- best" if i == best_idx else ""
        print(f"threshold={thresholds[i]:.3f}  precision={precisions[i]:.3f}  "
              f"recall={recalls[i]:.3f}  F{beta:.0f}={f_beta_scores[i]:.3f}{marker}")

    return thresholds[best_idx]


def evaluate_at_threshold(y_true, y_proba, threshold, label):
    y_pred = (y_proba >= threshold).astype(int)
    print(f"\n=== {label} @ threshold={threshold:.3f} ===")
    cm = confusion_matrix(y_true, y_pred)
    print("         Predicted 0   Predicted 1")
    print(f"Actual 0    {cm[0][0]:>6}        {cm[0][1]:>6}")
    print(f"Actual 1    {cm[1][0]:>6}        {cm[1][1]:>6}")
    print(classification_report(y_true, y_pred, target_names=["No Flood", "Flood"]))


def main():
    train_full = pd.read_csv(TRAIN_PATH, parse_dates=["date"])
    test_df = pd.read_csv(TEST_PATH, parse_dates=["date"])

    # Split training years further: 2020-2022 to fit, 2023 to tune threshold
    fit_df = train_full[train_full["date"] < VAL_CUTOFF_DATE]
    val_df = train_full[train_full["date"] >= VAL_CUTOFF_DATE]
    print(f"Fit: {len(fit_df):,} rows ({fit_df['date'].min().date()} to {fit_df['date'].max().date()})")
    print(f"Validate: {len(val_df):,} rows ({val_df['date'].min().date()} to {val_df['date'].max().date()})")

    X_fit, y_fit = fit_df[FEATURE_COLUMNS], fit_df[TARGET_COLUMN]
    X_val, y_val = val_df[FEATURE_COLUMNS], val_df[TARGET_COLUMN]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COLUMN]

    # Step 1: fit on 2020-2022 only, tune threshold on 2023
    model_for_tuning = train_xgb(X_fit, y_fit)
    val_proba = model_for_tuning.predict_proba(X_val)[:, 1]
    best_threshold = find_best_threshold(y_val, val_proba)
    print(f"\n>>> Selected threshold: {best_threshold:.3f} (chosen on validation, before touching test)")

    evaluate_at_threshold(y_val, val_proba, best_threshold, "VALIDATION (2023)")
    evaluate_at_threshold(y_val, val_proba, 0.5, "VALIDATION (2023) at default 0.5 -- for comparison")

    # Step 2: refit on ALL training years (2020-2023) with the threshold now locked,
    # then evaluate on test (2024) exactly once.
    model_final = train_xgb(train_full[FEATURE_COLUMNS], train_full[TARGET_COLUMN])
    test_proba = model_final.predict_proba(X_test)[:, 1]

    evaluate_at_threshold(y_test, test_proba, best_threshold, "TEST (2024) -- final, threshold locked from validation")
    evaluate_at_threshold(y_test, test_proba, 0.5, "TEST (2024) at default 0.5 -- for comparison")

    print(f"\nTest ROC-AUC: {roc_auc_score(y_test, test_proba):.4f}")
    print(f"Test PR-AUC: {average_precision_score(y_test, test_proba):.4f}")


if __name__ == "__main__":
    main()