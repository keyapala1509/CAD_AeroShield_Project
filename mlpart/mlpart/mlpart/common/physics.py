import numpy as np
from common.config import *

def power_w(headwind, gust, rain, payload, health):
    h = np.maximum(headwind, 0)
    return (P0 * (1 + 0.004*h**2 + 0.3*rain + 0.01*gust + 0.0006*gust*h**2)
            * (1 + 0.5*(1 - health)) * (1 + 0.15*payload))

def soc_drop_pct(power, dt, health):
    return power * dt / (3600 * C_NOM * health) * 100

def motor_temp_rate(power, cooling, temp):
    return 0.6 * power / P0 - 0.02 * cooling * (temp - T_AMBIENT)

def vibration(gust, fault_vib):
    return 0.2 + 0.02 * gust + fault_vib

def wind_from_rain(base_wind, rain):
    return base_wind * (1 + 1.5 * rain)
    