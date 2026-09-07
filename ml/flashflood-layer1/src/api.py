"""
Flask API service for the Layer 1 flood nowcast model.

Wraps FloodRiskPredictor behind an HTTP endpoint so a non-Python backend
(Node/Express in this case) can call it. The model and calibrator are loaded
ONCE at process startup, not per-request -- reloading from disk on every
request would add unnecessary latency.

Run:
    python src/api.py
Then it listens on http://localhost:5001

Endpoints:
    GET  /health            -> {"status": "ok"}
    POST /predict           -> flood risk for one day/region (builds features from
                               this service's own rolling history store)
    POST /predict/vector    -> flood risk from a ready-made 13-feature vector
                               (stateless; the caller computed the features)
"""

import pandas as pd
from flask import Flask, request, jsonify
from predict import FloodRiskPredictor

app = Flask(__name__)

# Loaded once at startup -- reused across all requests
predictor = FloodRiskPredictor()

@app.route("/")
def index():
    return {
        "status": "flashflood-layer1 API running",
        "endpoints": ["/health", "/predict", "/predict/vector"],
    }

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict():
    body = request.get_json(force=True, silent=True)
    if body is None:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    required_fields = ["region_id", "date", "rainfall_mm", "soil_saturation_pct", "reservoir_level_pct"]
    missing = [f for f in required_fields if f not in body]
    if missing:
        return jsonify({"error": f"Missing required fields: {missing}"}), 400

    try:
        result = predictor.predict(
            region_id=body["region_id"],
            date_str=body["date"],
            rainfall_mm=float(body["rainfall_mm"]),
            soil_saturation_pct=float(body["soil_saturation_pct"]),
            reservoir_level_pct=float(body["reservoir_level_pct"]),
            urbanization_index=body.get("urbanization_index"),  # optional, falls back to config lookup
            persist=body.get("persist", True),
        )
        return jsonify(result), 200

    except ValueError as e:
        # Invalid/out-of-range input (negative rainfall, saturation > 100, sensor-glitch values, etc.)
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        # Anything unexpected -- log it server-side in a real deployment,
        # but don't leak internal details to the caller.
        app.logger.exception("Unexpected error in /predict")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/predict/vector", methods=["POST"])
def predict_vector():
    """
    Score a ready-made feature vector. The caller (the Node backend) computes
    the 13 model features from its own per-watershed sensor history and sends
    them here, so this service stays stateless and works for any region id.

    Body: { "features": { <all 13 feature_columns>: <number>, ... },
            "region_id": "<optional, for the response only>" }
    """
    body = request.get_json(force=True, silent=True)
    if body is None or "features" not in body:
        return jsonify({"error": "Body must be JSON with a 'features' object"}), 400

    feats = body["features"]
    missing = [c for c in predictor.feature_columns if c not in feats]
    if missing:
        return jsonify({"error": f"Missing feature(s): {missing}"}), 400

    try:
        X = pd.DataFrame([{c: float(feats[c]) for c in predictor.feature_columns}])[
            predictor.feature_columns
        ]
        raw_proba = float(predictor.model.predict_proba(X)[:, 1][0])
        calibrated_proba = float(predictor.calibrator.predict([raw_proba])[0])
        return jsonify(
            {
                "region_id": body.get("region_id"),
                "raw_probability": round(raw_proba, 4),
                "calibrated_probability": round(calibrated_proba, 4),
                "flood_risk": bool(calibrated_proba >= predictor.calibrated_threshold),
                "threshold_used": predictor.calibrated_threshold,
            }
        ), 200
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Bad feature value: {e}"}), 400
    except Exception:
        app.logger.exception("Unexpected error in /predict/vector")
        return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)