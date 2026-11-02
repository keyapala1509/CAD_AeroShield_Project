import os
import numpy as np
import joblib

from .features import window_features


MODEL_PATH = os.path.join(
    "ml",
    "models",
    "fault.joblib"
)


class FaultPredictor:
    """
    Fault prediction interface.

    Uses the trained Random Forest model when available.
    Falls back to rule-based detection if the model cannot
    be loaded.
    """

    CONFIDENCE_THRESHOLD = 0.70
    REQUIRED_CONSECUTIVE = 2

    def __init__(self, model_path=MODEL_PATH):
        self.model = None
        self.model_path = model_path

        self._load_model()

    # =========================================================
    # MODEL LOADING
    # =========================================================

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(
                    self.model_path
                )

                print(
                    f"Fault model loaded: "
                    f"{self.model_path}"
                )

            except Exception as e:
                print(
                    f"Could not load fault model: {e}"
                )

                self.model = None

    # =========================================================
    # SINGLE WINDOW PREDICTION
    # =========================================================

    def predict(self, buffer):
        """
        Predict the fault for one telemetry window.

        Returns:
            (label, confidence)
        """

        if buffer is None or len(buffer) == 0:
            return "healthy", 0.0

        features = window_features(buffer)

        if self.model is not None:

            X = np.asarray(
                features,
                dtype=float
            ).reshape(1, -1)

            prediction = self.model.predict(X)[0]

            confidence = 1.0

            if hasattr(
                self.model,
                "predict_proba"
            ):
                probabilities = (
                    self.model.predict_proba(X)[0]
                )

                confidence = float(
                    np.max(probabilities)
                )

            return (
                str(prediction),
                confidence
            )

        return self._fallback_predict(
            buffer
        )

    # =========================================================
    # PROBABILITIES
    # =========================================================

    def predict_proba(self, buffer):
        """
        Return probability for each fault class.
        """

        if buffer is None or len(buffer) == 0:
            return {
                "healthy": 1.0
            }

        if self.model is not None:

            features = window_features(
                buffer
            )

            X = np.asarray(
                features,
                dtype=float
            ).reshape(1, -1)

            if hasattr(
                self.model,
                "predict_proba"
            ):
                probabilities = (
                    self.model.predict_proba(X)[0]
                )

                classes = self.model.classes_

                return {
                    str(label): float(prob)
                    for label, prob
                    in zip(
                        classes,
                        probabilities
                    )
                }

        label, confidence = self.predict(
            buffer
        )

        return {
            label: confidence
        }

    # =========================================================
    # TWO-CONSECUTIVE-WINDOW DETECTION
    # =========================================================

    def detect_fault(
        self,
        windows,
        window_times=None,
    ):
        """
        Detect a fault only when the same non-healthy
        fault is predicted in two consecutive windows
        with confidence > 0.70.

        Parameters
        ----------
        windows:
            List of telemetry windows.

        window_times:
            Optional list containing the starting time
            of each window.

        Returns
        -------
        Dictionary containing:
            fault
            confidence
            detected
            detection_time
            detection_window
        """

        if windows is None:
            return {
                "fault": "healthy",
                "confidence": 0.0,
                "detected": False,
                "detection_time": None,
                "detection_window": None,
            }

        previous_label = None
        previous_confidence = 0.0

        for i, window in enumerate(windows):

            label, confidence = self.predict(
                window
            )

            confidence = float(
                confidence
            )

            # Ignore low-confidence predictions.
            if confidence < self.CONFIDENCE_THRESHOLD:
                previous_label = None
                previous_confidence = 0.0
                continue

            # Healthy predictions do not constitute
            # a fault detection.
            if label == "healthy":
                previous_label = None
                previous_confidence = 0.0
                continue

            # Two consecutive predictions of the
            # same fault are required.
            if (
                previous_label == label
                and previous_confidence
                >= self.CONFIDENCE_THRESHOLD
            ):

                detection_time = None

                if (
                    window_times is not None
                    and i < len(window_times)
                ):
                    detection_time = (
                        window_times[i]
                    )

                return {
                    "fault": str(label),
                    "confidence": confidence,
                    "detected": True,
                    "detection_time":
                        detection_time,
                    "detection_window": i,
                }

            previous_label = str(label)
            previous_confidence = confidence

        return {
            "fault": "healthy",
            "confidence": 0.0,
            "detected": False,
            "detection_time": None,
            "detection_window": None,
        }

    # =========================================================
    # DETECTION TIME
    # =========================================================

    def detection_time(
        self,
        windows,
        fault_time,
        window_times=None,
    ):
        """
        Calculate time from actual fault occurrence
        to ML detection.

        Returns None if the fault is not detected.
        """

        result = self.detect_fault(
            windows,
            window_times
        )

        if not result["detected"]:
            return None

        detection_time = result[
            "detection_time"
        ]

        if detection_time is None:
            return None

        return max(
            0.0,
            float(detection_time)
            - float(fault_time)
        )

    # =========================================================
    # FALLBACK
    # =========================================================

    def _fallback_predict(self, buffer):
        """
        Rule-based fallback when the trained model
        is unavailable.
        """

        features = window_features(
            buffer
        )

        (
            temp_mean,
            temp_std,
            temp_slope,
            vib_mean,
            vib_std,
            vib_slope,
            power_mean,
            gust_mean,
            battery_gap_mean,
        ) = features

        if battery_gap_mean < -0.5:
            return (
                "weak_battery",
                0.80
            )

        if (
            temp_mean > 75
            or temp_slope > 0.5
        ):
            return (
                "motor_overheat",
                0.80
            )

        if (
            vib_mean > 0.35
            or vib_std > 0.15
        ):
            return (
                "vibration",
                0.80
            )

        return (
            "healthy",
            0.80
        )


# =============================================================
# DEFAULT PREDICTOR
# =============================================================

_default_predictor = FaultPredictor()


def predict_fault(buffer):
    """
    Convenience function for single-window prediction.
    """

    return _default_predictor.predict(
        buffer
    )


def predict_proba(buffer):
    """
    Convenience function for probability prediction.
    """

    return _default_predictor.predict_proba(
        buffer
    )


def detect_fault(
    windows,
    window_times=None,
):
    """
    Convenience function for two-window fault detection.
    """

    return _default_predictor.detect_fault(
        windows,
        window_times
    )
    