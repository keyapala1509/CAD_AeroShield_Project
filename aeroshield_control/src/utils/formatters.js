/**
 * Tactical Data Formatting Utilities
 */

export function formatTimeSeconds(seconds) {
  if (seconds === undefined || seconds === null || isNaN(seconds)) {
    return 'T+000.0s';
  }
  const sign = seconds >= 0 ? '+' : '-';
  const abs = Math.abs(seconds);
  const formatted = abs.toFixed(1).padStart(5, '0');
  return `T${sign}${formatted}s`;
}

export function formatPercent(val, fallback = 'N/A') {
  if (val === undefined || val === null || isNaN(val)) {
    return fallback;
  }
  return `${Number(val).toFixed(1)}%`;
}

export function formatMetric(val, unit = '', decimals = 1, fallback = 'N/A') {
  if (val === undefined || val === null || isNaN(val)) {
    return fallback;
  }
  return `${Number(val).toFixed(decimals)}${unit}`;
}

export function getStatusColorClass(status) {
  const s = String(status || '').toUpperCase();
  if (s.includes('ABORT') || s.includes('CRITICAL') || s.includes('NO-GO')) {
    return 'text-error';
  }
  if (s.includes('REROUTE') || s.includes('DEGRADED') || s.includes('WARN')) {
    return 'text-secondary';
  }
  if (s.includes('FLYING') || s.includes('NOMINAL') || s.includes('GO')) {
    return 'text-tertiary';
  }
  if (s.includes('IDLE') || s.includes('STANDBY')) {
    return 'text-outline';
  }
  return 'text-on-surface-variant';
}

export function getDecisionBadgeClass(decision) {
  const d = String(decision || '').toUpperCase();
  if (d.includes('ABORT') || d.includes('NO-GO')) {
    return 'bg-error text-on-error';
  }
  if (d.includes('REROUTE')) {
    return 'bg-secondary-container text-on-secondary-container';
  }
  if (d.includes('GO')) {
    return 'bg-tertiary text-on-tertiary';
  }
  return 'bg-surface-container-high text-on-surface-variant';
}
