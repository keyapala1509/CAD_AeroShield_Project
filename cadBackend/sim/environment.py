import numpy as np
from config import RNG, GRID_SIZE, MAP_UNITS


class StormCell:
    def __init__(self, x, y, vx, vy, radius, intensity):
        self.x = x
        self.y = y
        self.vx = vx  # drift speed, x direction (units/sec)
        self.vy = vy  # drift speed, y direction (units/sec)
        self.radius = radius
        self.intensity = intensity  # 0-1, how strong the storm is

    def step(self, dt):
        self.x += self.vx * dt
        self.y += self.vy * dt
        # bounce off map edges so storms don't fly off forever
        if self.x < 0 or self.x > MAP_UNITS:
            self.vx *= -1
        if self.y < 0 or self.y > MAP_UNITS:
            self.vy *= -1


class Environment:
    def __init__(self, n_storms=3):
        self.storms = []
        for _ in range(n_storms):
            self.storms.append(StormCell(
                x=RNG.uniform(0, MAP_UNITS),
                y=RNG.uniform(0, MAP_UNITS),
                vx=RNG.uniform(-0.08, 0.08),
                vy=RNG.uniform(-0.08, 0.08),
                radius=RNG.uniform(10, 20),
                intensity=RNG.uniform(0.5, 1.0),
            ))
        self.base_wind_u = 5.0  # base wind, x component (m/s)
        self.base_wind_v = 2.0  # base wind, y component (m/s)

    def step(self, dt):
        for storm in self.storms:
            storm.step(dt)

    def rain(self, x, y):
        """x, y can be scalars or numpy arrays. Returns rain intensity 0-1."""
        total = np.zeros_like(x, dtype=float) if isinstance(x, np.ndarray) else 0.0
        for storm in self.storms:
            d2 = (x - storm.x) ** 2 + (y - storm.y) ** 2
            sigma2 = 2 * (storm.radius / 2) ** 2
            total += storm.intensity * np.exp(-d2 / sigma2)
        return np.clip(total, 0, 1)

    def wind(self, x, y):
        """Returns (u, v) wind components in m/s at point(s) x, y."""
        rain_here = self.rain(x, y)
        gust = RNG.normal(0, 1.5)
        u = self.base_wind_u * (1 + 1.5 * rain_here) + gust
        v = self.base_wind_v * (1 + 1.5 * rain_here) + gust
        return u, v

    def grid(self):
        """Returns 40x40 rain and wind-speed grids for the dashboard."""
        xs = np.linspace(0, MAP_UNITS, GRID_SIZE)
        ys = np.linspace(0, MAP_UNITS, GRID_SIZE)
        xx, yy = np.meshgrid(xs, ys)
        rain_grid = self.rain(xx, yy)
        u, v = self.wind(xx, yy)
        wind_grid = np.sqrt(u ** 2 + v ** 2)
        return np.round(rain_grid, 1), np.round(wind_grid, 1)