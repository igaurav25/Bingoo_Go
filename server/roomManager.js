/**
 * server/roomManager.js
 * 
 * Part 2 Multi-device Room Manager.
 * - 5-character vowel-free, look-alike-free alphabet (2-9, consonants except L)
 * - 2 players per room (maxPlayers = 2)
 * - Anonymous sessionTokens (seat ownership, never leaked to opponent)
 * - 60-second disconnect grace period & match pausing
 * - Auto-reconnect & tab conflict resolution (newer connection kicks older)
 * - Room cleanup (empty rooms expire in 5 min, idle in 30 min)
 * - Turn timer with server-authoritative deadlines
 * - Rematch support with alternating first turn and series scorekeeping
 */

import crypto from 'node:crypto';
import { Match } from './gameState.js';
import { BingoBot } from './botPlayer.js';

// Alphabet: digits 2-9 and consonants except L (no 0, 1, A, E, I, O, U, L)
// Total 28 characters: 23456789BCDFGHJKMNPQRSTVWXYZ
export const ROOM_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 5;
export const MAX_PLAYERS = 2;
export const DISCONNECT_GRACE_PERIOD_MS = 60 * 1000;
export const EMPTY_ROOM_EXPIRY_MS = 5 * 60 * 1000;
export const IDLE_ROOM_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Generates a random 5-character room code from the alphabet.
 * @param {(code: string) => boolean} isCodeTaken
 * @returns {string}
 */
export function generateRoomCode(isCodeTaken = () => false) {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = crypto.randomInt(0, ROOM_ALPHABET.length);
    code += ROOM_ALPHABET[idx];
  }
  return isCodeTaken(code) ? generateRoomCode(isCodeTaken) : code;
}

/**
 * Sanitizes and validates a room code.
 * @param {string} input
 * @returns {string}
 */
export function normalizeRoomCode(input) {
  if (!input || typeof input !== 'string') return '';
  return input.toUpperCase().trim().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '').slice(0, 5);
}

export class DeviceRoom {
  /**
   * @param {string} code
   * @param {string} hostPlayerId
   * @param {string} hostSessionToken
   * @param {string} hostName
   * @param {string} hostAvatar
   */
  constructor(code, hostPlayerId, hostSessionToken, hostName, hostAvatar) {
    this.code = code;
    this.hostPlayerId = hostPlayerId;
    this.status = 'lobby'; // 'lobby' | 'arranging' | 'playing' | 'finished'
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();

    // Settings
    this.settings = {
      turnTimerSeconds: 0, // 0 = Off, 20, 30, 45
      seriesTargetWins: 1  // 1 = single match, 2 = Best-of-3, 3 = Best-of-5
    };

    // Series scores: playerId -> wins
    this.scores = {
      [hostPlayerId]: 0
    };

    // Players: array of player records
    this.players = [
      this._createPlayerRecord(hostPlayerId, hostSessionToken, hostName, hostAvatar, true)
    ];

    // Rematch requests: Set of playerIds
    this.rematchRequests = new Set();
    this.lastStartingPlayerId = hostPlayerId;

    // Active gameplay match
    this.match = null;
    this.bot = null;

    // Disconnect handling
    this.disconnectTimer = null;
    this.disconnectGraceDeadline = null;
    this.disconnectedPlayerId = null;
    this.pauseCounts = { [hostPlayerId]: 0 };

    // Turn timer
    this.turnTimerInterval = null;
    this.turnDeadline = null;
  }

  _createPlayerRecord(id, sessionToken, name, avatar, isHost = false) {
    return {
      id,
      sessionToken,
      name: (name || 'Player').slice(0, 16),
      avatar: avatar || '🦊',
      isHost,
      isReady: false,
      isBoardLocked: false,
      isConnected: true,
      lastSeenAt: Date.now(),
      ws: null
    };
  }

  touch() {
    this.lastActivityAt = Date.now();
  }

  findPlayerBySessionToken(sessionToken) {
    return this.players.find(p => p.sessionToken === sessionToken);
  }

