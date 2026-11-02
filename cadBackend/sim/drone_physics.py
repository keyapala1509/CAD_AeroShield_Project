import numpy as np
from config import (
    P0, C_NOM, T_AMBIENT, MOTOR_LIMIT, VIB_LIMIT,
    SOC_RESERVE, WIND_RATED, CRUISE_SPEED, RNG
)


class TrueDrone:
    def __init__(self, drone_id, x, y, route, payload=0.0):
        self.id = drone_id
        self.x = x
        self.y = y
        self.route = route          # list of (x, y) waypoints
        self.route_index = 0
        self.payload = payload      # 0-1, extra weight factor
        self.status = "idle"        # idle, flying, returning, landed, aborted, lost

        self.soc = 100.0            # battery %, starts full
        self.motor_temp = T_AMBIENT
        self.battery_health = 1.0   # 1.0 = healthy, lower = degraded
        self.cooling = 1.0          # 1.0 = normal cooling, lower = degraded
        self.fault_vib = 0.0        # extra vibration from a fault, 0 = none

    def inject_fault(self, fault_type):
        """Corrupts the TRUE state — the twin must discover this on its own."""
        if fault_type == "battery":
            self.battery_health = 0.6
        elif fault_type == "motor":
            self.cooling = 0.5
        elif fault_type == "vibration":
            self.fault_vib = 0.5

    def step(self, dt, environment):
        if self.status not in ("flying", "returning"):
            return

        # move toward next waypoint
        if self.route_index < len(self.route):
            target_x, target_y = self.route[self.route_index]
            dx, dy = target_x - self.x, target_y - self.y
            dist = np.hypot(dx, dy)
            move = CRUISE_SPEED * dt
            if dist <= move:
                self.x, self.y = target_x, target_y
                self.route_index += 1
            else:
                self.x += move * dx / dist
                self.y += move * dy / dist

        if self.route_index >= len(self.route):
            self.status = "landed"
            return
        
        # read local weather
        u, v = environment.wind(self.x, self.y)
        rain = environment.rain(self.x, self.y)
        wind_speed = np.hypot(u, v)
        headwind = wind_speed  # simplified: treat all wind as headwind
        gust = RNG.normal(0, 1.0)

        # physics formulas
        power = (
            P0 * (1 + 0.004 * headwind ** 2 + 0.3 * rain + 0.01 * gust
                  + 0.0006 * gust * headwind ** 2)
            * (1 + 0.5 * (1 - self.battery_health))
            * (1 + 0.15 * self.payload)
        )
        self.soc -= power * dt / (3600 * C_NOM * self.battery_health) * 100
        self.motor_temp += (
            0.6 * power / P0 - 0.02 * self.cooling * (self.motor_temp - T_AMBIENT)
        ) * dt
        self.vibration = 0.2 + 0.02 * gust + self.fault_vib

        # check failure conditions
        if (self.soc < 0 or self.motor_temp > MOTOR_LIMIT
                or self.vibration > VIB_LIMIT or wind_speed > WIND_RATED):
            self.status = "lost"

    def state(self):
        return {
            "id": self.id, "x": self.x, "y": self.y, "status": self.status,
            "soc": round(self.soc, 1), "motorTemp": round(self.motor_temp, 1),
            "vibration": round(getattr(self, "vibration", 0.2), 2),
        }