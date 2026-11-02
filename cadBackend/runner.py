import numpy as np
from config import TICK_INTERVAL, RNG, MAP_UNITS, TOPIC_GROUND_SENSOR, TOPIC_DRONE_TELEMETRY
import bus
from sim.environment import Environment
from sim.drone_physics import TrueDrone
from sim.sensors import make_ground_sensors, publish_drone_telemetry
from twins.env_twin import EnvironmentTwin
from twins.health_twin import HealthTwin
from ml.stress import predict_power
from viability.engine import run_viability
from controller.controller import decide_launch, check_abort
from config import TICK_INTERVAL, RNG, MAP_UNITS, TOPIC_GROUND_SENSOR, TOPIC_DRONE_TELEMETRY, WIND_RATED

class Simulation:
    def __init__(self):
        self.time = 0.0
        self.speed = 1.0
        self.playing = True

        self.env = Environment(n_storms=3)
        self.env_twin = EnvironmentTwin(x_min=0, x_max=MAP_UNITS, y_min=0, y_max=MAP_UNITS)
        self.ground_sensors = make_ground_sensors()

        for gs in self.ground_sensors:
            bus.subscribe(TOPIC_GROUND_SENSOR.format(id=gs.id), self.env_twin.update)

        self.drones = {}
        self.health_twins = {}
        self.abort_counters = {}
        self.decisions = []

        self._make_drone("D1", route=[(60, 20)])
        self._make_drone("D2", route=[(50, 40)])
        self._make_drone("D3", route=[(40, 80)])
        self._make_drone("D4", route=[(50, 50)], idle=True)
        self._make_drone("D5", route=[(50, 50)], idle=True)

        self.drones["D3"].inject_fault("battery")

        self.last_viability = {}

    def _make_drone(self, drone_id, route, idle=False):
        d = TrueDrone(drone_id, x=0, y=0, route=route)
        d.status = "idle" if idle else "flying"
        self.drones[drone_id] = d

        health_twin = HealthTwin(drone_id=drone_id, sample_period=TICK_INTERVAL)
        self.health_twins[drone_id] = health_twin
        bus.subscribe(TOPIC_DRONE_TELEMETRY.format(id=drone_id), health_twin.update)

        self.abort_counters[drone_id] = 0

    def step(self, dt):
        if not self.playing:
            return
        dt = dt * self.speed
        self.time += dt

        self.env.step(dt)

        for gs in self.ground_sensors:
            gs.publish_reading(self.env, t=self.time)

        for drone in self.drones.values():
            drone.step(dt, self.env)

            u, v = self.env.wind(drone.x, drone.y)
            wind_speed = float(np.hypot(u, v))
            rain = float(self.env.rain(drone.x, drone.y))
            health_twin = self.health_twins[drone.id]
            power_w = float(predict_power({
                "headwind": wind_speed,
                "crosswind": 0.0,
                "gust": abs(RNG.normal(0, 1.0)),
                "rain": rain,
                "payload": 0.0,
                "battery_health": health_twin.battery_health,
            }))

            publish_drone_telemetry(drone, t=self.time, power_w=power_w)

        for drone_id, drone in self.drones.items():
            if drone.status not in ("flying", "returning"):
                continue

            health_twin = self.health_twins[drone_id]
            result = run_viability(
                self.env_twin, health_twin, route=drone.route,
                start_x=0, start_y=0, n=100
            )
            self.last_viability[drone_id] = result

            already_decided = any(d["drone_id"] == drone_id and d["decision"] in ("GO", "NO-GO", "REROUTE")
                                   for d in self.decisions)
            if not already_decided:
                decision = decide_launch(drone_id, result)
                self.decisions.append(decision)
                if decision["decision"] == "NO-GO":
                    drone.status = "aborted"

            s_return_estimate = 0.5
            should_abort, count, reason = check_abort(
                drone_id, result["sEnd"], s_return_estimate, self.abort_counters[drone_id]
            )
            self.abort_counters[drone_id] = count
            if should_abort and drone.status == "flying":
                drone.status = "aborted"
                self.decisions.append({"drone_id": drone_id, "decision": "ABORT", "reason": reason})



    def _latest_decision_for(self, drone_id):
        """Find this drone's most recent entry in the decisions log."""
        for d in reversed(self.decisions):
            if d.get("drone_id") == drone_id:
                return d
        return None

    def snapshot(self):
        grids = self.env_twin.grids()
        wind_grid = np.hypot(grids["wind_u"], grids["wind_v"])
        rain_grid = grids["rain"]

        drones_out = []
        for did, d in self.drones.items():
            latest = self._latest_decision_for(did)
            viability = self.last_viability.get(did, {})

            drones_out.append({
                **d.state(),
                "motor_temp": d.motor_temp,
                "sEnd": viability.get("sEnd", None),
                "decision": latest["decision"] if latest else "STANDBY",
                "dominantRisk": (latest.get("dominantRisk") if latest else None)
                                 or viability.get("dominantRisk", "none"),
                "decisionReason": latest["reason"] if latest else None,
                "health": self.health_twins[did].state(),
            })
            if viability.get("sEnd") is not None:
                drones_out[-1]["survival"] = round(viability["sEnd"] * 100, 1)
            if drones_out[-1]["sEnd"] is None:
                del drones_out[-1]["sEnd"]
            drones_out[-1]["x"] = round(d.x, 1)
            drones_out[-1]["y"] = round(d.y, 1)
            drones_out[-1]["motor_temp"] = round(d.motor_temp, 1)
            drones_out[-1]["dominantRisk"] = str(drones_out[-1]["dominantRisk"]).upper()

        return {
            "time": round(self.time, 1),
            "drones": drones_out,
            "windGrid": np.round(wind_grid, 1).tolist(),
            "rainGrid": np.round(rain_grid, 1).tolist(),
            "wind_grid": np.round(wind_grid, 1).tolist(),
            "rain_grid": np.round(rain_grid, 1).tolist(),
            "max_wind": round(float(wind_grid.max()), 1),
            "avg_wind": round(float(wind_grid.mean()), 1),
            "max_rain": round(float(rain_grid.max()), 2),
            "hazard_airspace": round(float((wind_grid > WIND_RATED).mean() * 100), 1),
            "decisions": self.decisions[-10:],
        }