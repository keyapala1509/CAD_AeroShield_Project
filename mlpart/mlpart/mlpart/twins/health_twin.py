import os
import numpy as np
from collections import deque

from ml.fault import FaultPredictor


class HealthTwin:
    """
    Digital twin for monitoring the health of a drone.

    The twin receives telemetry only and maintains an internal
    rolling representation of battery, motor and vibration health.

    It does not directly access simulator ground truth.
    """

    BUFFER_SECONDS = 60

    def __init__(
    self,
    drone_id="drone_1",
    sample_period=1.0,
    predictor=None):
        self.drone_id = drone_id
        self.sample_period = float(sample_period)

        # 60-second rolling telemetry buffer
        maxlen = int(self.BUFFER_SECONDS / self.sample_period)

        self.buffer = deque(maxlen=maxlen)

        # Health values
        self.battery_health = 1.0
        self.cooling = 1.0
        self.vibration_health = 1.0

        # State estimation
        self.soc_measured = 100.0
        self.soc_predicted = 100.0
        self.soc = 100.0

        self.temperature = 25.0
        self.vibration = 0.0
        self.power = 0.0
        self.gust = 0.0

        # Fault state
        self.fault = "healthy"
        self.fault_confidence = 0.0

        # Uncertainty
        self.uncertainty = {
            "battery": 0.0,
            "cooling": 0.0,
            "vibration": 0.0,
        }

        # Fault predictor
