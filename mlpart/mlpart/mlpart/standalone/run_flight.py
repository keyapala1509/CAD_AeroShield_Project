"""
run_flight(): runs ONE flight headless at full speed and returns per-second records.

Each record has two kinds of fields:
  NOISY fields  -> what the twins are allowed to see (same names as the bus messages)
  TRUE fields   -> labels and validation only. Twins must NEVER use these.

The same function name and output format is used by the backend's sim/headless.py,
so linking later only means changing which run_flight you import.
"""
import numpy as np
from common.config import *
from standalone.sim import Environment, Drone, GroundSensors, FAULT_LABEL

# noise levels (standard deviations)
NOISE_SOC = 0.5
NOISE_POWER_FRAC = 0.03
NOISE_TEMP = 1.5
NOISE_VIB = 0.03
NOISE_WIND = 1.5


def run_flight(seed, storms, route, payload=0.0, fault=None, fault_time=None,
               base_wind=(5.0, 2.0), max_time=1500, record_env=False):
    """
    seed       : int, makes the flight repeatable
    storms     : list of dicts {x, y, vx, vy, radius, intensity}
    route      : list of (x, y) waypoints; first = base, last = landing point
    payload    : 0..1 kg
    fault      : None / 'battery' / 'motor' / 'vibration'
    fault_time : simulated second when the fault starts (None = no fault)
    record_env : also return ground-sensor readings and true grids
                 (needed only for the environment twin; makes output larger)

    Returns dict: records, outcome, and (if record_env) ground, grids.
    """
    rng = np.random.default_rng(seed)
    env = Environment(storms, base_wind, rng)
    drone = Drone(route, payload)
    sensors = GroundSensors(rng)

    records, ground, grids = [], [], []
    t = 0
    while t < max_time and drone.status == "flying":
        if fault is not None and fault_time is not None and t >= fault_time and drone.fault is None:
            drone.inject_fault(fault)

        env.step(1.0)
        x, y = float(drone.pos[0]), float(drone.pos[1])   # position at start of step
        tr = drone.step(env, 1.0)

        records.append({
            # ---- noisy (twins may use) ----
            "t": t, "x": x, "y": y,
            "soc": drone.soc + rng.normal(0, NOISE_SOC),
            "power_w": tr["power"] * (1 + rng.normal(0, NOISE_POWER_FRAC)),
            "motor_temp": drone.temp + rng.normal(0, NOISE_TEMP),
            "vib": tr["vib"] + rng.normal(0, NOISE_VIB),
            "wind_u": tr["wind_u"] + rng.normal(0, NOISE_WIND),
            "wind_v": tr["wind_v"] + rng.normal(0, NOISE_WIND),
            # ---- true (labels / validation only) ----
            "true_power": tr["power"], "true_soc": drone.soc, "true_temp": drone.temp,
            "true_vib": tr["vib"], "headwind": tr["headwind"], "crosswind": tr["crosswind"],
            "gust": tr["gust"], "rain": tr["rain"],
            "battery_health": drone.health, "cooling": drone.cooling,
            "fault_label": FAULT_LABEL[drone.fault], "status": drone.status,
        })

        if record_env:
            for g in sensors.read(env):
                g["t"] = t
                ground.append(g)
            if t % 30 == 0:
                rain, u, v = env.grid()
                grids.append({"t": t, "rain": rain, "wind_u": u, "wind_v": v})
        t += 1

    status = drone.status if drone.status != "flying" else "timeout"
    outcome = {
        "status": status,                      # landed / lost / timeout
        "cause": drone.cause,                  # battery / motor / vibration / wind / None
        "duration": t,
        "final_soc": drone.soc,
        "soc_used": 100.0 - drone.soc,
        "max_temp": max(r["true_temp"] for r in records),
        "max_vib": max(r["true_vib"] for r in records),
        "fault": fault,
    }
    result = {"records": records, "outcome": outcome}
    if record_env:
        result["ground"] = ground
        result["grids"] = grids
    return result


def random_scenario(seed):
    """Random but repeatable flight settings, for generating training data.
    Usage: run_flight(**random_scenario(seed))"""
    rng = np.random.default_rng(seed)

    base = np.array([rng.uniform(8, 25), rng.uniform(30, 70)])
    ang = rng.uniform(-0.9, 0.9)
    d = rng.uniform(30, 46)
    target = np.clip(base + d * np.array([np.cos(ang), np.sin(ang)]), 5, 95)

    route = [tuple(base)]
    if rng.random() < 0.5:                       # optional detour waypoint
        mid = (base + target) / 2
        perp = np.array([-(target - base)[1], (target - base)[0]])
        perp = perp / (np.linalg.norm(perp) + 1e-9)
        mid = np.clip(mid + perp * rng.uniform(-8, 8), 5, 95)
        route.append(tuple(mid))
    route += [tuple(target), tuple(base)]

    n_storms = int(rng.choice([0, 1, 2, 3], p=[0.25, 0.35, 0.25, 0.15]))
    storms = []
    for _ in range(n_storms):
        frac = rng.uniform(0.2, 1.0)
        centre = base + frac * (target - base) + rng.normal(0, 10, 2)
        speed = rng.uniform(0, 0.06)
        theta = rng.uniform(0, 2 * np.pi)
        storms.append(dict(x=float(np.clip(centre[0], 0, 100)),
                           y=float(np.clip(centre[1], 0, 100)),
                           vx=float(speed * np.cos(theta)), vy=float(speed * np.sin(theta)),
                           radius=float(rng.uniform(12, 26)),
                           intensity=float(rng.uniform(0.3, 0.9))))

    fault = rng.choice([None, "battery", "motor", "vibration"], p=[0.4, 0.2, 0.2, 0.2])
    fault = None if fault is None or fault == "None" else str(fault)
    fault_time = float(rng.uniform(20, 150)) if fault else None

    return dict(seed=seed, storms=storms, route=route,
                payload=float(rng.uniform(0, 1)), fault=fault, fault_time=fault_time,
                base_wind=(float(rng.normal(5, 1.5)), float(rng.normal(2, 1.0))))
