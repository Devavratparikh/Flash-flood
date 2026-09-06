"""
Layer 1 nowcast model, WITH monotonic constraints (fixes the saturation cliff).

Background: unconstrained XGBoost (xgboost_model.py) learned a sharp,
non-physical cliff on soil_saturation_pct / reservoir_level_pct -- because
the ~261 positive (flood) training examples cluster almost entirely at
95-100% saturation, the trees essentially memorized "flood = near 100%"
instead of a smooth "more saturation -> more risk" relationship. A
hand-crafted sanity scenario (heavy rain, 90% soil, 88% reservoir, peak
monsoon) scored only 3.4% risk -- clearly wrong -- confirming the cliff.

Fix: monotonic constraints tell XGBoost explicitly that predicted risk must
never DECREASE as a "more water" feature increases. This isn't a workaround,
it's injecting known hydrological physics as a hard constraint, and it
should also let the model generalize sensibly in sparse regions (e.g. 90-95%
saturation) instead of only trusting memorized extremes.

Everything else (train/val/test split, threshold tuning via F2 on a 2023
validation set, final one-time evaluation on 2024 test) is identical to
threshold_tuning.py, so results are a fair before/after comparison.
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
MODEL_OUTPUT = Path("models/xgb_nowcast_monotonic.json")

VAL_CUTOFF_DATE = "2023-01-01"  # train: 2020-2022, validate: 2023
BETA = 2.0  # F2 score: recall weighted 2x as important as precision

# --- Monotonic constraints, one entry per FEATURE_COLUMNS, IN ORDER ---
#  1  = prediction can only increase (or stay flat) as the feature increases
# -1  = prediction can only decrease (or stay flat) as the feature increases
#  0  = unconstrained
#
# FEATURE_COLUMNS order (from feature_engineering.py):
#   rainfall_mm, soil_saturation_pct, reservoir_level_pct,
#   rainfall_3d_sum, rainfall_7d_sum,
#   rainfall_change_1day, soil_saturation_change_3day, reservoir_change_3day,
#   rain_saturation_interaction, days_since_significant_rain,
#   month, is_monsoon, urbanization_index
MONOTONE_CONSTRAINTS = (
    1,   # rainfall_mm                    -- more rain can't lower risk
    1,   # soil_saturation_pct            -- the cliff-fix target
    1,   # reservoir_level_pct            -- the cliff-fix target
    1,   # rainfall_3d_sum                -- more accumulated rain can't lower risk
    1,   # rainfall_7d_sum
    1,   # rainfall_change_1day           -- intensifying storm can't lower risk
    1,   # soil_saturation_change_3day    -- wetting faster can't lower risk
    1,   # reservoir_change_3day          -- filling faster can't lower risk
    1,   # rain_saturation_interaction    -- explicitly named in the fix decision
    -1,  # days_since_significant_rain    -- longer since rain -> can't raise risk
    0,   # month                          -- cyclical, not monotonic
    0,   # is_monsoon                     -- calendar flag, direction not forced
    1,   # urbanization_index             -- generator ties this to more runoff
)

assert len(MONOTONE_CONSTRAINTS) == len(FEATURE_COLUMNS), (
    "MONOTONE_CONSTRAINTS length must match FEATURE_COLUMNS exactly -- "
    "a silent mismatch here applies constraints to the wrong columns."
)


def train_xgb_monotonic(X_train, y_train):
    n_neg, n_pos = (y_train == 0).sum(), (y_train == 1).sum()
    model = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8,
        scale_pos_weight=n_neg / n_pos,
        monotone_constraints=MONOTONE_CONSTRAINTS,
        eval_metric="aucpr", random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def find_best_threshold(y_true, y_proba, beta=BETA):
    precisions, recalls, thresholds = precision_recall_curve(y_true, y_proba)
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


def run_sanity_scenarios(model):
    """Quick physical sanity check: does risk rise smoothly with saturation,
    instead of cliffing, for a fixed heavy-rain / peak-monsoon backdrop?"""
    base = {col: 0.0 for col in FEATURE_COLUMNS}
    base.update({
        "rainfall_mm": 90.0, "rainfall_3d_sum": 180.0, "rainfall_7d_sum": 320.0,
        "rainfall_change_1day": 20.0, "month": 7, "is_monsoon": 1,
        "urbanization_index": 0.6, "days_since_significant_rain": 0,
    })
    print("\n=== Saturation sanity sweep (heavy rain, peak monsoon, fixed) ===")
    for sat in [90, 95, 99]:
        row = dict(base)
        row["soil_saturation_pct"] = sat
        row["reservoir_level_pct"] = sat - 2
        row["soil_saturation_change_3day"] = 5.0
        row["reservoir_change_3day"] = 5.0
        row["rain_saturation_interaction"] = row["rainfall_mm"] * sat / 100
        X_row = pd.DataFrame([row])[FEATURE_COLUMNS]
        proba = model.predict_proba(X_row)[:, 1][0]
        print(f"soil={sat}%  reservoir={sat-2}%  -> predicted risk = {proba:.3f}")


def main():
    train_full = pd.read_csv(TRAIN_PATH, parse_dates=["date"])
    test_df = pd.read_csv(TEST_PATH, parse_dates=["date"])

    fit_df = train_full[train_full["date"] < VAL_CUTOFF_DATE]
    val_df = train_full[train_full["date"] >= VAL_CUTOFF_DATE]
    print(f"Fit: {len(fit_df):,} rows ({fit_df['date'].min().date()} to {fit_df['date'].max().date()})")
    print(f"Validate: {len(val_df):,} rows ({val_df['date'].min().date()} to {val_df['date'].max().date()})")

    X_fit, y_fit = fit_df[FEATURE_COLUMNS], fit_df[TARGET_COLUMN]
    X_val, y_val = val_df[FEATURE_COLUMNS], val_df[TARGET_COLUMN]
    X_test, y_test = test_df[FEATURE_COLUMNS], test_df[TARGET_COLUMN]

    # Step 1: fit on 2020-2022 only, tune threshold on 2023
    model_for_tuning = train_xgb_monotonic(X_fit, y_fit)
    val_proba = model_for_tuning.predict_proba(X_val)[:, 1]
    best_threshold = find_best_threshold(y_val, val_proba)
    print(f"\n>>> Selected threshold: {best_threshold:.3f} (chosen on validation, before touching test)")

    evaluate_at_threshold(y_val, val_proba, best_threshold, "VALIDATION (2023)")
    evaluate_at_threshold(y_val, val_proba, 0.5, "VALIDATION (2023) at default 0.5 -- for comparison")

    # Step 2: refit on ALL training years (2020-2023) with threshold locked,
    # evaluate on test (2024) exactly once.
    model_final = train_xgb_monotonic(train_full[FEATURE_COLUMNS], train_full[TARGET_COLUMN])
    test_proba = model_final.predict_proba(X_test)[:, 1]

    evaluate_at_threshold(y_test, test_proba, best_threshold, "TEST (2024) -- final, threshold locked from validation")
    evaluate_at_threshold(y_test, test_proba, 0.5, "TEST (2024) at default 0.5 -- for comparison")

    print(f"\nTest ROC-AUC: {roc_auc_score(y_test, test_proba):.4f}")
    print(f"Test PR-AUC: {average_precision_score(y_test, test_proba):.4f}")

    print("\n=== Feature importances (gain-based) ===")
    importances = pd.Series(
        model_final.feature_importances_, index=FEATURE_COLUMNS
    ).sort_values(ascending=False)
    print(importances)

    # Sanity check: confirm the cliff is now a smooth ramp, not a step.
    run_sanity_scenarios(model_final)

    MODEL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    model_final.save_model(MODEL_OUTPUT)
    print(f"\nModel saved to {MODEL_OUTPUT}")


if __name__ == "__main__":
    main()