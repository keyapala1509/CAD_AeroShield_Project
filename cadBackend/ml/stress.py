"""
stress.py  -  the function the viability engine calls.

    predict_power(features) -> power in watts

'features' is a dict with equal-length numpy arrays (or single numbers):
    headwind, crosswind, gust, rain, payload, battery_health

Note: the model is only reliable for weather combinations the simulator produces
(tree models cannot extrapolate). Real forecasts from the environment twin are
realistic, so this is fine in normal use.

If the trained model file is missing, it silently falls back to a plain physics
formula, so nothing in the demo ever breaks because a model wasn't trained yet.
"""
import os
import numpy as np
from config import P0

FEATURES = ["headwind", "crosswind", "gust", "rain", "payload", "battery_health"]
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "stress.joblib")

# ---- load the model once, when this file is first imported ----
_model = None
try:
    import joblib
    _model = joblib.load(MODEL_PATH)
except Exception:
    _model = None            # missing or unreadable -> use the formula fallback


def model_loaded():
    return _model is not None


def formula_power(headwind, gust, rain, payload, battery_health):
    """Simple engineering estimate of power draw (the fallback, and the
    baseline the ML model must beat). It knows that headwind, rain, gusts,
    payload and a weak battery all cost power, but it does NOT know that
    gusts in a strong headwind cost extra (the interaction term)."""
    h = np.maximum(headwind, 0)
    return (P0 * (1 + 0.004 * h**2 + 0.3 * rain + 0.01 * gust)
            * (1 + 0.5 * (1 - battery_health)) * (1 + 0.15 * payload))


def predict_power(features):
    """Predict power draw in watts. Works for one point or thousands at once."""
    arrs = np.broadcast_arrays(*[np.asarray(features[k], dtype=float) for k in FEATURES])
    shape = arrs[0].shape

    if _model is not None:
        X = np.column_stack([a.ravel() for a in arrs])
        out = _model.predict(X).reshape(shape)
    else:
        out = formula_power(features["headwind"], features["gust"], features["rain"],
                            features["payload"], features["battery_health"])
        out = np.asarray(out, dtype=float)

    return float(out) if out.ndim == 0 else out
