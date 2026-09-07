"""
Synthetic flash flood dataset generator (v3).

Simulates daily data for multiple river-basin regions over several years,
with rainfall -> antecedent soil saturation -> antecedent reservoir level ->
flash flood risk built from real hydrological relationships, realistic
seasonality, rare-event class imbalance, and genuine train-worthy difficulty.

IMPORTANT SEMANTICS: soil_saturation_pct and reservoir_level_pct are the
ANTECEDENT state -- conditions at the START of the day, before that day's
rainfall has infiltrated -- exactly what a forecaster would actually know
when trying to predict whether today's rain will cause a flood. This also
means today's flash_flood label genuinely depends on the interaction of
today's rain with the ground's pre-existing wetness: heavy rain on dry
antecedent ground correctly does NOT flood, and saturated ground can flood
from only moderate rain. (An earlier version used same-day soil/reservoir
values that already included that day's own rain -- which is circular, and
empirically made "heavy rain on dry ground" impossible to represent at all.)

Also includes: per-timestep physical bounds (0-100%) on soil/reservoir state,
an unobserved local-convective noise term that caps best-possible model
accuracy below 1.0, sensor measurement noise, rare "rogue storm" events
decoupled from the monsoon cycle, and pooled (not per-region) rarity
thresholding so wetter/more-urbanized regions genuinely flood more often.

Output: data/raw/synthetic_flashflood_data.csv
"""

import numpy as np
import pandas as pd
from pathlib import Path

RNG_SEED = 42
N_REGIONS = 6
N_YEARS = 5
OUTPUT_PATH = Path("data/raw/synthetic_flashflood_data.csv")

# Fraction of days across the WHOLE dataset (all regions pooled) that end up
# labeled as flash-flood days. Pooling (rather than per-region) means wetter
# regions genuinely flood more often -- region-level risk survives into the label.
TARGET_FLOOD_RATE = 0.03


def simulate_region_physics(rng: np.random.Generator, n_days: int, start_date: str,
                             region_intensity: float, urbanization_index: float):
    """Simulate the true physical state for one region. Returns dict of arrays."""
    dates = pd.date_range(start=start_date, periods=n_days, freq="D")
    day_of_year = dates.dayofyear.values

    # --- Rainfall ---
    monsoon_curve = np.exp(-((day_of_year - 200) ** 2) / (2 * 55 ** 2))
    base_rain = monsoon_curve * 35 * region_intensity

    storm_chance = 0.15 + 0.35 * monsoon_curve
    is_storm_day = rng.random(n_days) < storm_chance
    rainfall = np.where(
        is_storm_day,
        rng.gamma(shape=2.0, scale=base_rain / 1.5 + 5),
        rng.exponential(scale=base_rain * 0.15 + 0.5),
    )

    # Rogue convective storms: rare, localized cloudbursts that can hit ANY
    # day of the year regardless of the monsoon cycle or antecedent ground
    # conditions (real early-monsoon or freak thunderstorm events). Without
    # these, every heavy-rain day in the dataset only ever occurs when soil
    # is already wet (both driven by the same seasonal curve), so rainfall
    # alone becomes a near-perfect proxy for the label and the model never
    # has to learn that rain needs saturated ground to cause a flood. These
    # events create real "heavy rain, dry ground, no flood" examples.
    is_rogue_storm = rng.random(n_days) < 0.02
    rogue_rain = rng.gamma(shape=2.0, scale=22.0, size=n_days)
    rainfall = np.where(is_rogue_storm, rainfall + rogue_rain, rainfall)
    rainfall = np.clip(rainfall, 0, None)

    # --- Soil saturation (%) : leaky bucket, PHYSICALLY BOUNDED AT EVERY STEP ---
    # (bug fix: previous version only clipped after the loop, which let values
    #  run into the hundreds of percent internally and silently pinned ~50% of
    #  reported days at exactly 100 -- destroying most of the feature's variance)
    #
    # IMPORTANT: we track soil_start[t] = saturation at the START of day t,
    # BEFORE that day's rain has infiltrated. This is the antecedent condition
    # a forecaster would actually know, and it's what should drive that day's
    # flood risk together with that day's rain. (Using the END-of-day value,
    # which already includes today's own rain, is circular: a heavy storm
    # instantly "saturates" the ground in the same timestep you're using it
    # to explain, so a scenario like "heavy rain falls on dry ground" becomes
    # structurally impossible to represent -- confirmed empirically: with the
    # end-of-day version, 0 of 10,950 days had rain>=30mm with soil<40%.)
    soil_start = np.zeros(n_days)
    soil_start[0] = rng.uniform(20, 40)
    decay_rate = rng.uniform(0.04, 0.07)
    for t in range(1, n_days):
        inflow = rainfall[t - 1] * rng.uniform(0.6, 0.9)
        val = soil_start[t - 1] * (1 - decay_rate) + inflow
        soil_start[t] = min(100.0, max(0.0, val))

    # --- Reservoir/dam level (%) : same antecedent logic, PLUS urbanization ---
    # raises runoff (more impervious surface -> faster runoff for the same
    # rain+saturation, giving urbanization genuine predictive value).
    reservoir_start = np.zeros(n_days)
    reservoir_start[0] = rng.uniform(30, 55)
    release_rate = rng.uniform(0.015, 0.03)
    runoff_boost = 1.0 + 0.6 * urbanization_index
    for t in range(1, n_days):
        saturation_frac = soil_start[t - 1] / 100
        runoff = rainfall[t - 1] * saturation_frac ** 2 * rng.uniform(0.4, 0.7) * runoff_boost
        val = reservoir_start[t - 1] * (1 - release_rate) + runoff
        reservoir_start[t] = min(100.0, max(0.0, val))

    return dates, rainfall, soil_start, reservoir_start


