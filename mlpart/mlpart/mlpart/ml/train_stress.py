"""
Train the stress model: weather + payload + battery health -> power draw (W).

Run from the project root (after python -m ml.gen_data):
    python -m ml.train_stress

Saves:
    ml/models/stress.joblib          the trained model
    ml/models/stress_metrics.json    numbers for your report
    eval/stress_pred_vs_true.png     figure for your report
"""
import json
import os
import time

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

from ml import stress
from ml.stress import FEATURES, formula_power

DATA = "data/stress.csv"
MODEL_OUT = stress.MODEL_PATH
METRICS_OUT = os.path.join(os.path.dirname(MODEL_OUT), "stress_metrics.json")
FIG_OUT = "eval/stress_pred_vs_true.png"


def scores(y, pred):
    return {"MAE_W": float(mean_absolute_error(y, pred)),
            "RMSE_W": float(np.sqrt(np.mean((y - pred) ** 2))),
            "R2": float(r2_score(y, pred))}


def main():
    df = pd.read_csv(DATA)
    train, test = df[df.split == "train"], df[df.split == "test"]
    print(f"train rows: {len(train):,} ({train.seed.nunique()} flights)   "
          f"test rows: {len(test):,} ({test.seed.nunique()} flights)")

    Xtr, ytr = train[FEATURES].to_numpy(), train["true_power"].to_numpy()
    Xte, yte = test[FEATURES].to_numpy(), test["true_power"].to_numpy()

    # ---- train ----
    # 150 trees is a deliberate choice: 300 trees is slightly more accurate but too slow
    # for the viability engine, which calls predict_power about 100 times per drone.
    # Settings were NOT tuned on the test flights.
    t0 = time.time()
    model = HistGradientBoostingRegressor(max_iter=150, learning_rate=0.15,
                                          max_leaf_nodes=31, random_state=42)
    model.fit(Xtr, ytr)
    print(f"trained in {time.time() - t0:.1f}s")

    # ---- evaluate on the test flights ----
    ml_pred = model.predict(Xte)
    f_pred = formula_power(test.headwind.to_numpy(), test.gust.to_numpy(), test.rain.to_numpy(),
                           test.payload.to_numpy(), test.battery_health.to_numpy())

    result = {"all_test_rows": {"ml": scores(yte, ml_pred), "formula": scores(yte, f_pred)}}

    # the hard cases: strong headwind AND gusts (where the interaction term matters)
    hard = ((test.headwind > 6) & (test.gust > 2)).to_numpy()
    if hard.sum() > 50:
        result["hard_cases_headwind>6_and_gust>2"] = {
            "rows": int(hard.sum()),
            "ml": scores(yte[hard], ml_pred[hard]),
            "formula": scores(yte[hard], f_pred[hard])}

    print("\n=== RESULTS ON TEST FLIGHTS ===")
    for name, block in result.items():
        print(f"\n{name}")
        for who in ("formula", "ml"):
            s = block[who]
            print(f"  {who:8s} MAE = {s['MAE_W']:6.2f} W   RMSE = {s['RMSE_W']:6.2f} W   R2 = {s['R2']:.4f}")

    # ---- save model and metrics ----
    os.makedirs(os.path.dirname(MODEL_OUT), exist_ok=True)
    joblib.dump(model, MODEL_OUT)
    with open(METRICS_OUT, "w") as fh:
        json.dump(result, fh, indent=2)
    print(f"\nsaved model   -> {MODEL_OUT}")
    print(f"saved metrics -> {METRICS_OUT}")

    # ---- figure: predicted vs true ----
    rng = np.random.default_rng(0)
    idx = rng.choice(len(yte), size=min(6000, len(yte)), replace=False)
    lim = [yte.min() - 5, yte.max() + 5]
    fig, ax = plt.subplots(1, 2, figsize=(10, 4.6), sharex=True, sharey=True)
    for a, pred, title, m in ((ax[0], f_pred, "Simple formula", result["all_test_rows"]["formula"]),
                              (ax[1], ml_pred, "ML stress model", result["all_test_rows"]["ml"])):
        a.scatter(yte[idx], pred[idx], s=4, alpha=0.3)
        a.plot(lim, lim, "r--", lw=1)
        a.set_title(f"{title}\nMAE {m['MAE_W']:.1f} W, R2 {m['R2']:.3f}")
        a.set_xlabel("true power (W)")
    ax[0].set_ylabel("predicted power (W)")
    plt.tight_layout()
    os.makedirs("eval", exist_ok=True)
    plt.savefig(FIG_OUT, dpi=150)
    print(f"saved figure  -> {FIG_OUT}")

    # ---- speed check: the viability engine calls this ~100 times per drone ----
    import importlib
    importlib.reload(stress)                     # reload so the new model file is picked up
    feats = {k: test[k].to_numpy()[:200] for k in FEATURES}
    stress.predict_power(feats)                  # warm-up
    t0 = time.perf_counter()
    for _ in range(100):
        stress.predict_power(feats)
    ms = (time.perf_counter() - t0) / 100 * 1000
    print(f"\nspeed: 200 rows in {ms:.2f} ms per call   (target: under 2 ms)")


if __name__ == "__main__":
    main()
