import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';

export function DecisionLogPage() {
  const { auditLogs, drones, enforceRtb, reroute, showToast } = useTelemetry();
  const [filterType, setFilterType] = useState('ALL');
  const [filterDrone, setFilterDrone] = useState('ALL');

  const nowLabel = new Date().toLocaleTimeString('en-GB');
  const decisionsList = Object.values(drones)
    .filter((d) => typeof d.survival === 'number' && d.decision)
    .map((d) => {
      const dec = String(d.decision).toUpperCase();
      return {
        id: 'dec-' + d.id,
        time: nowLabel,
        drone: d.id,
        callsign: d.callsign || ('UAV-' + d.id),
        decision: dec,
        rule: dec === 'ABORT' ? 'SURVIVAL_BELOW_ABORT_THRESHOLD' : dec === 'REROUTE' ? 'MARGIN_BELOW_GO_THRESHOLD' : 'SAFETY_MARGIN_OK',
        survival: d.survival,
        threshold: dec === 'ABORT' ? 60 : 90,
        risk: String(d.dominantRisk || 'none').toUpperCase(),
        reason: d.decisionReason || '',
        actionTaken: dec === 'ABORT' ? 'PENDING_CONFIRMATION' : 'PASSIVE_MONITOR'
      };
    });

  const filteredDecisions = decisionsList.filter((dec) => {
    if (filterType !== 'ALL' && dec.decision !== filterType) return false;
    if (filterDrone !== 'ALL' && dec.drone !== filterDrone) return false;
    return true;
  });

  return (
    <div className="flex flex-col w-full px-space-md py-space-sm gap-space-md font-mono">
      {/* Header Banner */}
      <div className="bg-surface-container-low p-space-md rounded-lg flex flex-col gap-space-xs border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
            <span className="font-headline-sm text-headline-sm text-on-surface font-sans">
              Autonomous Decision Log
            </span>
          </div>
          <span className="font-label-xs text-label-xs text-tertiary bg-surface-container-high px-space-xs py-0.5 rounded border border-tertiary/40">
            ENGINE C2 // ACTIVE
          </span>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant font-sans">
          Historical audit trail of autonomous state changes, rule evaluations, and operator intervention directives.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-col gap-space-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
          {['ALL', 'ABORT', 'REROUTE', 'GO'].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`h-7 px- space-sm rounded font-label-xs text-label-xs uppercase transition-colors ${
                filterType === t
                  ? 'bg-primary text-on-primary font-bold'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              {t}
            </button>
          ))}
          <span className="text-outline-variant mx-1">|</span>
          {['ALL', 'D1', 'D2', 'D3'].map((d) => (
            <button
              key={d}
              onClick={() => setFilterDrone(d)}
              className={`h-7 px-space-xs rounded font-label-xs text-label-xs uppercase transition-colors ${
                filterDrone === d
                  ? 'bg-surface-container-high text-primary font-bold border border-primary/40'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Decision Cards */}
      <div className="flex flex-col gap-space-sm">
        {filteredDecisions.map((item) => {
          const isAbort = item.decision === 'ABORT';
          const isReroute = item.decision === 'REROUTE';
          const isGo = item.decision === 'GO';

          return (
            <div
              key={item.id}
              className={`flex flex-col bg-surface-container-low p-space-sm rounded-lg gap-space-xs border ${
                isAbort
                  ? 'border-error/50 bg-error-container/10'
                  : isReroute
                  ? 'border-secondary/40'
                  : 'border-outline-variant/30'
              }`}
            >
              <div className="flex items-center justify-between bg-surface-container p-space-xs rounded border border-outline-variant/20">
                <div className="flex items-center gap-space-xs">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAbort ? 'bg-error animate-ping' : isReroute ? 'bg-secondary' : 'bg-tertiary'
                    }`}
                  ></span>
                  <span className="font-label-md text-label-md font-bold text-on-surface">
                    {item.callsign} [{item.drone}]
                  </span>
                  <span className="text-outline text-label-xs">[{item.time}]</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded font-label-xs text-label-xs font-bold uppercase ${
                    isAbort
                      ? 'bg-error text-on-error'
                      : isReroute
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-tertiary text-on-tertiary'
                  }`}
                >
                  {item.decision}
                </span>
              </div>

              <div className="flex items-center justify-between text-label-xs text-outline pt-0.5">
                <span>RULE: {item.rule}</span>
                <span>
                  sEnd: <strong className={isAbort ? 'text-error' : 'text-tertiary'}>{item.survival}%</strong> / THR: {item.threshold}%
                </span>
              </div>

              <p className="font-body-sm text-body-sm text-on-surface-variant font-sans leading-tight">
                {item.reason}
              </p>

              <div className="flex items-center justify-between bg-surface-container-highest px-space-xs py-1 rounded text-label-xs">
                <span className="text-outline truncate">
                  RISK: <span className={isAbort ? 'text-error' : 'text-on-surface'}>{item.risk}</span>
                </span>
                <span className="text-primary font-bold shrink-0 ml-1">{item.actionTaken}</span>
              </div>

              {isAbort && (
                <div className="grid grid-cols-2 gap-space-xs pt-1">
                  <button
                    onClick={() => enforceRtb(item.drone)}
                    className="h-8 bg-error text-on-error text-label-xs font-bold uppercase rounded flex items-center justify-center gap-1 active:opacity-90"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">flight_land</span>
                    <span>EXECUTE RTB</span>
                  </button>
                  <button
                    onClick={() => reroute(item.drone)}
                    className="h-8 bg-surface-container text-primary text-label-xs font-bold uppercase rounded flex items-center justify-center gap-1 border border-primary/30 hover:bg-surface-variant"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[14px]">navigation</span>
                    <span>OVERRIDE VECTOR</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
