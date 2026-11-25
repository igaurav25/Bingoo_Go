/**
 * mobile/services/apiClient.ts
 *
 * HTTP REST Client connecting React Native screens to the Bingoo Goo backend.
 */

import { APP_CONFIG, normalizeServerUrl } from '../constants/config';

class ApiClient {
  private baseUrl: string = APP_CONFIG.apiBaseUrl;
  private token: string | null = null;

  public setBaseUrl(url: string) {
    this.baseUrl = normalizeServerUrl(url);
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setToken(token: string | null) {
    this.token = token;
  }

  public getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
      }

      return data as T;
    } catch (err: any) {
      console.warn(`[ApiClient] Error on ${endpoint}:`, err.message);
      throw err;
    }
  }

  // Auth Endpoints
  public async createGuestSession(payload: { username?: string; avatar?: string } = {}) {
    return this.request<any>('/api/auth/guest', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async register(payload: { username: string; password?: string; email?: string; phoneNumber?: string; avatar?: string }) {
    return this.request<any>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async login(payload: { username: string; password?: string }) {
    return this.request<any>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async getMe(token?: string) {
    const q = token ? `?token=${encodeURIComponent(token)}` : '';
    return this.request<any>(`/api/auth/me${q}`);
  }

  // Health
  public async getDbHealth() {
    return this.request<any>('/api/health/db');
  }

  public async getServerHealth() {
    return this.request<any>('/health');
  }

  // Profile, Users & Leaderboard
  public async getUserProfile(userId: string) {
    return this.request<any>(`/api/users/profile?id=${encodeURIComponent(userId)}`);
  }

  public async updateProfile(userId: string, updates: { displayName?: string; avatar?: string }) {
    return this.request<any>('/api/users/profile', {
      method: 'PUT',
      body: JSON.stringify({ userId, ...updates })
    });
  }

  public async getUserDirectory(excludeUserId?: string, query?: string) {
    const params = new URLSearchParams();
    if (excludeUserId) params.set('excludeUserId', excludeUserId);
    if (query) params.set('q', query);
    return this.request<any>(`/api/users/directory?${params.toString()}`);
  }

  public async getLeaderboard(limit: number = 20, category: string = 'wins') {
    return this.request<any>(`/api/users/leaderboard?limit=${limit}&category=${encodeURIComponent(category)}`);
  }

  public async getMatchHistory(userId: string, limit: number = 15) {
    return this.request<any>(`/api/matches/history?userId=${encodeURIComponent(userId)}&limit=${limit}`);
  }

  // Tournaments
  public async getTournaments(format?: string) {
    const query = format ? `?format=${encodeURIComponent(format)}` : '';
    return this.request<any>(`/api/tournaments${query}`);
  }

  public async getTournamentByCode(code: string) {
    return this.request<any>(`/api/tournaments?code=${encodeURIComponent(code)}`);
  }

  public async createTournament(payload: any) {
    return this.request<any>('/api/tournaments', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async joinTournament(payload: { tournamentId?: string; code?: string; playerId?: string; playerName: string }) {
    return this.request<any>('/api/tournaments/join', { method: 'POST', body: JSON.stringify(payload) });
  }

  public async startTournament(tournamentId: string, hostId?: string) {
    return this.request<any>(`/api/tournaments/${tournamentId}/start`, {
      method: 'POST',
      body: JSON.stringify({ hostId })
    });
  }

  public async getTournamentById(id: string) {
    return this.request<any>(`/api/tournaments/${id}`);
  }

  public async startTournamentMatch(tournamentId: string, matchId: string, playerId?: string) {
    return this.request<any>(`/api/tournaments/${tournamentId}/matches/${matchId}/start`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    });
  }

  public async recordMatchResult(tournamentId: string, matchId: string, winnerId: string, scores?: number[]) {
    return this.request<any>(`/api/tournaments/${tournamentId}/match-result`, {
      method: 'POST',
      body: JSON.stringify({ matchId, winnerId, scores })
    });
  }

  public async fillBotsAndStart(tournamentId: string, hostId?: string) {
    return this.request<any>(`/api/tournaments/${tournamentId}/fill-bots`, {
      method: 'POST',
      body: JSON.stringify({ hostId })
    });
  }

  public async cancelTournament(tournamentId: string, hostId: string, reason?: string) {
    return this.request<any>(`/api/tournaments/${tournamentId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ hostId, reason })
    });
  }

  public async updateTournamentSettings(tournamentId: string, hostId: string, settings: any) {
    return this.request<any>(`/api/tournaments/${tournamentId}/settings`, {
      method: 'POST',
      body: JSON.stringify({ hostId, ...settings })
    });
  }

  public async getAuditLog(tournamentId: string) {
    return this.request<any>(`/api/tournaments/${tournamentId}/audit-log`);
  }

  public async sendTournamentInvitation(tournamentId: string, payload: { senderId: string; senderName: string; receiverId: string; receiverName?: string }) {
    return this.request<any>(`/api/tournaments/${tournamentId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  public async getTournamentNotifications(tournamentId: string, userId?: string) {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<any>(`/api/tournaments/${tournamentId}/notifications${q}`);
  }

  public async getAllNotifications(userId?: string) {
    const q = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<any>(`/api/notifications${q}`);
  }

  public async setParticipantReady(tournamentId: string, playerId: string, isReady: boolean) {
    return this.request<any>(`/api/tournaments/${tournamentId}/ready`, {
      method: 'POST',
      body: JSON.stringify({ playerId, isReady })
    });
  }

  public async leaveTournament(tournamentId: string, playerId: string) {
    return this.request<any>(`/api/tournaments/${tournamentId}/leave`, {
      method: 'POST',
      body: JSON.stringify({ playerId })
    });
  }

  // Wallet
  public async getWallet(userId: string) {
    return this.request<any>(`/api/wallet/balance?userId=${encodeURIComponent(userId)}`);
  }

  public async getTransactions(userId: string, limit: number = 20) {
    return this.request<any>(`/api/wallet/transactions?userId=${encodeURIComponent(userId)}&limit=${limit}`);
  }

  // Friends
  public async getFriends(userId: string) {
    return this.request<any>(`/api/friends/list?userId=${encodeURIComponent(userId)}`);
  }

  public async sendFriendRequest(senderId: string, receiverId: string) {
    return this.request<any>('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ senderId, receiverId })
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
