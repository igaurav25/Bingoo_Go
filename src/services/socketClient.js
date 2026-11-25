/**
 * src/services/socketClient.js
 *
 * Unified Web & API Client for Bingoo Goo.
 * - Manages authenticated/guest player identity via /api/auth/me, /api/auth/guest, login, register
 * - Maintains a single resilient WebSocket connection to the authoritative server
 * - Supports reconnection, pub/sub event listeners, and room session recovery on page reload
 */

const AUTH_TOKEN_KEY = 'bingo_auth_token';
const AUTH_USER_KEY = 'bingo_auth_user';
const ROOM_SESSION_KEY = 'bingo_room_session';

class BingoSocketClient {
  constructor() {
    this.ws = null;
    this.playerId = null;
    this.sessionToken = null;
    this.playerName = 'Player';
    this.playerAvatar = '🦊';
    this.listeners = new Map();
    this.pendingQueue = [];
    this.isConnecting = false;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
  }

  getWsUrl() {
    if (typeof window === 'undefined') return 'ws://localhost:3000';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}`;
  }

  setIdentity(user) {
    if (!user) return;
    this.playerId = user.id || this.playerId;
    this.playerName = user.username || user.name || this.playerName;
    this.playerAvatar = user.avatar || this.playerAvatar;
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.playerId) {
      this.send('identify', {
        playerId: this.playerId,
        sessionToken: this.getRoomSession()?.sessionToken,
        name: this.playerName,
        avatar: this.playerAvatar
      });
    }
  }

  getAuthToken() {
    try {
      return localStorage.getItem(AUTH_TOKEN_KEY) || null;
    } catch {
      return null;
    }
  }

  saveAuthSession(token, user) {
    try {
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
      if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } catch {}
    this.setIdentity(user);
  }

  clearAuthSession() {
    try {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
    } catch {}
  }

  saveRoomSession(session) {
    try {
      if (session) {
        localStorage.setItem(ROOM_SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(ROOM_SESSION_KEY);
      }
    } catch {}
  }

  getRoomSession() {
    try {
      const raw = localStorage.getItem(ROOM_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async apiFetch(path, options = {}) {
    const token = this.getAuthToken();
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(path, {
      ...options,
      headers,
      body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || data.message || `HTTP ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async ensureSession() {
    if (typeof window === 'undefined') return null;

    const existingToken = this.getAuthToken();
    if (existingToken) {
      try {
        const res = await this.apiFetch(`/api/auth/me?token=${encodeURIComponent(existingToken)}`);
        if (res.success && res.user) {
          this.saveAuthSession(existingToken, res.user);
          return res.user;
        }
      } catch {
        this.clearAuthSession();
      }
    }

    // Create a clean server-backed guest identity
    try {
      const savedUserRaw = localStorage.getItem(AUTH_USER_KEY);
      const savedUser = savedUserRaw ? JSON.parse(savedUserRaw) : null;
      const guestRes = await this.apiFetch('/api/auth/guest', {
        method: 'POST',
        body: {
          username: savedUser?.username || savedUser?.name || undefined,
          avatar: savedUser?.avatar || '🦊'
        }
      });
      if (guestRes.success && guestRes.user) {
        this.saveAuthSession(guestRes.sessionToken, guestRes.user);
        return guestRes.user;
      }
    } catch {}

    return null;
  }

  async login({ username, password }) {
    const res = await this.apiFetch('/api/auth/login', {
      method: 'POST',
      body: { username, password }
    });
    if (res.success && res.user) {
      this.saveAuthSession(res.sessionToken, res.user);
    }
    return res;
  }

  async register({ username, email, password, avatar }) {
    const res = await this.apiFetch('/api/auth/register', {
      method: 'POST',
      body: { username, email, password, avatar }
    });
    if (res.success && res.user) {
      this.saveAuthSession(res.sessionToken, res.user);
    }
    return res;
  }

  connect() {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return Promise.resolve(false);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve(true);
    if (this.isConnecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            clearInterval(check);
            resolve(true);
          } else if (!this.isConnecting) {
            clearInterval(check);
            resolve(false);
          }
        }, 80);
      });
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(this.getWsUrl());
        this.ws = ws;

        const connectTimeout = setTimeout(() => {
          if (ws.readyState !== WebSocket.OPEN) {
            this.isConnecting = false;
            resolve(false);
          }
        }, 6000);

        ws.onopen = () => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this.reconnectAttempts = 0;

          if (this.playerId) {
            this.send('identify', {
              playerId: this.playerId,
              sessionToken: this.getRoomSession()?.sessionToken,
              name: this.playerName,
              avatar: this.playerAvatar
            });
          }

          while (this.pendingQueue.length > 0) {
            const msg = this.pendingQueue.shift();
            ws.send(msg);
          }

          this._emit('connected', { connected: true });
          resolve(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'room_created' || data.type === 'room_joined' || data.type === 'quick_match_found') {
              if (data.playerId) this.playerId = data.playerId;
              if (data.sessionToken) this.sessionToken = data.sessionToken;
              if (data.code) {
                this.saveRoomSession({
                  code: data.code,
                  playerId: data.playerId,
                  sessionToken: data.sessionToken
                });
              }
            }
            this._emit(data.type, data);
            this._emit('*', data);
          } catch {}
        };

        ws.onclose = () => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          this._emit('disconnected', { connected: false });

          if (this.shouldReconnect && this.reconnectAttempts < 8) {
            const delay = Math.min(8000, 1000 * Math.pow(1.4, this.reconnectAttempts));
            this.reconnectAttempts += 1;
            setTimeout(() => this.connect(), delay);
          }
        };

        ws.onerror = () => {
          clearTimeout(connectTimeout);
          this.isConnecting = false;
          resolve(false);
        };
      } catch {
        this.isConnecting = false;
        resolve(false);
      }
    });
  }

  send(type, payload = {}) {
    const serialized = JSON.stringify({ type, payload });
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(serialized);
      return true;
    }
    this.pendingQueue.push(serialized);
    this.connect();
    return false;
  }

  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(handler);
    return () => this.off(eventType, handler);
  }

  off(eventType, handler) {
    const set = this.listeners.get(eventType);
    if (set) set.delete(handler);
  }

  _emit(eventType, data) {
    const set = this.listeners.get(eventType);
    if (!set) return;
    for (const fn of set) {
      try {
        fn(data);
      } catch (e) {
        console.error('[SocketClient listener error]', e);
      }
    }
  }
}

export const socketClient = new BingoSocketClient();
