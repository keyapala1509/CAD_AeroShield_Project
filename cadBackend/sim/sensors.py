import numpy as np
from config import RNG, MAP_UNITS, TOPIC_DRONE_TELEMETRY, TOPIC_GROUND_SENSOR
import bus


def publish_drone_telemetry(drone, t=0.0, power_w=0.0):
    """Publishes a NOISY version of the drone's true state. Never publishes
    battery_health, cooling, or fault_vib -- those are hidden truths the twin
    must infer, not read directly.

    t and power_w are passed in by the caller (runner.py) since the drone
    itself doesn't track sim time or its own instantaneous power draw."""
    topic = TOPIC_DRONE_TELEMETRY.format(id=drone.id)
    vib = getattr(drone, "vibration", 0.2) + RNG.normal(0, 0.03)
    msg = {
        "id": drone.id,
        "x": drone.x,
        "y": drone.y,
        "t": t,
        "soc": drone.soc + RNG.normal(0, 0.5),        
        "battery_health": drone.battery_health + RNG.normal(0, 0.02),
        "motorTemp": drone.motor_temp + RNG.normal(0, 1.5),   # kept for dashboard / old consumers
        "motor_temp": drone.motor_temp + RNG.normal(0, 1.5),  # what HealthTwin.update() reads
        "vibration": vib,  # kept for dashboard / old consumers
        "vib": vib,        # what HealthTwin.update() reads
        "power_w": power_w,
        "gust": abs(RNG.normal(0, 1.0)),  # approximation: ground truth doesn't isolate gust
    }
    bus.publish(topic, msg)


class GroundSensor:
    def __init__(self, sensor_id, x, y):
        self.id = sensor_id
        self.x = x
        self.y = y

    def publish_reading(self, environment, t=0.0):
        # 3% chance this sensor's reading drops out (simulates real-world flakiness)
        if RNG.random() < 0.03:
            return
        rain = environment.rain(self.x, self.y) + RNG.normal(0, 0.02)
        u, v = environment.wind(self.x, self.y)
        wind_speed = np.hypot(u, v) + RNG.normal(0, 1.5)
        topic = TOPIC_GROUND_SENSOR.format(id=self.id)
        bus.publish(topic, {
            "id": self.id, "x": self.x, "y": self.y, "t": t,
            "rain": rain, "wind": wind_speed,       # kept for dashboard / old consumers
            "wind_u": u + RNG.normal(0, 0.3),       # what EnvironmentTwin.update() reads
            "wind_v": v + RNG.normal(0, 0.3),
            "gust": abs(RNG.normal(0, 1.0)),        # approximation, same caveat as above
        })


def make_ground_sensors(n_x=5, n_y=4):
    """Creates a 5x4 grid of fixed ground sensors spread across the map."""
    sensors = []
    xs = np.linspace(10, MAP_UNITS - 10, n_x)
    ys = np.linspace(10, MAP_UNITS - 10, n_y)
    i = 0
    for x in xs:
        for y in ys:
            sensors.append(GroundSensor(f"G{i}", x, y))
            i += 1
    return sensors