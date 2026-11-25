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
export const ROOM_ALPHABET = '23456789BCDFGHJKMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 5;
export const MAX_PLAYERS = 2;
export const DISCONNECT_GRACE_PERIOD_MS = 60 * 1000;
export const EMPTY_ROOM_EXPIRY_MS = 5 * 60 * 1000;
export const IDLE_ROOM_EXPIRY_MS = 30 * 60 * 1000;

/**
 * Generates a random 5-character room code from the alphabet.
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
 */
export function normalizeRoomCode(input) {
  if (!input || typeof input !== 'string') return '';
  return input.toUpperCase().trim().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '').slice(0, 5);
}

export class DeviceRoom {
  constructor(code, hostPlayerId, hostSessionToken, hostName, hostAvatar, settings = {}) {
    this.code = code;
    this.hostPlayerId = hostPlayerId;
    this.status = 'lobby'; // 'lobby' | 'arranging' | 'playing' | 'finished'
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();

    // Settings
    this.settings = {
      turnTimerSeconds: Number(settings.turnTimerSeconds) || 0, // 0 = Off, 20, 30, 45
      seriesTargetWins: Number(settings.seriesTargetWins) || 1, // 1 = single match, 2 = Best-of-3, 3 = Best-of-5
      disconnectRule: settings.disconnectRule || 'PAUSE_60S',
      timeoutRule: settings.timeoutRule || 'AUTO_PICK'
    };
    this.allowedPlayerIds = Array.isArray(settings.allowedPlayerIds) ? settings.allowedPlayerIds : null;

    // Series scores: playerId -> wins
    this.scores = {
      [hostPlayerId]: 0
    };

    // Players array
    this.players = [
      this._createPlayerRecord(hostPlayerId, hostSessionToken, hostName, hostAvatar, true)
    ];

    // Rematch & match state
    this.rematchRequests = new Set();
    this.lastStartingPlayerId = hostPlayerId;
    this.match = null;
    this.bot = null;
    this.victoryProcessed = false;
    this.winnerId = null;

    // Disconnect handling
    this.disconnectTimer = null;
    this.disconnectGraceDeadline = null;
    this.disconnectedPlayerId = null;
    this.pauseCounts = { [hostPlayerId]: 0 };

    // Turn timer
    this.turnTimerInterval = null;
    this.turnDeadline = null;

    // Event log & idempotency
    this.eventSeq = 0;
    this.eventLog = [];
    this.processedCmds = new Set();
  }

  appendEvent(type, payload = {}) {
    this.eventSeq++;
    const event = {
      seq: this.eventSeq,
      type,
      payload,
      timestamp: Date.now()
    };
    this.eventLog.push(event);
    if (this.eventLog.length > 500) {
      this.eventLog.shift();
    }
    return event;
  }

