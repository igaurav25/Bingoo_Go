/**
 * server/tournamentManager.js
 * 
 * Complete Tournament Engine supporting:
 * 1. Knockout Tournament (Single elimination: QF -> SF -> Final -> Champion)
 * 2. League Tournament (Round-robin fixtures, IPL-style points table, deterministic tie-breakers)
 * 3. Friends League Tournament (Host-configured even player count e.g. 4, 6, 8, 10, points per win/loss, Top 4 -> SF -> Final)
 * 4. Friends Knockout Tournament (Host-configured elimination bracket)
 * 5. Friends Hybrid Tournament (League stage -> Points table -> Top 4 Semifinals: 1v4, 2v3 -> Final -> Champion)
 */

import { economy } from './economy.js';

export class Tournament {
  /**
   * @param {string} id
   * @param {'KNOCKOUT' | 'LEAGUE' | 'HYBRID'} type
   * @param {string} name
   * @param {string} creatorId
   * @param {string} creatorName
   * @param {object} [config]
   */
  constructor(id, type, name, creatorId, creatorName, config = {}) {
    this.id = id;
    this.type = type; // 'KNOCKOUT' | 'LEAGUE' | 'HYBRID'
    this.name = name;
    this.creatorId = creatorId;
    this.status = 'REGISTERING'; // 'REGISTERING' | 'IN_PROGRESS' | 'PLAYOFFS' | 'COMPLETED'
    
    // Configurable settings (Section 4 & 5)
    this.maxParticipants = Number(config.maxParticipants) || 4;
    this.pointsPerWin = Number(config.pointsPerWin) || 2;
    this.pointsPerLoss = Number(config.pointsPerLoss) || 0;
    this.qualificationSlots = Number(config.qualificationSlots) || 4;

    this.participants = [
      { id: creatorId, name: creatorName, isBot: false }
    ];
    this.champion = null;

    // Knockout brackets
    this.knockoutMatches = [];
    // League fixtures & points table
    this.leagueFixtures = [];
    this.pointsTable = [];
    // Playoffs for Hybrid / League (Semifinals & Finals)
    this.playoffMatches = [];
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
    const botNames = ['CyberNeon', 'PixelStriker', 'QuantumBingo', 'AstroViper', 'ThunderBolt', 'ShadowRacer', 'BlazeHero', 'ViperKing'];
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
    } else if (this.type === 'LEAGUE') {
      this._initLeague();
    } else if (this.type === 'HYBRID') {
      this._initHybrid();
    }

