import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { FleetDispatchHeader } from '../components/FleetDispatchHeader';
import { formatPercent, formatMetric } from '../utils/formatters';

export function FleetMatrixPage() {
  const {
    droneList,
    selectedDroneId,
    setSelectedDroneId,
    enforceRtb,
    recallFleet,
    showToast,
    addLog,
    wsStatus
  } = useTelemetry();

  const [filter, setFilter] = useState('all'); // 'all' | 'flying' | 'idle' | 'degraded' | 'critical'
  const [sortBy, setSortBy] = useState('survival'); // 'survival' | 'soc' | 'temp' | 'vib'
  const [syncing, setSyncing] = useState(false);

  // Filter drones
  const filteredDrones = droneList.filter((d) => {
    const s = String(d.status).toUpperCase();
    if (filter === 'all') return true;
    if (filter === 'flying') return s.includes('FLYING');
    if (filter === 'idle') return s.includes('IDLE') || s.includes('STANDBY');
    if (filter === 'degraded') return s.includes('DEGRADED') || d.decision === 'REROUTE';
    if (filter === 'critical') return d.decision === 'ABORT' || (d.survival !== null && d.survival < 70);
    return true;
  });

  // Sort drones
  const sortedDrones = [...filteredDrones].sort((a, b) => {
    if (sortBy === 'survival') {
      const survA = a.survival ?? -1;
      const survB = b.survival ?? -1;
      return survB - survA;
    }
    if (sortBy === 'soc') {
      return (b.soc ?? 0) - (a.soc ?? 0);
    }
    if (sortBy === 'temp') {
      return (b.temp ?? 0) - (a.temp ?? 0);
    }
    if (sortBy === 'vib') {
      return (b.vib ?? 0) - (a.vib ?? 0);
    }
    return 0;
  });

  const handleExportLogs = () => {
    const jsonStr = JSON.stringify(droneList, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aeroshield_flight_logs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Compiling high-rate flight log: JSON bundle created', 'success');
    addLog('SYS', 'EXPORT', 'Exported high-rate flight log JSON bundle');
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      showToast('Telemetry delta synchronized with C2 Node', 'success');
      addLog('SYS', 'SYNC', 'Telemetry delta synchronized with C2 Node @ 20Hz');
    }, 600);
  };

  return (
    <div className="flex flex-col w-full px-space-md py-space-sm gap-space-md">
      {/* 1. Header with Radar Console */}
      <FleetDispatchHeader />

      {/* 2. Filter & Sorting Controls */}
      <section className="flex flex-col gap-space-xs">
        {/* Filter Tabs (Horizontal Scrollable) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar font-mono" id="statusFilterBar">
          {[
            { id: 'all', label: 'ALL', count: droneList.length, badgeColor: 'bg-on-primary/20' },
            { id: 'flying', label: 'FLYING', count: droneList.filter((d) => String(d.status).toUpperCase().includes('FLYING')).length, badgeColor: 'bg-surface-container-high text-tertiary' },
            { id: 'idle', label: 'IDLE', count: droneList.filter((d) => !String(d.status).toUpperCase().includes('FLYING')).length, badgeColor: 'bg-surface-container-high' },
            { id: 'degraded', label: 'DEGRADED', count: droneList.filter((d) => String(d.status).toUpperCase().includes('DEGRADED') || d.decision === 'REROUTE').length, badgeColor: 'bg-surface-container-high text-secondary' },
            { id: 'critical', label: 'CRITICAL', count: droneList.filter((d) => d.decision === 'ABORT' || (d.survival !== null && d.survival < 70)).length, badgeColor: 'bg-error-container text-error font-bold' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={`filter-btn h-8 px-space-sm rounded font-label-xs text-label-xs uppercase flex items-center gap-1 shrink-0 transition-colors ${
                filter === item.id
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              <span>{item.label}</span>
              <span className={`px-1 py-0.2 rounded font-label-xs ${item.badgeColor}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>

        {/* Quick Sorting Bar */}
        <div className="flex items-center justify-between bg-surface-container-low px-space-sm py-1.5 rounded border border-outline-variant/30 font-mono">
          <div className="flex items-center gap-1 text-outline">
            <span className="material-symbols-outlined text-[14px]">sort</span>
            <span className="font-label-xs text-label-xs uppercase">SORT BY:</span>
          </div>
          <div className="flex items-center gap-1">
            {[
              { id: 'survival', label: 'SURV %' },
              { id: 'soc', label: 'BATT' },
              { id: 'temp', label: 'TEMP' },
              { id: 'vib', label: 'VIB' }
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSortBy(s.id)}
                className={`px-space-xs py-0.5 rounded font-label-xs text-label-xs uppercase transition-colors ${
                  sortBy === s.id
                    ? 'bg-surface-container-high text-primary font-bold border border-primary/40'
                    : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Matrix Card Deck */}
      <section className="flex flex-col gap-space-sm" id="droneCardsContainer">
        {sortedDrones.map((drone) => {
          const isSelected = selectedDroneId === drone.id;
          const isCritical = drone.decision === 'ABORT' || (drone.survival !== null && drone.survival < 70);
          const isIdle = String(drone.status).toUpperCase().includes('IDLE') || String(drone.status).toUpperCase().includes('STANDBY');

          return (
            <article
              key={drone.id}
              onClick={() => setSelectedDroneId(drone.id)}
              className={`flex flex-col bg-surface-container-low rounded-lg p-space-sm gap-space-xs shadow-md border cursor-pointer transition-all ${
                isSelected ? 'border-primary ring-1 ring-primary/40' : 'border-outline-variant/30 hover:border-outline-variant/60'
              }`}
            >
              {/* Card Topline Badge Header */}
              <div className="flex items-center justify-between bg-surface-container p-space-xs rounded border border-outline-variant/20 font-mono">
                <div className="flex items-center gap-space-xs">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isCritical
                        ? 'bg-error animate-ping'
                        : isIdle
                        ? 'bg-outline'
                        : 'bg-tertiary'
                    }`}
                  ></span>
                  <span className={`font-label-md text-label-md font-bold ${isCritical ? 'text-error' : 'text-on-surface'}`}>
                    {drone.callsign || `UAV-${drone.id.replace('D', '')}`} [{drone.id}]
                  </span>
                  <span
                    className={`font-label-xs text-label-xs px-1 py-0.5 rounded font-medium ${
                      isCritical
                        ? 'text-error bg-error-container/50'
                        : isIdle
                        ? 'text-outline-variant bg-surface-container-highest'
                        : 'text-tertiary bg-tertiary-container/20'
                    }`}
                  >
                    {drone.status}
                  </span>
                </div>

                <div className="flex items-center gap-space-xs">
                  {drone.id === 'D3' ? (
                    <>
                      <span className="font-label-xs text-label-xs text-outline font-medium">TWIN MULTIPLIER:</span>
                      <span className="font-label-xs text-label-xs text-error font-bold bg-surface-container-highest px-1 py-0.5 rounded">
                        0.60x BATT
                      </span>
                    </>
                  ) : (
                    <span
                      className={`font-label-xs text-label-xs font-bold ${
                        isCritical
                          ? 'text-error'
                          : isIdle
                          ? 'text-outline'
                          : 'text-primary'
                      }`}
                    >
                      {isIdle ? drone.standbyPad || 'STANDBY' : drone.decision === 'GO' ? 'GO ACCEPTABLE' : drone.decision}
                    </span>
                  )}
                </div>
              </div>

              {/* Route & Spatial Lock */}
              <div className="flex items-center justify-between text-outline text-body-sm px-0.5 font-mono">
                <span className="font-label-xs text-label-xs text-on-surface-variant">
                  POS: X:{drone.x} | Y:{drone.y}
                </span>
                <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
                  {drone.route || 'WAYPOINTS: BASE → RETURN'}
                </span>
              </div>

              {/* Telemetry Quadrant */}
              <div className="grid grid-cols-4 gap-1.5 py-0.5 font-mono">
                {/* SoC */}
                <div className="bg-surface-container p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
                  <div className={`flex items-center justify-between ${isCritical ? 'text-error' : 'text-outline'}`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {isCritical ? 'battery_alert' : 'battery_full'}
                    </span>
                    <span className="font-label-xs text-label-xs font-bold">
                      {isCritical ? '-1.8%/m' : drone.soc ? 'NORM' : 'N/A'}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className={`font-data-metric text-data-metric font-bold leading-none ${isCritical ? 'text-error' : drone.soc > 80 ? 'text-tertiary' : 'text-on-surface'}`}>
                      {drone.soc !== null ? drone.soc : 'N/A'}
                    </span>
                    {drone.soc !== null && <span className="font-label-xs text-label-xs text-outline">%</span>}
                  </div>
                </div>

                {/* Motor Temp */}
                <div className="bg-surface-container p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
                  <div className="flex items-center justify-between text-secondary">
                    <span className="material-symbols-outlined text-[13px]">device_thermostat</span>
                    <span className="font-label-xs text-label-xs">MTR</span>
                  </div>
                  <div className="mt-1">
                    <span className="font-data-metric text-data-metric text-on-surface font-bold leading-none">
                      {drone.temp !== null ? drone.temp : 'N/A'}
                    </span>
                    {drone.temp !== null && <span className="font-label-xs text-label-xs text-outline">°C</span>}
                  </div>
                </div>

                {/* Vibration */}
                <div className="bg-surface-container p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
                  <div className="flex items-center justify-between text-outline">
                    <span className="material-symbols-outlined text-[13px]">vibration</span>
                    <span className="font-label-xs text-label-xs">IMU</span>
                  </div>
                  <div className="mt-1">
                    <span className={`font-data-metric text-data-metric font-bold leading-none ${drone.vib > 0.3 ? 'text-error' : 'text-on-surface'}`}>
                      {drone.vib !== null ? drone.vib : 'N/A'}
                    </span>
                    {drone.vib !== null && <span className="font-label-xs text-label-xs text-outline">g</span>}
                  </div>
                </div>

                {/* Survival */}
                <div className="bg-surface-container p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
                  <div className={`flex items-center justify-between ${isCritical ? 'text-error' : 'text-tertiary'}`}>
                    <span className="material-symbols-outlined text-[13px]">
                      {isCritical ? 'crisis_alert' : 'verified_user'}
                    </span>
                    <span className="font-label-xs text-label-xs">
                      {isCritical ? 'RISK' : 'SURV'}
                    </span>
                  </div>
                  <div className="mt-1">
                    <span className={`font-data-metric text-data-metric font-bold leading-none ${isCritical ? 'text-error' : drone.survival ? 'text-tertiary' : 'text-outline'}`}>
                      {drone.survival !== null ? drone.survival : 'N/A'}
                    </span>
                    {drone.survival !== null && <span className="font-label-xs text-label-xs text-outline">%</span>}
                  </div>
                </div>
              </div>

              {/* Decision Context Box */}
              <div className="bg-surface-container-highest p-space-xs rounded flex flex-col gap-0.5 border border-outline-variant/30 font-mono">
                <div className="flex items-center justify-between">
                  <span className={`font-label-xs text-label-xs uppercase font-bold ${isCritical ? 'text-error' : 'text-tertiary'}`}>
                    DECISION ENGINE // {drone.decision}
                  </span>
                  <span className={`font-label-xs text-label-xs uppercase ${isCritical ? 'text-error' : 'text-outline'}`}>
                    PRIMARY THREAT: {drone.dominantRisk || 'NONE'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface leading-tight font-sans">
                  {drone.decisionReason || 'Asset telemetry conforms to operational envelope.'}
                </p>
              </div>

              {/* Actions */}
              {isCritical && (
                <div className="grid grid-cols-2 gap-space-xs pt-0.5 font-mono">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      enforceRtb(drone.id);
                    }}
                    className="h-8 bg-error text-surface font-label-xs text-label-xs uppercase font-bold rounded flex items-center justify-center gap-1 active:opacity-90 transition-opacity"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">u_turn_left</span>
                    <span>ENFORCE RTB</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showToast(`CELL ISOLATION COMMAND QUEUED FOR ${drone.id}`, 'info');
                    }}
                    className="h-8 bg-surface-container text-on-surface hover:bg-surface-variant font-label-xs text-label-xs uppercase font-medium rounded flex items-center justify-center gap-1 border border-outline-variant/30"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">query_stats</span>
                    <span>ISOLATE CELL</span>
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {/* 4. Tactile Batch Action Dock */}
      <section className="bg-surface-container-low rounded-lg p-space-sm flex flex-col gap-space-xs shadow-lg mt-space-xs border border-outline-variant/30 font-mono">
        <div className="flex items-center justify-between">
          <span className="font-label-xs text-label-xs text-outline font-bold uppercase tracking-wider">
            COMMAND DOCK // FLEET OVERRIDE
          </span>
          <div className="flex items-center gap-1 text-tertiary">
            <span className="material-symbols-outlined text-[13px]">wifi_tethering</span>
            <span className="font-label-xs text-label-xs" id="wsIndicator">
              {wsStatus === 'CONNECTED' ? 'WSS CONNECTED' : wsStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-space-xs">
          <button
            onClick={() => {
              if (window.confirm('WARNING: Issue autonomous Return To Base (RTB) to all airborne assets immediately?')) {
                recallFleet();
              }
            }}
            className="h-10 w-full bg-error text-surface font-label-md text-label-md uppercase font-bold rounded flex items-center justify-center gap-space-xs active:opacity-90 shadow-md transition-opacity"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">keyboard_return</span>
            <span>RECALL FLEET (ALL TO BASE)</span>
          </button>

          <div className="grid grid-cols-2 gap-space-xs">
            <button
              onClick={handleExportLogs}
              className="h-9 bg-surface-container text-on-surface hover:bg-surface-variant font-label-xs text-label-xs uppercase font-medium rounded flex items-center justify-center gap-space-xs transition-colors border border-outline-variant/30"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">download</span>
              <span>EXPORT LOGS</span>
            </button>
            <button
              onClick={handleSync}
              className="h-9 bg-surface-container text-on-surface hover:bg-surface-variant font-label-xs text-label-xs uppercase font-medium rounded flex items-center justify-center gap-space-xs transition-colors border border-outline-variant/30"
              type="button"
            >
              <span className={`material-symbols-outlined text-[16px] text-tertiary ${syncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              <span>{syncing ? 'SYNCING...' : 'SYNC WEBSOCKET'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
