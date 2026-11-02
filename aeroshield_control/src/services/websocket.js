/**
 * AeroShield WebSocket Service
 * Handles real-time telemetry stream from FastAPI backend:
 * ws://localhost:8000/ws
 */

const STORAGE_KEY_WS_URL = 'aeroshield_ws_url';

class TelemetryWebSocket {
  constructor() {
    this.ws = null;
    this.url = localStorage.getItem(STORAGE_KEY_WS_URL) || 'ws://localhost:8000/ws';
    this.status = 'DISCONNECTED'; // 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR'
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 50;
    this.baseDelay = 1500;
    this.lastMessageTime = null;
    this.latency = null;
    this.frameCount = 0;
    this.hz = 0;
    this.hzInterval = null;
  }

  getUrl() {
    return this.url;
  }

  setUrl(newUrl) {
    if (!newUrl || newUrl === this.url) return;
    this.url = newUrl;
    localStorage.setItem(STORAGE_KEY_WS_URL, newUrl);
    this.reconnect();
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this._setStatus('CONNECTING');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this._startHzCounter();
      };

      this.ws.onmessage = (event) => {
        this.frameCount++;
        const now = Date.now();
        if (this.lastMessageTime) {
          this.latency = Math.max(8, Math.min(250, now - this.lastMessageTime));
        } else {
          this.latency = 18;
        }
        this.lastMessageTime = now;

        try {
          const parsed = JSON.parse(event.data);
          this._notifyListeners(parsed);
        } catch (err) {
          // Non-JSON message, send raw
          this._notifyListeners({ raw: event.data });
        }
      };

      this.ws.onerror = (error) => {
        this._setStatus('ERROR', error);
      };

      this.ws.onclose = (event) => {
        this._setStatus('DISCONNECTED');
        this._stopHzCounter();
        this._scheduleReconnect();
      };
    } catch (err) {
      this._setStatus('ERROR', err);
      this._scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this._stopHzCounter();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._setStatus('DISCONNECTED');
  }

  reconnect() {
    this.disconnect();
    this.connect();
  }

  _scheduleReconnect() {
    if (this.reconnectTimer) return;
    const delay = Math.min(10000, this.baseDelay * Math.pow(1.3, Math.min(this.reconnectAttempts, 8)));
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  _startHzCounter() {
    this._stopHzCounter();
    let prevFrames = 0;
    this.hzInterval = setInterval(() => {
      this.hz = this.frameCount - prevFrames;
      prevFrames = this.frameCount;
    }, 1000);
  }

  _stopHzCounter() {
    if (this.hzInterval) {
      clearInterval(this.hzInterval);
      this.hzInterval = null;
    }
  }

  _setStatus(status, error = null) {
    this.status = status;
    this.statusListeners.forEach((listener) => {
      try {
        listener(status, { url: this.url, latency: this.latency, error, hz: this.hz });
      } catch (e) {
        console.error('Status listener error:', e);
      }
    });
  }

  _notifyListeners(data) {
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (e) {
        console.error('Telemetry message listener error:', e);
      }
    });
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.status, { url: this.url, latency: this.latency, hz: this.hz });
    return () => this.statusListeners.delete(callback);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
      return true;
    }
    return false;
  }
}

export const telemetryWs = new TelemetryWebSocket();
export default telemetryWs;