  findPlayerById(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  /**
   * Adds or reconnects a player to the room.
   * @param {string} playerId
   * @param {string} sessionToken
   * @param {string} name
   * @param {string} avatar
   * @param {WebSocket} ws
   * @returns {{ success: boolean, error?: string, isReconnect?: boolean, oldWs?: WebSocket }}
   */
  join(playerId, sessionToken, name, avatar, ws) {
    this.touch();

    // 1. Check if player with this sessionToken already exists in this room (reconnection or second tab)
    const existingByToken = this.findPlayerBySessionToken(sessionToken);
    if (existingByToken) {
      const oldWs = existingByToken.ws;
      existingByToken.ws = ws;
      existingByToken.isConnected = true;
      existingByToken.lastSeenAt = Date.now();

      // If they had changed nickname/avatar, update
      if (name) existingByToken.name = name.slice(0, 16);
      if (avatar) existingByToken.avatar = avatar;

      // Handle reconnect during pause
      let wasPaused = false;
      if (this.disconnectedPlayerId === existingByToken.id) {
        this._cancelDisconnectGrace();
        wasPaused = true;
      }

      return {
        success: true,
        isReconnect: true,
        player: existingByToken,
        oldWs,
        wasPaused
      };
    }

    // 2. Room capacity check
    if (this.players.length >= MAX_PLAYERS) {
      return { success: false, error: 'Room is full (2/2 players).' };
    }

    // 3. New player joining
    // Ensure name doesn't collide with existing player
    let finalName = (name || 'Guest').slice(0, 16);
    if (this.players.some(p => p.name.toLowerCase() === finalName.toLowerCase())) {
      finalName = `${finalName} #2`;
    }

    const newPlayer = this._createPlayerRecord(playerId, sessionToken, finalName, avatar, false);
    newPlayer.ws = ws;
    this.players.push(newPlayer);
    this.scores[playerId] = 0;
    this.pauseCounts[playerId] = 0;

    return {
      success: true,
      isReconnect: false,
      player: newPlayer
    };
  }

  /**
   * Adds an AI Bot to practice against.
   * @returns {{ success: boolean, bot?: BingoBot, error?: string }}
   */
  addBot() {
    this.touch();
    if (this.players.length >= MAX_PLAYERS) {
      return { success: false, error: 'Room is full.' };
    }
    const botId = `bot-${crypto.randomBytes(3).toString('hex')}`;
    const botSession = `bot-session-${crypto.randomBytes(4).toString('hex')}`;
    const botNames = ['CyberBot', 'PixelPro', 'BingoViper', 'NeonStar'];
    const botAvatars = ['🤖', '⚡', '🎮', '🚀'];
    const name = botNames[Math.floor(Math.random() * botNames.length)];
    const avatar = botAvatars[Math.floor(Math.random() * botAvatars.length)];

    const botPlayer = this._createPlayerRecord(botId, botSession, `${name} (Bot)`, avatar, false);
    botPlayer.isReady = true;
    botPlayer.isBot = true;

    this.bot = new BingoBot(botId, botPlayer.name);
    botPlayer.botInstance = this.bot;

    this.players.push(botPlayer);
    this.scores[botId] = 0;
    this.pauseCounts[botId] = 0;

    return { success: true, bot: this.bot };
  }

  /**
   * Handles player disconnection (socket close / drop).
   * @param {string} playerId
   * @param {(winnerId: string, reason: string) => void} onForfeit
   * @returns {{ shouldPause: boolean, graceDeadline?: number }}
   */
  handleDisconnect(playerId, onForfeit) {
    this.touch();
    const player = this.findPlayerById(playerId);
    if (!player) return { shouldPause: false };

    player.isConnected = false;
    player.ws = null;
    player.lastSeenAt = Date.now();

    // If still in lobby, no need to pause match
    if (this.status === 'lobby') {
      return { shouldPause: false };
    }

    // In active match ('arranging' or 'playing'): pause match up to 60s
    if (this.status === 'arranging' || this.status === 'playing') {
      const currentPauses = this.pauseCounts[playerId] || 0;
      if (currentPauses >= 2) {
        // Exceeded max pauses -> forfeit immediately
        const otherPlayer = this.players.find(p => p.id !== playerId);
        if (otherPlayer && onForfeit) {
          onForfeit(otherPlayer.id, 'Opponent exceeded maximum disconnect pauses (forfeit).');
        }
        return { shouldPause: false };
      }

      this.pauseCounts[playerId] = currentPauses + 1;
      this.disconnectedPlayerId = playerId;
      this.disconnectGraceDeadline = Date.now() + DISCONNECT_GRACE_PERIOD_MS;

      // Start 60-second grace timer
      if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
      this.disconnectTimer = setTimeout(() => {
        if (this.disconnectedPlayerId === playerId) {
          const otherPlayer = this.players.find(p => p.id !== playerId);
          if (otherPlayer && onForfeit) {
            onForfeit(otherPlayer.id, 'Opponent did not reconnect within 60 seconds (forfeit).');
          }
        }
      }, DISCONNECT_GRACE_PERIOD_MS);
      if (this.disconnectTimer.unref) {
        this.disconnectTimer.unref();
      }

      return {
        shouldPause: true,
        graceDeadline: this.disconnectGraceDeadline,
        pauseCount: this.pauseCounts[playerId]
      };
    }

    return { shouldPause: false };
  }

  _cancelDisconnectGrace() {
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    this.disconnectGraceDeadline = null;
    this.disconnectedPlayerId = null;
  }

  /**
   * Removes player from room (explicit leave).
   * @param {string} playerId
   */
  removePlayer(playerId) {
    this.touch();
    this._cancelDisconnectGrace();

    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      delete this.scores[playerId];

      // If host left, assign host to the other player
      if (this.hostPlayerId === playerId && this.players.length > 0) {
        this.hostPlayerId = this.players[0].id;
        this.players[0].isHost = true;
      }
    }
  }

