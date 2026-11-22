/**
 * server/tournamentManager.js
 * 
 * Comprehensive tournament engine supporting:
 * 1. Knockout Tournament (Single elimination bracket: Semifinals -> Finals -> Champion)
 * 2. League Tournament (Round-robin fixtures, live points table, final standings)
 */

import { Match } from './gameState.js';
import { BingoBot } from './botPlayer.js';
import { economy } from './economy.js';

export class Tournament {
  /**
   * @param {string} id
   * @param {'KNOCKOUT' | 'LEAGUE'} type
   * @param {string} name
   * @param {string} creatorId
   * @param {string} creatorName
   */
  constructor(id, type, name, creatorId, creatorName) {
    this.id = id;
    this.type = type; // 'KNOCKOUT' | 'LEAGUE'
    this.name = name;
    this.creatorId = creatorId;
    this.status = 'REGISTERING'; // 'REGISTERING' | 'IN_PROGRESS' | 'COMPLETED'
    this.maxParticipants = 4;
    this.participants = [
      { id: creatorId, name: creatorName, isBot: false }
    ];
    this.champion = null;

    // Knockout bracket structure
    this.knockoutMatches = [];
    // League fixtures & points table
    this.leagueFixtures = [];
    this.pointsTable = [];
    this.currentMatchIndex = 0;
  }

  addParticipant(playerId, playerName) {
    if (this.status !== 'REGISTERING') {
      return { success: false, error: 'Tournament registration is closed' };
    }
    if (this.participants.length >= this.maxParticipants) {
      return { success: false, error: 'Tournament is full' };
    }
    if (this.participants.some(p => p.id === playerId)) {
      return { success: true, tournament: this.getSnapshot() };
    }

    this.participants.push({ id: playerId, name: playerName, isBot: false });
    return { success: true, tournament: this.getSnapshot() };
  }

  fillWithBots() {
    const botNames = ['CyberNeon', 'PixelStriker', 'QuantumBingo', 'AstroViper'];
    let nameIdx = 0;
    while (this.participants.length < this.maxParticipants) {
      const botId = `bot-${Date.now()}-${this.participants.length}`;
      const name = botNames[nameIdx % botNames.length];
      nameIdx++;
      this.participants.push({ id: botId, name: `${name} (AI)`, isBot: true });
    }
    return this.getSnapshot();
  }

  startTournament() {
    if (this.participants.length < this.maxParticipants) {
      this.fillWithBots();
    }

    this.status = 'IN_PROGRESS';

    if (this.type === 'KNOCKOUT') {
      this._initKnockout();
    } else {
      this._initLeague();
    }

    return this.getSnapshot();
  }

  _initKnockout() {
    const [p0, p1, p2, p3] = this.participants;
    this.knockoutMatches = [
      {
        id: `ko-sf1-${this.id}`,
        round: 'Semifinal 1',
        player1: { id: p0.id, name: p0.name },
        player2: { id: p1.id, name: p1.name },
        winner: null,
        status: 'READY'
      },
      {
        id: `ko-sf2-${this.id}`,
        round: 'Semifinal 2',
        player1: { id: p2.id, name: p2.name },
        player2: { id: p3.id, name: p3.name },
        winner: null,
        status: 'READY'
      },
      {
        id: `ko-final-${this.id}`,
        round: 'Grand Final',
        player1: null,
        player2: null,
        winner: null,
        status: 'WAITING'
      }
    ];
  }

  _initLeague() {
    this.pointsTable = this.participants.map(p => ({
      id: p.id,
      name: p.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0
    }));

    const p = this.participants;
    this.leagueFixtures = [
      { id: `fix-1-${this.id}`, p1: p[0], p2: p[1], winner: null, status: 'READY' },
      { id: `fix-2-${this.id}`, p1: p[2], p2: p[3], winner: null, status: 'WAITING' },
      { id: `fix-3-${this.id}`, p1: p[0], p2: p[2], winner: null, status: 'WAITING' },
      { id: `fix-4-${this.id}`, p1: p[1], p2: p[3], winner: null, status: 'WAITING' },
      { id: `fix-5-${this.id}`, p1: p[0], p2: p[3], winner: null, status: 'WAITING' },
      { id: `fix-6-${this.id}`, p1: p[1], p2: p[2], winner: null, status: 'WAITING' }
    ];
  }

