import pickle
import numpy as np

from ml.fault import FaultPredictor
from ml.features import window_features


FLIGHTS_PATH = "data/flights.pkl"

WINDOW_SIZE = 30
STEP_SIZE = 10
CONFIDENCE_THRESHOLD = 0.70


def make_windows(records):
    """
    Create 30-second windows with a 10-second step.
    """

    windows = []
    times = []

    for start in range(
        0,
        len(records) - WINDOW_SIZE + 1,
        STEP_SIZE
    ):
        end = start + WINDOW_SIZE

        windows.append(records[start:end])

        times.append(
            float(records[start].get("t", start))
        )

    return windows, times


def batch_predict(predictor, windows):
    """
    Predict all windows together using the Random Forest.
    """

    if not windows:
        return [], []

    features = np.asarray(
        [
            window_features(window)
            for window in windows
        ],
        dtype=float
    )

    model = predictor.model

    # Use the trained Random Forest directly
    predictions = model.predict(features)

    probabilities = model.predict_proba(
        features
    )

    confidences = np.max(
        probabilities,
        axis=1
    )

    return (
        [str(x) for x in predictions],
        confidences
    )


def detect_from_predictions(
    predictions,
    confidences,
    times,
):
    """
    Apply the two-consecutive-window rule.

    A fault is detected only when:
        1. Prediction is not healthy
        2. Confidence > 0.70
        3. The same fault appears in two consecutive windows
    """

    previous_label = None
    previous_confidence = 0.0

    for i in range(len(predictions)):

        label = predictions[i]
        confidence = float(confidences[i])

        if confidence < CONFIDENCE_THRESHOLD:
            previous_label = None
            previous_confidence = 0.0
            continue

        if label == "healthy":
            previous_label = None
            previous_confidence = 0.0
            continue

        if (
            previous_label == label
            and previous_confidence
            >= CONFIDENCE_THRESHOLD
        ):
            return {
                "detected": True,
                "fault": label,
                "confidence": confidence,
                "detection_time": times[i],
                "window": i,
            }

        previous_label = label
        previous_confidence = confidence

    return {
        "detected": False,
        "fault": None,
        "confidence": 0.0,
        "detection_time": None,
        "window": None,
    }


def main():

    print("Loading flights...")

    with open(
        FLIGHTS_PATH,
        "rb"
    ) as f:
        flights = pickle.load(f)

    print(
        f"Loaded {len(flights)} flights"
    )

    predictor = FaultPredictor()

    if predictor.model is None:
        raise RuntimeError(
            "Fault model could not be loaded."
        )

    detection_times = []

    total_faults = 0
    detected_faults = 0

    fault_counts = {}
    detected_counts = {}

    print()
    print("Starting fast fault detection...")
    print()

    for flight_index, flight in enumerate(flights):

        # Show progress every 100 flights
        if flight_index % 100 == 0:
            print(
                f"Processing "
                f"{flight_index}/{len(flights)} flights..."
            )

        fault = flight.get("fault")

        # Healthy flights are not used for
        # fault detection-time calculation.
        if fault is None:
            continue

        fault = str(fault)

        fault_counts[fault] = (
            fault_counts.get(fault, 0) + 1
        )

        fault_time = flight.get(
            "fault_time"
        )

        if fault_time is None:
            continue

        records = flight["df"].to_dict(
            orient="records"
        )

        windows, times = make_windows(
            records
        )

        if not windows:
            continue

        # Batch prediction
        predictions, confidences = (
            batch_predict(
                predictor,
                windows
            )
        )

        result = detect_from_predictions(
            predictions,
            confidences,
            times
        )

        total_faults += 1

        if result["detected"]:

            detected_faults += 1

            detected_label = result[
                "fault"
            ]

            detected_counts[
                detected_label
            ] = (
                detected_counts.get(
                    detected_label,
                    0
                ) + 1
            )

            detection_delay = max(
                0.0,
                result["detection_time"]
                - float(fault_time)
            )

            detection_times.append(
                detection_delay
            )

    print()
    print("=" * 50)
    print("FAULT DETECTION RESULTS")
    print("=" * 50)

    print(
        f"Total fault flights : "
        f"{total_faults}"
    )

    print(
        f"Detected faults     : "
        f"{detected_faults}"
    )

    if total_faults > 0:

        detection_rate = (
            detected_faults
            / total_faults
            * 100
        )

        print(
            f"Detection rate      : "
            f"{detection_rate:.2f}%"
        )

    print()
    print("Actual fault distribution:")

    for label, count in sorted(
        fault_counts.items()
    ):
        print(
            f"  {label}: {count}"
        )

    print()
    print("Detected fault distribution:")

    for label, count in sorted(
        detected_counts.items()
    ):
        print(
            f"  {label}: {count}"
        )

    print()

    if detection_times:

        print(
            f"Average detection time : "
            f"{np.mean(detection_times):.2f} s"
        )

        print(
            f"Minimum detection time : "
            f"{np.min(detection_times):.2f} s"
        )

        print(
            f"Maximum detection time : "
            f"{np.max(detection_times):.2f} s"
        )

    else:

        print(
            "No faults were detected."
        )

    print()
    print("Fault detection evaluation complete.")


if __name__ == "__main__":
    main()
    