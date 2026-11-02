from twins.health_twin import HealthTwin


def test_health_twin_initial_state():
    twin = HealthTwin()

    state = twin.state()

    assert state["battery_health"] == 1.0
    assert state["cooling"] == 1.0
    assert state["vibration_health"] == 1.0


def test_health_twin_update():
    twin = HealthTwin()

    state = twin.update({
        "t": 1,
        "soc": 99.9,
        "power_w": 250,
        "motor_temp": 45,
        "vib": 0.1,
        "gust": 2,
        "battery_health": 1.0,
        "cooling": 1.0,
    })

    assert 0 <= state["soc"] <= 100
    assert 0 <= state["battery_health"] <= 1
    assert 0 <= state["cooling"] <= 1
    assert 0 <= state["vibration_health"] <= 1


def test_health_twin_sample_params():
    twin = HealthTwin()

    params = twin.sample_params(30)

    assert len(params["battery_health"]) == 30
    assert len(params["cooling"]) == 30
    assert len(params["vibration_health"]) == 30
    