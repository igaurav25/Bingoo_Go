/**
 * server/roomManager.js
 * 
 * Manages custom private rooms, room codes, lobbies, and host permissions.
 */

import { Match } from './gameState.js';
import { BingoBot } from './botPlayer.js';

export class PrivateRoom {
  /**
   * @param {string} code
   * @param {string} hostId
   * @param {string} hostName
   */
  constructor(code, hostId, hostName) {
    this.code = code;
    this.hostId = hostId;
    this.status = 'LOBBY'; // 'LOBBY' | 'IN_MATCH' | 'FINISHED'
    this.players = [
      { id: hostId, name: hostName, isHost: true, isReady: false }
    ];
    this.match = null;
    this.bot = null;
  }

  addPlayer(playerId, playerName) {
    if (this.status !== 'LOBBY') {
      return { success: false, error: 'Match is already in progress in this room' };
    }
    if (this.players.length >= 2) {
      return { success: false, error: 'Room is already full (max 2 players)' };
    }
    if (this.players.some(p => p.id === playerId)) {
      return { success: true, room: this.getLobbySnapshot() };
    }

    this.players.push({ id: playerId, name: playerName, isHost: false, isReady: false });
    return { success: true, room: this.getLobbySnapshot() };
  }

  addBot() {
    if (this.players.length >= 2) {
      return { success: false, error: 'Room is already full' };
    }
    const bot = new BingoBot(`bot-${Date.now()}`, 'AI Bingo Bot');
    this.bot = bot;
    this.players.push({ id: bot.botId, name: bot.name, isHost: false, isReady: true, isBot: true });
    return { success: true, room: this.getLobbySnapshot() };
  }

  removePlayer(playerId) {
    const idx = this.players.findIndex(p => p.id === playerId);
    if (idx !== -1) {
      this.players.splice(idx, 1);
      if (this.bot && this.bot.botId === playerId) {
        this.bot = null;
      }
      // If host left, transfer host if someone else exists
      if (this.hostId === playerId && this.players.length > 0) {
        this.hostId = this.players[0].id;
        this.players[0].isHost = true;
      }
    }
    return { success: true, room: this.getLobbySnapshot() };
  }

  setPlayerReady(playerId, isReady = true) {
    const player = this.players.find(p => p.id === playerId);
    if (player) {
      player.isReady = isReady;
    }
    return this.getLobbySnapshot();
  }

  startMatch() {
    if (this.players.length < 2) {
      return { success: false, error: 'Need 2 players to start a match' };
    }
    const [p1, p2] = this.players;
    const matchId = `match-room-${this.code}`;
    this.match = new Match(matchId, p1.id, p2.id);
    this.status = 'IN_MATCH';

    // If p2 is a bot, lock bot arrangement automatically
    if (this.bot && p2.id === this.bot.botId) {
      this.match.setPlayerArrangement(this.bot.botId, this.bot.grid);
    }

    return {
      success: true,
      matchId,
      match: this.match,
      player1Id: p1.id,
      player2Id: p2.id
    };
  }

  getLobbySnapshot() {
    return {
      code: this.code,
      hostId: this.hostId,
      status: this.status,
      playerCount: this.players.length,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        isReady: p.isReady,
        isBot: !!p.isBot
      }))
    };
  }
}

export class RoomManager {
  constructor() {
    /** @type {Map<string, PrivateRoom>} */
    this.rooms = new Map();
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return this.rooms.has(code) ? this.generateRoomCode() : code;
  }

  createRoom(hostId, hostName) {
    const code = this.generateRoomCode();
    const room = new PrivateRoom(code, hostId, hostName);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.toUpperCase().trim()) || null;
  }
}

export const roomManager = new RoomManager();