  /**
   * Toggles ready state in lobby.
   * @param {string} playerId
   * @param {boolean} [ready]
   * @returns {{ allReady: boolean }}
   */
  setReady(playerId, ready = null) {
    this.touch();
    const p = this.findPlayerById(playerId);
    if (p) {
      p.isReady = ready !== null ? ready : !p.isReady;
    }
    const allReady = this.players.length === MAX_PLAYERS && this.players.every(pl => pl.isReady);
    return { allReady };
  }

  /**
   * Advances room from lobby to arranging.
   */
  startArranging() {
    this.touch();
    this.status = 'arranging';
    this.rematchRequests.clear();

    // Reset boards
    this.players.forEach(p => {
      p.isBoardLocked = false;
      if (p.isBot && p.botInstance) {
        p.isBoardLocked = true;
      }
    });

    // Create new Match instance
    const [p1, p2] = this.players;
    const matchId = `match-${this.code}-${Date.now().toString(36)}`;

    // Alternate starting player for rematches
    const startingPlayerId = this.lastStartingPlayerId === p1.id ? p2.id : p1.id;
    this.lastStartingPlayerId = startingPlayerId;

    this.match = new Match(matchId, p1.id, p2.id, {
      claimRateLimitMs: 400
    });
    this.match.currentTurnPlayerId = startingPlayerId;

    // If player 2 is bot, auto-lock arrangement
    if (p2.isBot && p2.botInstance) {
      this.match.setPlayerArrangement(p2.id, p2.botInstance.grid);
    }

    return { matchId, startingPlayerId };
  }

  /**
   * Sets board arrangement and locks it.
   * If both players locked, transitions status to 'playing'.
   * @param {string} playerId
   * @param {number[]} grid
   */
  lockBoard(playerId, grid) {
    this.touch();
    const p = this.findPlayerById(playerId);
    if (!p || !this.match) {
      return { success: false, error: 'Match not initialized' };
    }

    const res = this.match.setPlayerArrangement(playerId, grid);
    if (!res.success) {
      return res;
    }

    p.isBoardLocked = true;

    // Check if both locked
    const bothLocked = this.players.every(pl => pl.isBoardLocked);
    let matchStarted = false;
    if (bothLocked && this.status === 'arranging') {
      this.status = 'playing';
      matchStarted = true;
      this._startTurnTimerIfNeeded();
    }

    return {
      success: true,
      isBoardLocked: true,
      matchStarted,
      currentTurnPlayerId: this.match.currentTurnPlayerId
    };
  }

