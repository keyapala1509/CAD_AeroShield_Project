import React from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { formatTimeSeconds } from '../utils/formatters';

export function Header({ currentScreenTitle }) {
  const {
    wsStatus,
    simTime,
    play,
    pause,
    reset,
    toast,
    isPlaying
  } = useTelemetry();

  const isOnline = wsStatus === 'CONNECTED';

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface-container-lowest/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.5)] border-b border-outline-variant/30">
      <div className="h-28 px-space-md flex flex-col justify-center gap-space-xs">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <div className="w-7 h-7 bg-primary-container/20 flex items-center justify-center border border-primary/30">
              <span className="material-symbols-outlined text-primary text-[20px]">shield_with_house</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">AEROSHIELD</span>
                <span className="font-label-xs text-label-xs text-outline font-medium">// C2</span>
              </div>
              <h1 className="font-headline-sm text-headline-sm text-on-surface tracking-tight truncate leading-tight">
                {currentScreenTitle || 'Mission Control'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-space-xs">
            <div className="h-6 px-space-xs bg-surface-container flex items-center gap-space-xs border border-outline-variant/40">
              {isOnline ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-ping"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary -ml-2"></span>
                  <span className="font-label-xs text-label-xs text-tertiary uppercase font-bold">ONLINE</span>
                </>
              ) : wsStatus === 'CONNECTING' ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  <span className="font-label-xs text-label-xs text-primary uppercase font-semibold">SYNCING</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                  <span className="font-label-xs text-label-xs text-error uppercase font-semibold">STANDALONE</span>
                </>
              )}
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 text-on-primary">
              <span className="material-symbols-outlined text-[18px]">person</span>
            </div>
          </div>
        </div>

        {/* Secondary metrics & control trigger row */}
        <div className="flex items-center justify-between gap-space-xs pt-space-xs">
          <div className="flex items-center gap-space-xs">
            <span className="font-label-xs text-label-xs text-outline uppercase font-mono">SYS METRIC:</span>
            <span className="font-data-metric text-data-metric text-primary-fixed-dim bg-surface-container px-space-xs py-0.5 border border-outline-variant/30">
              {formatTimeSeconds(simTime)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              aria-label="Play Telemetry Simulation"
              onClick={play}
              className={`w-11 h-8 min-w-[44px] bg-surface-container hover:bg-surface-variant flex items-center justify-center transition-colors border border-outline-variant/40 ${isPlaying ? 'border-tertiary/50' : ''}`}
              type="button"
            >
              <span className={`material-symbols-outlined text-[16px] ${isPlaying ? 'text-tertiary' : 'text-outline'}`}>
                play_arrow
              </span>
            </button>
            <button
              aria-label="Pause Telemetry Simulation"
              onClick={pause}
              className={`w-11 h-8 min-w-[44px] bg-surface-container hover:bg-surface-variant flex items-center justify-center transition-colors border border-outline-variant/40 ${!isPlaying ? 'border-primary/50' : ''}`}
              type="button"
            >
              <span className={`material-symbols-outlined text-[16px] ${!isPlaying ? 'text-primary' : 'text-outline'}`}>
                pause
              </span>
            </button>
            <button
              aria-label="Reset Simulation Clock"
              onClick={reset}
              className="w-11 h-8 min-w-[44px] bg-surface-container text-on-surface hover:bg-surface-variant flex items-center justify-center transition-colors border border-outline-variant/40"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-error">restart_alt</span>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Tactical Feedback Toast */}
      <div
        className={`fixed top-28 right-2 z-50 transform transition-transform duration-300 pointer-events-none px-space-md py-space-xs bg-surface-container-highest border border-outline-variant text-primary font-label-xs text-label-xs shadow-lg flex items-center gap-space-xs ${
          toast.visible ? 'translate-y-0' : '-translate-y-[180%]'
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${toast.type === 'error' ? 'bg-error' : toast.type === 'warning' ? 'bg-secondary' : 'bg-primary'} animate-ping`}></span>
        <span className="uppercase font-mono tracking-wider font-semibold">{toast.message}</span>
      </div>
    </header>
  );
}
