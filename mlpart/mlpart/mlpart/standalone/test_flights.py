"""Run from the project root:  python -m standalone.test_flights"""
import numpy as np
from standalone.run_flight import run_flight, random_scenario

ROUTE = [(10, 50), (50, 50), (10, 50)]          # 40 units out, 40 back (4 km each way)
STORM = [dict(x=30, y=50, vx=0, vy=0, radius=28, intensity=0.85)]


def show(name, res, expect):
    o = res["outcome"]
    print(f"\n{name}")
    print(f"  status={o['status']}  cause={o['cause']}  duration={o['duration']}s")
    print(f"  battery used={o['soc_used']:.1f}%   max motor temp={o['max_temp']:.1f} C   max vib={o['max_vib']:.2f}")
    print(f"  expected: {expect}")


# 1) calm weather, healthy drone
show("1) Calm weather, healthy",
     run_flight(1, [], ROUTE, payload=0.0),
     "about 50% battery used, motor 60-65 C, landed")

# 2) storm, healthy drone (average of several seeds, gusts are random)
used, lost = [], 0
for s in range(20):
    o = run_flight(s, STORM, ROUTE, payload=0.2)["outcome"]
    lost += o["status"] == "lost"
    if o["status"] == "landed":
        used.append(o["soc_used"])
print("\n2) Storm, healthy (20 seeds)")
print(f"  landed={20 - lost}/20   mean battery used (landed)={np.mean(used):.1f}%")
print("  expected: about 70% battery used, nearly all landed")

# 3) storm, weak battery from the start
res = [run_flight(s, STORM, ROUTE, payload=0.2, fault="battery", fault_time=0)["outcome"] for s in range(20)]
lost = sum(o["status"] == "lost" for o in res)
print("\n3) Storm, weak battery (20 seeds)")
print(f"  lost={lost}/20   causes={sorted(set(o['cause'] for o in res if o['cause']))}")
print("  expected: drone fails")

# 4) random scenarios, quick sanity check of outcome mix
print("\n4) 200 random scenarios")
outs = [run_flight(**random_scenario(s))["outcome"] for s in range(200)]
lost = [o for o in outs if o["status"] == "lost"]
print(f"  lost={len(lost)}/200   timeouts={sum(o['status']=='timeout' for o in outs)}")
causes = {}
for o in lost:
    causes[o["cause"]] = causes.get(o["cause"], 0) + 1
print(f"  causes={causes}")
print("  expected: roughly 35-45% lost, with all four causes (battery, motor, vibration, wind)")
