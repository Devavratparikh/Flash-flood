"""
Calibration and regional consistency checks for the monotonic model.

1) Calibration: if the model says "30% chance of flood" on a batch of days,
   roughly 30% of those days should actually flood. This matters a lot for a
   warning system -- officers may set action thresholds based on the number
   (e.g. "evacuate advisory above 20%, mandatory above 50%"), so the number
   itself needs to mean what it claims, not just rank days correctly.

2) Regional consistency: aggregate test metrics can hide a model that's
   great on 5 regions and terrible on 1 (e.g. the most/least urbanized, or
   the wettest). We check region-by-region.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from sklearn.calibration import calibration_curve
from sklearn.metrics import recall_score, precision_score
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN

MODEL_PATH = Path("models/xgb_nowcast_monotonic.json")
TEST_PATH = Path("data/processed/test.csv")
THRESHOLD = 0.122


def main():
    model = XGBClassifier()
    model.load_model(MODEL_PATH)

    test_df = pd.read_csv(TEST_PATH, parse_dates=["date"])
    X_test = test_df[FEATURE_COLUMNS]
    y_test = test_df[TARGET_COLUMN]
    y_proba = model.predict_proba(X_test)[:, 1]

    print("=== Calibration (predicted probability vs actual observed rate) ===")
    prob_true, prob_pred = calibration_curve(y_test, y_proba, n_bins=10, strategy="quantile")
    for pt, pp in zip(prob_true, prob_pred):
        bar = "#" * int(pt * 50)
        print(f"predicted~{pp:.3f}  actual={pt:.3f}  {bar}")

    print("\n=== Per-region test performance (at threshold={:.3f}) ===".format(THRESHOLD))
    test_df = test_df.copy()
    test_df["y_proba"] = y_proba
    test_df["y_pred"] = (y_proba >= THRESHOLD).astype(int)

    for region, group in test_df.groupby("region_id"):
        n_floods = group[TARGET_COLUMN].sum()
        if n_floods == 0:
            print(f"{region:<12} no flood days in test set -- skipping recall/precision")
            continue
        recall = recall_score(group[TARGET_COLUMN], group["y_pred"])
        precision = precision_score(group[TARGET_COLUMN], group["y_pred"], zero_division=0)
        print(f"{region:<12} floods={n_floods:>3}  recall={recall:.3f}  precision={precision:.3f}")


if __name__ == "__main__":
    main()