import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { formatTimeSeconds } from '../utils/formatters';

export function TelemetryControlBar() {
  const {
    wsStatus,
    wsLatency,
    simTime,
    play,
    pause,
    reset,
    wsUrl
  } = useTelemetry();

  const isConnected = wsStatus === 'CONNECTED';

  return (
    <div className="bg-surface-container-lowest px-space-md py-space-xs flex flex-col gap-space-xs shadow-sm border-b border-outline-variant/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-space-xs min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              isConnected ? 'bg-tertiary animate-pulse' : wsStatus === 'CONNECTING' ? 'bg-primary animate-ping' : 'bg-error'
            }`}
          ></span>
          <span className="font-label-xs text-label-xs text-on-surface uppercase tracking-wider truncate font-bold font-mono">
            {isConnected ? 'BACKEND CONNECTED' : wsStatus === 'CONNECTING' ? 'CONNECTING WS...' : 'BACKEND DISCONNECTED'}
          </span>
          <span className="font-label-xs text-label-xs text-outline font-normal truncate hidden sm:inline font-mono">
            ({wsUrl})
          </span>
        </div>

        <div className="flex items-center gap-space-sm shrink-0">
          <span className="font-label-xs text-label-xs bg-surface-container px-space-xs py-0.5 text-tertiary font-mono">
            {isConnected ? `${wsLatency || 18}ms` : 'N/A'}
          </span>
          <span className="font-label-xs text-label-xs bg-surface-container px-space-xs py-0.5 text-primary-fixed-dim font-bold font-mono">
            {formatTimeSeconds(simTime)}
          </span>
        </div>
      </div>

      {/* Direct Simulation API Triggers */}
      <div className="grid grid-cols-3 gap-space-xs">
        <button
          onClick={play}
          className="h-8 bg-primary text-on-primary font-label-sm text-label-sm font-mono uppercase font-bold flex items-center justify-center gap-1 active:bg-primary-container transition-colors shadow-sm"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
          <span>PLAY</span>
        </button>
        <button
          onClick={pause}
          className="h-8 bg-surface-container-high text-on-surface hover:bg-surface-variant font-label-sm text-label-sm font-mono uppercase font-semibold flex items-center justify-center gap-1 active:bg-surface-bright transition-colors border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px] text-outline">pause</span>
          <span>PAUSE</span>
        </button>
        <button
          onClick={reset}
          className="h-8 bg-surface-container-high text-error hover:bg-surface-variant font-label-sm text-label-sm font-mono uppercase font-semibold flex items-center justify-center gap-1 active:bg-surface-bright transition-colors border border-outline-variant/30"
          type="button"
        >
          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          <span>RESET</span>
        </button>
      </div>
    </div>
  );
}
