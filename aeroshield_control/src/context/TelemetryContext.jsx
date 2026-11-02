import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { playSimulation, pauseSimulation, resetSimulation, checkBackendHealth, getBackendBaseUrl, setBackendBaseUrl } from '../services/api';
import telemetryWs from '../services/websocket';

const TelemetryContext = createContext(null);

// Initial baseline drone data reflecting the Stitch design state
const INITIAL_DRONES = {
  D1: {
    id: 'D1',
    callsign: 'UAV-01',
    name: 'SCOUT-ALPHA',
    x: 20.5,
    y: 10.2,
    status: 'FLYING - NOMINAL',
    soc: 87.3,
    temp: 48.2,
    vib: 0.21,
    survival: 94,
    decision: 'GO',
    dominantRisk: 'NONE',
    decisionReason: 'Nominal flight dynamics & safe viability margins verified.',
    history: [{ x: 10, y: 10 }, { x: 15, y: 10 }, { x: 20.5, y: 10.2 }],
    route: 'BASE → [60,20] → RETURN',
    standbyPad: null
  },
  D2: {
    id: 'D2',
    callsign: 'UAV-02',
    name: 'HAULER-BETA',
    x: 62.1,
    y: 58.4,
    status: 'FLYING - NOMINAL',
    soc: 79.1,
    temp: 51.0,
    vib: 0.24,
    survival: 91,
    decision: 'GO',
    dominantRisk: 'WIND (PERIMETER)',
    decisionReason: 'Viability acceptable. Gust vector 14m/s trending from north boundary.',
    history: [{ x: 10, y: 10 }, { x: 35, y: 30 }, { x: 62.1, y: 58.4 }],
    route: 'BASE → [50,40] → RETURN',
    standbyPad: null
  },
  D3: {
    id: 'D3',
    callsign: 'UAV-03',
    name: 'TACTICAL-RECON',
    x: 38.4,
    y: 68.2,
    status: 'FLYING (BATTERY DEGRADED)',
    soc: 48.2,
    temp: 58.6,
    vib: 0.38,
    survival: 62,
    decision: 'ABORT',
    dominantRisk: 'BATTERY (Cell degradation detected)',
    decisionReason: 'Continuing mission survival (62%) is below return survival threshold (78%). Immediate RTB advised.',
    history: [{ x: 10, y: 10 }, { x: 25, y: 40 }, { x: 38.4, y: 68.2 }],
    route: 'BASE → [40,80] → RET',
    standbyPad: null
  },
  D4: {
    id: 'D4',
    callsign: 'UAV-04',
    name: 'STANDBY-DELTA',
    x: 10.0,
    y: 10.0,
    status: 'IDLE - READY',
    soc: 99.5,
    temp: 24.1,
    vib: 0.00,
    survival: null,
    decision: 'STANDBY',
    dominantRisk: 'NONE',
    decisionReason: 'Asset docked on ground umbilical charging loop. Systems pre-checked.',
    history: [{ x: 10, y: 10 }],
    route: 'HANGAR BERTH 01',
    standbyPad: 'PAD A'
  },
  D5: {
    id: 'D5',
    callsign: 'UAV-05',
    name: 'STANDBY-ECHO',
    x: 12.0,
    y: 10.0,
    status: 'IDLE - READY',
    soc: 98.2,
    temp: 23.8,
    vib: 0.00,
    survival: null,
    decision: 'STANDBY',
    dominantRisk: 'NONE',
    decisionReason: 'Asset docked on ground power. Quick-launch protocol calibrated.',
    history: [{ x: 12, y: 10 }],
    route: 'HANGAR BERTH 02',
    standbyPad: 'PAD B'
  }
};

const INITIAL_LOGS = [];

