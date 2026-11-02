import numpy as np
from config import RNG, N_FORECAST_MEMBERS

# TEMPORARY STUB — reads the true environment directly.
# Person 2 will replace this with a real twin that only uses noisy sensor data.


class EnvTwinStub:
    def __init__(self, environment):
        self.environment = environment
        self.M = N_FORECAST_MEMBERS

    def query(self, x, y, t_ahead, member):
        """
        x, y: numpy arrays of positions to query
        t_ahead: seconds into the future (ignored in this stub — no real forecasting yet)
        member: numpy array of which forecast "member" (ensemble) to use

        Returns arrays: wind_speed, gust, rain — one value per input point.
        """
        rain_true = self.environment.rain(x, y)
        u, v = self.environment.wind(x, y)
        wind_true = np.hypot(u, v)

        # small random offset per member, to fake ensemble spread
        offset = (member.astype(float) - self.M / 2) / self.M * 2.0

        wind_speed = wind_true + offset + RNG.normal(0, 0.5, size=np.shape(x))
        gust = RNG.normal(0, 1.0, size=np.shape(x))
        rain = np.clip(rain_true + offset * 0.05, 0, 1)

        return wind_speed, gust, rain

    def grids(self):
        return self.environment.grid()