  isCmdDuplicate(cmdId) {
    if (!cmdId) return false;
    if (this.processedCmds.has(cmdId)) return true;
    this.processedCmds.add(cmdId);
    if (this.processedCmds.size > 1000) {
      const first = this.processedCmds.values().next().value;
      this.processedCmds.delete(first);
    }
    return false;
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
   * Direct player/bot insertion helper used by matchmaking, challenges & tournaments.
   */
  addPlayer(playerId, sessionToken, name, avatar, isBot = false, ws = null) {
    this.touch();
    const existing = this.findPlayerById(playerId);
    if (existing) {
      if (ws) existing.ws = ws;
      existing.isConnected = true;
      existing.sessionToken = sessionToken || existing.sessionToken;
      return existing;
    }
    if (this.players.length >= MAX_PLAYERS) return null;

    const record = this._createPlayerRecord(playerId, sessionToken, name, avatar, false);
    record.ws = ws;
    record.isBot = Boolean(isBot);
    if (isBot) {
      record.isReady = true;
      const botInstance = new BingoBot(playerId, record.name);
      record.botInstance = botInstance;
      this.bot = botInstance;
    }
    this.players.push(record);
    this.scores[playerId] = this.scores[playerId] || 0;
    this.pauseCounts[playerId] = this.pauseCounts[playerId] || 0;
    return record;
  }

  /**
   * Adds or reconnects a player to the room.
   */
  join(playerId, sessionToken, name, avatar, ws) {
    this.touch();

    // Reject outsiders on restricted tournament match rooms
    if (this.tournamentId && Array.isArray(this.allowedPlayerIds) && this.allowedPlayerIds.length > 0) {
      if (!this.allowedPlayerIds.includes(playerId)) {
        return {
          success: false,
          code: 'UNAUTHORIZED_PLAYER',
          error: 'Only the two assigned match participants may enter this tournament match room.'
        };
      }
    }

    // 1. Check reconnection by sessionToken OR matching seat playerId (for tournament pre-reserved seats)
    const existingByToken = this.findPlayerBySessionToken(sessionToken);
    const existingById = !existingByToken ? this.findPlayerById(playerId) : null;
    const existingSeat = existingByToken || (existingById && (this.tournamentId || !existingById.isConnected || existingById.sessionToken === `tourn-tok-${playerId}`) ? existingById : null);

    if (existingSeat) {
      const oldWs = existingSeat.ws;
      existingSeat.ws = ws;
      existingSeat.isConnected = true;
      existingSeat.lastSeenAt = Date.now();
      if (sessionToken) existingSeat.sessionToken = sessionToken;

      if (name) existingSeat.name = name.slice(0, 16);
      if (avatar) existingSeat.avatar = avatar;

      let wasPaused = false;
      if (this.disconnectedPlayerId === existingSeat.id) {
        this._cancelDisconnectGrace();
        wasPaused = true;
      }

      return {
        success: true,
        isReconnect: true,
        player: existingSeat,
        oldWs,
        wasPaused
      };
    }

    // 2. Reject new joins to rooms already in progress or finished
    if (this.status === 'playing' || this.status === 'arranging') {
      return {
        success: false,
        code: 'MATCH_ALREADY_STARTED',
        error: 'Match has already started in this room.'
      };
    }
    if (this.status === 'finished') {
      return {
        success: false,
        code: 'MATCH_FINISHED',
        error: 'This match has already finished.'
      };
    }

    // 3. Room capacity check
    if (this.players.length >= MAX_PLAYERS) {
      return { success: false, code: 'ROOM_FULL', error: 'Room is full (2/2 players).' };
    }

    // 4. New player joining
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

    const botPlayer = this.addPlayer(botId, botSession, `${name} (Bot)`, avatar, true, null);
    return { success: true, bot: botPlayer.botInstance };
  }

  /**
   * Handles player disconnection (socket close / drop).
   */
  handleDisconnect(playerId, onForfeit) {
    this.touch();
    const player = this.findPlayerById(playerId);
    if (!player) return { shouldPause: false };

    player.isConnected = false;
    player.ws = null;
    player.lastSeenAt = Date.now();

    if (this.status === 'lobby') {
      return { shouldPause: false };
    }

    if (this.status === 'arranging' || this.status === 'playing') {
      if (this.settings?.disconnectRule === 'FORFEIT') {
        const otherPlayer = this.players.find(p => p.id !== playerId);
        if (otherPlayer && onForfeit) {
          onForfeit(otherPlayer.id, 'Opponent disconnected (tournament FORFEIT rule).');
        }
        return { shouldPause: false };
      }
      const currentPauses = this.pauseCounts[playerId] || 0;
      if (currentPauses >= 2) {
        const otherPlayer = this.players.find(p => p.id !== playerId);
        if (otherPlayer && onForfeit) {
          onForfeit(otherPlayer.id, 'Opponent exceeded maximum disconnect pauses (forfeit).');
        }
        return { shouldPause: false };
      }

      this.pauseCounts[playerId] = currentPauses + 1;
      this.disconnectedPlayerId = playerId;
      this.disconnectGraceDeadline = Date.now() + DISCONNECT_GRACE_PERIOD_MS;

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
   */
  removePlayer(playerId) {
    this.touch();
    this._cancelDisconnectGrace();

    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      delete this.scores[playerId];

      if (this.hostPlayerId === playerId && this.players.length > 0) {
        this.hostPlayerId = this.players[0].id;
        this.players[0].isHost = true;
      }
    }
  }

  /**
   * Toggles ready state in lobby.
   */
  setReady(playerId, ready = null) {
    this.touch();
    const p = this.findPlayerById(playerId);
    if (p) {
      p.isReady = ready !== null ? Boolean(ready) : !p.isReady;
    }
    const allReady = this.players.length === MAX_PLAYERS && this.players.every(pl => pl.isReady);
    return { allReady };
  }

  /**
   * Advances room from lobby to arranging.
   */
  startArranging() {
    this.touch();
    if (this.players.length < MAX_PLAYERS) {
      return { error: 'Need 2 players in room before starting.' };
    }

    this.status = 'arranging';
    this.victoryProcessed = false;
    this.winnerId = null;
    this.rematchRequests.clear();

    this.players.forEach(p => {
      p.isBoardLocked = false;
      if (p.isBot && p.botInstance) {
        p.isBoardLocked = true;
      }
    });

    const [p1, p2] = this.players;
    const matchId = `match-${this.code}-${Date.now().toString(36)}`;
    this.matchId = matchId;

    const startingPlayerId = this.lastStartingPlayerId === p1.id ? p2.id : p1.id;
    this.lastStartingPlayerId = startingPlayerId;

    this.match = new Match(matchId, p1.id, p2.id, {
      claimRateLimitMs: 400
    });
    this.match.players[p1.id].name = p1.name;
    this.match.players[p2.id].name = p2.name;
    this.match.currentTurnPlayerId = startingPlayerId;

    for (const pl of this.players) {
      if (pl.isBot && pl.botInstance) {
        this.match.setPlayerArrangement(pl.id, pl.botInstance.grid);
      }
    }

    return { matchId, startingPlayerId };
  }

  /**
   * Sets board arrangement and locks it.
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
   * Request a rematch.
   */
  requestRematch(playerId) {
    this.touch();
    this.rematchRequests.add(playerId);
    if (this.players.some(p => p.isBot)) {
      this.players.filter(p => p.isBot).forEach(b => this.rematchRequests.add(b.id));
    }
    const rematchReady = this.players.length >= MAX_PLAYERS && this.players.every(p => this.rematchRequests.has(p.id));
    return { rematchReady };
  }

  /**
   * Generates public snapshot of the room (never leaks sessionToken or opponent grid).
   */
  getSnapshot(forPlayerId) {
    const isPaused = this.disconnectedPlayerId !== null;
    let matchSnapshot = null;
    if (this.match) {
      matchSnapshot = this.match.getSnapshot(forPlayerId);
    }

    return {
      code: this.code,
      matchId: this.matchId || `match-${this.code}`,
      tournamentId: this.tournamentId || null,
      tournamentMatchId: this.tournamentMatchId || null,
      eventSeq: this.eventSeq,
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
    this.createRateLimits = new Map();
    this.joinRateLimits = new Map();

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

  createRoom(hostPlayerId, hostSessionToken, hostName, hostAvatar, settings = {}) {
    const code = generateRoomCode((c) => this.rooms.has(c));
    const room = new DeviceRoom(code, hostPlayerId, hostSessionToken, hostName, hostAvatar, settings);
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
      if (connectedCount === 0 && (now - room.lastActivityAt > EMPTY_ROOM_EXPIRY_MS)) {
        this.rooms.delete(code);
        continue;
      }
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