export function TelemetryProvider({ children }) {
  const [wsStatus, setWsStatus] = useState('CONNECTING');
  const [wsLatency, setWsLatency] = useState(18);
  const [streamHz, setStreamHz] = useState(5);
  const [backendHealth, setBackendHealth] = useState({ online: false, checking: true });
  const [simTime, setSimTime] = useState(42.8);
  const [isPlaying, setIsPlaying] = useState(true);
  const [drones, setDrones] = useState(INITIAL_DRONES);
  const [selectedDroneId, setSelectedDroneId] = useState('D3');
  const [auditLogs, setAuditLogs] = useState(INITIAL_LOGS);
  const [toast, setToast] = useState({ visible: false, message: 'SYSTEM TELEMETRY LOCKED', type: 'info' });
  const [envLayer, setEnvLayer] = useState('combined'); // 'combined' | 'wind' | 'rain' | 'off'
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [backendUrl, setBackendUrlState] = useState(getBackendBaseUrl());
  const [wsUrl, setWsUrlState] = useState(telemetryWs.getUrl());
  
  // Environmental Grid Data
  const [envStats, setEnvStats] = useState({
    maxWind: 24.8,
    avgWind: 11.2,
    maxRain: 14.2,
    hazardAirspace: 18.5,
    stormVelocity: '4.2 KM/H SE'
  });

  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ visible: true, message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 2800);
  }, []);

  const addLog = useCallback((drone, type, text) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setAuditLogs((prev) => [
      { id: String(Date.now() + Math.random()), time: timeStr, drone, type, text },
      ...prev.slice(0, 49) // Keep last 50 logs
    ]);
  }, []);

  // Check Backend REST API Health
  const checkBackend = useCallback(async () => {
    try {
      await checkBackendHealth();
      setBackendHealth({ online: true, checking: false });
    } catch (err) {
      setBackendHealth({ online: false, checking: false });
    }
  }, []);

  useEffect(() => {
    checkBackend();
    const healthInterval = setInterval(checkBackend, 10000);
    return () => clearInterval(healthInterval);
  }, [checkBackend]);

  // Connect and listen to WebSocket
  useEffect(() => {
    telemetryWs.connect();

    const unsubStatus = telemetryWs.onStatusChange((status, info) => {
      setWsStatus(status);
      if (info.latency) setWsLatency(info.latency);
      if (info.hz) setStreamHz(info.hz || 5);
      
      if (status === 'CONNECTED') {
        showToast('BACKEND WEBSOCKET CONNECTED', 'success');
        addLog('SYS', 'SYSTEM', `Connected to telemetry stream at ${telemetryWs.getUrl()}`);
      } else if (status === 'ERROR' || status === 'DISCONNECTED') {
        // Will auto-reconnect
      }
    });

    const unsubMsg = telemetryWs.subscribe((data) => {
      if (!data) return;

      // 1. Simulation Time
      if (data.time !== undefined && data.time !== null) {
        setSimTime(Number(data.time));
      } else if (data.sim_time !== undefined) {
        setSimTime(Number(data.sim_time));
      }

      // 2. Play/Pause state
      if (data.is_playing !== undefined) {
        setIsPlaying(Boolean(data.is_playing));
      }

      // 3. Drone Telemetry Update
      // Supports array of drones, object keyed by ID, or root drone object
      let incomingDrones = [];
      if (Array.isArray(data.drones)) {
        incomingDrones = data.drones;
      } else if (data.drones && typeof data.drones === 'object') {
        incomingDrones = Object.entries(data.drones).map(([key, val]) => ({ id: key, ...val }));
      } else if (Array.isArray(data)) {
        incomingDrones = data;
      } else if (data.drone_id || data.id) {
        incomingDrones = [data];
      }

      if (incomingDrones.length > 0) {
        setDrones((prev) => {
          const updated = { ...prev };
          incomingDrones.forEach((d) => {
            const id = d.id || d.drone_id || d.droneId;
            if (!id) return;
            const existing = updated[id] || {
              id,
              callsign: `UAV-${id}`,
              history: []
            };

            const x = d.x !== undefined ? Number(d.x) : existing.x;
            const y = d.y !== undefined ? Number(d.y) : existing.y;

            // Keep trajectory breadcrumbs
            const history = [...(existing.history || [])];
            if (x !== undefined && y !== undefined) {
              const last = history[history.length - 1];
              if (!last || Math.hypot(last.x - x, last.y - y) > 1.0) {
                history.push({ x, y });
                if (history.length > 25) history.shift();
              }
            }

            updated[id] = {
              ...existing,
              id,
              callsign: d.callsign || existing.callsign || `UAV-${id}`,
              name: d.name || existing.name || `AIRFRAME-${id}`,
              x,
              y,
              status: d.status !== undefined ? d.status : existing.status,
              soc: d.soc !== undefined ? Number(d.soc) : (d.battery !== undefined ? Number(d.battery) : existing.soc),
              temp: d.temp !== undefined ? Number(d.temp) : (d.motor_temp !== undefined ? Number(d.motor_temp) : existing.temp),
              vib: d.vib !== undefined ? Number(d.vib) : (d.vibration !== undefined ? Number(d.vibration) : existing.vib),
              survival: d.survival !== undefined ? Number(d.survival) : (d.sEnd !== undefined ? Number(d.sEnd) : existing.survival),
              decision: d.decision !== undefined ? d.decision : existing.decision,
              dominantRisk: d.dominantRisk || d.dominant_risk || existing.dominantRisk,
              decisionReason: d.decisionReason || d.decision_reason || d.reason || existing.decisionReason,
              history
            };

            // Check if there was a critical status trigger to log
            if (d.decision === 'ABORT' && existing.decision !== 'ABORT') {
              addLog(id, 'ABORT', `Autonomous decision triggered: ABORT (sEnd: ${d.survival || existing.survival}%)`);
            } else if (d.decision === 'REROUTE' && existing.decision !== 'REROUTE') {
              addLog(id, 'REROUTE', `Vector reroute advisory: ${d.dominantRisk || 'Margin breach'}`);
            }
          });
          return updated;
        });
      }

      // 4. Environment Grid Data (if provided)
      if (data.wind_grid || data.rain_grid || data.env) {
        setEnvStats((prev) => ({
          ...prev,
          maxWind: data.max_wind !== undefined ? Number(data.max_wind) : prev.maxWind,
          avgWind: data.avg_wind !== undefined ? Number(data.avg_wind) : prev.avgWind,
          maxRain: data.max_rain !== undefined ? Number(data.max_rain) : prev.maxRain,
          hazardAirspace: data.hazard_airspace !== undefined ? Number(data.hazard_airspace) : prev.hazardAirspace,
          stormVelocity: data.storm_velocity || prev.stormVelocity
        }));
      }

      // 5. Events / Logs
      if (Array.isArray(data.events)) {
        data.events.forEach((ev) => {
          addLog(ev.drone || 'SYS', ev.type || 'INFO', ev.message || ev.text || JSON.stringify(ev));
        });
      }
    });

    return () => {
      unsubStatus();
      unsubMsg();
    };
  }, [addLog, showToast]);

  // Demo simulation generator when backend is not yet accessible (optional preview mode)
  useEffect(() => {
    if (!isDemoMode) return;
    const timer = setInterval(() => {
      setSimTime((t) => Number((t + 0.2).toFixed(1)));
      setDrones((prev) => {
        const next = { ...prev };
        // Animate D1
        if (next.D1) {
          const t = Date.now() / 2500;
          const nx = Math.max(10, Math.min(80, 20.5 + Math.sin(t) * 8));
          const ny = Math.max(10, Math.min(40, 10.2 + Math.cos(t) * 5));
          next.D1 = { ...next.D1, x: Number(nx.toFixed(1)), y: Number(ny.toFixed(1)) };
        }
        // Animate D2
        if (next.D2) {
          const t = Date.now() / 2200;
          const nx = Math.max(40, Math.min(85, 62.1 + Math.sin(t * 1.2) * 6));
          const ny = Math.max(40, Math.min(80, 58.4 + Math.cos(t * 1.1) * 7));
          next.D2 = { ...next.D2, x: Number(nx.toFixed(1)), y: Number(ny.toFixed(1)) };
        }
        // Animate D3 (jittery inside storm cell)
        if (next.D3) {
          const t = Date.now() / 1500;
          const nx = Math.max(32, Math.min(45, 38.4 + Math.sin(t * 2) * 2));
          const ny = Math.max(62, Math.min(74, 68.2 + Math.cos(t * 2) * 2));
          const soc = Math.max(20, Number((next.D3.soc - 0.02).toFixed(1)));
          next.D3 = { ...next.D3, x: Number(nx.toFixed(1)), y: Number(ny.toFixed(1)), soc };
        }
        return next;
      });
    }, 200);
    return () => clearInterval(timer);
  }, [isDemoMode]);

  // Actions
  const handlePlay = async () => {
    try {
      showToast('POST /play -> RUNNING @ 5Hz', 'info');
      addLog('CMD', 'PLAY', 'POST /play -> Telemetry Simulation Active');
      setIsPlaying(true);
      await playSimulation();
    } catch (err) {
      // Backend not running or offline
      console.warn('Play simulation API error:', err);
    }
  };

  const handlePause = async () => {
    try {
      showToast('POST /pause -> HOLD VECTOR', 'info');
      addLog('CMD', 'PAUSE', 'POST /pause -> Simulation Paused');
      setIsPlaying(false);
      await pauseSimulation();
    } catch (err) {
      console.warn('Pause simulation API error:', err);
    }
  };

  const handleReset = async () => {
    try {
      showToast('POST /reset -> T+000.0s CLEARED', 'info');
      addLog('CMD', 'RESET', 'POST /reset -> Simulation Reset to T+000.0s');
      setSimTime(0.0);
      await resetSimulation();
    } catch (err) {
      console.warn('Reset simulation API error:', err);
    }
  };

  const handleEnforceRtb = (droneId) => {
    const d = drones[droneId] || drones[selectedDroneId];
    showToast(`RTB PROTOCOL ENGAGED // ${d.id} RETURNING`, 'warning');
    addLog(d.id, 'RTB', `Command: Manual RTB override enforced for ${d.id}`);
    telemetryWs.send({ command: 'RTB', drone_id: d.id });
  };

  const handleReroute = (droneId) => {
    const d = drones[droneId] || drones[selectedDroneId];
    showToast(`AUTONOMOUS VECTOR RE-CALCULATED // ${d.id}`, 'info');
    addLog(d.id, 'REROUTE', `Command: Auxiliary path reroute requested for ${d.id}`);
    telemetryWs.send({ command: 'REROUTE', drone_id: d.id });
  };

  const handleRecallFleet = () => {
    showToast('GLOBAL RTB COMMAND BROADCASTED', 'error');
    addLog('SYS', 'GLOBAL_RTB', 'Emergency Fleet Recall issued: All airborne assets directed to Home Base');
    telemetryWs.send({ command: 'RECALL_ALL' });
  };

  const updateUrls = (newApiUrl, newWsUrl) => {
    if (newApiUrl) {
      setBackendBaseUrl(newApiUrl);
      setBackendUrlState(newApiUrl);
      checkBackend();
    }
    if (newWsUrl) {
      telemetryWs.setUrl(newWsUrl);
      setWsUrlState(newWsUrl);
    }
    showToast('CONNECTION SETTINGS UPDATED', 'success');
  };

  // Aggregated KPIs
  const droneList = Object.values(drones);
  const airborneCount = droneList.filter((d) => String(d.status).toUpperCase().includes('FLYING')).length;
  const idleCount = droneList.filter((d) => !String(d.status).toUpperCase().includes('FLYING')).length;
  const activeRisksCount = droneList.filter((d) => d.dominantRisk && d.dominantRisk !== 'NONE').length;
  const decisionsCount = droneList.filter((d) => d.decision === 'ABORT' || d.decision === 'REROUTE').length;
  
  // Weighted Fleet Survival Calculation
  const survivingDrones = droneList.filter((d) => typeof d.survival === 'number');
  const fleetSurvival = survivingDrones.length > 0
    ? Number((survivingDrones.reduce((acc, d) => acc + d.survival, 0) / survivingDrones.length).toFixed(1))
    : 82.4;

  const selectedDrone = drones[selectedDroneId] || drones.D3 || droneList[0];

  return (
    <TelemetryContext.Provider
      value={{
        wsStatus,
        wsLatency,
        streamHz,
        backendHealth,
        simTime,
        isPlaying,
        drones,
        droneList,
        selectedDroneId,
        selectedDrone,
        setSelectedDroneId,
        auditLogs,
        toast,
        showToast,
        addLog,
        envLayer,
        setEnvLayer,
        envStats,
        isDemoMode,
        setIsDemoMode,
        backendUrl,
        wsUrl,
        updateUrls,
        airborneCount,
        idleCount,
        activeRisksCount,
        decisionsCount,
        fleetSurvival,
        play: handlePlay,
        pause: handlePause,
        reset: handleReset,
        enforceRtb: handleEnforceRtb,
        reroute: handleReroute,
        recallFleet: handleRecallFleet
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