  recordMatchResult(matchId, winnerId) {
    if (this.type === 'KNOCKOUT') {
      const sf1 = this.knockoutMatches[0];
      const sf2 = this.knockoutMatches[1];
      const finalMatch = this.knockoutMatches[2];

      if (sf1.id === matchId) {
        sf1.winner = sf1.player1.id === winnerId ? sf1.player1 : sf1.player2;
        sf1.status = 'COMPLETED';
        finalMatch.player1 = sf1.winner;
      } else if (sf2.id === matchId) {
        sf2.winner = sf2.player1.id === winnerId ? sf2.player1 : sf2.player2;
        sf2.status = 'COMPLETED';
        finalMatch.player2 = sf2.winner;
      } else if (finalMatch.id === matchId) {
        finalMatch.winner = finalMatch.player1.id === winnerId ? finalMatch.player1 : finalMatch.player2;
        finalMatch.status = 'COMPLETED';
        this.champion = finalMatch.winner;
        this.status = 'COMPLETED';
        // Award prize
        if (!this.champion.id.startsWith('bot-')) {
          economy.awardTournamentWin(this.champion.id, 500, 'Knockout');
        }
      }

      if (finalMatch.player1 && finalMatch.player2 && finalMatch.status === 'WAITING') {
        finalMatch.status = 'READY';
      }
    } else {
      // League
      const fix = this.leagueFixtures.find(f => f.id === matchId);
      if (fix && !fix.winner) {
        const winner = fix.p1.id === winnerId ? fix.p1 : fix.p2;
        const loser = fix.p1.id === winnerId ? fix.p2 : fix.p1;
        fix.winner = winner;
        fix.status = 'COMPLETED';

        const winRow = this.pointsTable.find(r => r.id === winner.id);
        const loseRow = this.pointsTable.find(r => r.id === loser.id);
        if (winRow) {
          winRow.played += 1;
          winRow.won += 1;
          winRow.points += 3;
        }
        if (loseRow) {
          loseRow.played += 1;
          loseRow.lost += 1;
        }

        // Sort points table
        this.pointsTable.sort((a, b) => b.points - a.points || b.won - a.won);

        // Next fixture
        const nextFix = this.leagueFixtures.find(f => f.status === 'WAITING');
        if (nextFix) {
          nextFix.status = 'READY';
        } else {
          // All fixtures completed
          this.status = 'COMPLETED';
          this.champion = this.pointsTable[0];
          if (this.champion && !this.champion.id.startsWith('bot-')) {
            economy.awardTournamentWin(this.champion.id, 600, 'League');
          }
        }
      }
    }

    return this.getSnapshot();
  }

  getSnapshot() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      status: this.status,
      participants: this.participants,
      champion: this.champion,
      knockoutMatches: this.knockoutMatches,
      leagueFixtures: this.leagueFixtures,
      pointsTable: this.pointsTable
    };
  }
}

export class TournamentManager {
  constructor() {
    /** @type {Map<string, Tournament>} */
    this.tournaments = new Map();
  }

  createTournament(type, name, creatorId, creatorName) {
    const id = `tourn-${Date.now().toString(36)}`;
    const tourn = new Tournament(id, type, name, creatorId, creatorName);
    this.tournaments.set(id, tourn);
    return tourn;
  }

  getTournament(id) {
    return this.tournaments.get(id) || null;
  }

  listTournaments() {
    return Array.from(this.tournaments.values()).map(t => t.getSnapshot());
  }
}

export const tournamentManager = new TournamentManager();
