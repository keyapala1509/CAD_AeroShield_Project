import React from 'react';
import { TelemetryControlBar } from '../components/TelemetryControlBar';
import { KpiGrid } from '../components/KpiGrid';
import { TacticalMap } from '../components/TacticalMap';
import { DroneInspectionDeck } from '../components/DroneInspectionDeck';
import { AuditLogTerminal } from '../components/AuditLogTerminal';

export function MissionControlPage() {
  return (
    <div className="flex flex-col w-full text-on-surface">
      {/* 1. Live Tactical Telemetry Control Bar */}
      <TelemetryControlBar />

      {/* 2. KPI Status Matrix (Dense Operational Grid) */}
      <KpiGrid />

      {/* 3. 2D Tactical Simulation Map Component */}
      <TacticalMap />

      {/* 4. Selected Drone Inspection Deck */}
      <DroneInspectionDeck />

      {/* 5. Live Operational Event Stream */}
      <AuditLogTerminal />
    </div>
  );
}
