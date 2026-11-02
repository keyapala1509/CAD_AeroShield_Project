import React, { useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Header } from './components/Header';
import { BottomNav, TABS } from './components/BottomNav';
import { MissionControlPage } from './pages/MissionControlPage';
import { FleetMatrixPage } from './pages/FleetMatrixPage';
import { EnvironmentGridPage } from './pages/EnvironmentGridPage';
import { ViabilityAnalyticsPage } from './pages/ViabilityAnalyticsPage';
import { DecisionLogPage } from './pages/DecisionLogPage';
import { SystemDiagnosticsPage } from './pages/SystemDiagnosticsPage';

export function App() {
  const [activeTab, setActiveTab] = useState('mission');

  const currentTabObj = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <TelemetryProvider>
      <div className="bg-surface text-on-surface font-body-md text-body-md flex flex-col min-h-screen">
        {/* Fixed Header */}
        <Header currentScreenTitle={currentTabObj.title} />

        {/* Main Viewport */}
        <main className="flex flex-col relative w-full pt-28 pb-20 bg-surface flex-1">
          {activeTab === 'mission' && <MissionControlPage />}
          {activeTab === 'fleet' && <FleetMatrixPage />}
          {activeTab === 'env' && <EnvironmentGridPage />}
          {activeTab === 'viab' && <ViabilityAnalyticsPage />}
          {activeTab === 'decide' && <DecisionLogPage />}
          {activeTab === 'system' && <SystemDiagnosticsPage />}
        </main>

        {/* Fixed Bottom Navigation */}
        <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
      </div>
    </TelemetryProvider>
  );
}

export default App;