  _startTurnTimerIfNeeded() {
    this._clearTurnTimer();
    const secs = this.settings.turnTimerSeconds;
    if (secs > 0 && this.status === 'playing') {
      this.turnDeadline = Date.now() + (secs * 1000);
    } else {
      this.turnDeadline = null;
    }
  }

  _clearTurnTimer() {
    if (this.turnTimerInterval) {
      clearInterval(this.turnTimerInterval);
      this.turnTimerInterval = null;
    }
    this.turnDeadline = null;
  }

  /**
   * Request a rematch. When both agree, restarts into 'arranging'.
   * @param {string} playerId
   * @returns {{ rematchReady: boolean }}
   */
  requestRematch(playerId) {
    this.touch();
    this.rematchRequests.add(playerId);
    // If bot is playing, bot auto-agrees
    if (this.players.some(p => p.isBot)) {
      this.players.filter(p => p.isBot).forEach(b => this.rematchRequests.add(b.id));
    }
    const rematchReady = this.players.every(p => this.rematchRequests.has(p.id));
    return { rematchReady };
  }

  /**
   * Generates public snapshot of the room.
   * NEVER sends sessionTokens or opponent grid arrangements!
   * @param {string} [forPlayerId]
   * @returns {object}
   */
  getSnapshot(forPlayerId) {
    const isPaused = this.disconnectedPlayerId !== null;
    let matchSnapshot = null;
    if (this.match) {
      matchSnapshot = this.match.getSnapshot(forPlayerId);
    }

    return {
      code: this.code,
      hostPlayerId: this.hostPlayerId,
      status: this.status,
      isPaused,
      disconnectedPlayerId: this.disconnectedPlayerId,
      disconnectGraceSecondsRemaining: this.disconnectGraceDeadline
        ? Math.max(0, Math.ceil((this.disconnectGraceDeadline - Date.now()) / 1000))
        : null,
      settings: this.settings,
      scores: this.scores,
      turnDeadline: this.turnDeadline,
      rematchRequests: Array.from(this.rematchRequests),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isHost: p.id === this.hostPlayerId,
        isReady: p.isReady,
        isBoardLocked: p.isBoardLocked,
        isConnected: p.isConnected,
        isBot: !!p.isBot
      })),
      match: matchSnapshot
    };
  }
}

export class DeviceRoomManager {
  constructor() {
    /** @type {Map<string, DeviceRoom>} */
    this.rooms = new Map();

    // IP Rate limiting
    this.createRateLimits = new Map(); // ip -> [timestamps]
    this.joinRateLimits = new Map();   // ip -> [timestamps]

    // Periodic cleanup of empty and idle rooms (unref so process exits cleanly in tests)
    this._cleanupTimer = setInterval(() => this.cleanupExpiredRooms(), 60 * 1000);
    if (this._cleanupTimer.unref) {
      this._cleanupTimer.unref();
    }
  }

  checkRateLimit(ip, type = 'create', limit = 10, windowMs = 60 * 1000) {
    const store = type === 'create' ? this.createRateLimits : this.joinRateLimits;
    const now = Date.now();
    const timestamps = (store.get(ip) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= limit) {
      return false;
    }
    timestamps.push(now);
    store.set(ip, timestamps);
    return true;
  }

  createRoom(hostPlayerId, hostSessionToken, hostName, hostAvatar) {
    const code = generateRoomCode((c) => this.rooms.has(c));
    const room = new DeviceRoom(code, hostPlayerId, hostSessionToken, hostName, hostAvatar);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    const normalized = normalizeRoomCode(code);
    return this.rooms.get(normalized) || null;
  }

  cleanupExpiredRooms() {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      const connectedCount = room.players.filter(p => p.isConnected && !p.isBot).length;
      // Empty room (0 connected human players) expires after 5 min
      if (connectedCount === 0 && (now - room.lastActivityAt > EMPTY_ROOM_EXPIRY_MS)) {
        this.rooms.delete(code);
        continue;
      }
      // Idle room expires after 30 min
      if (now - room.lastActivityAt > IDLE_ROOM_EXPIRY_MS) {
        this.rooms.delete(code);
      }
    }
  }

  dispose() {
    if (this._cleanupTimer) {
      clearInterval(this._cleanupTimer);
    }
  }
}

export const deviceRooms = new DeviceRoomManager();
