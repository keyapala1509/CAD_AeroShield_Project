from twins.env_twin import EnvironmentTwin


def test_environment_grid():
    twin = EnvironmentTwin()

    grids = twin.grids()

    assert grids["wind_u"].shape == (40, 40)
    assert grids["wind_v"].shape == (40, 40)
    assert grids["rain"].shape == (40, 40)


def test_environment_ensemble():
    twin = EnvironmentTwin()

    assert len(twin.M) == 30


def test_environment_update_and_query():
    twin = EnvironmentTwin()

    twin.update({
        "t": 0,
        "x": 100,
        "y": 100,
        "wind_u": 5,
        "wind_v": 2,
        "gust": 1,
        "rain": 0.2,
    })

    result = twin.query(
        100,
        100,
        0,
        0
    )

    assert "wind_u" in result
    assert "wind_v" in result
    assert "wind_speed" in result
    assert "gust" in result
    assert "rain" in result
    