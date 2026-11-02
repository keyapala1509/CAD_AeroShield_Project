# AeroShield: A Digital-Twin-Based Viability Engine for Autonomous Drone Fleet Survival in Disaster Zones

AeroShield is a command-and-control prototype for a fleet of autonomous drones operating over disaster zones. It uses digital twins of individual drones and their surrounding environment to estimate the probability of mission completion and safe return for each drone.

Based on these estimates, the system generates three operational decisions: **GO, REROUTE, or ABORT**, supporting safer and more informed autonomous fleet operations.

## 1. Problem Statement

Drones deployed for disaster response operate in unpredictable environmental conditions, including strong wind gusts, rainfall, storms, and degraded battery or motor health.

A drone that loses power or operates beyond its physical limits may fail to complete its mission, resulting in the loss of valuable operational data.

AeroShield addresses this challenge by continuously evaluating the viability of each drone's mission.

The central question is:

*Given the current environmental conditions and the estimated health of a drone, what is the probability that it will successfully complete its mission and return safely to base?*

## 2. How It Works

### 2.1 Simulated Fleet and Environment

**Location:** `cadBackend/sim/`

The simulation consists of five drones (D1–D5) operating on a 100 × 100 map.

The environment models:
- Spatially and temporally varying wind conditions.
- Rainfall and storm cells.
- Drone battery levels and motor health.
- IMU-based vibration monitoring.
- Motor cooling systems.
- Fault injection, including weak battery conditions.

Drones D1–D3 follow out-and-back routes from the base at coordinates (0, 0), while D4 and D5 remain on standby.

Twenty ground sensors provide localized wind and rainfall readings to support environmental estimation.

### 2.2 Digital Twins

**Location:** `cadBackend/twins/`

AeroShield incorporates two types of digital twins.

**Environment Twin**

- Reconstructs wind and rainfall fields using ground sensor readings.
- Uses Inverse Distance Weighting (IDW) to estimate environmental conditions between sensor locations.
- Maintains an ensemble of possible wind fields to represent environmental uncertainty.

**Drone Health Twin**

Each drone has an individual health twin that monitors its operational condition.

It:
- Estimates battery health using a 60-second regression of observed state-of-charge drop against expected energy consumption.
- Tracks motor temperature, vibration and cooling performance.
- Uses a trained fault classifier to identify conditions such as healthy operation, weak battery, motor overheating and vibration faults.

### 2.3 Viability Engine and Decision Controller

**Locations:**
- `cadBackend/viability/`
- `cadBackend/controller/`

The viability engine uses Monte Carlo simulation to estimate the probability of successful mission completion.

For every flying drone:
1. Environmental conditions are sampled from the environment twin.
2. Battery and motor parameters are sampled from the drone health twin.
3. The planned flight route is simulated.
4. Each simulation run checks whether the drone can complete its mission and return safely.
5. The fraction of successful simulation runs becomes the drone's estimated survival probability.

A simulation run is considered unsuccessful if:
- Battery charge falls below the required reserve.
- Motor temperature exceeds its safe operating limit.
- Vibration exceeds the permitted threshold.
- Wind speed exceeds the drone's rated operating limit.

**Decision Logic**

| Decision | Condition | Action |
|---|---|---|
| GO | Survival probability ≥ 90% | Mission can proceed. |
| REROUTE | Survival probability between 60% and 90% | Reroute decision is logged. |
| ABORT | Survival probability remains below 90% for two consecutive checks | Drone is stopped. |

**Note:** REROUTE is currently recorded in the decision log but is not yet physically executed by the backend.

**Machine Learning-Based Power Prediction**

The power model (`cadBackend/ml/stress.py`) predicts drone power consumption using:
- Wind speed and gust intensity.
- Rainfall.
- Payload.
- Battery health.

If the trained model cannot be loaded, the system falls back to a physics-based power estimation formula.

### 2.4 Command and Control Dashboard

**Locations:**
- Backend: `cadBackend/main.py`
- Frontend: `aeroshield_control/`

The FastAPI backend provides REST endpoints and streams telemetry snapshots approximately five times per second through a WebSocket connection at `/ws`.

The React dashboard runs locally at `http://localhost:3000` and provides six operational views:

| Dashboard View | Functionality |
|---|---|
| Mission | Overall flight and mission monitoring. |
| Fleet | Individual drone telemetry, survival estimates and decisions. |
| Env | Visualization of wind and rainfall conditions. |
| Viab | Mission survival curves and viability analytics. |
| Decide | Autonomous decision and event logs. |
| System | Backend connectivity and REST API testing. |

