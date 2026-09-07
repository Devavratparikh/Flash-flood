"""
Manual scenario testing for the Layer 1 nowcast model.

Loads the trained model and feeds it hand-crafted scenarios spanning the
full range of plausible conditions -- not to compute formal metrics, but to
sanity-check that predictions match basic physical intuition. If the model
disagrees badly with common sense on an obvious case (e.g. predicts high
risk on a bone-dry day with no rain), that's a red flag to investigate
before trusting SHAP explanations or deploying it anywhere.

Note: since is_monsoon/month are part of FEATURE_COLUMNS, each scenario
must specify a calendar context too -- flood risk is not just about the
three physical readings in isolation.
"""

import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN

MODEL_PATH = Path("models/xgb_nowcast_monotonic.json")
CHOSEN_THRESHOLD = 0.122  # from xgboost_monotonic.py


def build_scenario(rainfall_mm, soil_saturation_pct, reservoir_level_pct,
                    month, is_monsoon, urbanization_index=0.5,
                    rainfall_3d_sum=None, rainfall_7d_sum=None,
                    rainfall_change_1day=0.0,
                    days_since_significant_rain=0, description=""):
    """Fill in engineered features with sensible defaults consistent with
    the raw values given, so we're not accidentally feeding contradictory
    inputs (e.g. high rainfall today but rainfall_3d_sum near zero)."""
    if rainfall_3d_sum is None:
        rainfall_3d_sum = rainfall_mm * 2.5  # assume similar rain recently
    if rainfall_7d_sum is None:
        rainfall_7d_sum = rainfall_mm * 4

    return {
        "description": description,
        "rainfall_mm": rainfall_mm,
        "soil_saturation_pct": soil_saturation_pct,
        "reservoir_level_pct": reservoir_level_pct,
        "rainfall_3d_sum": rainfall_3d_sum,
        "rainfall_7d_sum": rainfall_7d_sum,
        "rainfall_change_1day": rainfall_change_1day,
        "soil_saturation_change_3day": 0.0,
        "reservoir_change_3day": 0.0,
        "rain_saturation_interaction": rainfall_mm * soil_saturation_pct / 100,
        "days_since_significant_rain": days_since_significant_rain,
        "month": month,
        "is_monsoon": is_monsoon,
        "urbanization_index": urbanization_index,
    }


SCENARIOS = [
    build_scenario(0, 25, 30, month=3, is_monsoon=0, days_since_significant_rain=999,
                    description="Bone-dry summer day, no rain, low reservoir -> expect VERY LOW risk"),

    build_scenario(80, 20, 25, month=6, is_monsoon=1, days_since_significant_rain=0,
                    description="Heavy sudden rain on DRY ground, low reservoir -> expect LOW-MODERATE risk "
                                "(this is the case our v3 generator specifically fixed to make possible)"),

    build_scenario(15, 95, 92, month=8, is_monsoon=1, days_since_significant_rain=1,
                    description="Light rain but ground ALREADY saturated, reservoir nearly full -> expect HIGH risk"),

    build_scenario(120, 90, 88, month=7, is_monsoon=1, days_since_significant_rain=0,
                    description="Heavy rain + saturated ground + full reservoir, peak monsoon -> expect VERY HIGH risk"),

    build_scenario(40, 60, 55, month=7, is_monsoon=1, days_since_significant_rain=2,
                    description="Moderate rain, moderate saturation/reservoir -> expect MODERATE risk (ambiguous case)"),

    build_scenario(150, 30, 35, month=1, is_monsoon=0, days_since_significant_rain=0,
                    description="Extreme rogue rain OUT of monsoon season, dry ground -> tests rogue-storm generalization"),

    build_scenario(0, 98, 97, month=9, is_monsoon=1, days_since_significant_rain=15,
                    description="No rain today, but ground/reservoir still near-saturated from past rain -> expect LOW-MODERATE risk "
                                "(tests whether model over-relies on stale saturation vs needing fresh rain)"),

    build_scenario(70, 80, 78, month=7, is_monsoon=1, days_since_significant_rain=0,
                    rainfall_change_1day=65,
                    description="Sudden storm intensification (rain jumped +65mm from yesterday), high-ish saturation -> "
                                "expect HIGH risk (tests whether rapid intensification alone raises risk)"),

    build_scenario(70, 80, 78, month=7, is_monsoon=1, days_since_significant_rain=0,
                    rainfall_change_1day=0,
                    description="SAME rain/saturation levels but rain was FLAT/sustained (no sudden jump) -> "
                                "compare directly against the scenario above to isolate the intensification effect"),

    build_scenario(50, 85, 80, month=7, is_monsoon=1, urbanization_index=0.95,
                    days_since_significant_rain=0,
                    description="Moderate rain, high saturation, HIGH urbanization (0.95) -> tests whether "
                                "urbanization raises risk at the same rain/soil levels"),

    build_scenario(50, 85, 80, month=7, is_monsoon=1, urbanization_index=0.05,
                    days_since_significant_rain=0,
                    description="SAME rain/saturation, LOW urbanization (0.05) -> compare directly against "
                                "the scenario above to isolate the urbanization effect"),

    build_scenario(90, 96, 94, month=1, is_monsoon=0, days_since_significant_rain=0,
                    description="Heavy rain + high saturation but OUT of monsoon season (January) -> tests "
                                "whether the model wrongly discounts risk just because it's not monsoon season"),
]


def main():
    model = XGBClassifier()
    model.load_model(MODEL_PATH)

    rows = pd.DataFrame(SCENARIOS)
    X = rows[FEATURE_COLUMNS]
    probas = model.predict_proba(X)[:, 1]

    print(f"{'Scenario':<90} {'Prob':>7}  {'Flag'}")
    print("-" * 110)
    for desc, proba in zip(rows["description"], probas):
        flag = "FLOOD RISK" if proba >= CHOSEN_THRESHOLD else "safe"
        print(f"{desc:<90} {proba:>7.3f}  {flag}")


if __name__ == "__main__":
    main()