# Reuse an existing predictor when provided.
        self.predictor = (
        predictor
        if predictor is not None
        else FaultPredictor()
        )

        # Last update time
        self.time = 0.0

    # ---------------------------------------------------------
    # TELEMETRY UPDATE
    # ---------------------------------------------------------

    def update(self, telemetry):
        """
        Update the health twin using one telemetry sample.

        Expected fields:
            t
            soc
            power_w
            motor_temp
            vib
            gust
            battery_health
            cooling
        """

        if telemetry is None:
            return self.state()

        sample = dict(telemetry)

        # Time
        t = sample.get("t", self.time + self.sample_period)

        try:
            self.time = float(t)
        except (TypeError, ValueError):
            self.time += self.sample_period

        # -----------------------------------------------------
        # Read measured telemetry
        # -----------------------------------------------------

        self.soc_measured = self._number(
            sample.get("soc"),
            self.soc_measured
        )

        self.power = self._number(
            sample.get("power_w"),
            self.power
        )

        self.temperature = self._number(
            sample.get("motor_temp"),
            self.temperature
        )

        self.vibration = self._number(
            sample.get("vib"),
            self.vibration
        )

        self.gust = self._number(
            sample.get("gust"),
            self.gust
        )

        # -----------------------------------------------------
        # Predicted SoC
        # -----------------------------------------------------

        self._update_predicted_soc()

        # Required 70/30 SoC blend
        self.soc = (
            0.7 * self.soc_measured
            + 0.3 * self.soc_predicted
        )

        # -----------------------------------------------------
        # Battery health
        # -----------------------------------------------------

        measured_battery_health = sample.get("battery_health")

        if measured_battery_health is not None:
            measured_battery_health = self._clip(
                self._number(measured_battery_health, 1.0),
                0.0,
                1.0
            )

            # Do not directly trust one measurement.
            self.battery_health = (
                0.7 * self.battery_health
                + 0.3 * measured_battery_health
            )

        else:
            self._estimate_battery_health()

        # -----------------------------------------------------
        # Cooling health
        # -----------------------------------------------------

        self._update_cooling()

        # -----------------------------------------------------
        # Vibration health
        # -----------------------------------------------------

        self._update_vibration()

        # -----------------------------------------------------
        # Store telemetry in rolling buffer
        # -----------------------------------------------------

        sample["motor_temp"] = self.temperature
        sample["vib"] = self.vibration
        sample["power_w"] = self.power
        sample["gust"] = self.gust
        sample["soc"] = self.soc
        sample["battery_health"] = self.battery_health
        sample["cooling"] = self.cooling
        sample["dt"] = self.sample_period

        self.buffer.append(sample)

        # -----------------------------------------------------
        # ML fault prediction
        # -----------------------------------------------------

        if len(self.buffer) >= 30:
            self._update_fault_prediction()

        return self.state()

    # ---------------------------------------------------------
    # SOC ESTIMATION
    # ---------------------------------------------------------

    def _update_predicted_soc(self):
        """
        Predict SoC from recent power consumption.

        The estimate is intentionally simple so that the twin
        remains usable without simulator ground truth.
        """

        if len(self.buffer) == 0:
            self.soc_predicted = self.soc_measured
            return

        previous_soc = self.soc_predicted

        # Approximate battery energy capacity.
        # This is a normalized estimate for the standalone twin.
        battery_capacity_wh = 100.0

        energy_used_wh = (
            max(self.power, 0.0)
            * self.sample_period
            / 3600.0
        )

        soc_drop = (
            energy_used_wh
            / battery_capacity_wh
            * 100.0
        )

        health_factor = max(
            self.battery_health,
            0.1
        )

        soc_drop /= health_factor

        self.soc_predicted = self._clip(
            previous_soc - soc_drop,
            0.0,
            100.0
        )

    # ---------------------------------------------------------
    # BATTERY HEALTH
    # ---------------------------------------------------------

    def _estimate_battery_health(self):
        """
        Estimate battery health using the relationship between
        observed SoC decrease and expected energy consumption.
        """

        if len(self.buffer) < 2:
            return

        previous = self.buffer[-1]

        previous_soc = self._number(
            previous.get("soc"),
            self.soc_measured
        )

        observed_drop = max(
            0.0,
            previous_soc - self.soc_measured
        )

        expected_drop = (
            max(self.power, 0.0)
            * self.sample_period
            / 3600.0
            / 100.0
            * 100.0
        )

        if expected_drop > 1e-6:
            ratio = observed_drop / expected_drop

            estimated = 1.0 / max(ratio, 1.0)

            self.battery_health = (
                0.8 * self.battery_health
                + 0.2 * self._clip(
                    estimated,
                    0.0,
                    1.0
                )
            )

    # ---------------------------------------------------------
    # COOLING HEALTH
    # ---------------------------------------------------------

    def _update_cooling(self):
        """
        Estimate cooling health from motor temperature slope.
        """

        if len(self.buffer) < 5:
            return

        temps = [
            self._number(x.get("motor_temp"), self.temperature)
            for x in self.buffer
        ]

        recent = np.asarray(temps[-10:], dtype=float)

        if len(recent) < 2:
            return

        x = np.arange(len(recent))

        try:
            slope = float(np.polyfit(x, recent, 1)[0])
        except Exception:
            slope = 0.0

        # Higher positive temperature slope means weaker cooling.
        cooling_estimate = 1.0 - max(0.0, slope) / 5.0

        cooling_estimate = self._clip(
            cooling_estimate,
            0.0,
            1.0
        )

        self.cooling = (
            0.8 * self.cooling
            + 0.2 * cooling_estimate
        )

    # ---------------------------------------------------------
    # VIBRATION HEALTH
    # ---------------------------------------------------------

    def _update_vibration(self):
        """
        Calculate vibration excess according to the project
        specification:

        max(0, EMA(vibration) - 0.2 - 0.02 * gust)
        """

        if len(self.buffer) == 0:
            ema_vibration = self.vibration

        else:
            vibrations = [
                self._number(x.get("vib"), 0.0)
                for x in self.buffer
            ]

            alpha = 0.2
            ema_vibration = vibrations[0]

            for value in vibrations[1:]:
                ema_vibration = (
                    alpha * value
                    + (1.0 - alpha) * ema_vibration
                )

        gust_est = max(self.gust, 0.0)

        vibration_excess = max(
            0.0,
            ema_vibration
            - 0.2
            - 0.02 * gust_est
        )

        self.vibration_health = self._clip(
            1.0 - vibration_excess,
            0.0,
            1.0
        )

    # ---------------------------------------------------------
    # FAULT PREDICTION
    # ---------------------------------------------------------

    def _update_fault_prediction(self):
        """
        Run the trained ML fault classifier on the rolling
        telemetry buffer.
        """

        try:
            label, confidence = self.predictor.predict(
                list(self.buffer)
            )

            self.fault = str(label)
            self.fault_confidence = float(confidence)

        except Exception:
            # Never allow an ML failure to stop health monitoring.
            self._fallback_fault_detection()

        # Apply fallback safety thresholds.
        self._apply_fallback_rules()

    # ---------------------------------------------------------
    # FALLBACK RULES
    # ---------------------------------------------------------

    def _fallback_fault_detection(self):
        """
        Rule-based fallback when the ML model is unavailable.
        """

        if self.battery_health < 0.8:
            self.fault = "weak_battery"
            self.fault_confidence = max(
                self.fault_confidence,
                0.8
            )

        elif self.cooling < 0.8:
            self.fault = "motor_overheat"
            self.fault_confidence = max(
                self.fault_confidence,
                0.8
            )

        elif (1.0 - self.vibration_health) > 0.2:
            self.fault = "vibration"
            self.fault_confidence = max(
                self.fault_confidence,
                0.8
            )

        else:
            self.fault = "healthy"

    def _apply_fallback_rules(self):
        """
        Apply safety thresholds even when ML is available.
        """

        if self.battery_health < 0.8:
            self.fault = "weak_battery"

        elif self.cooling < 0.8:
            self.fault = "motor_overheat"

        elif (1.0 - self.vibration_health) > 0.2:
            self.fault = "vibration"

    # ---------------------------------------------------------
    # STATE
    # ---------------------------------------------------------

    def state(self):
        """
        Return the current digital-twin health state.
        """

        return {
            "drone_id": self.drone_id,
            "time": float(self.time),

            "soc": float(self.soc),
            "soc_measured": float(self.soc_measured),
            "soc_predicted": float(self.soc_predicted),

            "battery_health": float(
                self.battery_health
            ),

            "cooling": float(
                self.cooling
            ),

            "vibration_health": float(
                self.vibration_health
            ),

            "fault": self.fault,
            "fault_confidence": float(
                self.fault_confidence
            ),

            "uncertainty": dict(
                self.uncertainty
            ),
        }

    # ---------------------------------------------------------
    # PARAMETER SAMPLING
    # ---------------------------------------------------------

    def sample_params(self, n):
        """
        Generate n plausible health parameter sets.

        Used for uncertainty/ensemble analysis.
        """

        n = int(n)

        rng = np.random.default_rng(42)

        battery = np.clip(
            rng.normal(
                self.battery_health,
                0.05,
                n
            ),
            0.0,
            1.0
        )

        cooling = np.clip(
            rng.normal(
                self.cooling,
                0.05,
                n
            ),
            0.0,
            1.0
        )

        vibration = np.clip(
            rng.normal(
                self.vibration_health,
                0.05,
                n
            ),
            0.0,
            1.0
        )

        return {
            "battery_health": battery,
            "cooling": cooling,
            "vibration_health": vibration,
        }

    # ---------------------------------------------------------
    # HELPERS
    # ---------------------------------------------------------

    @staticmethod
    def _number(value, default=0.0):
        try:
            value = float(value)

            if np.isfinite(value):
                return value

        except (TypeError, ValueError):
            pass

        return float(default)

    @staticmethod
    def _clip(value, low, high):
        return float(
            np.clip(value, low, high)
        )
        