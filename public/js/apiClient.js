/**
 * public/js/apiClient.js
 * 
 * Frontend API client communicating with Prisma ORM REST endpoints.
 */

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('bingo_session_token') || null;
    this.currentUser = null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('bingo_session_token', token);
    } else {
      localStorage.removeItem('bingo_session_token');
    }
  }

  async _request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const res = await fetch(path, { ...options, headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (err) {
      console.warn(`[ApiClient] Request to ${path} failed:`, err.message);
      throw err;
    }
  }

  async getHealth() {
    return this._request('/api/health/db');
  }

  async register({ username, email, password, avatar }) {
    const data = await this._request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, avatar })
    });
    if (data.sessionToken) {
      this.setToken(data.sessionToken);
      this.currentUser = data.user;
    }
    return data;
  }

  async login({ username, password }) {
    const data = await this._request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.sessionToken) {
      this.setToken(data.sessionToken);
      this.currentUser = data.user;
    }
    return data;
  }

  async getMe() {
    if (!this.token) return null;
    try {
      const data = await this._request('/api/auth/me');
      this.currentUser = data.user;
      return data.user;
    } catch {
      this.setToken(null);
      return null;
    }
  }

  async getLeaderboard(limit = 10, category = 'wins') {
    return this._request(`/api/users/leaderboard?limit=${limit}&category=${category}`);
  }

  async getWallet(userId) {
    return this._request(`/api/wallet/balance?userId=${userId}`);
  }

  async getTournaments(status = null) {
    const url = status ? `/api/tournaments?status=${status}` : '/api/tournaments';
    return this._request(url);
  }

  async registerTournament(tournamentId, userId, teamName) {
    return this._request('/api/tournaments/register', {
      method: 'POST',
      body: JSON.stringify({ tournamentId, userId, teamName })
    });
  }

  async getFriends(userId) {
    return this._request(`/api/friends/list?userId=${userId}`);
  }
}

export const api = new ApiClient();
