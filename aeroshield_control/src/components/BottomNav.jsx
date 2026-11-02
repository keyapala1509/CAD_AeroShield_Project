import React from 'react';

export const TABS = [
  { id: 'mission', label: 'Mission', title: 'Mission Control', icon: 'radar' },
  { id: 'fleet', label: 'Fleet', title: 'Fleet Matrix', icon: 'flight' },
  { id: 'env', label: 'Env', title: 'Environment Grid', icon: 'cloud' },
  { id: 'viab', label: 'Viab', title: 'Viability Analytics', icon: 'show_chart' },
  { id: 'decide', label: 'Decide', title: 'Decision Log', icon: 'receipt_long' },
  { id: 'system', label: 'System', title: 'System Diagnostics', icon: 'vital_signs' }
];

export function BottomNav({ activeTab, onSelectTab }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/30 shadow-[0_-1px_12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-around h-16 px-space-xs">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] h-full flex-1 gap-0.5 transition-colors ${
                isActive
                  ? 'text-primary bg-surface-container-high border-t-2 border-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
              <span className="font-label-xs text-label-xs uppercase font-mono font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