    return this.getSnapshot();
  }

  _initKnockout() {
    this.knockoutMatches = [];
    const p = this.participants;

    if (p.length === 4) {
      // 4-player: 2 Semifinals + 1 Final
      this.knockoutMatches.push(
        { id: `ko-sf1-${this.id}`, round: 'Semifinal 1', player1: p[0], player2: p[1], winner: null, status: 'READY' },
        { id: `ko-sf2-${this.id}`, round: 'Semifinal 2', player1: p[2], player2: p[3], winner: null, status: 'READY' },
        { id: `ko-fin-${this.id}`, round: 'Grand Final', player1: null, player2: null, winner: null, status: 'WAITING' }
      );
    } else if (p.length >= 8) {
      // 8-player: 4 Quarterfinals + 2 Semifinals + 1 Final
      for (let i = 0; i < 4; i++) {
        this.knockoutMatches.push({
          id: `ko-qf${i+1}-${this.id}`,
          round: `Quarterfinal ${i+1}`,
          player1: p[i * 2],
          player2: p[i * 2 + 1],
          winner: null,
          status: 'READY'
        });
      }
      this.knockoutMatches.push(
        { id: `ko-sf1-${this.id}`, round: 'Semifinal 1', player1: null, player2: null, winner: null, status: 'WAITING' },
        { id: `ko-sf2-${this.id}`, round: 'Semifinal 2', player1: null, player2: null, winner: null, status: 'WAITING' },
        { id: `ko-fin-${this.id}`, round: 'Grand Final', player1: null, player2: null, winner: null, status: 'WAITING' }
      );
    } else {
      // 2-player or fallback
      this.knockoutMatches.push({
        id: `ko-fin-${this.id}`,
        round: 'Grand Final',
        player1: p[0],
        player2: p[1] || { id: 'bot-1', name: 'Bot' },
        winner: null,
        status: 'READY'
      });
    }
  }

  _initLeague() {
    this.pointsTable = this.participants.map(p => ({
      id: p.id,
      name: p.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      winRate: '0%'
    }));

    // Generate round-robin pairings
    this.leagueFixtures = [];
    const p = this.participants;
    let fixId = 1;
    for (let i = 0; i < p.length; i++) {
      for (let j = i + 1; j < p.length; j++) {
        this.leagueFixtures.push({
          id: `fix-${fixId++}-${this.id}`,
          p1: p[i],
          p2: p[j],
          winner: null,
          status: fixId === 2 ? 'READY' : 'WAITING'
        });
      }
    }
  }

  _initHybrid() {
    // 1. First stage: League stage
    this._initLeague();
    // 2. Playoff matches prepared for after league conclusion
    this.playoffMatches = [
      { id: `playoff-sf1-${this.id}`, round: 'Semifinal 1 (Rank 1 vs 4)', player1: null, player2: null, winner: null, status: 'WAITING' },
      { id: `playoff-sf2-${this.id}`, round: 'Semifinal 2 (Rank 2 vs 3)', player1: null, player2: null, winner: null, status: 'WAITING' },
      { id: `playoff-fin-${this.id}`, round: 'Grand Final', player1: null, player2: null, winner: null, status: 'WAITING' }
    ];
  }

  recordMatchResult(matchId, winnerId) {
    if (this.type === 'KNOCKOUT') {
      return this._recordKnockoutResult(matchId, winnerId);
    } else if (this.type === 'LEAGUE') {
      return this._recordLeagueResult(matchId, winnerId);
    } else if (this.type === 'HYBRID') {
      return this._recordHybridResult(matchId, winnerId);
    }
    return this.getSnapshot();
  }

  _recordKnockoutResult(matchId, winnerId) {
    const match = this.knockoutMatches.find(m => m.id === matchId);
    if (!match || match.status === 'COMPLETED') return this.getSnapshot();

    match.winner = match.player1.id === winnerId ? match.player1 : match.player2;
    match.status = 'COMPLETED';

    // Propagate winner
    if (this.knockoutMatches.length === 3) {
      // 4-player tournament (SF1, SF2, Final)
      const fin = this.knockoutMatches[2];
      if (match.id.includes('sf1')) fin.player1 = match.winner;
      if (match.id.includes('sf2')) fin.player2 = match.winner;

      if (fin.player1 && fin.player2 && fin.status === 'WAITING') {
        fin.status = 'READY';
      }
      if (match === fin) {
        this.champion = match.winner;
        this.status = 'COMPLETED';
        if (!this.champion.id.startsWith('bot-')) {
          economy.awardTournamentWin(this.champion.id, 500, 'Knockout');
        }
      }
    } else if (this.knockoutMatches.length >= 7) {
      // 8-player tournament (QF1..QF4, SF1, SF2, Final)
      const [qf1, qf2, qf3, qf4, sf1, sf2, fin] = this.knockoutMatches;
      if (match === qf1) sf1.player1 = match.winner;
      if (match === qf2) sf1.player2 = match.winner;
      if (match === qf3) sf2.player1 = match.winner;
      if (match === qf4) sf2.player2 = match.winner;

      if (sf1.player1 && sf1.player2 && sf1.status === 'WAITING') sf1.status = 'READY';
      if (sf2.player1 && sf2.player2 && sf2.status === 'WAITING') sf2.status = 'READY';

      if (match === sf1) fin.player1 = match.winner;
      if (match === sf2) fin.player2 = match.winner;

      if (fin.player1 && fin.player2 && fin.status === 'WAITING') fin.status = 'READY';

      if (match === fin) {
        this.champion = match.winner;
        this.status = 'COMPLETED';
        if (!this.champion.id.startsWith('bot-')) {
          economy.awardTournamentWin(this.champion.id, 800, 'Knockout');
        }
      }
    } else {
      this.champion = match.winner;
      this.status = 'COMPLETED';
    }

    return this.getSnapshot();
  }

  _recordLeagueResult(matchId, winnerId) {
    const fix = this.leagueFixtures.find(f => f.id === matchId);
    if (!fix || fix.status === 'COMPLETED') return this.getSnapshot();

    const winner = fix.p1.id === winnerId ? fix.p1 : fix.p2;
    const loser = fix.p1.id === winnerId ? fix.p2 : fix.p1;
    fix.winner = winner;
    fix.status = 'COMPLETED';

    const winRow = this.pointsTable.find(r => r.id === winner.id);
    const loseRow = this.pointsTable.find(r => r.id === loser.id);
    if (winRow) {
      winRow.played += 1;
      winRow.won += 1;
      winRow.points += this.pointsPerWin;
      winRow.winRate = `${Math.round((winRow.won / winRow.played) * 100)}%`;
    }
    if (loseRow) {
      loseRow.played += 1;
      loseRow.lost += 1;
      loseRow.points += this.pointsPerLoss;
      loseRow.winRate = `${Math.round((loseRow.won / loseRow.played) * 100)}%`;
    }

    // Deterministic Tie-Breaker: Points -> Wins
    this.pointsTable.sort((a, b) => b.points - a.points || b.won - a.won);

    // Next fixture
    const nextFix = this.leagueFixtures.find(f => f.status === 'WAITING');
    if (nextFix) {
      nextFix.status = 'READY';
    } else if (this.type !== 'HYBRID') {
      this.status = 'COMPLETED';
      this.champion = this.pointsTable[0];
      if (this.champion && !this.champion.id.startsWith('bot-')) {
        economy.awardTournamentWin(this.champion.id, 1000, 'League');
      }
    }

    return this.getSnapshot();
  }

  _recordHybridResult(matchId, winnerId) {
    // If in League stage:
    if (this.leagueFixtures.some(f => f.id === matchId)) {
      this._recordLeagueResult(matchId, winnerId);
      // Check if all league fixtures are complete:
      const allLeagueDone = this.leagueFixtures.every(f => f.status === 'COMPLETED');
      if (allLeagueDone) {
        this.status = 'PLAYOFFS';
        // Top 4 qualify: Rank 1 vs 4, Rank 2 vs 3
        const sf1 = this.playoffMatches[0];
        const sf2 = this.playoffMatches[1];
        sf1.player1 = this.pointsTable[0];
        sf1.player2 = this.pointsTable[3] || this.pointsTable[1];
        sf1.status = 'READY';

        sf2.player1 = this.pointsTable[1];
        sf2.player2 = this.pointsTable[2] || this.pointsTable[0];
        sf2.status = 'READY';
      }
      return this.getSnapshot();
    }

    // If in Playoff stage:
    const playoffMatch = this.playoffMatches.find(m => m.id === matchId);
    if (playoffMatch && playoffMatch.status !== 'COMPLETED') {
      playoffMatch.winner = playoffMatch.player1.id === winnerId ? playoffMatch.player1 : playoffMatch.player2;
      playoffMatch.status = 'COMPLETED';

      const sf1 = this.playoffMatches[0];
      const sf2 = this.playoffMatches[1];
      const fin = this.playoffMatches[2];

      if (sf1.winner && sf2.winner && fin.status === 'WAITING') {
        fin.player1 = sf1.winner;
        fin.player2 = sf2.winner;
        fin.status = 'READY';
      }

      if (playoffMatch === fin) {
        this.champion = fin.winner;
        this.status = 'COMPLETED';
        if (!this.champion.id.startsWith('bot-')) {
          economy.awardTournamentWin(this.champion.id, 1200, 'Hybrid');
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
      maxParticipants: this.maxParticipants,
      pointsPerWin: this.pointsPerWin,
      pointsPerLoss: this.pointsPerLoss,
      participants: this.participants,
      champion: this.champion,
      knockoutMatches: this.knockoutMatches,
      leagueFixtures: this.leagueFixtures,
      pointsTable: this.pointsTable,
      playoffMatches: this.playoffMatches
    };
  }
}

export class TournamentManager {
  constructor() {
    /** @type {Map<string, Tournament>} */
    this.tournaments = new Map();
  }

  createTournament(type, name, creatorId, creatorName, config = {}) {
    const id = `tourn-${Date.now().toString(36)}`;
    const tourn = new Tournament(id, type, name, creatorId, creatorName, config);
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
