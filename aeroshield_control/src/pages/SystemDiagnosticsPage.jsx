import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { checkBackendHealth, playSimulation, pauseSimulation, resetSimulation } from '../services/api';
import telemetryWs from '../services/websocket';

export function SystemDiagnosticsPage() {
  const {
    wsStatus,
    wsLatency,
    streamHz,
    backendHealth,
    backendUrl,
    wsUrl,
    updateUrls,
    isDemoMode,
    setIsDemoMode,
    showToast,
    addLog
  } = useTelemetry();

  const [inputApiUrl, setInputApiUrl] = useState(backendUrl);
  const [inputWsUrl, setInputWsUrl] = useState(wsUrl);
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const handleTestEndpoint = async (endpoint, action) => {
    setTesting(true);
    setTestResult({ endpoint, status: 'TESTING...' });
    const startTime = Date.now();

    try {
      let res;
      if (endpoint === 'GET /') {
        res = await checkBackendHealth();
      } else if (endpoint === 'POST /play') {
        res = await playSimulation();
      } else if (endpoint === 'POST /pause') {
        res = await pauseSimulation();
      } else if (endpoint === 'POST /reset') {
        res = await resetSimulation();
      }

      const elapsed = Date.now() - startTime;
      setTestResult({
        endpoint,
        status: '200 OK',
        latency: `${elapsed}ms`,
        data: res
      });
      showToast(`${endpoint} SUCCESS (${elapsed}ms)`, 'success');
      addLog('SYS', 'API_TEST', `${endpoint} succeeded in ${elapsed}ms`);
    } catch (err) {
      const elapsed = Date.now() - startTime;
      setTestResult({
        endpoint,
        status: 'FAILED',
        error: err.message,
        hint: 'Ensure FastAPI backend is running: `uvicorn main:app --reload --host 0.0.0.0 --port 8000`'
      });
      showToast(`${endpoint} ERROR: ${err.message}`, 'error');
      addLog('SYS', 'API_ERR', `${endpoint} failed: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveUrls = (e) => {
    e.preventDefault();
    updateUrls(inputApiUrl, inputWsUrl);
  };

  const handleReconnectWs = () => {
    telemetryWs.reconnect();
    showToast('RECONNECTING WEBSOCKET...', 'info');
    addLog('SYS', 'WS_RECONNECT', 'Manual WebSocket reconnect initiated');
  };

  return (
    <div className="flex flex-col w-full px-space-md py-space-sm gap-space-md font-mono">
      {/* 1. Header Banner */}
      <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-xs border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">vital_signs</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-sans">
              System Diagnostics
            </span>
          </div>
          <span
            className={`font-label-xs text-label-xs px-space-xs py-0.5 rounded border ${
              wsStatus === 'CONNECTED'
                ? 'text-tertiary bg-tertiary-container/20 border-tertiary/40'
                : 'text-error bg-error-container/20 border-error/40'
            }`}
          >
            {wsStatus === 'CONNECTED' ? 'TELEMETRY LOCKED' : 'LINK OFFLINE'}
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant font-sans">
          Inspect FastAPI backend connectivity, evaluate telemetry frame rate, and trigger REST endpoints.
        </p>
      </div>

      {/* 2. Connection Metrics Grid */}
      <div className="grid grid-cols-2 gap-space-xs">
        {/* WebSocket Ingest Node */}
        <div className="bg-surface-container p-space-sm rounded flex flex-col justify-between border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-xs text-label-xs text-outline uppercase">WEBSOCKET INGEST</span>
            <span className="material-symbols-outlined text-[15px] text-primary">wifi_tethering</span>
          </div>
          <div className="my-1">
            <span
              className={`font-data-display text-headline-sm font-bold ${
                wsStatus === 'CONNECTED' ? 'text-tertiary' : 'text-error'
              }`}
            >
              {wsStatus}
            </span>
          </div>
          <div className="flex items-center justify-between text-label-xs text-outline pt-1 border-t border-outline-variant/20">
            <span>SYNC FREQ</span>
            <span className="text-primary font-bold">{streamHz || 5} Hz</span>
          </div>
        </div>

        {/* REST API Node */}
        <div className="bg-surface-container p-space-sm rounded flex flex-col justify-between border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-xs text-label-xs text-outline uppercase">FASTAPI REST LINK</span>
            <span className="material-symbols-outlined text-[15px] text-primary">api</span>
          </div>
          <div className="my-1">
            <span
              className={`font-data-display text-headline-sm font-bold ${
                backendHealth.online ? 'text-tertiary' : 'text-outline'
              }`}
            >
              {backendHealth.online ? 'ONLINE' : 'STANDALONE'}
            </span>
          </div>
          <div className="flex items-center justify-between text-label-xs text-outline pt-1 border-t border-outline-variant/20">
            <span>LATENCY</span>
            <span className="text-tertiary font-bold">{wsLatency || 18} ms</span>
          </div>
        </div>
      </div>

      {/* 3. FastAPI Endpoint Tester */}
      <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-xs border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface">
            FastAPI REST Verification Triggers
          </span>
          <span className="font-label-xs text-label-xs text-outline">HTTP 1.1 // JSON</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-xs pt-1">
          <button
            onClick={() => handleTestEndpoint('GET /')}
            disabled={testing}
            className="h-9 bg-surface-container hover:bg-surface-variant text-on-surface text-label-xs uppercase font-bold rounded flex items-center justify-center gap-1 border border-outline-variant/30 active:scale-95 transition-all"
            type="button"
          >
            <span>GET /</span>
          </button>
          <button
            onClick={() => handleTestEndpoint('POST /play')}
            disabled={testing}
            className="h-9 bg-surface-container hover:bg-surface-variant text-tertiary text-label-xs uppercase font-bold rounded flex items-center justify-center gap-1 border border-outline-variant/30 active:scale-95 transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">play_arrow</span>
            <span>POST /play</span>
          </button>
          <button
            onClick={() => handleTestEndpoint('POST /pause')}
            disabled={testing}
            className="h-9 bg-surface-container hover:bg-surface-variant text-primary text-label-xs uppercase font-bold rounded flex items-center justify-center gap-1 border border-outline-variant/30 active:scale-95 transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">pause</span>
            <span>POST /pause</span>
          </button>
          <button
            onClick={() => handleTestEndpoint('POST /reset')}
            disabled={testing}
            className="h-9 bg-surface-container hover:bg-surface-variant text-error text-label-xs uppercase font-bold rounded flex items-center justify-center gap-1 border border-outline-variant/30 active:scale-95 transition-all"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            <span>POST /reset</span>
          </button>
        </div>

        {/* Live Response Panel */}
        {testResult && (
          <div className="mt-space-xs bg-surface-container-lowest p-space-sm rounded border border-outline-variant/30 text-label-xs">
            <div className="flex items-center justify-between pb-1 border-b border-outline-variant/20 mb-1">
              <span className="text-primary font-bold">{testResult.endpoint}</span>
              <span
                className={`font-bold ${
                  testResult.status === '200 OK'
                    ? 'text-tertiary'
                    : testResult.status === 'TESTING...'
                    ? 'text-secondary'
                    : 'text-error'
                }`}
              >
                {testResult.status} {testResult.latency ? `(${testResult.latency})` : ''}
              </span>
            </div>
            {testResult.error && (
              <div className="text-error font-sans text-body-sm py-1">
                {testResult.error}
                <div className="text-outline text-label-xs font-mono mt-0.5">{testResult.hint}</div>
              </div>
            )}
            {testResult.data && (
              <pre className="text-on-surface-variant max-h-36 overflow-auto text-label-xs font-mono">
                {JSON.stringify(testResult.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* 4. Backend Host Configuration Form */}
      <form onSubmit={handleSaveUrls} className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-sm border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface">
            Network Host Settings
          </span>
          <button
            type="button"
            onClick={handleReconnectWs}
            className="text-primary text-label-xs uppercase hover:underline"
          >
            FORCE RECONNECT WS
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-label-xs text-outline uppercase">FastAPI Base URL</label>
          <input
            type="text"
            value={inputApiUrl}
            onChange={(e) => setInputApiUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="bg-surface-container px-space-sm py-1.5 rounded border border-outline-variant/40 text-on-surface text-label-sm font-mono focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-label-xs text-outline uppercase">WebSocket Telemetry URL</label>
          <input
            type="text"
            value={inputWsUrl}
            onChange={(e) => setInputWsUrl(e.target.value)}
            placeholder="ws://localhost:8000/ws"
            className="bg-surface-container px-space-sm py-1.5 rounded border border-outline-variant/40 text-on-surface text-label-sm font-mono focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="submit"
          className="h-9 bg-primary text-on-primary text-label-xs uppercase font-bold rounded flex items-center justify-center gap-1 active:bg-primary-container transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">save</span>
          <span>APPLY CONFIGURATION & RECONNECT</span>
        </button>
      </form>

      {/* 5. Offline Demo Simulation Toggle */}
      <div className="bg-surface-container-low p-space-md rounded-lg flex items-center justify-between border border-outline-variant/30">
        <div className="flex flex-col gap-0.5">
          <span className="font-label-sm text-label-sm uppercase font-bold text-on-surface">
            Offline Demo Physics Mode
          </span>
          <span className="font-body-sm text-body-sm text-on-surface-variant font-sans">
            Simulates dynamic waypoint vectors when the external FastAPI backend is offline.
          </span>
        </div>
        <button
          onClick={() => {
            const next = !isDemoMode;
            setIsDemoMode(next);
            showToast(next ? 'DEMO SIMULATION ACTIVE' : 'DEMO SIMULATION PAUSED', 'info');
          }}
          className={`h-8 px-space-sm rounded text-label-xs uppercase font-bold flex items-center gap-1 transition-colors ${
            isDemoMode
              ? 'bg-tertiary text-on-tertiary'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/40'
          }`}
          type="button"
        >
          <span className="material-symbols-outlined text-[14px]">
            {isDemoMode ? 'toggle_on' : 'toggle_off'}
          </span>
          <span>{isDemoMode ? 'ENABLED' : 'DISABLED'}</span>
        </button>
      </div>
    </div>
  );
}