An Android wrapper in `aeroshield_control/app/` packages the dashboard as a mobile application.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI |
| Communication | REST API, WebSockets |
| Machine Learning | Scikit-learn and trained ML models |
| Simulation | Custom Python-based drone and environment simulation |
| Digital Twins | Environment Twin and Drone Health Twin |
| Android Application | Kotlin, Gradle |
| Data Visualization | React-based dashboard components |

## 4. Project Structure

```text
CAD_AeroShield_Project/
│
├── cadBackend/
│   ├── main.py
│   ├── runner.py
│   ├── config.py
│   ├── bus.py
│   │
│   ├── sim/
│   │   ├── drone_physics.py
│   │   ├── environment.py
│   │   ├── sensors.py
│   │   └── headless.py
│   │
│   ├── twins/
│   │   ├── env_twin.py
│   │   ├── health_twin.py
│   │   └── ...
│   │
│   ├── viability/
│   │   └── engine.py
│   │
│   ├── controller/
│   │   └── controller.py
│   │
│   ├── ml/
│   │   ├── fault.py
│   │   ├── stress.py
│   │   ├── features.py
│   │   └── models/
│   │
│   └── requirements.txt
│
├── aeroshield_control/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   │
│   ├── app/
│   │   └── Android application
│   │
│   ├── package.json
│   └── vite.config.js
│
├── mlpart/
│   └── mlpart/
│       ├── common/
│       ├── eval/
│       ├── ml/
│       ├── standalone/
│       ├── tests/
│       └── twins/
│
└── README.md
```

## 5. Installation and Setup

### Prerequisites

- Python 3.12 or later.
- Node.js 18 or later.
- npm.
- Git.

### Step 1: Clone the Repository

```powershell
git clone https://github.com/keyapala1509/CAD_AeroShield_Project.git
cd CAD_AeroShield_Project
```

### Step 2: Start the Backend

Open a terminal and execute:

```powershell
cd cadBackend

python -m venv venv

.\venv\Scripts\Activate.ps1

python -m pip install -r requirements.txt

python -m uvicorn main:app --port 8000
```

The FastAPI backend will be available at:

`http://localhost:8000`

### Step 3: Start the Frontend

Open a second terminal:

```powershell
cd aeroshield_control

npm install

npm run dev
```

Open the dashboard in your browser:

`http://localhost:3000`

### Step 4: Run the Simulation

1. Open the dashboard.
2. Navigate to the SYSTEM tab.
3. Press the POST /play button to start the simulation.
4. Navigate to the FLEET tab to monitor individual drones.
5. Open the DECIDE tab to observe operational decisions.

**Important:** Run the backend from the `cadBackend` directory because the model paths are relative to that directory.

## 6. API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Returns backend status and simulation time. |
| POST | `/play` | Starts the simulation. |
| POST | `/pause` | Pauses the simulation. |
| POST | `/reset` | Rebuilds the fleet and environment. |
| WS | `/ws` | Streams telemetry snapshots approximately five times per second. |

## 7. Known Limitations

AeroShield is currently a working prototype, and certain functionalities require further development.

- **Operator Commands:** ENFORCE RTB and EXECUTE RTB commands are sent over WebSocket, but the backend does not currently execute these commands.
- **Rerouting:** REROUTE decisions are logged but do not yet result in automatic route modification.
- **Health Estimation:** Battery health estimates are approximate and may lag behind actual battery conditions because of noisy sensor readings.
- **Survival Estimation:** Predictions depend on the accuracy of environmental, battery and fault models. They represent estimates rather than guarantees.
- **Fault Classifier:** The classifier was trained using the standalone simulator in `mlpart/`. Its accuracy on live backend simulation data has not yet been measured.
- **Backend Testing:** The backend test suite is currently empty. Existing tests cover the `mlpart/` package rather than `cadBackend/`.
- **Drone Handoff:** The HANDOFF functionality, which would allow one drone to take over another drone's mission, is not yet implemented.

## 8. Future Enhancements

Potential directions for further development include:

- Implementing dynamic route optimization and autonomous rerouting.
- Integrating operator command execution and return-to-base functionality.
- Improving fault detection through additional training and validation.
- Implementing drone-to-drone mission handoff.
- Expanding simulation scenarios to include more complex disaster environments.
- Improving the accuracy and calibration of survival probability estimates.
- Extending automated testing and system validation.

## 9. Team

**Project:** AeroShield

**Repository:** [CAD_AeroShield_Project](https://github.com/keyapala1509/CAD_AeroShield_Project)

**Team Members:**

- Bhagyashree Naidu O – 24BPS1036
- Keya Pala – 24BPS1039
- Tanvi – 24BPS1086



*Developed as a prototype for digital-twin-based drone fleet viability assessment, predictive monitoring and autonomous decision support in disaster-response environments.*
