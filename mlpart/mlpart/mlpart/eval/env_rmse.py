import pickle
import math
import numpy as np

from twins.env_twin import EnvironmentTwin


FLIGHTS_PATH = "data/flights.pkl"

# Current Environment Twin setting
K_VALUE = 0.4

# Evaluate every next telemetry point
# The twin receives record i-1 and predicts record i.
MIN_FLIGHT_LENGTH = 2


def rmse(actual, predicted):
    actual = np.asarray(actual, dtype=float)
    predicted = np.asarray(predicted, dtype=float)

    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def evaluate_flight(flight, k=K_VALUE):
    """
    Evaluate one flight using one-step-ahead prediction.

    Record i-1 is given to the Environment Twin.
    The twin then predicts the environment at record i.
    """

    df = flight.get("df")

    if df is None or len(df) < MIN_FLIGHT_LENGTH:
        return None

    records = df.to_dict(orient="records")

    twin = EnvironmentTwin(k=k)

    actual_u = []
    predicted_u = []

    actual_v = []
    predicted_v = []

    actual_gust = []
    predicted_gust = []

    actual_rain = []
    predicted_rain = []

    actual_speed = []
    predicted_speed = []

    for i in range(1, len(records)):
        previous = records[i - 1]
        current = records[i]

        # Give only the previous telemetry observation
        # to the Environment Twin.
        twin.update(previous)

        # Time difference between observations
        previous_time = float(previous.get("t", i - 1))
        current_time = float(current.get("t", i))

        t_ahead = max(0.0, current_time - previous_time)

        # Query the twin at the NEXT telemetry position.
        prediction = twin.query(
            float(current.get("x", 0.0)),
            float(current.get("y", 0.0)),
            t_ahead=t_ahead,
            member=0
        )

        # Ground truth is used ONLY for evaluation.
        true_u = float(current.get("wind_u", 0.0))
        true_v = float(current.get("wind_v", 0.0))
        true_gust = float(current.get("gust", 0.0))
        true_rain = float(current.get("rain", 0.0))

        true_speed = math.sqrt(
            true_u ** 2 + true_v ** 2
        )

        actual_u.append(true_u)
        predicted_u.append(prediction["wind_u"])

        actual_v.append(true_v)
        predicted_v.append(prediction["wind_v"])

        actual_gust.append(true_gust)
        predicted_gust.append(prediction["gust"])

        actual_rain.append(true_rain)
        predicted_rain.append(prediction["rain"])

        actual_speed.append(true_speed)
        predicted_speed.append(prediction["wind_speed"])

    if not actual_u:
        return None

    return {
        "wind_u_rmse": rmse(actual_u, predicted_u),
        "wind_v_rmse": rmse(actual_v, predicted_v),
        "wind_speed_rmse": rmse(actual_speed, predicted_speed),
        "gust_rmse": rmse(actual_gust, predicted_gust),
        "rain_rmse": rmse(actual_rain, predicted_rain),
        "samples": len(actual_u)
    }


def main():

    print("=" * 60)
    print("ENVIRONMENT TWIN RMSE EVALUATION")
    print("=" * 60)

    print("\nLoading flights...")

    with open(FLIGHTS_PATH, "rb") as f:
        flights = pickle.load(f)

    print(f"Loaded {len(flights)} flights")

    results = []

    print("\nEvaluating Environment Twin...")
    print(f"Using K = {K_VALUE}")
    print("One-step-ahead evaluation is being used.\n")

    for index, flight in enumerate(flights):

        if index % 100 == 0:
            print(
                f"Processing {index}/{len(flights)} flights..."
            )

        result = evaluate_flight(
            flight,
            k=K_VALUE
        )

        if result is not None:
            results.append(result)

    if not results:
        print("\nNo valid flight results found.")
        return

    # Combine all predictions from all flights
    wind_u_values = [r["wind_u_rmse"] for r in results]
    wind_v_values = [r["wind_v_rmse"] for r in results]
    wind_speed_values = [r["wind_speed_rmse"] for r in results]
    gust_values = [r["gust_rmse"] for r in results]
    rain_values = [r["rain_rmse"] for r in results]

    print("\n" + "=" * 60)
    print("ENVIRONMENT TWIN RESULTS")
    print("=" * 60)

    print(f"Flights evaluated : {len(results)}")

    print("\nRMSE:")
    print(
        f"  Wind U RMSE     : "
        f"{np.mean(wind_u_values):.4f}"
    )

    print(
        f"  Wind V RMSE     : "
        f"{np.mean(wind_v_values):.4f}"
    )

    print(
        f"  Wind Speed RMSE : "
        f"{np.mean(wind_speed_values):.4f}"
    )

    print(
        f"  Gust RMSE       : "
        f"{np.mean(gust_values):.4f}"
    )

    print(
        f"  Rain RMSE       : "
        f"{np.mean(rain_values):.4f}"
    )

    print("\nMedian RMSE:")
    print(
        f"  Wind U          : "
        f"{np.median(wind_u_values):.4f}"
    )

    print(
        f"  Wind V          : "
        f"{np.median(wind_v_values):.4f}"
    )

    print(
        f"  Wind Speed      : "
        f"{np.median(wind_speed_values):.4f}"
    )

    print(
        f"  Gust            : "
        f"{np.median(gust_values):.4f}"
    )

    print(
        f"  Rain            : "
        f"{np.median(rain_values):.4f}"
    )

    print("\nEnvironment Twin evaluation complete.")


if __name__ == "__main__":
    main()
    