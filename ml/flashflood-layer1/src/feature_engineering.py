"""
Feature engineering for the flash flood nowcast model.

Takes the raw daily rainfall / soil saturation / reservoir level data and
derives features that capture ACCUMULATION and TREND, not just a single
day's snapshot -- this is what actually drives flash floods hydrologically.

All rolling/diff operations are computed per region_id so that no
information leaks across regions (e.g. region_2's history never touches
region_1's rolling averages).

Input:  data/raw/synthetic_flashflood_data.csv
Output: data/processed/features.csv
"""

import pandas as pd
from pathlib import Path

INPUT_PATH = Path("data/raw/synthetic_flashflood_data.csv")
OUTPUT_PATH = Path("data/processed/features.csv")


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    # NOTE: rainfall_3d_sum / rainfall_7d_sum are already computed by the
    # data generator (add_temporal_features) -- not recreated here to avoid
    # duplicate near-identical columns.
    df = df.sort_values(["region_id", "date"]).copy()
    grouped = df.groupby("region_id")

    # --- Rainfall intensity change: is the storm intensifying? ---
    df["rainfall_change_1day"] = grouped["rainfall_mm"].diff().fillna(0)

    # --- Soil saturation trend: is the ground still absorbing, or maxed out? ---
    df["soil_saturation_change_3day"] = grouped["soil_saturation_pct"].transform(
        lambda s: s.diff(periods=3)
    ).fillna(0)

    # --- Reservoir trend: is the reservoir filling faster than usual? ---
    df["reservoir_change_3day"] = grouped["reservoir_level_pct"].transform(
        lambda s: s.diff(periods=3)
    ).fillna(0)

    # --- Simple interaction term: combined pressure from rain + saturated ground ---
    # (kept as a simple product, not a replica of how the synthetic target
    # was generated, so it reflects genuine feature engineering rather than
    # accidentally re-deriving the label formula)
    df["rain_saturation_interaction"] = (
        df["rainfall_mm"] * df["soil_saturation_pct"] / 100
    )

    # --- Days since last significant rain (>10mm) ---
    def days_since_rain(s: pd.Series) -> pd.Series:
        significant = s > 10
        # group counter that resets every time a significant rain day occurs
        groups = significant.cumsum()
        counter = significant.groupby(groups).cumcount()
        return counter.where(groups > 0, other=999)  # 999 = no rain yet in record

    df["days_since_significant_rain"] = grouped["rainfall_mm"].transform(days_since_rain)

    return df


# --- Single source of truth for what the model is allowed to see ---
# Import these lists in later scripts (train/test split, training) rather
# than re-typing column names, so the feature set can only change in one place.
FEATURE_COLUMNS = [
    "rainfall_mm", "soil_saturation_pct", "reservoir_level_pct",
    "rainfall_3d_sum", "rainfall_7d_sum",
    "rainfall_change_1day", "soil_saturation_change_3day", "reservoir_change_3day",
    "rain_saturation_interaction", "days_since_significant_rain",
    "month", "is_monsoon",
    "urbanization_index",
]
TARGET_COLUMN = "flash_flood"
# Kept in the dataframe for grouping/diagnostics, but NEVER passed to the model:
# region_id (identifier), date (identifier), day_of_year (redundant with is_monsoon),
# region_intensity (hidden generator ground-truth -- no real-world equivalent)
EXCLUDED_COLUMNS = ["region_id", "date", "day_of_year", "region_intensity"]


def main():
    df = pd.read_csv(INPUT_PATH, parse_dates=["date"])
    df_features = engineer_features(df)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df_features.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(df_features):,} rows, {df_features.shape[1]} columns to {OUTPUT_PATH}")
    print("\nNew columns added:")
    original_cols = {"date", "region_id", "rainfall_mm", "soil_saturation_pct",
                      "reservoir_level_pct", "flash_flood"}
    print([c for c in df_features.columns if c not in original_cols])


if __name__ == "__main__":
    main()