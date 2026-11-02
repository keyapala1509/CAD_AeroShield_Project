import os

folders = ["common", "standalone", "ml", "ml/models", "twins", "eval", "data", "tests"]
files = [
    "common/config.py", "common/physics.py", "common/bus.py",
    "standalone/sim.py", "standalone/run_flight.py",
    "ml/gen_data.py", "ml/features.py", "ml/stress.py",
    "ml/train_stress.py", "ml/train_fault.py",
    "twins/env_twin.py", "twins/health_twin.py",
]
for f in folders:
    os.makedirs(f, exist_ok=True)
for f in files:
    open(f, "a").close()
# __init__.py makes each folder importable as a Python package
for f in ["common", "standalone", "ml", "twins", "eval", "tests"]:
    open(os.path.join(f, "__init__.py"), "a").close()
print("Done")
