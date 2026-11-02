"""
Standalone simulator: a temporary stand-in for the backend's sim/ folder.

It contains the GROUND TRUTH world: storms, one drone, and ground sensors.
Only run_flight.py and validation scripts may read the true values from here.
The twins must only ever see the noisy messages that run_flight.py produces.

All physics formulas come from common/physics.py (shared with the backend).
Coordinates: x = east, y = north, map units 0..100 (1 unit = 50 m).
"""
import numpy as np
from common.config import *
from common import physics as ph

# Fault names used when injecting -> labels used for ML
FAULT_LABEL = {
    None: "healthy",
    "battery": "weak_battery",
    "motor": "motor_overheat",
    "vibration": "vibration",
}

GUST_SCALE = 0.25        # gust size relative to local wind speed
WIND_GUST_FACTOR = 0.1   # how much gust counts toward the wind rating check


# ----------------------------------------------------------------------------
# Environment (true weather)
# ----------------------------------------------------------------------------
class Environment:
    """Storm cells that drift. Rain and wind are computed from them."""

    def __init__(self, storms, base_wind=(5.0, 2.0), rng=None):
        # storms: list of dicts with x, y, vx, vy, radius, intensity
        self.storms = [dict(s) for s in storms]
        self.base = np.array(base_wind, dtype=float)
        self.rng = rng if rng is not None else np.random.default_rng(SEED)
        self.g = 0.0  # gust process, unit variance, correlated over time

    def step(self, dt=1.0):
        for s in self.storms:
            s["x"] += s["vx"] * dt
            s["y"] += s["vy"] * dt
            if s["x"] < 0 or s["x"] > MAP:
                s["vx"] *= -1
                s["x"] = float(np.clip(s["x"], 0, MAP))
            if s["y"] < 0 or s["y"] > MAP:
                s["vy"] *= -1
                s["y"] = float(np.clip(s["y"], 0, MAP))
        # AR(1) gust process
        self.g = 0.8 * self.g + 0.6 * self.rng.standard_normal()

    def rain(self, x, y):
        """Rain intensity 0..1 at (x, y). Accepts scalars or arrays."""
        x = np.asarray(x, dtype=float)
        y = np.asarray(y, dtype=float)
        r = np.zeros(np.broadcast(x, y).shape)
        for s in self.storms:
            d2 = (x - s["x"]) ** 2 + (y - s["y"]) ** 2
            r = r + s["intensity"] * np.exp(-d2 / (2 * (s["radius"] / 2) ** 2))
        return np.clip(r, 0, 1)

    def wind_mean(self, x, y):
        """Mean wind (u, v) in m/s: base wind, stronger inside storms."""
        k = ph.wind_from_rain(1.0, self.rain(x, y))
        return self.base[0] * k, self.base[1] * k

    def wind_and_gust(self, x, y):
        """Returns (u, v, speed, gust_signed).
        u, v are the mean wind. gust_signed is along the wind direction."""
        u, v = self.wind_mean(x, y)
        u, v = float(u), float(v)
        speed = float(np.hypot(u, v))
        gust_signed = GUST_SCALE * speed * self.g
        return u, v, speed, gust_signed

    def grid(self):
        """True rain, wind_u, wind_v on the GRID x GRID cell centres.
        Arrays are indexed [row = y, col = x]. Used for validating the env twin."""
        xs = (np.arange(GRID) + 0.5) * MAP / GRID
        X, Y = np.meshgrid(xs, xs)
        rain = self.rain(X, Y)
        u, v = self.wind_mean(X, Y)
        return rain, u, v


