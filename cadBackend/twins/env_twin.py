import numpy as np


class EnvironmentTwin:
    """
    Digital twin of the local flight environment.

    The twin estimates wind, gust and rain from telemetry
    rather than accessing simulator ground truth.
    """

    GRID_SIZE = 40
    ENSEMBLE_SIZE = 30

    def __init__(
        self,
        x_min=0.0,
        x_max=1000.0,
        y_min=0.0,
        y_max=1000.0,
        recompute_interval=5.0,
        k=0.4,
    ):
        self.x_min = float(x_min)
        self.x_max = float(x_max)

        self.y_min = float(y_min)
        self.y_max = float(y_max)

        self.recompute_interval = float(
            recompute_interval
        )

        # Tunable inverse-distance weighting factor.
        self.k = float(
            np.clip(k, 0.1, 0.8)
        )

        # Telemetry observations
        self.observations = []

        # Current simulation time
        self.time = 0.0
        self.last_update = -np.inf

        # Build 40 x 40 grid
        self.x_grid = np.linspace(
            self.x_min,
            self.x_max,
            self.GRID_SIZE
        )

        self.y_grid = np.linspace(
            self.y_min,
            self.y_max,
            self.GRID_SIZE
        )

        self.X, self.Y = np.meshgrid(
            self.x_grid,
            self.y_grid
        )

        # Current environment fields
        shape = (
            self.GRID_SIZE,
            self.GRID_SIZE
        )

        self.wind_u = np.zeros(shape)
        self.wind_v = np.zeros(shape)
        self.gust = np.zeros(shape)
        self.rain = np.zeros(shape)

        self.wind_uncertainty = np.ones(shape)
        self.rain_uncertainty = np.ones(shape)

        # Ensemble members
        self.M = []

        self._create_ensemble()

    # =========================================================
    # TELEMETRY
    # =========================================================

    def update(self, telemetry):
        """
        Add one telemetry observation.

        Expected fields:
            x
            y
            t
            wind_u
            wind_v
            gust
            rain
        """

        if telemetry is None:
            return

        sample = dict(telemetry)

        x = self._number(
            sample.get("x"),
            0.0
        )

        y = self._number(
            sample.get("y"),
            0.0
        )

        t = self._number(
            sample.get("t"),
            self.time
        )

        sample["x"] = x
        sample["y"] = y
        sample["t"] = t

        sample["wind_u"] = self._number(
            sample.get("wind_u"),
            0.0
        )

        sample["wind_v"] = self._number(
            sample.get("wind_v"),
            0.0
        )

        sample["gust"] = self._number(
            sample.get("gust"),
            0.0
        )

        sample["rain"] = max(
            0.0,
            self._number(
                sample.get("rain"),
                0.0
            )
        )

        self.observations.append(sample)
        max_obs = 500
        if len(self.observations) > max_obs:
            self.observations = self.observations[-max_obs:]
        self.time = t

        # Recompute every 5 simulated seconds.
        if (
            self.time - self.last_update
            >= self.recompute_interval
        ):
            self._recompute()

    # =========================================================
    # RECOMPUTATION
    # =========================================================

    def _recompute(self):
        """
        Recalculate spatial environmental fields.
        """

        self._estimate_wind()
        self._estimate_gust()
        self._estimate_rain()

        self._create_ensemble()

        self.last_update = self.time

    # =========================================================
    # WIND ESTIMATION
    # =========================================================

    def _estimate_wind(self):
        """
        Estimate wind using inverse-distance weighting.

        Weight:

            w = 1 / (distance + k)
        """

        if not self.observations:
            return

        u_sum = np.zeros_like(self.X)
        v_sum = np.zeros_like(self.X)
        weight_sum = np.zeros_like(self.X)

        for obs in self.observations:

            dx = self.X - obs["x"]
            dy = self.Y - obs["y"]

            distance = np.sqrt(
                dx * dx + dy * dy
            )

            weight = 1.0 / (
                distance + self.k
            )

            u_sum += (
                weight
                * obs["wind_u"]
            )

            v_sum += (
                weight
                * obs["wind_v"]
            )

            weight_sum += weight

        weight_sum = np.maximum(
            weight_sum,
            1e-9
        )

        self.wind_u = (
            u_sum / weight_sum
        )

        self.wind_v = (
            v_sum / weight_sum
        )

        # Uncertainty is lower when observations
        # are closer and more numerous.
        self.wind_uncertainty = 1.0 / np.sqrt(
            weight_sum
        )

    # =========================================================
    # GUST ESTIMATION
    # =========================================================

    def _estimate_gust(self):
        """
        Estimate gust magnitude using the same spatial weighting.
        """

        if not self.observations:
            return

        gust_sum = np.zeros_like(self.X)
        weight_sum = np.zeros_like(self.X)

        for obs in self.observations:

            dx = self.X - obs["x"]
            dy = self.Y - obs["y"]

            distance = np.sqrt(
                dx * dx + dy * dy
            )

            weight = 1.0 / (
                distance + self.k
            )

            gust_sum += (
                weight
                * obs["gust"]
            )

            weight_sum += weight

        weight_sum = np.maximum(
            weight_sum,
            1e-9
        )

        self.gust = (
            gust_sum / weight_sum
        )

    # =========================================================
    # RAIN ESTIMATION
    # =========================================================

    def _estimate_rain(self):
        """
        Estimate the current rain field.
        """

        if not self.observations:
            return

        rain_sum = np.zeros_like(self.X)
        weight_sum = np.zeros_like(self.X)

        for obs in self.observations:

            dx = self.X - obs["x"]
            dy = self.Y - obs["y"]

            distance = np.sqrt(
                dx * dx + dy * dy
            )

            weight = 1.0 / (
                distance + self.k
            )

            rain_sum += (
                weight
                * obs["rain"]
            )

            weight_sum += weight

        weight_sum = np.maximum(
            weight_sum,
            1e-9
        )

        self.rain = np.maximum(
            0.0,
            rain_sum / weight_sum
        )

        self.rain_uncertainty = 1.0 / np.sqrt(
            weight_sum
        )

    # =========================================================
    # ENSEMBLE
    # =========================================================

    def _create_ensemble(self):
        """
        Create 30 environmental ensemble members.

        Each member perturbs:
            - wind speed
            - wind direction
            - wind intensity
            - rain
        """

        rng = np.random.default_rng(
            int(self.time) + 42
        )

        self.M = []

        base_speed = np.sqrt(
            self.wind_u ** 2
            + self.wind_v ** 2
        )

        base_direction = np.arctan2(
            self.wind_v,
            self.wind_u
        )

        for member_id in range(
            self.ENSEMBLE_SIZE
        ):

            # Speed perturbation
            speed_factor = rng.normal(
                1.0,
                0.05
            )

            # Direction perturbation
            direction_offset = rng.normal(
                0.0,
                np.deg2rad(5.0)
            )

            # Intensity perturbation
            intensity = rng.normal(
                1.0,
                0.05
            )

            speed = (
                base_speed
                * speed_factor
            )

            direction = (
                base_direction
                + direction_offset
            )

            member_u = (
                speed
                * np.cos(direction)
                * intensity
            )

            member_v = (
                speed
                * np.sin(direction)
                * intensity
            )

            member_gust = np.maximum(
                0.0,
                self.gust
                * rng.normal(1.0, 0.10)
            )

            member_rain = np.maximum(
                0.0,
                self.rain
                * rng.normal(1.0, 0.10)
            )

            self.M.append({
                "id": member_id,
                "wind_u": member_u,
                "wind_v": member_v,
                "gust": member_gust,
                "rain": member_rain,
            })

    # =========================================================
    # QUERY
    # =========================================================

    def query(
        self,
        x,
        y,
        t_ahead=0.0,
        member=0,
    ):
        """
        Query the predicted environment at position (x, y).

        Parameters:
            x       : x coordinate
            y       : y coordinate
            t_ahead : seconds into the future
            member  : ensemble member index
        """

        if not self.M:
            self._create_ensemble()

        member = int(
            np.clip(
                member,
                0,
                len(self.M) - 1
            )
        )

        env = self.M[member]

        wind_u = self._bilinear_nearest(
            env["wind_u"],
            x,
            y
        )

        wind_v = self._bilinear_nearest(
            env["wind_v"],
            x,
            y
        )

        gust = self._bilinear_nearest(
            env["gust"],
            x,
            y
        )

        rain = self._bilinear_nearest(
            env["rain"],
            x,
            y
        )

        # Simple forecast lead-time adjustment.
        # Uncertainty grows with forecast horizon.
        horizon_factor = 1.0 + (
            max(float(t_ahead), 0.0)
            / 60.0
        ) * 0.05

        return {
            "x": float(x),
            "y": float(y),
            "t_ahead": float(t_ahead),
            "member": member,

            "wind_u": float(wind_u),
            "wind_v": float(wind_v),

            "wind_speed": float(
                np.sqrt(
                    wind_u ** 2
                    + wind_v ** 2
                )
            ),

            "gust": float(gust),
            "rain": float(rain),

            "wind_uncertainty": float(
                np.mean(
                    self.wind_uncertainty
                )
                * horizon_factor
            ),

            "rain_uncertainty": float(
                np.mean(
                    self.rain_uncertainty
                )
                * horizon_factor
            ),
        }

    # =========================================================
    # GRIDS
    # =========================================================

    def grids(self):
        """
        Return the current 40 x 40 environment grids.
        """

        return {
            "x": self.X.copy(),
            "y": self.Y.copy(),

            "wind_u": self.wind_u.copy(),
            "wind_v": self.wind_v.copy(),

            "gust": self.gust.copy(),
            "rain": self.rain.copy(),

            "wind_uncertainty":
                self.wind_uncertainty.copy(),

            "rain_uncertainty":
                self.rain_uncertainty.copy(),
        }

    # =========================================================
    # HELPERS
    # =========================================================

    def _bilinear_nearest(
        self,
        field,
        x,
        y,
    ):
        """
        Return the value from the nearest grid point.

        This keeps the query fast and vector-friendly.
        """

        x = self._clip(
            float(x),
            self.x_min,
            self.x_max
        )

        y = self._clip(
            float(y),
            self.y_min,
            self.y_max
        )

        ix = int(
            round(
                (x - self.x_min)
                / (self.x_max - self.x_min)
                * (self.GRID_SIZE - 1)
            )
        )

        iy = int(
            round(
                (y - self.y_min)
                / (self.y_max - self.y_min)
                * (self.GRID_SIZE - 1)
            )
        )

        ix = max(
            0,
            min(
                self.GRID_SIZE - 1,
                ix
            )
        )

        iy = max(
            0,
            min(
                self.GRID_SIZE - 1,
                iy
            )
        )

        return float(
            field[iy, ix]
        )

    @staticmethod
    def _number(value, default=0.0):
        try:
            value = float(value)

            if np.isfinite(value):
                return value

        except (TypeError, ValueError):
            pass

        return float(default)

    @staticmethod
    def _clip(value, low, high):
        return float(
            np.clip(value, low, high)
        )
        