import pickle
import numpy as np

from twins.health_twin import HealthTwin


FLIGHTS_PATH = "data/flights.pkl"


class DummyFaultPredictor:
    """
    Lightweight predictor used only for Health Twin evaluation.

    Fault detection is evaluated separately in:
        eval/fault_detection.py

    Therefore we do not run the expensive Random Forest
    during every Health Twin update.
    """

    def predict(self, buffer):
        return "healthy", 1.0


def safe_float(value, default=0.0):
    try:
        value = float(value)

        if np.isfinite(value):
            return value

    except (TypeError, ValueError):
        pass

    return default


def rmse(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    return float(
        np.sqrt(np.mean((actual - predicted) ** 2))
    )


def evaluate_flight(flight):

    df = flight.get("df")

    if df is None or len(df) < 2:
        return None

    records = df.to_dict(orient="records")

    # Use a dummy predictor so the Random Forest is not
    # repeatedly executed during health-state evaluation.
    predictor = DummyFaultPredictor()

    twin = HealthTwin(
        predictor=predictor
    )

    actual_soc = []
    predicted_soc = []

    actual_battery = []
    predicted_battery = []

    actual_cooling = []
    predicted_cooling = []

    actual_vibration_health = []
    predicted_vibration_health = []

    for record in records:

        telemetry = {
            "t": safe_float(
                record.get("t")
            ),

            "soc": safe_float(
                record.get("soc")
            ),

            "power_w": safe_float(
                record.get("power_w")
            ),

            "motor_temp": safe_float(
                record.get("motor_temp")
            ),

            "vib": safe_float(
                record.get("vib")
            ),

            "gust": safe_float(
                record.get("gust")
            )
        }

        state = twin.update(telemetry)

        # -----------------------------
        # SoC
        # -----------------------------

        true_soc = safe_float(
            record.get("true_soc"),
            safe_float(record.get("soc"))
        )

        estimated_soc = safe_float(
            state.get("soc"),
            0.0
        )

        actual_soc.append(true_soc)
        predicted_soc.append(estimated_soc)

        # -----------------------------
        # Battery Health
        # -----------------------------

        true_battery = safe_float(
            record.get("battery_health"),
            1.0
        )

        estimated_battery = safe_float(
            state.get("battery_health"),
            0.0
        )

        actual_battery.append(true_battery)
        predicted_battery.append(estimated_battery)

        # -----------------------------
        # Cooling
        # -----------------------------

        true_cooling = safe_float(
            record.get("cooling"),
            1.0
        )

        estimated_cooling = safe_float(
            state.get("cooling"),
            0.0
        )

        actual_cooling.append(true_cooling)
        predicted_cooling.append(estimated_cooling)

        # -----------------------------
        # Vibration Health
        # -----------------------------

        true_vib = safe_float(
            record.get("true_vib"),
            safe_float(record.get("vib"))
        )

        true_gust = safe_float(
            record.get("gust"),
            0.0
        )

        true_excess = max(
            0.0,
            true_vib - 0.2 - 0.02 * true_gust
        )

        true_vibration_health = max(
            0.0,
            min(
                1.0,
                1.0 - true_excess
            )
        )

        estimated_vibration_health = safe_float(
            state.get("vibration_health"),
            1.0
        )

        actual_vibration_health.append(
            true_vibration_health
        )

        predicted_vibration_health.append(
            estimated_vibration_health
        )

    return {
        "soc_rmse": rmse(
            actual_soc,
            predicted_soc
        ),

        "battery_rmse": rmse(
            actual_battery,
            predicted_battery
        ),

        "cooling_rmse": rmse(
            actual_cooling,
            predicted_cooling
        ),

        "vibration_health_rmse": rmse(
            actual_vibration_health,
            predicted_vibration_health
        )
    }


def main():

    print("=" * 60)
    print("HEALTH TWIN EVALUATION")
    print("=" * 60)

    print("\nLoading flights...")

    with open(FLIGHTS_PATH, "rb") as f:
        flights = pickle.load(f)

    print(
        f"Loaded {len(flights)} flights"
    )

    print(
        "\nFault classifier is disabled during this evaluation."
    )

    print(
        "Fault detection is evaluated separately."
    )

    results = []

    print(
        "\nEvaluating Health Twin...\n"
    )

    for index, flight in enumerate(flights):

        if index % 100 == 0:
            print(
                f"Processing "
                f"{index}/{len(flights)} flights..."
            )

        result = evaluate_flight(flight)

        if result is not None:
            results.append(result)

    if not results:
        print(
            "\nNo valid flight results found."
        )
        return

    soc_rmse = [
        r["soc_rmse"]
        for r in results
    ]

    battery_rmse = [
        r["battery_rmse"]
        for r in results
    ]

    cooling_rmse = [
        r["cooling_rmse"]
        for r in results
    ]

    vibration_rmse = [
        r["vibration_health_rmse"]
        for r in results
    ]

    print(
        "\n" + "=" * 60
    )

    print(
        "HEALTH TWIN RESULTS"
    )

    print(
        "=" * 60
    )

    print(
        f"Flights evaluated : "
        f"{len(results)}"
    )

    print("\nMean RMSE:")

    print(
        f"  SoC                 : "
        f"{np.mean(soc_rmse):.4f}"
    )

    print(
        f"  Battery Health      : "
        f"{np.mean(battery_rmse):.4f}"
    )

    print(
        f"  Cooling             : "
        f"{np.mean(cooling_rmse):.4f}"
    )

    print(
        f"  Vibration Health    : "
        f"{np.mean(vibration_rmse):.4f}"
    )

    print("\nMedian RMSE:")

    print(
        f"  SoC                 : "
        f"{np.median(soc_rmse):.4f}"
    )

    print(
        f"  Battery Health      : "
        f"{np.median(battery_rmse):.4f}"
    )

    print(
        f"  Cooling             : "
        f"{np.median(cooling_rmse):.4f}"
    )

    print(
        f"  Vibration Health    : "
        f"{np.median(vibration_rmse):.4f}"
    )

    print(
        "\nHealth Twin evaluation complete."
    )


if __name__ == "__main__":
    main()
    