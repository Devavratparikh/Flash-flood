"""
Systematic monotonicity verification for the constrained model.

Spot-checking 2-3 points (like we did manually) only proves the constraint
holds at those exact points. This sweeps each constrained feature across its
full realistic range, holding everything else fixed, and checks that
predicted probability never violates the expected direction anywhere in
between -- a much stronger guarantee than eyeballing a few values.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from feature_engineering import FEATURE_COLUMNS

MODEL_PATH = Path("models/xgb_nowcast_monotonic.json")

BASELINE = {
    "rainfall_mm": 60, "soil_saturation_pct": 70, "reservoir_level_pct": 65,
    "rainfall_3d_sum": 150, "rainfall_7d_sum": 250, "rainfall_change_1day": 10,
    "soil_saturation_change_3day": 2, "reservoir_change_3day": 1,
    "rain_saturation_interaction": 60 * 70 / 100, "days_since_significant_rain": 2,
    "month": 7, "is_monsoon": 1, "urbanization_index": 0.5,
}

SWEEPS = {
    "rainfall_mm": (np.linspace(0, 300, 40), 1),
    "soil_saturation_pct": (np.linspace(0, 100, 40), 1),
    "reservoir_level_pct": (np.linspace(0, 100, 40), 1),
    "rainfall_3d_sum": (np.linspace(0, 600, 40), 1),
    "rainfall_7d_sum": (np.linspace(0, 900, 40), 1),
    "rain_saturation_interaction": (np.linspace(0, 300, 40), 1),
    "days_since_significant_rain": (np.linspace(0, 60, 40), -1),
}


def main():
    model = XGBClassifier()
    model.load_model(MODEL_PATH)

    all_passed = True
    for feature, (sweep_values, direction) in SWEEPS.items():
        rows = []
        for v in sweep_values:
            row = BASELINE.copy()
            row[feature] = v
            rows.append(row)
        X = pd.DataFrame(rows)[FEATURE_COLUMNS]
        probas = model.predict_proba(X)[:, 1]

        diffs = np.diff(probas)
        if direction == 1:
            violations = np.sum(diffs < -1e-6)
        else:
            violations = np.sum(diffs > 1e-6)

        status = "PASS" if violations == 0 else f"FAIL ({violations} violations)"
        if violations > 0:
            all_passed = False
        print(f"{feature:<30} sweep {sweep_values[0]:.0f}->{sweep_values[-1]:.0f}  "
              f"prob {probas[0]:.3f}->{probas[-1]:.3f}  [{status}]")

    print(f"\n{'ALL MONOTONICITY CHECKS PASSED' if all_passed else 'SOME CHECKS FAILED -- investigate'}")


if __name__ == "__main__":
    main()