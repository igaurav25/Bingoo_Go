/**
 * mobile/services/socketService.ts
 *
 * Authoritative WebSocket Client for React Native Mobile App.
 * Sends structured `{ type, payload }` frames matching server/server.js protocol.
 */

import { APP_CONFIG, deriveWsUrl } from '../constants/config';

export type SocketEventHandler = (data: any) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private url: string = APP_CONFIG.wsBaseUrl;
  private handlers: Map<string, Set<SocketEventHandler>> = new Map();
  private pendingQueue: string[] = [];
  private isConnected: boolean = false;
  private reconnectTimer: any = null;
  public playerId: string = `p_${Math.random().toString(36).substring(2, 9)}`;
  public playerName: string = 'Player';
  public playerAvatar: string = '🦊';

  public setServerHttpUrl(httpUrl: string) {
    const nextWs = deriveWsUrl(httpUrl);
    if (nextWs !== this.url) {
      this.url = nextWs;
      this.disconnect();
      this.connect(nextWs);
    }
  }

  public getWsUrl(): string {
    return this.url;
  }

  public setIdentity(identity: { playerId?: string; name?: string; avatar?: string }) {
    if (identity.playerId) this.playerId = identity.playerId;
    if (identity.name) this.playerName = identity.name;
    if (identity.avatar) this.playerAvatar = identity.avatar;
    if (this.isConnected) {
      this.send('identify', {
        playerId: this.playerId,
        name: this.playerName,
        avatar: this.playerAvatar
      });
    }
  }

  public connect(customUrl?: string) {
    if (customUrl) this.url = customUrl;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.clearReconnect();
        this.send('identify', {
          playerId: this.playerId,
          name: this.playerName,
          avatar: this.playerAvatar
        });
        while (this.pendingQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const raw = this.pendingQueue.shift();
          if (raw) this.ws.send(raw);
        }
        this.emit('connected', { playerId: this.playerId });
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const eventType = msg.type || msg.action || 'message';
          this.emit(eventType, msg);
        } catch (e) {
          console.warn('[SocketService] Message parsing error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected', {});
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
      };
    } catch (err) {
      console.warn('[SocketService] Connect exception:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.clearReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  public send(type: string, payload: any = {}) {
    const serialized = JSON.stringify({
      type,
      payload: {
        playerId: this.playerId,
        name: this.playerName,
        avatar: this.playerAvatar,
        ...payload
      }
    });
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.pendingQueue.push(serialized);
      this.connect();
      return false;
    }
    this.ws.send(serialized);
    return true;
  }

  public on(event: string, handler: SocketEventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: SocketEventHandler) {
    const set = this.handlers.get(event);
    if (set) set.delete(handler);
  }

  private emit(event: string, data: any) {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`[SocketService] Handler error for ${event}:`, e);
        }
      });
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const socketService = new SocketService();
export default socketService;
