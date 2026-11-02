import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';

export function FleetDispatchHeader() {
  const {
    droneList,
    airborneCount,
    idleCount,
    activeRisksCount,
    streamHz
  } = useTelemetry();

  const d1 = droneList.find((d) => d.id === 'D1');
  const d2 = droneList.find((d) => d.id === 'D2');
  const d3 = droneList.find((d) => d.id === 'D3');

  return (
    <section className="bg-surface-container-low rounded-lg p-space-md flex flex-col gap-space-sm shadow-md border border-outline-variant/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
          <span className="font-label-sm text-label-sm text-on-surface uppercase font-bold tracking-wider font-mono">
            FLEET DISPATCH CONSOLE
          </span>
        </div>
        <span className="font-label-xs text-label-xs text-outline px-space-xs py-0.5 bg-surface-container rounded font-mono border border-outline-variant/30">
          SYNC_FREQ: {streamHz * 4 || 20}Hz
        </span>
      </div>

      <div className="grid grid-cols-4 gap-space-xs text-center font-mono">
        <div className="bg-surface-container p-space-xs rounded flex flex-col border border-outline-variant/20">
          <span className="font-label-xs text-label-xs text-outline">TOTAL ASSETS</span>
          <span className="font-data-display text-headline-sm text-on-surface font-semibold">{droneList.length}</span>
        </div>
        <div className="bg-surface-container p-space-xs rounded flex flex-col border border-outline-variant/20">
          <span className="font-label-xs text-label-xs text-tertiary">AIRBORNE</span>
          <span className="font-data-display text-headline-sm text-tertiary font-semibold">{airborneCount}</span>
        </div>
        <div className="bg-surface-container p-space-xs rounded flex flex-col border border-outline-variant/20">
          <span className="font-label-xs text-label-xs text-outline">STANDBY</span>
          <span className="font-data-display text-headline-sm text-on-surface-variant font-semibold">{idleCount}</span>
        </div>
        <div className="bg-surface-container p-space-xs rounded flex flex-col border border-outline-variant/20">
          <span className="font-label-xs text-label-xs text-error">ALERTS</span>
          <span className="font-data-display text-headline-sm text-error font-semibold">{activeRisksCount}</span>
        </div>
      </div>

      {/* Mini Spatial Sector Radar Visualizer */}
      <div className="relative w-full h-24 bg-surface-container-lowest rounded overflow-hidden flex items-center justify-center border border-outline-variant/30">
        <svg className="absolute inset-0 w-full h-full text-outline-variant" fill="none" viewBox="0 0 320 96">
          <defs>
            <radialGradient cx="50%" cy="50%" id="sectorGlow" r="50%">
              <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.15"></stop>
              <stop offset="100%" stopColor="#4cd7f6" stopOpacity="0"></stop>
            </radialGradient>
          </defs>
          <circle cx="160" cy="48" fill="url(#sectorGlow)" r="44"></circle>
          <circle cx="160" cy="48" r="40" stroke="currentColor" strokeDasharray="2 4" strokeWidth="0.75"></circle>
          <circle cx="160" cy="48" r="22" stroke="currentColor" strokeWidth="0.5"></circle>
          <line stroke="currentColor" strokeWidth="0.5" x1="0" x2="320" y1="48" y2="48"></line>
          <line stroke="currentColor" strokeWidth="0.5" x1="160" x2="160" y1="0" y2="96"></line>

          {/* D1 Node */}
          <circle className="fill-tertiary" cx="90" cy="38" r="3.5"></circle>
          <text fill="#4edea3" fontFamily="JetBrains Mono" fontSize="8" x="96" y="36">
            D1 [{d1?.survival ?? 94}%]
          </text>

          {/* D2 Node */}
          <circle className="fill-tertiary" cx="215" cy="30" r="3.5"></circle>
          <text fill="#4edea3" fontFamily="JetBrains Mono" fontSize="8" x="221" y="28">
            D2 [{d2?.survival ?? 91}%]
          </text>

          {/* D3 Fault Node */}
          <circle className="fill-error animate-ping" cx="145" cy="24" opacity="0.75" r="4"></circle>
          <circle className="fill-error" cx="145" cy="24" r="3.5"></circle>
          <text fill="#ffb4ab" fontFamily="JetBrains Mono" fontSize="8" fontWeight="bold" x="110" y="20">
            D3 [ABORT {d3?.survival ?? 62}%]
          </text>

          {/* Base Hangar Pad Nodes D4, D5 */}
          <rect className="fill-outline" height="5" width="5" x="52" y="70"></rect>
          <text fill="#869397" fontFamily="JetBrains Mono" fontSize="7" x="61" y="74">
            PAD-A (D4)
          </text>
          <rect className="fill-outline" height="5" width="5" x="52" y="80"></rect>
          <text fill="#869397" fontFamily="JetBrains Mono" fontSize="7" x="61" y="84">
            PAD-B (D5)
          </text>
        </svg>

        <div className="absolute bottom-1 right-2 flex items-center gap-space-xs text-outline font-mono">
          <span className="material-symbols-outlined text-[12px]">filter_center_focus</span>
          <span className="font-label-xs text-label-xs">SECTOR-7 TELEMETRY LIVE</span>
        </div>
      </div>
    </section>
  );
}
