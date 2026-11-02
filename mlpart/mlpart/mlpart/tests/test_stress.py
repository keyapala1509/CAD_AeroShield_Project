"""Run from the project root:  python -m pytest tests/test_stress.py -v"""
import numpy as np
import pytest

from common.physics import power_w
from ml import stress


def sample(n=200, seed=0):
    r = np.random.default_rng(seed)
    return dict(headwind=r.uniform(-5, 14, n), crosswind=r.uniform(0, 8, n),
                gust=r.uniform(0, 6, n), rain=r.uniform(0, 1, n),
                payload=r.uniform(0, 1, n), battery_health=r.uniform(0.6, 1.0, n))


def test_shape_and_positive():
    out = stress.predict_power(sample(200))
    assert out.shape == (200,)
    assert np.all(out > 0)


def test_single_point_returns_a_number():
    one = {k: float(v[0]) for k, v in sample(1).items()}
    assert isinstance(stress.predict_power(one), float)


def test_fallback_works_without_a_model(monkeypatch):
    monkeypatch.setattr(stress, "_model", None)
    out = stress.predict_power(sample(50))
    assert out.shape == (50,) and np.all(out > 0)


def test_model_is_close_to_true_physics():
    """Uses real held-out flights, because a tree model is only reliable for
    weather combinations the simulator actually produces."""
    import os
    import pandas as pd
    if not stress.model_loaded() or not os.path.exists("data/stress.csv"):
        pytest.skip("needs a trained model and data/stress.csv (run gen_data and train_stress)")
    test = pd.read_csv("data/stress.csv").query("split == 'test'").sample(3000, random_state=0)
    truth = test["true_power"].to_numpy()
    pred = stress.predict_power({k: test[k].to_numpy() for k in stress.FEATURES})
    err = np.abs(pred - truth).mean()
    assert err < 3, f"mean error {err:.2f} W is too large"


def test_weak_battery_costs_more_power():
    base = dict(headwind=6.0, crosswind=1.0, gust=2.0, rain=0.4, payload=0.5)
    healthy = stress.predict_power({**base, "battery_health": 1.0})
    weak = stress.predict_power({**base, "battery_health": 0.6})
    assert weak > healthy
