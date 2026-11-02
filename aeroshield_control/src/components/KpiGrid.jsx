import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';

export function KpiGrid() {
  const {
    droneList,
    airborneCount,
    idleCount,
    fleetSurvival,
    activeRisksCount,
    decisionsCount
  } = useTelemetry();

  // Extract quick drone summaries for the survival card
  const d1 = droneList.find((d) => d.id === 'D1');
  const d2 = droneList.find((d) => d.id === 'D2');
  const d3 = droneList.find((d) => d.id === 'D3');

  // Dominant active risk text
  const highestRiskDrone = droneList.find((d) => d.dominantRisk && d.dominantRisk !== 'NONE') || d3;
  const riskLabel = highestRiskDrone
    ? `${highestRiskDrone.id}: ${highestRiskDrone.dominantRisk}`
    : 'All parameters nominal';

  return (
    <div className="grid grid-cols-2 gap-space-xs p-space-xs bg-surface-dim">
      {/* 1. Active Drones */}
      <div className="bg-surface-container p-space-sm flex flex-col justify-between shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-xs text-label-xs text-outline uppercase font-semibold font-mono">
            ACTIVE DRONES
          </span>
          <span className="material-symbols-outlined text-primary text-[15px]">sensors</span>
        </div>
        <div className="flex items-baseline gap-space-xs">
          <span className="font-data-display text-data-display text-on-surface font-semibold">
            {airborneCount}
          </span>
          <span className="font-data-metric text-data-metric text-outline">
            / {droneList.length}
          </span>
        </div>
        <div className="flex items-center justify-between pt-space-xs mt-space-xs bg-surface-container-low px-space-xs py-0.5 border border-outline-variant/20 font-mono">
          <span className="font-label-xs text-label-xs text-tertiary">{airborneCount} AIRBORNE</span>
          <span className="font-label-xs text-label-xs text-outline">{idleCount} IDLE</span>
        </div>
      </div>

      {/* 2. Fleet Survival */}
      <div className="bg-surface-container p-space-sm flex flex-col justify-between shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-xs text-label-xs text-outline uppercase font-semibold font-mono">
            FLEET SURVIVAL
          </span>
          <span className="material-symbols-outlined text-tertiary text-[15px]">verified_user</span>
        </div>
        <div className="flex items-baseline gap-space-xs">
          <span className="font-data-display text-data-display text-tertiary font-semibold">
            {fleetSurvival}
          </span>
          <span className="font-data-metric text-data-metric text-tertiary font-mono">%</span>
        </div>
        <div className="flex items-center justify-between pt-space-xs mt-space-xs bg-surface-container-low px-space-xs py-0.5 border border-outline-variant/20 font-mono">
          <span className="font-label-xs text-label-xs text-tertiary">
            D1:{d1?.survival ?? '94'} D2:{d2?.survival ?? '91'}
          </span>
          <span className="font-label-xs text-label-xs text-error font-semibold">
            D3:{d3?.survival != null ? `${d3.survival}%` : '--'}
          </span>
        </div>
      </div>

      {/* 3. Active Risks */}
      <div className="bg-surface-container p-space-sm flex flex-col justify-between shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-xs text-label-xs text-outline uppercase font-semibold font-mono">
            ACTIVE RISKS
          </span>
          <span className="material-symbols-outlined text-error text-[15px]">warning</span>
        </div>
        <div className="flex items-baseline gap-space-xs">
          <span className="font-data-display text-data-display text-error font-semibold font-mono">
            {activeRisksCount}
          </span>
          <span className="font-label-sm text-label-sm text-error uppercase font-medium font-mono">
            {activeRisksCount > 0 ? 'ELEVATED' : 'NOMINAL'}
          </span>
        </div>
        <div className="pt-space-xs mt-space-xs bg-surface-container-low px-space-xs py-0.5 truncate border border-outline-variant/20 font-mono">
          <span className="font-label-xs text-label-xs text-on-surface-variant truncate block">
            {riskLabel}
          </span>
        </div>
      </div>

      {/* 4. Critical Decisions */}
      <div className="bg-surface-container p-space-sm flex flex-col justify-between shadow-sm border border-outline-variant/30">
        <div className="flex items-center justify-between mb-space-xs">
          <span className="font-label-xs text-label-xs text-outline uppercase font-semibold font-mono">
            DECISIONS
          </span>
          <span className="material-symbols-outlined text-error text-[15px]">alt_route</span>
        </div>
        <div className="flex items-baseline gap-space-xs">
          <span className="font-data-display text-data-display text-error font-semibold font-mono">
            {decisionsCount}
          </span>
          <span className="font-label-sm text-label-sm text-error uppercase font-medium font-mono">
            {decisionsCount > 0 ? 'ABORT / REROUTE' : 'GO STABLE'}
          </span>
        </div>
        <div className="pt-space-xs mt-space-xs bg-surface-container-low px-space-xs py-0.5 truncate border border-outline-variant/20 font-mono">
          <span className="font-label-xs text-label-xs text-on-surface-variant truncate block">
            {decisionsCount > 0 ? 'Threshold breach' : 'Acceptable margin'}
          </span>
        </div>
      </div>
    </div>
  );
}
