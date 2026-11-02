import os
import pickle
import json

import numpy as np
import joblib

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

from .features import window_features, FEATURE_NAMES


WINDOW_SIZE = 30
STEP_SIZE = 10

MODEL_DIR = os.path.join("ml", "models")
MODEL_PATH = os.path.join(MODEL_DIR, "fault.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "fault_metrics.json")

FLIGHTS_PATH = os.path.join("data", "flights.pkl")


FAULT_LABELS = [
    "healthy",
    "weak_battery",
    "motor_overheat",
    "vibration",
]


def load_flights():
    """Load complete flight records."""

    if not os.path.exists(FLIGHTS_PATH):
        raise FileNotFoundError(
            f"Could not find {FLIGHTS_PATH}. "
            "Generate the flight data first."
        )

    with open(FLIGHTS_PATH, "rb") as f:
        flights = pickle.load(f)

    return flights


def get_value(item, name, default=0.0):
    """Read a value from a dictionary or object."""

    if isinstance(item, dict):
        return item.get(name, default)

    return getattr(item, name, default)


def get_telemetry(flight):
    """
    Extract telemetry records from a flight.

    The generated flights.pkl stores telemetry
    inside a pandas DataFrame under the key 'df'.
    """

    if isinstance(flight, dict):

        # Existing possible telemetry formats
        for key in [
            "telemetry",
            "records",
            "samples",
            "data",
        ]:
            if key in flight:
                return flight[key]

        # Actual format used by flights.pkl
        if "df" in flight:
            df = flight["df"]

            # Convert pandas DataFrame to list of dictionaries
            if hasattr(df, "to_dict"):
                return df.to_dict(orient="records")

    if isinstance(flight, list):
        return flight

    return []


def get_fault_label(flight):
    """Return the fault label for a flight."""

    if isinstance(flight, dict):

        label = flight.get("fault_label")

        if label is not None:
            return label

        label = flight.get("fault")

        if label is not None:
            return label

    return "None"


def get_fault_time(flight):
    """Return the fault injection time if available."""

    if isinstance(flight, dict):

        for key in [
            "fault_time",
            "fault_t",
            "failure_time",
            "inject_time",
        ]:
            if key in flight:
                return flight[key]

    return None


def normalise_label(label):
    """Convert simulator labels into classifier labels."""

    if label is None:
        return "healthy"

    label = str(label).lower()

    if label in ["none", "healthy", "no_fault"]:
        return "healthy"

    if label in ["battery", "weak_battery"]:
        return "weak_battery"

    if label in ["motor", "motor_overheat", "overheat"]:
        return "motor_overheat"

    if label in ["vibration", "fault_vibration"]:
        return "vibration"

    return None


def build_window_label(
    flight,
    window_start,
    window_end,
):
    """
    Determine the label for a 30-second window.

    Windows before the fault are healthy.
    Windows after the fault receive the fault class.
    """

    fault = normalise_label(get_fault_label(flight))

    if fault is None:
        return None

    if fault == "healthy":
        return "healthy"

    fault_time = get_fault_time(flight)

    # If the simulator does not store fault time,
    # use the flight-level label.
    if fault_time is None:
        return fault

    if window_start < fault_time:
        return "healthy"

    return fault


def split_by_seed(flight):
    """
    Determine whether a flight belongs to the test set.

    Prefer the explicit split stored in the generated
    flight data. If it is unavailable, use the seed rule.
    """

    if isinstance(flight, dict):

        # Use explicit split if available
        split = flight.get("split")

        if split is not None:
            return str(split).lower() == "test"

        # Otherwise use seed
        seed = flight.get("seed", 0)

    else:
        seed = getattr(flight, "seed", 0)

    try:
        seed = int(seed)
    except (TypeError, ValueError):
        seed = 0

    return seed % 10 in [0, 5]


def make_windows(flight):
    """Create feature vectors and labels from one flight."""

    telemetry = get_telemetry(flight)

    if len(telemetry) < WINDOW_SIZE:
        return [], []

    X = []
    y = []

    # Windows move forward by 10 seconds.
    for start in range(
        0,
        len(telemetry) - WINDOW_SIZE + 1,
        STEP_SIZE,
    ):
        end = start + WINDOW_SIZE

        window = telemetry[start:end]

        features = window_features(window)

        label = build_window_label(
            flight,
            start,
            end,
        )

        if label is None:
            continue

        X.append(features)
        y.append(label)

    return X, y


def build_dataset(flights):
    """Build training and testing datasets."""

    X_train = []
    y_train = []

    X_test = []
    y_test = []

    train_flights = 0
    test_flights = 0

    for flight in flights:

        X, y = make_windows(flight)

        if not X:
            continue

        if split_by_seed(flight):
            X_test.extend(X)
            y_test.extend(y)
            test_flights += 1
        else:
            X_train.extend(X)
            y_train.extend(y)
            train_flights += 1

    return (
        np.asarray(X_train, dtype=float),
        np.asarray(y_train),
        np.asarray(X_test, dtype=float),
        np.asarray(y_test),
        train_flights,
        test_flights,
    )


def main():

    print("Loading flight data...")

    flights = load_flights()

    print(f"Loaded {len(flights)} flights")

    (
        X_train,
        y_train,
        X_test,
        y_test,
        train_flights,
        test_flights,
    ) = build_dataset(flights)

    print()
    print("=== DATASET ===")
    print(f"training flights: {train_flights}")
    print(f"test flights:     {test_flights}")
    print(f"training windows:  {len(X_train)}")
    print(f"test windows:      {len(X_test)}")

    if len(X_train) == 0:
        raise RuntimeError(
            "No training windows were created."
        )

    if len(X_test) == 0:
        raise RuntimeError(
            "No test windows were created."
        )

    print()
    print("Training Random Forest...")

    model = RandomForestClassifier(
        n_estimators=200,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train)

    predictions = model.predict(X_test)

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    labels_present = [
        label
        for label in FAULT_LABELS
        if label in set(y_test)
        or label in set(predictions)
    ]

    cm = confusion_matrix(
        y_test,
        predictions,
        labels=labels_present,
    )

    report = classification_report(
        y_test,
        predictions,
        labels=labels_present,
        zero_division=0,
        output_dict=True,
    )

    print()
    print("=== RESULTS ===")
    print(f"accuracy: {accuracy:.4f}")

    print()
    print("Confusion matrix:")
    print(labels_present)
    print(cm)

    print()
    print("Classification report:")
    print(
        classification_report(
            y_test,
            predictions,
            labels=labels_present,
            zero_division=0,
        )
    )

    os.makedirs(MODEL_DIR, exist_ok=True)

    joblib.dump(
        model,
        MODEL_PATH,
    )

    metrics = {
        "accuracy": float(accuracy),
        "feature_names": FEATURE_NAMES,
        "labels": labels_present,
        "confusion_matrix": cm.tolist(),
        "train_windows": int(len(X_train)),
        "test_windows": int(len(X_test)),
        "train_flights": int(train_flights),
        "test_flights": int(test_flights),
        "classification_report": report,
    }

    with open(
        METRICS_PATH,
        "w",
        encoding="utf-8",
    ) as f:
        json.dump(
            metrics,
            f,
            indent=2,
        )

    print()
    print(f"saved model   -> {MODEL_PATH}")
    print(f"saved metrics -> {METRICS_PATH}")


if __name__ == "__main__":
    main()
