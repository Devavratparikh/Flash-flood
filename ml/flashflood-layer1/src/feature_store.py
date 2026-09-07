"""
Rolling feature store for live inference.

Training used pandas .rolling()/.groupby() over a full historical CSV to
compute features like rainfall_3d_sum or days_since_significant_rain. A live
backend doesn't have that -- it gets one day's raw reading at a time and
needs a prediction immediately. This module bridges that gap: it persists
each region's recent daily readings in a small SQLite file (survives backend
restarts, no external service needed) and computes the exact same 13
features from that history + today's new reading.

IMPORTANT: the feature formulas here must stay IN SYNC with
feature_engineering.py and generate_dataset.py. If those change, update here
too, or predictions will silently use a different feature definition than
what the model was trained on.
"""

import sqlite3
from pathlib import Path
from datetime import datetime, timedelta

DB_PATH = Path("data/feature_store.db")
LOOKBACK_DAYS_FOR_DRY_SPELL = 365  # cap search for "days since significant rain"
SIGNIFICANT_RAIN_MM = 10.0
MONSOON_DAY_START, MONSOON_DAY_END = 135, 265  # matches generate_dataset.py's is_monsoon window


def _get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            region_id TEXT NOT NULL,
            date TEXT NOT NULL,
            rainfall_mm REAL NOT NULL,
            soil_saturation_pct REAL NOT NULL,
            reservoir_level_pct REAL NOT NULL,
            PRIMARY KEY (region_id, date)
        )
    """)
    return conn


def _parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d")


def add_reading(region_id: str, date_str: str, rainfall_mm: float,
                soil_saturation_pct: float, reservoir_level_pct: float):
    """Store today's raw reading so it becomes available as history tomorrow."""
    conn = _get_connection()
    conn.execute(
        """INSERT OR REPLACE INTO readings
           (region_id, date, rainfall_mm, soil_saturation_pct, reservoir_level_pct)
           VALUES (?, ?, ?, ?, ?)""",
        (region_id, date_str, rainfall_mm, soil_saturation_pct, reservoir_level_pct),
    )
    conn.commit()
    conn.close()


def _get_reading_on(region_id: str, date_str: str):
    """Returns (rainfall_mm, soil_saturation_pct, reservoir_level_pct) for this
    EXACT date, or None if there's no reading recorded for that specific day."""
    conn = _get_connection()
    row = conn.execute(
        """SELECT rainfall_mm, soil_saturation_pct, reservoir_level_pct
           FROM readings WHERE region_id = ? AND date = ?""",
        (region_id, date_str),
    ).fetchone()
    conn.close()
    return row


def _get_last_known_reading_before(region_id: str, before_date: datetime):
    """For forward-filling soil/reservoir state across a gap: returns the most
    recent reading strictly before `before_date`, regardless of how many days
    back it is (soil/reservoir change slowly, so carrying forward the last
    known value is more sensible than assuming 0 -- unlike rainfall, where a
    missing day usually just means "no rain reported that day")."""
    conn = _get_connection()
    row = conn.execute(
        """SELECT date, rainfall_mm, soil_saturation_pct, reservoir_level_pct
           FROM readings WHERE region_id = ? AND date < ?
           ORDER BY date DESC LIMIT 1""",
        (region_id, before_date.strftime("%Y-%m-%d")),
    ).fetchone()
    conn.close()
    return row


def build_features(region_id: str, date_str: str, rainfall_mm: float,
                    soil_saturation_pct: float, reservoir_level_pct: float,
                    urbanization_index: float, persist: bool = True) -> dict:
    """
    Computes all 13 FEATURE_COLUMNS for today's reading, using stored history
    for this region. Set persist=False to preview a hypothetical "what if"
    reading without actually saving it to history.

    IMPORTANT: looks up SPECIFIC calendar dates (yesterday, exactly N days
    ago), not just "the last N database rows" -- if reporting has a gap
    (e.g. a sensor outage skipped a day), a missing day's rainfall is
    treated as 0 (no report usually means nothing notable happened) rather
    than silently treating an older reading as if it were more recent than
    it actually is.
    """
    today = _parse_date(date_str)

    def rainfall_on(days_ago: int) -> float:
        target_date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        row = _get_reading_on(region_id, target_date)
        return row[0] if row else 0.0  # missing day -> assume no rain, not "skip to next available"

    def reading_exactly(days_ago: int):
        """Returns full (rainfall, soil, reservoir) for an exact date, or None."""
        target_date = (today - timedelta(days=days_ago)).strftime("%Y-%m-%d")
        return _get_reading_on(region_id, target_date)

    # --- Antecedent rainfall sums: today + exact trailing calendar days ---
    rainfall_3d_sum = rainfall_mm + sum(rainfall_on(d) for d in range(1, 3))
    rainfall_7d_sum = rainfall_mm + sum(rainfall_on(d) for d in range(1, 7))

    # --- 1-day rainfall change: exact yesterday, or 0 if no reading that day ---
    yesterday = reading_exactly(1)
    rainfall_change_1day = (rainfall_mm - yesterday[0]) if yesterday else 0.0

    # --- 3-day change in soil saturation / reservoir: exact 3-days-ago, else
    # fall back to the last known reading before today ---
    three_days_ago = reading_exactly(3)
    if three_days_ago:
        soil_saturation_change_3day = soil_saturation_pct - three_days_ago[1]
        reservoir_change_3day = reservoir_level_pct - three_days_ago[2]
    else:
        last_known = _get_last_known_reading_before(region_id, today)
        soil_saturation_change_3day = (soil_saturation_pct - last_known[2]) if last_known else 0.0
        reservoir_change_3day = (reservoir_level_pct - last_known[3]) if last_known else 0.0

    # --- Days since last significant rain (>10mm): scan EXACT calendar days back ---
    if rainfall_mm > SIGNIFICANT_RAIN_MM:
        days_since_significant_rain = 0
    else:
        days_since_significant_rain = 999
        for d in range(1, LOOKBACK_DAYS_FOR_DRY_SPELL + 1):
            if rainfall_on(d) > SIGNIFICANT_RAIN_MM:
                days_since_significant_rain = d
                break

    # --- Calendar features ---
    day_of_year = today.timetuple().tm_yday
    month = today.month
    is_monsoon = 1 if MONSOON_DAY_START <= day_of_year <= MONSOON_DAY_END else 0

    # --- Interaction term ---
    rain_saturation_interaction = rainfall_mm * soil_saturation_pct / 100

    features = {
        "rainfall_mm": rainfall_mm,
        "soil_saturation_pct": soil_saturation_pct,
        "reservoir_level_pct": reservoir_level_pct,
        "rainfall_3d_sum": rainfall_3d_sum,
        "rainfall_7d_sum": rainfall_7d_sum,
        "rainfall_change_1day": rainfall_change_1day,
        "soil_saturation_change_3day": soil_saturation_change_3day,
        "reservoir_change_3day": reservoir_change_3day,
        "rain_saturation_interaction": rain_saturation_interaction,
        "days_since_significant_rain": days_since_significant_rain,
        "month": month,
        "is_monsoon": is_monsoon,
        "urbanization_index": urbanization_index,
    }

    if persist:
        add_reading(region_id, date_str, rainfall_mm, soil_saturation_pct, reservoir_level_pct)

    return features