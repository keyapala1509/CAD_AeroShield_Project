import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';

export function TacticalMap() {
  const {
    drones,
    droneList,
    selectedDroneId,
    setSelectedDroneId,
    envLayer,
    setEnvLayer,
    showToast,
    addLog
  } = useTelemetry();

  const [hoveredCoord, setHoveredCoord] = useState(null);

  const selectedDrone = drones[selectedDroneId] || drones.D3;

  const handleSelect = (id) => {
    setSelectedDroneId(id);
    const d = drones[id];
    showToast(`TARGET LOCK SHIFTED TO ${id}`, 'info');
    addLog('CMD', 'INSPECT', `Tactical crosshair focused on drone ${id} (${d?.callsign || id})`);
  };

  const handleMapClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((rect.bottom - e.clientY) / rect.height) * 100; // bottom up
    setHoveredCoord({ x: clickX.toFixed(0), y: clickY.toFixed(0) });
  };

  // Environmental hazard opacity based on layer filter
  const hazardOpacity =
    envLayer === 'off' ? 0 : envLayer === 'rain' ? 0.5 : envLayer === 'wind' ? 0.8 : 1;

  return (
    <div className="p-space-xs bg-surface-dim flex flex-col gap-space-xs">
      <div className="bg-surface-container-lowest p-space-sm flex flex-col gap-space-xs shadow-md border border-outline-variant/30">
        {/* Tactical Map Header & Controls */}
        <div className="flex items-center justify-between gap-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[16px]">map</span>
            <span className="font-label-sm text-label-sm uppercase text-on-surface font-semibold font-mono">
              TACTICAL GEO-SECTOR // 0-100 GRID
            </span>
          </div>

          {/* Environment Layer Selector */}
          <div className="flex items-center bg-surface-container p-0.5 border border-outline-variant/40" id="env-selector">
            {['combined', 'wind', 'rain', 'off'].map((mode) => (
              <button
                key={mode}
                onClick={() => setEnvLayer(mode)}
                className={`font-label-xs text-label-xs px-2 py-0.5 font-mono uppercase transition-colors ${
                  envLayer === mode
                    ? 'bg-primary text-on-primary font-bold'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                {mode === 'combined' ? 'ALL' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Viewport Canvas */}
        <div
          onClick={handleMapClick}
          className="relative w-full aspect-square bg-surface-container-lowest overflow-hidden select-none border border-outline-variant/40 cursor-crosshair"
          id="tactical-viewport"
        >
          {/* Coordinate Grid Ticklines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25" preserveAspectRatio="none" viewBox="0 0 100 100">
            <defs>
              <pattern height="10" id="grid-ticks" patternUnits="userSpaceOnUse" width="10">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#869397" strokeDasharray="1,1" strokeWidth="0.3"></path>
              </pattern>
            </defs>
            <rect fill="url(#grid-ticks)" height="100" width="100"></rect>
            {/* Cardinal crosshairs */}
            <line stroke="#869397" strokeDasharray="2,2" strokeWidth="0.4" x1="50" x2="50" y1="0" y2="100"></line>
            <line stroke="#869397" strokeDasharray="2,2" strokeWidth="0.4" x1="0" x2="100" y1="50" y2="50"></line>
          </svg>

          {/* Dynamic Environment Hazard Zones (Sector X:30-50, Y:60-85) */}
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{ opacity: hazardOpacity }}
          >
            {/* Wind Gradient Vector Core */}
            <div className="absolute left-[30%] bottom-[60%] w-[22%] h-[25%] bg-gradient-to-tr from-error/40 via-primary-container/25 to-transparent blur-sm"></div>

            {/* Storm Hazard Striped Footprint */}
            <div className="absolute left-[30%] bottom-[60%] w-[22%] h-[25%] bg-surface-variant/30 border border-dashed border-error/50 flex items-center justify-center">
              <span className="font-label-xs text-label-xs text-error font-mono font-bold tracking-widest uppercase opacity-85 bg-surface/60 px-1 py-0.5">
                STORM CELL
              </span>
            </div>

            {/* Gust Front Isolines */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
              <circle className="animate-pulse" cx="40" cy="27" fill="none" r="13" stroke="#ffb4ab" strokeDasharray="1.5,1.5" strokeWidth="0.6"></circle>
              <circle cx="40" cy="27" fill="none" opacity="0.6" r="8" stroke="#06b6d4" strokeWidth="0.5"></circle>
            </svg>
          </div>

          {/* Waypoint Vector Trails (SVG) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100">
            {/* D1 Trajectory */}
            {drones.D1 && (
              <>
                <line
                  opacity="0.8"
                  stroke="#4edea3"
                  strokeDasharray="2,1"
                  strokeWidth="0.8"
                  x1={drones.D1.x}
                  x2="60"
                  y1={100 - drones.D1.y}
                  y2="80"
                ></line>
                <circle cx="60" cy="80" fill="#4edea3" r="1.2"></circle>
              </>
            )}

            {/* D2 Trajectory */}
            {drones.D2 && (
              <>
                <line
                  opacity="0.8"
                  stroke="#4edea3"
                  strokeDasharray="2,1"
                  strokeWidth="0.8"
                  x1={drones.D2.x}
                  x2="70"
                  y1={100 - drones.D2.y}
                  y2="30"
                ></line>
                <circle cx="70" cy="30" fill="#4edea3" r="1.2"></circle>
              </>
            )}

            {/* D3 Trajectory (Degraded vector into storm) */}
            {drones.D3 && (
              <>
                <line
                  opacity="0.9"
                  stroke="#ffb4ab"
                  strokeDasharray="1.5,1"
                  strokeWidth="0.9"
                  x1={drones.D3.x}
                  x2="40"
                  y1={100 - drones.D3.y}
                  y2="20"
                ></line>
                <circle cx="40" cy="20" fill="#ffb4ab" r="1.4"></circle>
              </>
            )}
          </svg>

          {/* Base Launch Depot Station (X: 10, Y: 10) */}
          <div className="absolute left-[10%] bottom-[10%] -translate-x-1/2 translate-y-1/2 p-1 bg-surface-container flex items-center gap-1 z-10 pointer-events-none border border-outline-variant/50">
            <span className="material-symbols-outlined text-outline text-[12px]">home_pin</span>
            <span className="font-label-xs text-label-xs text-outline font-mono">HOME_PAD</span>
          </div>

          {/* D4 Marker (Idle Standby at Base) */}
          <div
            onClick={(e) => { e.stopPropagation(); handleSelect('D4'); }}
            className={`absolute left-[9%] bottom-[10%] -translate-x-1/2 translate-y-1/2 -ml-2 -mb-2 w-5 h-5 bg-surface-container-high flex items-center justify-center cursor-pointer border ${selectedDroneId === 'D4' ? 'border-primary' : 'border-outline-variant/60'}`}
          >
            <span className="font-label-xs text-label-xs text-outline font-bold font-mono">4</span>
          </div>

          {/* D5 Marker (Idle Standby at Base) */}
          <div
            onClick={(e) => { e.stopPropagation(); handleSelect('D5'); }}
            className={`absolute left-[12%] bottom-[10%] -translate-x-1/2 translate-y-1/2 ml-2 -mb-2 w-5 h-5 bg-surface-container-high flex items-center justify-center cursor-pointer border ${selectedDroneId === 'D5' ? 'border-primary' : 'border-outline-variant/60'}`}
          >
            <span className="font-label-xs text-label-xs text-outline font-bold font-mono">5</span>
          </div>

          {/* D1 Marker (Flying Nominal) */}
          {drones.D1 && (
            <div
              onClick={(e) => { e.stopPropagation(); handleSelect('D1'); }}
              style={{ left: `${drones.D1.x}%`, bottom: `${drones.D1.y}%` }}
              className="absolute -translate-x-1/2 translate-y-1/2 group cursor-pointer z-20"
            >
              <div className={`w-6 h-6 bg-tertiary-container/30 border ${selectedDroneId === 'D1' ? 'border-primary ring-1 ring-primary' : 'border-tertiary/60'} flex items-center justify-center text-tertiary transition-transform active:scale-95 shadow-sm`}>
                <span className="material-symbols-outlined text-[16px] animate-pulse">navigation</span>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1 bg-surface-container-highest text-tertiary font-label-xs text-label-xs font-mono uppercase whitespace-nowrap border border-tertiary/40">
                D1:{drones.D1.survival ?? 94}%
              </div>
            </div>
          )}

          {/* D2 Marker (Flying Nominal) */}
          {drones.D2 && (
            <div
              onClick={(e) => { e.stopPropagation(); handleSelect('D2'); }}
              style={{ left: `${drones.D2.x}%`, bottom: `${drones.D2.y}%` }}
              className="absolute -translate-x-1/2 translate-y-1/2 group cursor-pointer z-20"
            >
              <div className={`w-6 h-6 bg-tertiary-container/30 border ${selectedDroneId === 'D2' ? 'border-primary ring-1 ring-primary' : 'border-tertiary/60'} flex items-center justify-center text-tertiary transition-transform active:scale-95 shadow-sm`}>
                <span className="material-symbols-outlined text-[16px] animate-pulse">navigation</span>
              </div>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1 bg-surface-container-highest text-tertiary font-label-xs text-label-xs font-mono uppercase whitespace-nowrap border border-tertiary/40">
                D2:{drones.D2.survival ?? 91}%
              </div>
            </div>
          )}

          {/* D3 Marker (Degraded & Aborting Inside Hazard) */}
          {drones.D3 && (
            <div
              onClick={(e) => { e.stopPropagation(); handleSelect('D3'); }}
              style={{ left: `${drones.D3.x}%`, bottom: `${drones.D3.y}%` }}
              className="absolute -translate-x-1/2 translate-y-1/2 group cursor-pointer z-30"
            >
              {/* Alarm Ping Aura */}
              <span className="absolute -inset-1.5 bg-error/40 animate-ping"></span>
              <div className={`relative w-7 h-7 bg-error text-on-error flex items-center justify-center shadow-lg border ${selectedDroneId === 'D3' ? 'border-white' : 'border-error'}`}>
                <span className="material-symbols-outlined text-[18px]">priority_high</span>
              </div>
              {/* Priority Callout Badge */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-1.5 py-0.5 bg-error text-on-error font-label-xs text-label-xs font-bold tracking-wider uppercase whitespace-nowrap shadow-md font-mono">
                D3: ABORT
              </div>
            </div>
          )}

          {/* Real-time Inspect Crosshair Box (Pinned to currently selected drone) */}
          {selectedDrone && (
            <div
              style={{
                left: `${selectedDrone.x}%`,
                bottom: `${Math.min(92, Math.max(12, selectedDrone.y + 14))}%`
              }}
              className="absolute transform -translate-x-1/2 bg-surface-container-highest px-space-xs py-0.5 shadow-md flex items-center gap-space-xs pointer-events-none border border-primary/50 z-40 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-primary text-[12px]">rotate_90_degrees_ccw</span>
              <span className="font-label-xs text-label-xs text-on-surface font-mono font-bold">
                X:{selectedDrone.x} Y:{selectedDrone.y} | WIND: {selectedDrone.id === 'D3' ? '18.4m/s' : '8.2m/s'} | RAIN: {selectedDrone.id === 'D3' ? '4.2mm' : '0.1mm'}
              </span>
            </div>
          )}
        </div>

        {/* Map Footer Coordinate Telemetry Bar */}
        <div className="flex items-center justify-between font-label-xs text-label-xs text-outline bg-surface-container px-space-xs py-0.5 font-mono border border-outline-variant/30">
          <span>ORIGIN (00,00)</span>
          <span className="text-primary font-bold">ACTIVE SECTOR: GRID_SEC_NORTH</span>
          <span>EXTENT (100,100)</span>
        </div>
      </div>
    </div>
  );
}
