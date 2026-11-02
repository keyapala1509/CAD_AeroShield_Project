from config import RNG

# TEMPORARY STUB — estimates health from the drone's own telemetry with
# a fixed uncertainty. Person 2 will replace this with a real estimator
# that only uses noisy sensor messages from the bus.


class HealthTwinStub:
    def __init__(self, drone):
        self.drone = drone

    def sample_params(self, n):
        """
        Returns n plausible parameter sets, representing our uncertainty
        about this drone's true health.
        """
        return {
            "health": RNG.normal(self.drone.battery_health, 0.05, size=n).clip(0.3, 1.0),
            "cooling": RNG.normal(self.drone.cooling, 0.05, size=n).clip(0.3, 1.0),
            "fault_vib": RNG.normal(self.drone.fault_vib, 0.02, size=n).clip(0, 1.0),
            "soc": RNG.normal(self.drone.soc, 1.0, size=n),
            "motor_temp": RNG.normal(self.drone.motor_temp, 1.5, size=n),
        }

    def state(self):
        return {
            "soc": round(self.drone.soc, 1),
            "motorTemp": round(self.drone.motor_temp, 1),
            "vibration": round(getattr(self.drone, "vibration", 0.2), 2),
            "health": round(self.drone.battery_health, 2),
            "faultLabel": "healthy",       # stub doesn't do real fault detection yet
            "faultConfidence": 0.0,
        }