import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { formatPercent, formatMetric, getDecisionBadgeClass } from '../utils/formatters';

export function DroneInspectionDeck() {
  const {
    selectedDrone,
    enforceRtb,
    reroute
  } = useTelemetry();

  if (!selectedDrone) {
    return null;
  }

  const isCritical = selectedDrone.decision === 'ABORT' || (selectedDrone.survival !== null && selectedDrone.survival < 70);
  const isNominal = selectedDrone.decision === 'GO';

  return (
    <div className="p-space-xs bg-surface-dim">
      <div className="bg-surface-container p-space-sm flex flex-col gap-space-sm shadow-md border border-outline-variant/40" id="inspection-deck">
        {/* Deck Header */}
        <div className="flex items-start justify-between gap-space-xs">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-space-xs">
              <span className={`w-2 h-2 ${isCritical ? 'bg-error' : isNominal ? 'bg-tertiary' : 'bg-outline'}`}></span>
              <span className="font-label-md text-label-md text-on-surface font-bold uppercase truncate font-mono">
                DRONE {selectedDrone.id} // CALLSIGN: {selectedDrone.callsign || `VANGUARD-${selectedDrone.id.replace('D', '')}`}
              </span>
            </div>
            <span
              className={`font-label-xs text-label-xs font-semibold mt-0.5 font-mono ${
                isCritical ? 'text-error' : isNominal ? 'text-tertiary' : 'text-outline'
              }`}
            >
              STATUS: {selectedDrone.status}
            </span>
          </div>
          <div className="px-space-xs py-0.5 bg-surface-container-highest text-primary font-label-xs text-label-xs uppercase shrink-0 font-mono font-bold border border-primary/40">
            TARGET LOCKED
          </div>
        </div>

        {/* Technical Telemetry Readout Gauges */}
        <div className="grid grid-cols-4 gap-space-xs font-mono">
          {/* SoC Level */}
          <div className="bg-surface-container-low p-space-xs flex flex-col border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">SoC LEVEL</span>
            <span className={`font-data-metric text-data-metric font-bold mt-1 ${isCritical ? 'text-error' : 'text-on-surface'}`}>
              {formatPercent(selectedDrone.soc)}
            </span>
            <span className={`font-label-xs text-label-xs truncate ${isCritical ? 'text-error' : 'text-outline'}`}>
              {selectedDrone.soc < 50 ? 'FAST DRAIN' : 'NOMINAL'}
            </span>
          </div>

          {/* Motor Temp */}
          <div className="bg-surface-container-low p-space-xs flex flex-col border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">MOTOR T°</span>
            <span className="font-data-metric text-data-metric text-on-surface font-semibold mt-1">
              {formatMetric(selectedDrone.temp, '°C')}
            </span>
            <span className="font-label-xs text-label-xs text-on-surface-variant truncate">
              {selectedDrone.temp > 55 ? 'NOMINAL-MAX' : 'OPTIMAL'}
            </span>
          </div>

          {/* Vibration */}
          <div className="bg-surface-container-low p-space-xs flex flex-col border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">VIBRATION</span>
            <span className={`font-data-metric text-data-metric font-semibold mt-1 ${selectedDrone.vib > 0.3 ? 'text-error' : 'text-on-surface'}`}>
              {formatMetric(selectedDrone.vib, 'g', 2)}
            </span>
            <span className={`font-label-xs text-label-xs truncate ${selectedDrone.vib > 0.3 ? 'text-error' : 'text-outline'}`}>
              {selectedDrone.vib > 0.3 ? 'ELEVATED' : 'STABLE'}
            </span>
          </div>

          {/* Survival */}
          <div className="bg-surface-container-low p-space-xs flex flex-col border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline">SURVIVAL</span>
            <span className={`font-data-metric text-data-metric font-bold mt-1 ${isCritical ? 'text-error' : 'text-tertiary'}`}>
              {formatPercent(selectedDrone.survival)}
            </span>
            <span className={`font-label-xs text-label-xs truncate ${isCritical ? 'text-error font-bold' : 'text-outline'}`}>
              {selectedDrone.survival === null ? 'STANDBY' : isCritical ? 'CRITICAL' : 'OPTIMAL'}
            </span>
          </div>
        </div>

        {/* Autonomous Decision Engine Output Module */}
        <div className="bg-surface-container-lowest p-space-sm flex flex-col gap-space-xs border border-outline-variant/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-error text-[16px]">psychology</span>
              <span className="font-label-xs text-label-xs uppercase font-bold text-outline font-mono">
                AUTONOMOUS DECISION ENGINE
              </span>
            </div>
            <span
              className={`px-space-xs py-0.5 font-label-xs text-label-xs font-bold uppercase font-mono ${getDecisionBadgeClass(
                selectedDrone.decision
              )}`}
            >
              {selectedDrone.decision === 'ABORT'
                ? 'ABORT RECOMMENDED'
                : selectedDrone.decision === 'REROUTE'
                ? 'REROUTE ADVISORY'
                : selectedDrone.decision === 'GO'
                ? 'MISSION NOMINAL'
                : 'SYSTEM STANDBY'}
            </span>
          </div>

          <p className="font-body-sm text-body-sm text-on-surface-variant leading-tight">
            {selectedDrone.decisionReason ||
              `${selectedDrone.id} vector margins and telemetry stability meet active autonomous operational thresholds.`}
          </p>

          <div className="flex items-center gap-space-xs pt-space-xs bg-surface-container px-space-xs py-1 border border-outline-variant/20">
            <span className="font-label-xs text-label-xs text-outline uppercase font-semibold font-mono">
              DOMINANT RISK:
            </span>
            <span className={`font-label-xs text-label-xs font-bold truncate font-mono ${isCritical ? 'text-error' : 'text-tertiary'}`}>
              {selectedDrone.dominantRisk || 'NONE (Acceptable margin)'}
            </span>
          </div>
        </div>

        {/* Tactical Manual Override Action */}
        <div className="grid grid-cols-2 gap-space-xs">
          <button
            onClick={() => enforceRtb(selectedDrone.id)}
            className="h-9 bg-error text-on-error font-label-sm text-label-sm font-mono uppercase font-bold flex items-center justify-center gap-1 active:bg-on-error-container transition-opacity hover:opacity-95"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">flight_land</span>
            <span>EXECUTE RTB</span>
          </button>
          <button
            onClick={() => reroute(selectedDrone.id)}
            className="h-9 bg-surface-container-highest text-primary font-label-sm text-label-sm font-mono uppercase font-semibold flex items-center justify-center gap-1 active:bg-surface-variant border border-primary/40 hover:bg-surface-variant"
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">navigation</span>
            <span>REROUTE PATH</span>
          </button>
        </div>
      </div>
    </div>
  );
}
