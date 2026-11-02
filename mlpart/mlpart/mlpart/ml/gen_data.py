"""
Generate training data by running many random flights in parallel.

Run from the project root:
    python -m ml.gen_data              # 1000 flights
    python -m ml.gen_data --n 200      # quick test run

Outputs (in data/):
    stress.csv   one row per second: weather + drone health -> true power   (stress model)
    flights.pkl  every flight as a DataFrame + metadata                     (fault classifier)

TRAIN / TEST SPLIT is by flight seed, never by row:
    seeds where seed % 5 == 0  (ending in 0 or 5)  -> "test"
    all other seeds                                -> "train"
Rows from one flight are almost identical to each other, so splitting by row
would leak test information into training and inflate every score.
"""
import argparse
import os
import pickle
import time
from collections import Counter
from multiprocessing import Pool, cpu_count

import pandas as pd

from standalone.run_flight import run_flight, random_scenario
# When linking with the backend, change the import above to their run_flight
# (for example: from sim.headless import run_flight). Nothing else changes.

DATA_DIR = "data"
STRESS_COLS = ["headwind", "crosswind", "gust", "rain", "payload",
               "battery_health", "true_power", "seed"]


def split_of(seed):
    return "test" if seed % 5 == 0 else "train"


def one_flight(seed):
    """Worker: run one random flight and return a compact result."""
    sc = random_scenario(seed)
    res = run_flight(**sc)                      # record_env stays False (much smaller)
    df = pd.DataFrame(res["records"])
    df["seed"] = seed
    df["payload"] = sc["payload"]
    return {
        "seed": seed,
        "split": split_of(seed),
        "fault": sc["fault"],
        "fault_time": sc["fault_time"],
        "payload": sc["payload"],
        "outcome": res["outcome"],
        "df": df,
    }


def main(n, workers):
    os.makedirs(DATA_DIR, exist_ok=True)
    seeds = list(range(n))
    t0 = time.time()
    with Pool(workers) as pool:
        flights = pool.map(one_flight, seeds, chunksize=10)
    flights.sort(key=lambda f: f["seed"])
    print(f"Ran {len(flights)} flights in {time.time() - t0:.1f}s using {workers} workers")

    # ---- stress.csv ----
    stress = pd.concat([f["df"][STRESS_COLS] for f in flights], ignore_index=True)
    stress["split"] = stress["seed"].map(split_of)
    stress.to_csv(os.path.join(DATA_DIR, "stress.csv"), index=False)

    # ---- flights.pkl ----
    with open(os.path.join(DATA_DIR, "flights.pkl"), "wb") as fh:
        pickle.dump(flights, fh)

    # ---- sanity report ----
    print("\n=== SUMMARY ===")
    print(f"stress.csv rows: {len(stress):,}")
    print("flights per split:", dict(Counter(f["split"] for f in flights)))

    names = Counter(str(f["fault"]) for f in flights)
    print("\nfault mix (flights):")
    for k, v in sorted(names.items()):
        print(f"  {k:10s} {v:4d}  ({100 * v / len(flights):.0f}%)")

    outs = Counter(f["outcome"]["status"] for f in flights)
    print("\noutcomes:", dict(outs))
    causes = Counter(f["outcome"]["cause"] for f in flights if f["outcome"]["status"] == "lost")
    print("loss causes:", dict(causes))

    labels = pd.concat([f["df"]["fault_label"] for f in flights]).value_counts()
    print("\nrows per fault label (this is what the classifier will learn from):")
    for k, v in labels.items():
        print(f"  {k:15s} {v:7,d}")

    # leakage check: a seed must never be in both splits
    tr = set(stress.loc[stress.split == "train", "seed"])
    te = set(stress.loc[stress.split == "test", "seed"])
    assert not (tr & te), "seed appears in both train and test!"
    print("\nOK: no seed appears in both train and test")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=1000, help="number of flights")
    ap.add_argument("--workers", type=int, default=max(1, cpu_count() - 1))
    a = ap.parse_args()
    main(a.n, a.workers)
