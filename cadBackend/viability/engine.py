import numpy as np
from config import (
    N_SAMPLES, P0, C_NOM, T_AMBIENT, MOTOR_LIMIT, VIB_LIMIT,
    SOC_RESERVE, WIND_RATED, RNG
)
from ml.stress import predict_power


def build_segments(route, start_x, start_y, speed=0.24, seg_length=2.0):
    """Breaks a route (list of waypoints) into short segments, including
    the return leg back to the start. Each segment gets an estimated ETA."""
    full_path = [(start_x, start_y)] + list(route) + [(start_x, start_y)]  # out and back
    segments = []
    t = 0.0
    for i in range(len(full_path) - 1):
        x0, y0 = full_path[i]
        x1, y1 = full_path[i + 1]
        dist = np.hypot(x1 - x0, y1 - y0)
        n_steps = max(1, int(dist / seg_length))
        for step in range(n_steps):
            frac0 = step / n_steps
            frac1 = (step + 1) / n_steps
            sx = x0 + (x1 - x0) * frac1
            sy = y0 + (y1 - y0) * frac1
            seg_dist = dist / n_steps
            dt = seg_dist / speed
            t += dt
            segments.append({"x": sx, "y": sy, "eta": t, "dt": dt})
    return segments


def stress_formula(wind_speed, gust, rain, headwind, health, payload):
    """Formula-based fallback for power draw. Person 3 (ML) may later
    replace this call with a trained model — same inputs/outputs."""
    power = (
        P0 * (1 + 0.004 * headwind ** 2 + 0.3 * rain + 0.01 * gust
              + 0.0006 * gust * headwind ** 2)
        * (1 + 0.5 * (1 - health))
        * (1 + 0.15 * payload)
    )
    return power

def run_viability(env_twin, health_twin, route, start_x, start_y, payload=0.0,
                   n=N_SAMPLES, dt_cap=1.0):
    """
    Runs a Monte Carlo simulation of the drone's flight over many sampled
    possible futures (uncertain health + uncertain weather forecast),
    and returns how many of them survive.

    Returns a dict: curve, sEnd, dominantRisk, ci_low, ci_high
    """
    segments = build_segments(route, start_x, start_y)

    theta = health_twin.sample_params(n)
    member = RNG.integers(0, len(env_twin.M), n)  # ONE forecast member per sample, fixed for the whole route

    soc = np.full(n, health_twin.soc)
    temp = np.full(n, health_twin.temperature)
    alive = np.ones(n, dtype=bool)
    cause = np.zeros(n, dtype=int)  # 0=none, 1=battery, 2=motor, 3=wind, 4=vibration

    curve = []

    for seg in segments:
        wind_speed = np.empty(n)
        gust = np.empty(n)
        rain = np.empty(n)
        for i in range(n):
            q = env_twin.query(seg["x"], seg["y"], seg["eta"], int(member[i]))
            wind_speed[i] = q["wind_speed"]
            gust[i] = q["gust"]
            rain[i] = q["rain"]

        power = predict_power({
            "headwind": wind_speed,
            "crosswind": np.zeros_like(wind_speed),
            "gust": gust,
            "rain": rain,
            "payload": np.full_like(wind_speed, payload),
            "battery_health": theta["battery_health"],
        })

        soc = soc - power * seg["dt"] / (3600 * C_NOM * theta["battery_health"]) * 100
        temp = temp + (0.6 * power / P0 - 0.02 * theta["cooling"] * (temp - T_AMBIENT)) * seg["dt"]
        vibration = 0.2 + 0.02 * gust + (1.0 - theta["vibration_health"])

        newly_dead_battery = alive & (soc < SOC_RESERVE)
        newly_dead_motor = alive & (temp > MOTOR_LIMIT) & ~newly_dead_battery
        newly_dead_wind = alive & (wind_speed > WIND_RATED) & ~newly_dead_battery & ~newly_dead_motor
        newly_dead_vib = alive & (vibration > VIB_LIMIT) & ~newly_dead_battery & ~newly_dead_motor & ~newly_dead_wind

        cause[newly_dead_battery] = 1
        cause[newly_dead_motor] = 2
        cause[newly_dead_wind] = 3
        cause[newly_dead_vib] = 4

        alive &= ~(newly_dead_battery | newly_dead_motor | newly_dead_wind | newly_dead_vib)
        curve.append(alive.mean())

    s_end = curve[-1] if curve else 1.0
    ci = 1.96 * np.sqrt(s_end * (1 - s_end) / n) if n > 0 else 0.0

    # downsample curve to 50 points for the frontend
    curve_arr = np.array(curve)
    if len(curve_arr) > 50:
        idx = np.linspace(0, len(curve_arr) - 1, 50).astype(int)
        curve_downsampled = curve_arr[idx].tolist()
    else:
        curve_downsampled = curve_arr.tolist()

    cause_names = {0: "none", 1: "battery", 2: "motor", 3: "wind", 4: "vibration"}
    if (cause > 0).any():
        dominant = cause_names[np.bincount(cause[cause > 0]).argmax()]
    else:
        dominant = "none"

    return {
        "curve": curve_downsampled,
        "sEnd": round(float(s_end), 3),
        "dominantRisk": dominant,
        "ciLow": round(float(max(0, s_end - ci)), 3),
        "ciHigh": round(float(min(1, s_end + ci)), 3),
    }