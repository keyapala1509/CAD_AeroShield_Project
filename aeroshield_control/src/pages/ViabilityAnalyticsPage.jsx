import React, { useState } from 'react';
import { useTelemetry } from '../context/TelemetryContext';
import { formatPercent } from '../utils/formatters';

export function ViabilityAnalyticsPage() {
  const {
    droneList,
    drones,
    selectedDroneId,
    setSelectedDroneId,
    fleetSurvival,
    enforceRtb,
    reroute,
    showToast,
    addLog,
    streamHz
  } = useTelemetry();

  const [alarmSilenced, setAlarmSilenced] = useState(false);

  const selectedDrone = drones[selectedDroneId] || drones.D3;
  const survivalVal = selectedDrone?.survival ?? 62;

  // Circumference calculation for SVG circle gauge: radius = 42, C = 2 * PI * 42 = 263.89
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - survivalVal / 100);

  const handleSilenceAlarm = () => {
    setAlarmSilenced(true);
    showToast('ALARM SILENCED (30 SECONDS)', 'info');
    addLog('OPR', 'ACK_ALARM', `Audible and visual threshold alarm acknowledged for ${selectedDrone.id}`);
    setTimeout(() => setAlarmSilenced(false), 30000);
  };

  return (
    <div className="flex flex-col w-full px-space-md py-space-sm gap-space-md">
      {/* 1. Realtime Telemetry Sync Ribbon */}
      <div className="flex items-center justify-between bg-surface-container px-space-md py-space-sm rounded-lg shadow-sm border border-outline-variant/30 font-mono">
        <div className="flex items-center gap-space-xs">
          <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></div>
          <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider">
            WS://AERO-STREAM:8443 [sEnd]
          </span>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="font-label-xs text-label-xs text-primary-fixed-dim bg-surface-container-high px-space-xs py-0.5 rounded border border-primary/30">
            TICK: {Math.round(1000 / (streamHz || 5))}ms
          </span>
          <span className="font-label-xs text-label-xs text-outline">N=10,000 SIMS</span>
        </div>
      </div>

      {/* 2. Mission Survival Probability: Fleet Level */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl gap-space-sm shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[18px]">query_stats</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase font-semibold font-mono">
              Fleet Aggregated Survival
            </span>
          </div>
          <span className="font-label-xs text-label-xs text-tertiary bg-surface-container-high px-space-xs py-0.5 rounded uppercase font-mono border border-tertiary/40">
            Nominal Fleet
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-space-xs font-mono">
          <div className="flex items-baseline gap-space-xs">
            <span className="font-data-display text-data-display text-primary font-bold">
              {fleetSurvival}
            </span>
            <span className="font-label-md text-label-md text-primary-fixed-dim">%</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-label-xs text-label-xs text-outline">CONFIDENCE BAND</span>
            <span className="font-data-metric text-data-metric text-on-surface font-semibold">
              95% [79.1% - 85.6%]
            </span>
          </div>
        </div>

        {/* Mini Progress Bar / Visual Distribution */}
        <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden flex border border-outline-variant/30">
          <div className="h-full bg-tertiary transition-all duration-500" style={{ width: `${fleetSurvival}%` }}></div>
          <div className="h-full bg-error transition-all duration-500" style={{ width: `${100 - fleetSurvival}%` }}></div>
        </div>

        {/* Drone Breakdown Selector Cards */}
        <div className="grid grid-cols-3 gap-space-xs mt-space-xs font-mono">
          {['D1', 'D2', 'D3'].map((id) => {
            const d = drones[id];
            if (!d) return null;
            const isSelected = selectedDroneId === id;
            const isCritical = d.decision === 'ABORT';

            return (
              <button
                key={id}
                onClick={() => setSelectedDroneId(id)}
                className={`p-space-xs flex flex-col items-start rounded-lg text-left transition-all active:scale-95 border ${
                  isSelected
                    ? 'bg-surface-container-high border-primary shadow-[0_0_12px_rgba(76,215,246,0.25)]'
                    : 'bg-surface-container border-outline-variant/30 hover:bg-surface-container-high'
                }`}
                type="button"
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`font-label-xs text-label-xs font-bold ${isCritical ? 'text-error' : 'text-on-surface-variant'}`}>
                    {d.callsign || id}
                  </span>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isCritical ? 'bg-error animate-ping' : 'bg-tertiary'
                    }`}
                  ></span>
                </div>
                <div className={`font-data-metric text-data-metric font-bold mt-1 ${isCritical ? 'text-error' : 'text-tertiary'}`}>
                  {formatPercent(d.survival)}
                </div>
                <span className={`font-label-xs text-label-xs uppercase mt-0.5 ${isCritical ? 'text-error font-semibold' : 'text-tertiary'}`}>
                  {isCritical ? 'ABORT' : 'GO SAFE'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Deep Dive Viability Engine: Focused Unit */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl gap-space-md shadow-md border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className={`material-symbols-outlined text-[20px] ${survivalVal < 70 ? 'text-error' : 'text-primary'}`}>
              {survivalVal < 70 ? 'warning' : 'verified'}
            </span>
            <div className="flex flex-col">
              <span className="font-headline-sm text-headline-sm text-on-surface">
                Viability Engine: {selectedDrone.callsign || selectedDrone.id} Focus
              </span>
              <span className={`font-label-xs text-label-xs uppercase font-semibold font-mono ${survivalVal < 70 ? 'text-error' : 'text-tertiary'}`}>
                {survivalVal < 70 ? 'Critical Boundary Breach' : 'Nominal Operational Boundary'}
              </span>
            </div>
          </div>
          <div className={`px-space-xs py-1 rounded font-mono ${survivalVal < 70 ? 'bg-error-container/40 border border-error/50' : 'bg-tertiary/20 border border-tertiary/40'}`}>
            <span className={`font-label-xs text-label-xs font-bold tracking-wider ${survivalVal < 70 ? 'text-error' : 'text-tertiary'}`}>
              {survivalVal < 70 ? 'NO-GO' : 'AIRWORTHY'}
            </span>
          </div>
        </div>

        {/* Tactical Gauge & Monte Carlo Visualizer */}
        <div className="flex items-center justify-between bg-surface-container p-space-md rounded-lg gap-space-md border border-outline-variant/30">
          {/* Radial Semi-Gauge inline SVG */}
          <div className="relative flex items-center justify-center w-28 h-28 flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                className="text-surface-variant fill-transparent"
                cx="50"
                cy="50"
                r={radius}
                stroke="currentColor"
                strokeWidth="9"
              ></circle>
              <circle
                className={`${survivalVal < 70 ? 'text-error' : 'text-tertiary'} fill-transparent transition-all duration-1000 ease-out`}
                cx="50"
                cy="50"
                r={radius}
                stroke="currentColor"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                strokeWidth="9"
              ></circle>
            </svg>
            <div className="absolute flex flex-col items-center justify-center font-mono">
              <span className={`font-data-display text-data-display font-bold leading-none ${survivalVal < 70 ? 'text-error' : 'text-tertiary'}`}>
                {survivalVal}
              </span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">% SURV</span>
            </div>
          </div>

          {/* Threshold Logic Specs */}
          <div className="flex flex-col flex-1 gap-1 font-mono">
            <div className="flex items-center justify-between bg-surface-container-high px-space-xs py-1 rounded border border-outline-variant/20">
              <span className="font-label-xs text-label-xs text-tertiary font-bold">GO ZONE</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">≥ 90%</span>
            </div>
            <div className="flex items-center justify-between bg-surface-container-high px-space-xs py-1 rounded border border-outline-variant/20">
              <span className="font-label-xs text-label-xs text-secondary-fixed font-bold">REROUTE</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">70 - 89%</span>
            </div>
            <div className="flex items-center justify-between bg-error-container/30 px-space-xs py-1 rounded border border-error/40">
              <span className="font-label-xs text-label-xs text-error font-bold">ABORT</span>
              <span className="font-label-xs text-label-xs text-error">
                &lt; 70% (CUR: {survivalVal}%)
              </span>
            </div>
          </div>
        </div>

        {/* Notice Badge / Monte Carlo Stream Info */}
        <div className="flex items-start gap-space-xs bg-surface-container p-space-sm rounded-lg border border-outline-variant/20">
          <span className="material-symbols-outlined text-primary text-[18px] flex-shrink-0 mt-0.5">info</span>
          <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
            Detailed viability curve & 95% CI (<span className="font-label-xs text-label-xs text-primary font-mono">ciLow / ciHigh</span>) will render dynamically when extended telemetry stream is activated. Currently tracking discrete <span className="font-label-xs text-label-xs text-primary-fixed-dim font-mono">sEnd</span> trajectory vector.
          </p>
        </div>

        {/* Sensitivity Analysis: Risk Attribution Matrix */}
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center justify-between font-mono">
            <span className="font-label-sm text-label-sm text-on-surface font-semibold uppercase">
              Risk Attribution Sensitivity
            </span>
            <span className="font-label-xs text-label-xs text-outline">FACTOR WEIGHT</span>
          </div>

          {/* Factor 1: Battery */}
          <div className="flex flex-col bg-surface-container p-space-xs rounded gap-1 border border-outline-variant/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[15px] text-error">battery_alert</span>
                <span className="font-body-sm text-body-sm text-on-surface">Battery Degradation</span>
              </div>
              <span className="font-data-metric text-data-metric text-error font-bold font-mono">58%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-error h-full rounded-full" style={{ width: '58%' }}></div>
            </div>
          </div>

          {/* Factor 2: Wind Drag */}
          <div className="flex flex-col bg-surface-container p-space-xs rounded gap-1 border border-outline-variant/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[15px] text-secondary">air</span>
                <span className="font-body-sm text-body-sm text-on-surface">Environmental Wind Drag</span>
              </div>
              <span className="font-data-metric text-data-metric text-secondary font-bold font-mono">28%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-secondary-container h-full rounded-full" style={{ width: '28%' }}></div>
            </div>
          </div>

          {/* Factor 3: Thermal */}
          <div className="flex flex-col bg-surface-container p-space-xs rounded gap-1 border border-outline-variant/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[15px] text-primary">device_thermostat</span>
                <span className="font-body-sm text-body-sm text-on-surface">Motor Thermal Stress</span>
              </div>
              <span className="font-data-metric text-data-metric text-primary font-bold font-mono">10%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary-container h-full rounded-full" style={{ width: '10%' }}></div>
            </div>
          </div>

          {/* Factor 4: Vibration */}
          <div className="flex flex-col bg-surface-container p-space-xs rounded gap-1 border border-outline-variant/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[15px] text-outline">vibration</span>
                <span className="font-body-sm text-body-sm text-on-surface">Vibration / Structural</span>
              </div>
              <span className="font-data-metric text-data-metric text-on-surface-variant font-bold font-mono">4%</span>
            </div>
            <div className="w-full bg-surface-container-highest h-1.5 rounded-full overflow-hidden">
              <div className="bg-outline h-full rounded-full" style={{ width: '4%' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Operational Decision Logic Card */}
      <div className="flex flex-col bg-surface-container-low p-space-md rounded-xl gap-space-md shadow-lg border border-outline-variant/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-space-xs">
            <span className="material-symbols-outlined text-primary text-[20px]">psychology</span>
            <span className="font-headline-sm text-headline-sm text-on-surface">Autonomous Decision Logic</span>
          </div>
          <div className={`flex items-center gap-space-xs px-space-xs py-0.5 rounded font-mono ${selectedDrone.decision === 'ABORT' ? 'bg-error-container text-on-error border border-error/50' : 'bg-tertiary-container text-on-tertiary'}`}>
            <span className="font-label-xs text-label-xs font-bold tracking-wider uppercase">
              VERDICT: {selectedDrone.decision || 'GO'}
            </span>
          </div>
        </div>

        {/* Diagnostic Explanation Box */}
        <div className="bg-surface-container p-space-sm rounded-lg flex flex-col gap-space-xs border border-outline-variant/20">
          <div className="flex items-center gap-space-xs font-mono">
            <span className={`material-symbols-outlined text-[16px] ${selectedDrone.decision === 'ABORT' ? 'text-error' : 'text-tertiary'}`}>
              {selectedDrone.decision === 'ABORT' ? 'cancel' : 'check_circle'}
            </span>
            <span className={`font-label-xs text-label-xs font-bold tracking-wide uppercase ${selectedDrone.decision === 'ABORT' ? 'text-error' : 'text-tertiary'}`}>
              {selectedDrone.decision === 'ABORT' ? 'C2 Engine Rule Triggered' : 'Operational Clear'}
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface leading-normal">
            {selectedDrone.decision === 'ABORT' ? (
              <>
                {selectedDrone.id} ABORT: Continuing mission survival (
                <span className="font-data-metric text-data-metric text-error font-bold font-mono">
                  {selectedDrone.survival}%
                </span>
                ) is below return survival threshold (
                <span className="font-data-metric text-data-metric text-tertiary font-bold font-mono">78%</span>
                ). Safe mission completion impossible under current battery drain rate.
              </>
            ) : (
              `${selectedDrone.id} viability satisfies safety margin criteria. Expected return probability > 90%.`
            )}
          </p>
        </div>

        {/* Operator Directives & Action Triggers */}
        <div className="flex flex-col gap-space-xs pt-space-xs font-mono">
          <span className="font-label-xs text-label-xs text-on-surface-variant uppercase tracking-wider font-semibold">
            Actionable Operator Directives
          </span>

          {/* Primary Action: RTB Handoff */}
          <button
            onClick={() => enforceRtb(selectedDrone.id)}
            className="w-full bg-error text-on-error py-space-sm px-space-md flex items-center justify-center gap-space-xs transition-all active:scale-[0.98] shadow-md hover:opacity-95 uppercase font-bold text-label-sm"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">keyboard_return</span>
            <span className="tracking-wider">Execute RTB Autopilot Handoff</span>
          </button>

          {/* Secondary Action: Override to Auxiliary */}
          <button
            onClick={() => reroute(selectedDrone.id)}
            className="w-full bg-surface-container text-on-surface py-space-sm px-space-md flex items-center justify-center gap-space-xs transition-all hover:bg-surface-container-high active:scale-[0.98] uppercase font-semibold text-label-sm border border-outline-variant/30 text-primary"
            type="button"
          >
            <span className="material-symbols-outlined text-primary text-[20px]">alt_route</span>
            <span className="tracking-wider">Override & Force Reroute Aux Site</span>
          </button>

          {/* Tertiary Action: Acknowledge Alarm */}
          <button
            onClick={handleSilenceAlarm}
            className={`w-full py-space-xs px-space-md flex items-center justify-center gap-space-xs transition-all uppercase text-label-xs tracking-wider border border-outline-variant/30 ${
              alarmSilenced
                ? 'bg-tertiary-container text-on-tertiary-container font-bold'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">
              {alarmSilenced ? 'check_circle' : 'notifications_paused'}
            </span>
            <span>{alarmSilenced ? 'Alarm Silenced (30s)' : 'Acknowledge Alarm'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
