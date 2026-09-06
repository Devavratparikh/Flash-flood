"""
Synthetic flash flood dataset generator.

Simulates daily data for multiple river-basin regions over several years,
with rainfall -> soil saturation -> reservoir level -> flash flood risk
built from real hydrological relationships (not just random noise), plus
realistic seasonality and rare-event class imbalance.

Output: data/raw/synthetic_flashflood_data.csv
Columns: date, region_id, rainfall_mm, soil_saturation_pct,
         reservoir_level_pct, flash_flood
"""

import numpy as np
import pandas as pd
from pathlib import Path

RNG_SEED = 42
N_REGIONS = 6
N_YEARS = 5
OUTPUT_PATH = Path("data/raw/synthetic_flashflood_data.csv")


def simulate_region(region_id: int, rng: np.random.Generator, n_days: int, start_date: str):
    dates = pd.date_range(start=start_date, periods=n_days, freq="D")
    day_of_year = dates.dayofyear.values

    # --- Rainfall ---
    # Monsoon-shaped seasonality (peak ~day 200, i.e. mid-July) + regional intensity offset
    monsoon_curve = np.exp(-((day_of_year - 200) ** 2) / (2 * 55 ** 2))
    region_intensity = rng.uniform(0.8, 1.4)  # some regions just get wetter than others
    base_rain = monsoon_curve * 35 * region_intensity

    # Rain is bursty, not smooth: mix of dry days and storm days
    storm_chance = 0.15 + 0.35 * monsoon_curve
    is_storm_day = rng.random(n_days) < storm_chance
    rainfall = np.where(
        is_storm_day,
        rng.gamma(shape=2.0, scale=base_rain / 1.5 + 5),
        rng.exponential(scale=base_rain * 0.15 + 0.5),
    )
    rainfall = np.clip(rainfall, 0, None)

    # --- Soil saturation (%) ---
    # Rises with rain, decays slowly over dry days (like a leaky bucket)
    soil_saturation = np.zeros(n_days)
    soil_saturation[0] = rng.uniform(20, 40)
    decay_rate = rng.uniform(0.04, 0.07)  # how fast soil dries out
    for t in range(1, n_days):
        inflow = rainfall[t] * rng.uniform(0.6, 0.9)
        soil_saturation[t] = soil_saturation[t - 1] * (1 - decay_rate) + inflow
    soil_saturation = np.clip(soil_saturation, 0, 100)

    # --- Reservoir/dam level (%) ---
    # Fed by runoff, which only really kicks in once soil is already saturated
    reservoir_level = np.zeros(n_days)
    reservoir_level[0] = rng.uniform(30, 55)
    release_rate = rng.uniform(0.015, 0.03)  # controlled outflow/drawdown
    for t in range(1, n_days):
        saturation_frac = soil_saturation[t] / 100
        runoff = rainfall[t] * saturation_frac ** 2 * rng.uniform(0.4, 0.7)
        reservoir_level[t] = reservoir_level[t - 1] * (1 - release_rate) + runoff
    reservoir_level = np.clip(reservoir_level, 0, 100)

    # --- Flash flood target ---
    # Risk rises sharply only when all three align: intense rain, saturated soil,
    # near-full reservoir. This is intentionally nonlinear (an AND condition,
    # not a simple weighted sum) so the model has to learn real interactions.
    risk_score = (
        (rainfall / 100) ** 1.5
        * (soil_saturation / 100) ** 2
        * (reservoir_level / 100) ** 2
    )
    risk_score = risk_score / (risk_score.max() + 1e-6)  # normalize per region
    noise = rng.normal(0, 0.05, n_days)
    flood_prob = np.clip(risk_score + noise, 0, 1)

    # Force genuine rarity: floods should be well under 5% of days, like reality
    threshold = np.quantile(flood_prob, 0.965)
    flash_flood = (flood_prob >= threshold).astype(int)

    return pd.DataFrame({
        "date": dates,
        "region_id": f"region_{region_id}",
        "rainfall_mm": rainfall.round(1),
        "soil_saturation_pct": soil_saturation.round(1),
        "reservoir_level_pct": reservoir_level.round(1),
        "flash_flood": flash_flood,
    })


def main():
    rng = np.random.default_rng(RNG_SEED)
    n_days = N_YEARS * 365
    frames = [
        simulate_region(i, rng, n_days, start_date="2020-01-01")
        for i in range(1, N_REGIONS + 1)
    ]
    df = pd.concat(frames, ignore_index=True)
    df = df.sort_values(["region_id", "date"]).reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(df):,} rows to {OUTPUT_PATH}")
    print(f"Flash flood rate: {df['flash_flood'].mean():.3%}")
    print(df.groupby("region_id")["flash_flood"].mean())


if __name__ == "__main__":
    main()