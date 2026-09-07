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
    GET  /health           -> {"status": "ok"}
    POST /predict           -> flood risk assessment for one day/region
"""

from flask import Flask, request, jsonify
from predict import FloodRiskPredictor

app = Flask(__name__)

# Loaded once at startup -- reused across all requests
predictor = FloodRiskPredictor()

@app.route("/")
def index():
    return {"status": "flashflood-layer1 API running", "endpoints": ["/health", "/predict"]}

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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)