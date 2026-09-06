"""
Time-based train/test split for the flash flood nowcast model.

CRITICAL: this is NOT a random split. Flood data is a time series, and a
random split would let the model train on days that come chronologically
AFTER some of its test days -- silently leaking future information and
producing misleadingly high accuracy that won't hold up on real deployment.

Instead: everything before CUTOFF_DATE is training, everything on/after it
is testing. This mirrors the real deployment scenario -- train on historical
years, predict on the upcoming/most recent monsoon season.

Input:  data/processed/features.csv
Output: data/processed/train.csv, data/processed/test.csv
"""

import pandas as pd
from pathlib import Path
from feature_engineering import FEATURE_COLUMNS, TARGET_COLUMN

INPUT_PATH = Path("data/processed/features.csv")
TRAIN_OUTPUT = Path("data/processed/train.csv")
TEST_OUTPUT = Path("data/processed/test.csv")

# Last full year (2024) held out entirely as the test set.
# Train: 2020-01-01 through 2023-12-31. Test: 2024-01-01 onward.
CUTOFF_DATE = "2024-01-01"


def main():
    df = pd.read_csv(INPUT_PATH, parse_dates=["date"])

    train_df = df[df["date"] < CUTOFF_DATE].copy()
    test_df = df[df["date"] >= CUTOFF_DATE].copy()

    # Sanity checks that would catch a broken split immediately
    assert train_df["date"].max() < test_df["date"].min(), \
        "Leakage detected: train dates overlap with or exceed test dates"
    assert len(train_df) > 0 and len(test_df) > 0, "One split is empty -- check CUTOFF_DATE"

    train_df.to_csv(TRAIN_OUTPUT, index=False)
    test_df.to_csv(TEST_OUTPUT, index=False)

    print(f"Train: {len(train_df):,} rows | {train_df['date'].min().date()} to {train_df['date'].max().date()}")
    print(f"Test:  {len(test_df):,} rows | {test_df['date'].min().date()} to {test_df['date'].max().date()}")
    print(f"\nTrain flood rate: {train_df[TARGET_COLUMN].mean():.3%}")
    print(f"Test flood rate:  {test_df[TARGET_COLUMN].mean():.3%}")

    if abs(train_df[TARGET_COLUMN].mean() - test_df[TARGET_COLUMN].mean()) > 0.02:
        print("\nWARNING: train/test flood rates differ by >2pp. Check whether this "
              "is expected (e.g. a genuinely different weather year) or a data issue.")


if __name__ == "__main__":
    main()