# ----------------------------------------------------------------------------
# Drone (true physical state)
# ----------------------------------------------------------------------------
class Drone:
    """The real drone. Its health values are hidden from the twins."""

    def __init__(self, route, payload=0.0):
        self.route = [np.array(p, dtype=float) for p in route]
        self.pos = self.route[0].copy()
        self.wp = 1                      # index of the waypoint we are flying to
        self.payload = payload
        self.soc = 100.0                 # %
        self.temp = float(T_AMBIENT)     # motor temperature, deg C
        self.health = 1.0                # battery health (1 = new)
        self.cooling = 1.0               # motor cooling factor (1 = normal)
        self.fault_vib = 0.0             # extra vibration from a fault
        self.fault = None                # None / 'battery' / 'motor' / 'vibration'
        self.status = "flying"           # flying / landed / lost
        self.cause = None                # why it was lost

    def inject_fault(self, kind):
        self.fault = kind
        if kind == "battery":
            self.health = 0.6
        elif kind == "motor":
            self.cooling = 0.5
        elif kind == "vibration":
            self.fault_vib = 0.5

    def step(self, env, dt=1.0):
        """Advance one time step. Returns the TRUE quantities for this step."""
        # heading toward the next waypoint
        target = self.route[self.wp]
        vec = target - self.pos
        dist = float(np.hypot(vec[0], vec[1]))
        h = vec / dist if dist > 1e-9 else np.zeros(2)

        # local weather
        u, v, speed, gust_signed = env.wind_and_gust(self.pos[0], self.pos[1])
        rain = float(env.rain(self.pos[0], self.pos[1]))
        gust = abs(gust_signed)
        headwind = -(u * h[0] + v * h[1])        # positive = wind against us
        crosswind = abs(-u * h[1] + v * h[0])

        # physics (shared formulas)
        power = float(ph.power_w(headwind, gust, rain, self.payload, self.health))
        self.soc -= float(ph.soc_drop_pct(power, dt, self.health))
        self.temp += float(ph.motor_temp_rate(power, self.cooling, self.temp)) * dt
        vib = float(ph.vibration(gust, self.fault_vib))

        # move (ground speed is constant: a simplification)
        move = min(CRUISE * dt, dist)
        self.pos = self.pos + h * move
        if dist - move < 1e-6:
            self.wp += 1
            if self.wp >= len(self.route):
                self.status = "landed"

        # failure checks
        cause = None
        if self.soc <= 0:
            cause = "battery"
        elif self.temp > MOTOR_LIMIT:
            cause = "motor"
        elif vib > VIB_LIMIT:
            cause = "vibration"
        elif speed + WIND_GUST_FACTOR * gust > WIND_RATED:
            cause = "wind"
        if cause is not None:
            self.status = "lost"
            self.cause = cause

        # wind the drone would actually feel (mean + gust along wind direction)
        if speed > 1e-9:
            wu = u + gust_signed * u / speed
            wv = v + gust_signed * v / speed
        else:
            wu, wv = u, v

        return dict(power=power, headwind=headwind, crosswind=crosswind,
                    gust=gust, rain=rain, vib=vib, wind_u=wu, wind_v=wv)


# ----------------------------------------------------------------------------
# Ground sensors (fixed, noisy, occasionally drop out)
# ----------------------------------------------------------------------------
class GroundSensors:
    """20 sensors on a 5 x 4 grid."""

    def __init__(self, rng):
        self.rng = rng
        xs = [10, 30, 50, 70, 90]
        ys = [12.5, 37.5, 62.5, 87.5]
        self.sensors = [(f"G{i:02d}", x, y)
                        for i, (y, x) in enumerate((y, x) for y in ys for x in xs)]

    def read(self, env):
        out = []
        for sid, x, y in self.sensors:
            if self.rng.random() < 0.03:      # dropout
                continue
            rain = float(env.rain(x, y))
            u, v, speed, gs = env.wind_and_gust(x, y)
            if speed > 1e-9:
                u, v = u + gs * u / speed, v + gs * v / speed
            out.append(dict(id=sid, x=x, y=y,
                            rain=max(0.0, rain + self.rng.normal(0, 0.03)),
                            wind_u=u + self.rng.normal(0, 0.7),
                            wind_v=v + self.rng.normal(0, 0.7)))
        return out
