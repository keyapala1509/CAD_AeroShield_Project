/**
 * AeroShield REST API Service
 * Connects to FastAPI backend at http://localhost:8000
 * Endpoints:
 *   GET  /
 *   POST /play
 *   POST /pause
 *   POST /reset
 */

const STORAGE_KEY_API_URL = 'aeroshield_api_url';
let currentBaseUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'http://localhost:8000';

export function getBackendBaseUrl() {
  return currentBaseUrl;
}

export function setBackendBaseUrl(url) {
  if (!url) return;
  // Strip trailing slashes
  currentBaseUrl = url.replace(/\/+$/, '');
  localStorage.setItem(STORAGE_KEY_API_URL, currentBaseUrl);
}

/**
 * Standard fetch helper with timeout
 */
async function request(endpoint, options = {}) {
  const url = `${currentBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {})
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Try parsing JSON or text
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { status: 'ok', raw: text };
    }
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * GET /
 * Healthcheck / backend root check
 */
export async function checkBackendHealth() {
  return request('/');
}

/**
 * POST /play
 * Resumes / starts simulation
 */
export async function playSimulation() {
  return request('/play', { method: 'POST' });
}

/**
 * POST /pause
 * Pauses simulation
 */
export async function pauseSimulation() {
  return request('/pause', { method: 'POST' });
}

/**
 * POST /reset
 * Resets simulation clock and telemetry state
 */
export async function resetSimulation() {
  return request('/reset', { method: 'POST' });
}
