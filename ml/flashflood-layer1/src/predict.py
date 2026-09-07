"""
Single entry point for backend integration.

Usage from your backend:

    from predict import FloodRiskPredictor

    predictor = FloodRiskPredictor()  # loads model + calibrator ONCE
    result = predictor.predict(
        region_id="region_1",
        date_str="2026-07-15",
        rainfall_mm=45.0,
        soil_saturation_pct=88.0,
        reservoir_level_pct=82.0,
    )
    # result = {
    #     "region_id": "region_1", "date": "2026-07-15",
    #     "raw_probability": 0.34, "calibrated_probability": 0.29,
    #     "flood_risk": True, "threshold_used": 0.182,
    #     "features_used": {...}
    # }

Do NOT re-instantiate FloodRiskPredictor per-request if avoidable -- loading
the model from disk has real overhead. Create one instance at app startup
and reuse it.
"""

import json
import joblib
import pandas as pd
from pathlib import Path
from xgboost import XGBClassifier

import feature_store

CONFIG_PATH = Path("model_config.json")


class FloodRiskPredictor:
    def __init__(self, config_path: Path = CONFIG_PATH):
        with open(config_path) as f:
            self.config = json.load(f)

        self.feature_columns = self.config["feature_columns"]
        self.calibrated_threshold = self.config["calibrated_threshold"]
        self.urbanization_by_region = self.config.get("urbanization_index_by_region", {})

        self.model = XGBClassifier()
        self.model.load_model(self.config["model_path"])
        self.calibrator = joblib.load(self.config["calibrator_path"])

    def predict(self, region_id: str, date_str: str, rainfall_mm: float,
                soil_saturation_pct: float, reservoir_level_pct: float,
                urbanization_index: float = None, persist: bool = True) -> dict:
        """
        persist=True (default) saves this reading to history for future
        predictions in this region. Set persist=False for a "what-if"
        prediction (e.g. testing a hypothetical scenario) that shouldn't
        pollute the region's real history.
        """
        self._validate_inputs(rainfall_mm, soil_saturation_pct, reservoir_level_pct)

        if urbanization_index is None:
            urbanization_index = self.urbanization_by_region.get(region_id, 0.5)

        features = feature_store.build_features(
            region_id=region_id, date_str=date_str,
            rainfall_mm=rainfall_mm, soil_saturation_pct=soil_saturation_pct,
            reservoir_level_pct=reservoir_level_pct, urbanization_index=urbanization_index,
            persist=persist,
        )

        X = pd.DataFrame([features])[self.feature_columns]
        raw_proba = float(self.model.predict_proba(X)[:, 1][0])
        calibrated_proba = float(self.calibrator.predict([raw_proba])[0])
        flood_risk = calibrated_proba >= self.calibrated_threshold

        return {
            "region_id": region_id,
            "date": date_str,
            "raw_probability": round(raw_proba, 4),
            "calibrated_probability": round(calibrated_proba, 4),
            "flood_risk": bool(flood_risk),
            "threshold_used": self.calibrated_threshold,
            "features_used": features,
        }

    @staticmethod
    def _validate_inputs(rainfall_mm, soil_saturation_pct, reservoir_level_pct):
        """Guard against garbage/sensor-glitch input reaching the model silently."""
        if rainfall_mm < 0:
            raise ValueError(f"rainfall_mm cannot be negative: {rainfall_mm}")
        if not (0 <= soil_saturation_pct <= 100):
            raise ValueError(f"soil_saturation_pct must be 0-100: {soil_saturation_pct}")
        if not (0 <= reservoir_level_pct <= 100):
            raise ValueError(f"reservoir_level_pct must be 0-100: {reservoir_level_pct}")
        if rainfall_mm > 500:
            raise ValueError(f"rainfall_mm={rainfall_mm} exceeds sane bound (500mm/day) -- likely a sensor error")


if __name__ == "__main__":
    # Quick manual smoke test
    predictor = FloodRiskPredictor()
    result = predictor.predict(
        region_id="region_1", date_str="2026-07-15",
        rainfall_mm=45.0, soil_saturation_pct=88.0, reservoir_level_pct=82.0,
    )
    print(json.dumps(result, indent=2))