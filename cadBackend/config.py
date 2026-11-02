import numpy as np

SEED = 42
RNG = np.random.default_rng(SEED)

GRID_SIZE = 40
MAP_UNITS = 100
UNIT_METERS = 50

P0 = 200.0
C_NOM = 70.0         # nominal battery capacity, Wh (tuned for round-trip missions incl. return leg)
T_AMBIENT = 30.0
MOTOR_LIMIT = 95.0
VIB_LIMIT = 0.8
SOC_RESERVE = 20.0
WIND_RATED = 14.0
CRUISE_SPEED = 0.24

GO_THRESHOLD = 0.90
CONDITIONAL_THRESHOLD = 0.70
ABORT_THRESHOLD = 0.60

N_SAMPLES = 200
N_FORECAST_MEMBERS = 30

TICK_HZ = 5
TICK_INTERVAL = 1.0 / TICK_HZ

TOPIC_DRONE_TELEMETRY = "drone/{id}/telemetry"
TOPIC_GROUND_SENSOR = "sensor/ground/{id}"
TOPIC_DRONE_HEALTH = "drone/{id}/health"