"""
Probability recalibration for the monotonic nowcast model.

scale_pos_weight fixed the class-imbalance problem for RANKING (recall/
precision/threshold decisions are all correct), but it distorts the raw
probability numbers themselves -- the model's "77% chance" days only
actually flooded ~31% of the time. This fits an isotonic regression that
remaps raw scores onto honest probabilities, without touching which days
get classified as flood-risk (isotonic regression is monotonic, so the
threshold decision boundary is unchanged -- same recall/precision as before).

Calibration is fit on the VALIDATION set (2023), using the tuning-stage
model that never saw 2023 during training -- consistent with how we already
chose the decision threshold, so we're not introducing a new leakage path.
It is then applied to the FINAL model's test-set (2024) probabilities,
which are only looked at once, at the end.
"""

import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.isotonic import IsotonicRegression
from sklearn.calibration import calibration_curve
from sklearn.metrics import classification_report, confusion_matrix
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN
from xgboost_monotonic import train_xgb_monotonic as train_xgb, MONOTONE_CONSTRAINTS as constraint_tuple

TRAIN_PATH = Path("data/processed/train.csv")
TEST_PATH = Path("data/processed/test.csv")
VAL_CUTOFF_DATE = "2023-01-01"
THRESHOLD = 0.261  # from this run's xgboost_monotonic.py threshold search  # unchanged -- isotonic is monotonic, decision boundary is preserved


def print_calibration(y_true, y_proba, label):
    print(f"\n=== Calibration: {label} ===")
    prob_true, prob_pred = calibration_curve(y_true, y_proba, n_bins=10, strategy="quantile")
    for pt, pp in zip(prob_true, prob_pred):
        print(f"predicted~{pp:.3f}  actual={pt:.3f}")


def main():
    train_full = pd.read_csv(TRAIN_PATH, parse_dates=["date"])
    test_df = pd.read_csv(TEST_PATH, parse_dates=["date"])

    fit_df = train_full[train_full["date"] < VAL_CUTOFF_DATE]
    val_df = train_full[train_full["date"] >= VAL_CUTOFF_DATE]

    model_for_calibration = train_xgb(fit_df[FEATURE_COLUMNS], fit_df[TARGET_COLUMN])
    val_proba_raw = model_for_calibration.predict_proba(val_df[FEATURE_COLUMNS])[:, 1]

    print_calibration(val_df[TARGET_COLUMN], val_proba_raw, "VALIDATION, before calibration")

    calibrator = IsotonicRegression(out_of_bounds="clip")
    calibrator.fit(val_proba_raw, val_df[TARGET_COLUMN])

    val_proba_calibrated = calibrator.predict(val_proba_raw)
    print_calibration(val_df[TARGET_COLUMN], val_proba_calibrated, "VALIDATION, after calibration")

    model_final = train_xgb(train_full[FEATURE_COLUMNS], train_full[TARGET_COLUMN])
    test_proba_raw = model_final.predict_proba(test_df[FEATURE_COLUMNS])[:, 1]
    test_proba_calibrated = calibrator.predict(test_proba_raw)

    print_calibration(test_df[TARGET_COLUMN], test_proba_raw, "TEST, before calibration")
    print_calibration(test_df[TARGET_COLUMN], test_proba_calibrated, "TEST, after calibration")

    y_pred_raw = (test_proba_raw >= THRESHOLD).astype(int)
    calibrated_threshold = calibrator.predict([THRESHOLD])[0]
    y_pred_calibrated = (test_proba_calibrated >= calibrated_threshold).astype(int)

    print(f"\nDecisions identical after calibration: {(y_pred_raw == y_pred_calibrated).all()}")
    print(f"Raw threshold {THRESHOLD:.3f} maps to calibrated threshold {calibrated_threshold:.3f}")

    print("\n=== TEST classification report (unchanged by calibration) ===")
    print(classification_report(test_df[TARGET_COLUMN], y_pred_calibrated, target_names=["No Flood", "Flood"]))

    Path("models").mkdir(exist_ok=True)
    model_final.save_model("models/xgb_nowcast_monotonic.json")
    import joblib
    joblib.dump(calibrator, "models/probability_calibrator.pkl")
    print("\nSaved model_final and probability_calibrator.pkl to models/")


if __name__ == "__main__":
    main()