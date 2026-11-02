import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { TopoCanvas } from '../components/TopoCanvas';

export function EnvironmentGridPage() {
  const { envStats, streamHz, wsStatus, showToast, addLog, reroute } = useTelemetry();

  const [cellInspection, setCellInspection] = useState({
    x: 38,
    y: 68,
    windSpeed: '21.4',
    gust: '26.1',
    rain: '9.8',
    drag: '1.42',
    penalty: 28,
    squall: 'HEAVY SQUALL'
  });

  const handleAutoReroute = () => {
    reroute('D3');
    showToast('AUTO-VECTOR REROUTE ENGAGED FOR D3', 'warning');
    addLog('ENV', 'AUTO_REROUTE', 'Automatic vector reroute calculated to avoid squall cell Charlie-3');
  };

  const handleIsolateCell = () => {
    showToast(`SPATIAL CELL [${cellInspection.x}, ${cellInspection.y}] ISOLATED AS GEO-FENCE`, 'info');
    addLog('ENV', 'GEO_FENCE', `Hazard boundary added around sector cell [${cellInspection.x}, ${cellInspection.y}]`);
  };

  return (
    <div className="flex flex-col w-full px-space-md py-space-sm gap-space-md">
      {/* 1. Live Stream Tactical Status Ribbon */}
      <div className="flex items-center justify-between bg-surface-container px-space-md py-space-xs rounded shadow-sm border border-outline-variant/30 font-mono">
        <div className="flex items-center gap-space-xs">
          <div className={`w-2 h-2 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-tertiary animate-pulse' : 'bg-primary'}`}></div>
          <span className="font-label-sm text-label-sm text-tertiary uppercase font-bold">
            WS://STREAM: {wsStatus === 'CONNECTED' ? 'ACTIVE' : wsStatus}
          </span>
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            // SYNC {streamHz * 12 || 60}Hz
          </span>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="font-label-xs text-label-xs text-outline uppercase">40x40 TOPO-GRID</span>
          <span className="font-label-xs text-label-xs bg-surface-container-high px-space-xs py-0.5 text-primary border border-primary/30">
            1,600 CELLS
          </span>
        </div>
      </div>

      {/* 2. Dynamic Live Stats Derived Matrix (Bento Grid) */}
      <div className="grid grid-cols-2 gap-space-xs font-mono">
        {/* Stat 1: Max Wind */}
        <div className="bg-surface-container p-space-sm flex flex-col gap-0.5 rounded shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
              MAX WIND VELOCITY
            </span>
            <span className="material-symbols-outlined text-primary text-[14px]">air</span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-data-display text-data-display text-error leading-none font-bold">
              {envStats.maxWind || '24.8'}
            </span>
            <span className="font-label-sm text-label-sm text-outline">m/s</span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">GUST AZIMUTH</span>
            <span className="font-label-xs text-label-xs text-on-surface font-semibold">315° NW [SEC-4]</span>
          </div>
        </div>

        {/* Stat 2: Avg Wind */}
        <div className="bg-surface-container p-space-sm flex flex-col gap-0.5 rounded shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
              AVG VECTOR SPEED
            </span>
            <span className="material-symbols-outlined text-primary text-[14px]">speed</span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-data-display text-data-display text-primary leading-none font-bold">
              {envStats.avgWind || '11.2'}
            </span>
            <span className="font-label-sm text-label-sm text-outline">m/s</span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">FLOW TREND</span>
            <span className="font-label-xs text-label-xs text-tertiary">+0.4 m/s ↑</span>
          </div>
        </div>

        {/* Stat 3: Rain Peak */}
        <div className="bg-surface-container p-space-sm flex flex-col gap-0.5 rounded shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
              MAX PRECIP CELL
            </span>
            <span className="material-symbols-outlined text-primary text-[14px]">rainy</span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-data-display text-data-display text-secondary leading-none font-bold">
              {envStats.maxRain || '14.2'}
            </span>
            <span className="font-label-sm text-label-sm text-outline">mm/h</span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">DENSITY CLASSIF</span>
            <span className="font-label-xs text-label-xs text-secondary-fixed-dim font-semibold">SQUALL INTENSE</span>
          </div>
        </div>

        {/* Stat 4: Hazard Airspace Coverage */}
        <div className="bg-surface-container p-space-sm flex flex-col gap-0.5 rounded shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <span className="font-label-xs text-label-xs text-on-surface-variant uppercase">
              HAZARD AIRSPACE
            </span>
            <span className="material-symbols-outlined text-error text-[14px]">warning</span>
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="font-data-display text-data-display text-error leading-none font-bold">
              {envStats.hazardAirspace || '18.5'}%
            </span>
            <span className="font-label-sm text-label-sm text-outline">VOL</span>
          </div>
          <div className="flex items-center justify-between mt-1 pt-1 bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">RESTRICTED ZONE</span>
            <span className="font-label-xs text-label-xs text-error font-semibold">296 CELLS NO-GO</span>
          </div>
        </div>
      </div>

      {/* 3. Environmental Alert Card */}
      <div className="bg-surface-container p-space-sm rounded shadow-sm relative overflow-hidden border border-error/40">
        <div className="flex items-start gap-space-sm">
          <div className="w-8 h-8 rounded bg-error-container/40 flex items-center justify-center flex-shrink-0 mt-0.5 border border-error/50">
            <span className="material-symbols-outlined text-error text-[18px]">thunderstorm</span>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="font-label-xs text-label-xs text-error uppercase font-bold tracking-wider font-mono">
                CRITICAL WEATHER CORRIDOR
              </span>
              <span className="font-label-xs text-label-xs bg-error-container text-on-error-container px-1 py-0.2 rounded font-bold font-mono">
                LVL-3 SQUALL
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant leading-tight">
              Active storm cell tracking Southeast @ {envStats.stormVelocity || '4.2 km/h'}. Penetration boundary reaches waypoint Charlie-3. Advising immediate reroute for lightweight multi-rotor airframes.
            </p>
          </div>
        </div>

        {/* Quick Action Ribbon within Alert */}
        <div className="mt-space-xs pt-space-xs flex items-center justify-between bg-surface-container-lowest px-space-xs py-1 rounded border border-outline-variant/20 font-mono">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
            <span className="font-label-xs text-label-xs text-error font-bold">AIRFRAME D3 AT RISK</span>
          </div>
          <button
            onClick={handleAutoReroute}
            className="bg-surface-container-high px-space-xs py-0.5 text-primary font-label-xs text-label-xs uppercase hover:bg-surface-bright transition-colors rounded border border-primary/30 font-bold"
            type="button"
          >
            AUTO-VECTOR REROUTE
          </button>
        </div>
      </div>

      {/* 4. Interactive 40x40 Canvas Module */}
      <TopoCanvas onSelectCell={(cellData) => setCellInspection((prev) => ({ ...prev, ...cellData }))} />

      {/* 5. Cell Telemetry Inspector Detail */}
      <div className="bg-surface-container p-space-sm rounded shadow-sm flex flex-col gap-space-xs border border-outline-variant/30">
        <div className="flex items-center justify-between pb-space-xs border-b border-outline-variant/20">
          <div className="flex items-center gap-space-xs">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="font-headline-sm text-headline-sm text-on-surface">Spatial Cell Inspector</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <span className="font-label-xs text-label-xs text-outline">LOC:</span>
            <span className="font-data-metric text-data-metric text-primary bg-surface-container-high px-1.5 py-0.5 rounded border border-primary/40">
              X: {cellInspection.x}, Y: {cellInspection.y}
            </span>
          </div>
        </div>

        {/* Inspector Matrix Grid */}
        <div className="grid grid-cols-2 gap-space-xs pt-1 font-mono">
          {/* Parameter: Wind & Gust */}
          <div className="bg-surface-container-lowest p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-xs text-label-xs text-outline">WIND SPEED & GUST</span>
              <span className="material-symbols-outlined text-[13px] text-primary">air</span>
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="font-data-metric text-data-metric text-error font-bold">
                {cellInspection.windSpeed}
              </span>
              <span className="font-label-xs text-label-xs text-outline">m/s</span>
              <span className="font-label-xs text-label-xs text-error font-bold">
                (G: {cellInspection.gust})
              </span>
            </div>
            <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
              <span>BEARING</span>
              <span className="text-on-surface">315° NW</span>
            </div>
          </div>

          {/* Parameter: Precip Rate */}
          <div className="bg-surface-container-lowest p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-xs text-label-xs text-outline">PRECIP RATE</span>
              <span className="material-symbols-outlined text-[13px] text-secondary">water_drop</span>
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="font-data-metric text-data-metric text-secondary font-bold">
                {cellInspection.rain}
              </span>
              <span className="font-label-xs text-label-xs text-outline">mm/h</span>
            </div>
            <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
              <span>INTENSITY</span>
              <span className="text-secondary-fixed-dim font-bold">{cellInspection.squall}</span>
            </div>
          </div>

          {/* Parameter: Aero Drag Coeff */}
          <div className="bg-surface-container-lowest p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-xs text-label-xs text-outline">AERO DRAG COEFF</span>
              <span className="material-symbols-outlined text-[13px] text-outline">flight_takeoff</span>
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="font-data-metric text-data-metric text-on-surface font-bold">
                {cellInspection.drag}x
              </span>
              <span className="font-label-xs text-label-xs text-outline">NOMINAL</span>
            </div>
            <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
              <span>TORQUE DRAIN</span>
              <span className="text-error font-bold">+34% / MIN</span>
            </div>
          </div>

          {/* Parameter: Viability Penalty */}
          <div className="bg-surface-container-lowest p-space-xs rounded flex flex-col justify-between border border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="font-label-xs text-label-xs text-outline">VIABILITY PENALTY</span>
              <span className="material-symbols-outlined text-[13px] text-error">heart_broken</span>
            </div>
            <div className="flex items-baseline gap-1 my-1">
              <span className="font-data-metric text-data-metric text-error font-bold">
                -{cellInspection.penalty}%
              </span>
              <span className="font-label-xs text-label-xs text-outline">MARGIN</span>
            </div>
            <div className="flex items-center justify-between text-outline font-label-xs text-label-xs">
              <span>AIRFRAME STATUS</span>
              <span className="text-error font-bold">UNSTABLE</span>
            </div>
          </div>
        </div>

        {/* Target Intercept Context Card */}
        <div className="bg-surface-container-high p-space-xs rounded flex items-center justify-between border border-outline-variant/30 mt-1">
          <div className="flex items-center gap-space-xs min-w-0">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center border border-primary/40 shrink-0">
              <span className="material-symbols-outlined text-primary text-[15px]">adjust</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-xs text-label-xs text-on-surface font-semibold truncate font-mono">
                AIRFRAME D3 CORRIDOR PENETRATION
              </span>
              <span className="font-label-xs text-label-xs text-outline truncate font-mono">
                Battery reserve decreasing 2.8x faster under current turbulence
              </span>
            </div>
          </div>
          <button
            onClick={handleIsolateCell}
            className="bg-primary text-on-primary px-space-xs py-1 rounded font-label-xs text-label-xs uppercase hover:bg-primary-fixed-dim transition-colors font-bold whitespace-nowrap font-mono shrink-0 ml-1"
            type="button"
          >
            ISOLATE CELL
          </button>
        </div>
      </div>

      {/* 6. Operational Field Context Summary */}
      <div className="bg-surface-container p-space-sm rounded shadow-sm flex flex-col gap-space-xs border border-outline-variant/30 font-mono">
        <div className="flex items-center justify-between">
          <span className="font-label-xs text-label-xs text-outline uppercase font-semibold">
            Fleet Safety Envelopes
          </span>
          <span className="font-label-xs text-label-xs text-tertiary font-bold">
            STORM VELOCITY {envStats.stormVelocity || '4.2 KM/H SE'}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between bg-surface-container-lowest p-space-xs rounded border border-outline-variant/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-tertiary"></span>
              <span className="font-label-xs text-label-xs text-on-surface font-bold">DRONE-01 (SCOUT-ALPHA)</span>
            </div>
            <span className="font-label-xs text-label-xs text-tertiary bg-tertiary/10 px-1.5 py-0.5 rounded font-bold border border-tertiary/30">
              CLEAR ZONE [SEC-1]
            </span>
          </div>

          <div className="flex items-center justify-between bg-surface-container-lowest p-space-xs rounded border border-outline-variant/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="font-label-xs text-label-xs text-on-surface font-bold">DRONE-02 (HAULER-BETA)</span>
            </div>
            <span className="font-label-xs text-label-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold border border-primary/30">
              MARGINAL FLOW (12 m/s)
            </span>
          </div>

          <div className="flex items-center justify-between bg-surface-container-lowest p-space-xs rounded border border-outline-variant/20">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error animate-ping"></span>
              <span className="font-label-xs text-label-xs text-error font-bold">DRONE-03 (TACTICAL-RECON)</span>
            </div>
            <span className="font-label-xs text-label-xs text-error bg-error/20 px-1.5 py-0.5 rounded font-bold border border-error/40">
              CRITICAL PENETRATION
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
