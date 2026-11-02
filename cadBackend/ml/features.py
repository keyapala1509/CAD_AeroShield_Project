import numpy as np


FEATURE_NAMES = [
    "temp_mean",
    "temp_std",
    "temp_slope",
    "vib_mean",
    "vib_std",
    "vib_slope",
    "power_mean",
    "gust_mean",
    "battery_gap_mean",
]


def _get_values(buffer, name, default=0.0):
    """
    Extract a numeric array from a telemetry buffer.

    The buffer can be:
    - a list of dictionaries
    - a list of objects with attributes
    - a dictionary of arrays
    """
    if isinstance(buffer, dict):
        if name in buffer:
            return np.asarray(buffer[name], dtype=float)

        return np.full(len(next(iter(buffer.values()))), default, dtype=float)

    values = []

    for item in buffer:
        if isinstance(item, dict):
            values.append(item.get(name, default))
        else:
            values.append(getattr(item, name, default))

    return np.asarray(values, dtype=float)


def _slope(values):
    """Return the straight-line slope of a sequence."""
    values = np.asarray(values, dtype=float)

    if len(values) < 2:
        return 0.0

    x = np.arange(len(values), dtype=float)

    try:
        return float(np.polyfit(x, values, 1)[0])
    except (ValueError, np.linalg.LinAlgError):
        return 0.0


def window_features(buffer):
    """
    Extract the shared fault-classification features from
    one telemetry window.

    Returns:
        numpy array containing the features in FEATURE_NAMES order.
    """

    if buffer is None or len(buffer) == 0:
        return np.zeros(len(FEATURE_NAMES), dtype=float)

    motor_temp = _get_values(buffer, "motor_temp")
    vibration = _get_values(buffer, "vib")
    power = _get_values(buffer, "power_w")
    gust = _get_values(buffer, "gust")

    # Battery gap:
    # expected battery drain based on measured power
    # compared with observed battery drain.
    soc = _get_values(buffer, "soc")
    battery_health = _get_values(buffer, "battery_health", 1.0)

    # If battery health is not available, assume healthy battery.
    battery_health = np.clip(battery_health, 0.3, 1.0)

    if len(soc) >= 2 and len(power) >= 2:
        dt = _get_values(buffer, "dt", 1.0)
        dt = np.maximum(dt, 0.001)

        expected_drop = (
            power * dt / 3600.0
        ) / np.maximum(battery_health, 0.3) * 100.0

        observed_drop = np.zeros(len(soc))

        if len(soc) > 1:
            observed_drop[1:] = np.maximum(
                soc[:-1] - soc[1:],
                0.0
            )

        battery_gap = observed_drop - expected_drop
        battery_gap_mean = float(np.mean(battery_gap))
    else:
        battery_gap_mean = 0.0

    features = np.array(
        [
            np.mean(motor_temp),
            np.std(motor_temp),
            _slope(motor_temp),

            np.mean(vibration),
            np.std(vibration),
            _slope(vibration),

            np.mean(power),
            np.mean(gust),

            battery_gap_mean,
        ],
        dtype=float,
    )

    # Replace NaN/inf values so the ML model never receives invalid data.
    features = np.nan_to_num(
        features,
        nan=0.0,
        posinf=0.0,
        neginf=0.0,
    )

    return features


def feature_names():
    """Return feature names in the same order used by the model."""
    return list(FEATURE_NAMES)
