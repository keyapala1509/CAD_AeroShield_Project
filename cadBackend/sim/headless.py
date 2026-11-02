import numpy as np
from config import RNG
from sim.environment import Environment
from sim.drone_physics import TrueDrone


def run_flight(seed=None, storms=3, route=None, payload=0.0, fault=None, fault_time=None):
    """
    Runs one simulated flight at full speed (no real-time delay, no WebSocket).
    Returns a list of per-second records containing both noisy telemetry-style
    values and the true underlying values, plus a fault label.

    seed: optional int, for reproducibility of this specific flight
    storms: number of storm cells in the environment
    route: list of (x,y) waypoints; defaults to a simple diagonal route
    payload: 0-1 extra weight factor
    fault: None, 'battery', 'motor', or 'vibration'
    fault_time: simulated second at which to inject the fault (None = no fault)
    """
    if seed is not None:
        np.random.seed(seed)  # local reseed for this flight only

    if route is None:
        route = [(50, 50), (90, 90)]

    env = Environment(n_storms=storms)
    drone = TrueDrone("headless", x=0, y=0, route=route, payload=payload)
    drone.status = "flying"

    records = []
    t = 0
    max_seconds = 1200  # safety cap so a stuck flight can't loop forever

    while drone.status == "flying" and t < max_seconds:
        if fault is not None and fault_time is not None and t == fault_time:
            drone.inject_fault(fault)

        drone.step(1.0, env)
        env.step(1.0)

        records.append({
            "t": t,
            "x": drone.x,
            "y": drone.y,
            # noisy, sensor-like readings (what a twin would actually see)
            "soc_noisy": drone.soc + RNG.normal(0, 0.5),
            "motorTemp_noisy": drone.motor_temp + RNG.normal(0, 1.5),
            "vibration_noisy": getattr(drone, "vibration", 0.2) + RNG.normal(0, 0.03),
            # true, ground-truth values (only for training labels/eval, never for the twin)
            "soc_true": drone.soc,
            "motorTemp_true": drone.motor_temp,
            "battery_health_true": drone.battery_health,
            "cooling_true": drone.cooling,
            "status": drone.status,
            "fault_label": fault if (fault_time is not None and t >= fault_time) else "healthy",
        })
        t += 1

    return records


if __name__ == "__main__":
    # quick manual test when running this file directly
    recs = run_flight(seed=1, storms=2, fault="battery", fault_time=50)
    print(f"Flight ran for {len(recs)} seconds, final status: {recs[-1]['status']}")
    print("Sample record:", recs[-1])