import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';

export function AuditLogTerminal() {
  const { auditLogs, streamHz } = useTelemetry();
  const [autoScroll, setAutoScroll] = useState(true);

  return (
    <div className="p-space-xs bg-surface-dim">
      <div className="bg-surface-container-lowest p-space-sm flex flex-col gap-space-xs shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between pb-space-xs bg-surface-container px-space-xs py-1 border border-outline-variant/30">
          <div className="flex items-center gap-space-xs">
            <span className="w-1.5 h-1.5 bg-primary animate-pulse"></span>
            <span className="font-label-xs text-label-xs uppercase font-bold text-on-surface font-mono">
              TACTICAL AUDIT LOG (STREAM: {streamHz || 5}Hz)
            </span>
          </div>
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className="font-label-xs text-label-xs text-outline font-mono uppercase hover:text-on-surface"
            type="button"
          >
            AUTO-SCROLL {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Real-time Terminal Events */}
        <div className="flex flex-col gap-1 font-label-xs text-label-xs font-mono max-h-52 overflow-y-auto" id="log-terminal">
          {auditLogs.map((log, idx) => {
            const isAbort = log.type === 'ABORT' || log.type === 'GLOBAL_RTB';
            const isReroute = log.type === 'REROUTE';
            const isGo = log.type === 'GO';
            const isSys = log.type === 'SYSTEM' || log.drone === 'SYS';
            const isCmd = log.drone === 'CMD';

            return (
              <div
                key={log.id || idx}
                className={`flex items-start gap-space-xs py-0.5 px-space-xs ${
                  idx % 2 === 0 ? 'bg-surface-container-low' : ''
                } border-b border-outline-variant/10`}
              >
                <span className="text-outline shrink-0">[{log.time}]</span>
                <span
                  className={`shrink-0 font-bold ${
                    isAbort
                      ? 'text-error'
                      : isReroute
                      ? 'text-secondary'
                      : isGo
                      ? 'text-tertiary'
                      : isCmd
                      ? 'text-primary'
                      : 'text-primary'
                  }`}
                >
                  {log.drone} {log.type ? `→ ${log.type}:` : '::'}
                </span>
                <span className="text-on-surface-variant truncate flex-1">{log.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