def compute_risk_score(rainfall, soil_saturation, reservoir_level, local_burst):
    """
    Bounded, saturating risk model (no per-draw max-normalization, so absolute
    risk is comparable across regions and years -- a region that is genuinely
    wetter/more saturated genuinely floods more often).

    local_burst is an UNOBSERVED micro-convective factor (not exported as a
    column). It represents localized cloudburst / drainage-choke effects that
    basin-averaged sensors can't see. Its presence caps the best possible
    model AUC below 1.0 -- exactly like a real flash-flood problem, where no
    amount of upstream-gauge data perfectly predicts every local event.
    """
    rain_term = 1 - np.exp(-rainfall / 25)           # in [0, 1), saturates by ~mod-heavy rain
    soil_term = (soil_saturation / 100) ** 1.5       # in [0, 1]
    reservoir_term = (reservoir_level / 100) ** 1.5  # in [0, 1]
    base_risk = rain_term * soil_term * reservoir_term
    return base_risk * (0.55 + 0.45 * local_burst)   # local_burst in [0,1] modulates risk


def simulate_region(region_id: int, rng: np.random.Generator, n_days: int, start_date: str):
    region_intensity = rng.uniform(0.7, 1.5)     # how rain-prone this basin is
    urbanization_index = rng.uniform(0.0, 1.0)   # static regional covariate

    dates, rainfall, soil_saturation, reservoir_level = simulate_region_physics(
        rng, n_days, start_date, region_intensity, urbanization_index
    )

    # Unobserved local convective noise -- deliberately NOT exported as a column.
    local_burst = rng.beta(2, 5, n_days)  # skewed toward low, occasional spikes

    risk_score = compute_risk_score(rainfall, soil_saturation, reservoir_level, local_burst)

    # Sensor / measurement noise: what actually gets exported differs slightly
    # from the true physical state, like real rain gauges and moisture probes.
    rainfall_obs = np.clip(rainfall * rng.normal(1.0, 0.03, n_days), 0, None)
    soil_obs = np.clip(soil_saturation + rng.normal(0, 1.5, n_days), 0, 100)
    reservoir_obs = np.clip(reservoir_level + rng.normal(0, 1.0, n_days), 0, 100)

    df = pd.DataFrame({
        "date": dates,
        "region_id": f"region_{region_id}",
        "region_intensity": round(region_intensity, 3),
        "urbanization_index": round(urbanization_index, 3),
        "rainfall_mm": rainfall_obs.round(1),
        "soil_saturation_pct": soil_obs.round(1),
        "reservoir_level_pct": reservoir_obs.round(1),
        "_risk_score": risk_score,  # temporary, used to set the global threshold; dropped later
    })
    return df


def add_temporal_features(df: pd.DataFrame) -> pd.DataFrame:
    """Standard antecedent-precipitation / calendar features tree models use well."""
    df["month"] = df["date"].dt.month
    df["day_of_year"] = df["date"].dt.dayofyear
    df["is_monsoon"] = df["day_of_year"].between(135, 265).astype(int)

    df = df.sort_values(["region_id", "date"])
    g = df.groupby("region_id")["rainfall_mm"]
    df["rainfall_3d_sum"] = g.transform(lambda s: s.rolling(3, min_periods=1).sum())
    df["rainfall_7d_sum"] = g.transform(lambda s: s.rolling(7, min_periods=1).sum())
    return df


def main():
    rng = np.random.default_rng(RNG_SEED)
    n_days = N_YEARS * 365
    frames = [
        simulate_region(i, rng, n_days, start_date="2020-01-01")
        for i in range(1, N_REGIONS + 1)
    ]
    df = pd.concat(frames, ignore_index=True)

    # Global (pooled) threshold + noise -> regions keep their relative riskiness,
    # rather than every region being forced to the exact same flood rate.
    noise = rng.normal(0, 0.06, len(df))
    flood_prob = np.clip(df["_risk_score"] + noise, 0, 1)
    threshold = np.quantile(flood_prob, 1 - TARGET_FLOOD_RATE)
    df["flash_flood"] = (flood_prob >= threshold).astype(int)
    df = df.drop(columns=["_risk_score"])

    df = add_temporal_features(df)
    df = df.sort_values(["region_id", "date"]).reset_index(drop=True)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_PATH, index=False)

    print(f"Saved {len(df):,} rows to {OUTPUT_PATH}")
    print(f"Overall flash flood rate: {df['flash_flood'].mean():.3%}")
    print(df.groupby("region_id")["flash_flood"].mean())
    return df


if __name__ == "__main__":
    main()