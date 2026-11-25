/**
 * server/services/tournamentService.js
 *
 * Persistent Tournament Service unifying the authoritative TournamentManager
 * simulation/bracket engine with PostgreSQL via Prisma ORM.
 * - Handles full tournament lifecycle: create, join, ready, leave, approve/reject,
 *   teams, kick, settings, cancel, start, match-room launch, authoritative result
 *   verification, walkovers, standings, brackets, results, notifications & audit logs.
 * - Never trusts unverified client match wins when a live server room exists.
 * - Persists state to Prisma whenever PostgreSQL is online.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma, isDbConnected, handlePrismaError } from '../db/prisma.js';
import { tournamentManager, Tournament } from '../tournamentManager.js';
import { deviceRooms } from '../roomManager.js';
import { economy } from '../economy.js';
import { walletService } from './walletService.js';
import { matchService } from './matchService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_STORE_FILE = path.resolve(__dirname, '..', '..', 'data', 'tournaments-store.json');
const IS_TEST_PROCESS = process.argv.some(a => a === '--test') || process.env.NODE_ENV === 'test';

const VALID_FORMATS = ['KNOCKOUT', 'LEAGUE', 'HYBRID', 'TEAM_LEAGUE'];

function toOptionalDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeFormat(format) {
  const upper = String(format || 'KNOCKOUT').toUpperCase();
  if (VALID_FORMATS.includes(upper)) return upper;
  return 'KNOCKOUT';
}

function normalizeStatus(status) {
  const upper = String(status || 'REGISTERING').toUpperCase();
  if (['REGISTERING', 'IN_PROGRESS', 'PLAYOFFS', 'COMPLETED', 'CANCELLED'].includes(upper)) {
    return upper;
  }
  return 'REGISTERING';
}

export class TournamentService {
  constructor() {
    this._broadcaster = null;
    this._customStoreFile = process.env.TOURNAMENT_STORE_FILE || null;
    this._recordingLocks = new Set();
  }

  setBroadcaster(fn) {
    this._broadcaster = typeof fn === 'function' ? fn : null;
  }

  setStoreFilePath(filePath) {
    this._customStoreFile = filePath || null;
  }

  _getStoreFile() {
    if (this._customStoreFile) return this._customStoreFile;
    if (process.env.TOURNAMENT_STORE_FILE) return process.env.TOURNAMENT_STORE_FILE;
    if (IS_TEST_PROCESS) return null;
    return DEFAULT_STORE_FILE;
  }

  _saveDiskSnapshot() {
    const storeFile = this._getStoreFile();
    if (!storeFile) return;
    try {
      const dir = path.dirname(storeFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const list = Array.from(tournamentManager.tournaments.values())
        .filter(t => t.status !== 'CANCELLED')
        .map(t => (typeof t.toSerializableState === 'function' ? t.toSerializableState() : t.getSnapshot()));
      const tmp = `${storeFile}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ savedAt: Date.now(), tournaments: list }, null, 2), 'utf8');
      fs.renameSync(tmp, storeFile);
    } catch (err) {
      console.warn('[TournamentService] Disk store write warning:', err?.message || err);
    }
  }

  _loadDiskSnapshot() {
    const storeFile = this._getStoreFile();
    if (!storeFile || !fs.existsSync(storeFile)) return 0;
    try {
      const raw = fs.readFileSync(storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.tournaments) ? parsed.tournaments : [];
      let restored = 0;
      for (const item of list) {
        const t = Tournament.fromSerializedState(item);
        if (t && t.id) {
          tournamentManager.tournaments.set(t.id, t);
          restored++;
        }
      }
      return restored;
    } catch (err) {
      console.warn('[TournamentService] Disk store load warning:', err?.message || err);
      return 0;
    }
  }

  async hydrateFromStorage() {
    if (isDbConnected()) {
      const dbCount = await this.hydrateFromDatabase();
      if (dbCount > 0) return dbCount;
    }
    return this._loadDiskSnapshot();
  }

  async setParticipantOnline(tournamentId, playerId, isOnline = true) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return false;
    const changed = tourn.setParticipantOnline(playerId, isOnline);
    if (changed) {
      this._saveDiskSnapshot();
      this._emitUpdate(tourn);
    }
    return changed;
  }

  _emitUpdate(tourn) {
    if (!this._broadcaster || !tourn) return;
    try {
      const snap = typeof tourn.getSnapshot === 'function' ? tourn.getSnapshot() : tourn;
      this._broadcaster(snap);
    } catch {
      // Non-blocking broadcast hook
    }
  }

  /**
   * Resolves a userId against the PostgreSQL User table so nullable FK columns
   * never throw P2003 for ephemeral guest/bot/test IDs.
   */
  async _resolveDbUserId(userId) {
    if (!isDbConnected() || !userId || String(userId).startsWith('bot-')) return null;
    try {
      const user = await prisma.user.findUnique({
        where: { id: String(userId) },
        select: { id: true }
      });
      return user ? user.id : null;
    } catch {
      return null;
    }
  }

  /**
   * Synchronizes a live Tournament snapshot into PostgreSQL when online.
   * Runs cleanly without crashing offline fallback execution.
   */
  async _persistTournament(tourn, options = {}) {
    if (!tourn) return;
    const { rethrow = false } = options;
    if (!isDbConnected()) {
      this._saveDiskSnapshot();
      return;
    }

    const snap = typeof tourn.getSnapshot === 'function' ? tourn.getSnapshot() : tourn;
    const format = normalizeFormat(snap.type || snap.format);
    const status = normalizeStatus(snap.status);

    try {
      const dbCreatorId = await this._resolveDbUserId(snap.creatorId || snap.hostId);
      const startTime = toOptionalDate(snap.startTime);
      const registrationDeadline = toOptionalDate(snap.registrationDeadline);

      await prisma.$transaction(async (tx) => {
        await tx.tournament.upsert({
          where: { id: snap.id },
          create: {
            id: snap.id,
            code: snap.code || null,
            joinUrl: snap.joinUrl || (snap.code ? `/tournaments/join/${snap.code}` : null),
            lobbyCode: snap.code || null,
            disconnectRule: snap.disconnectRule || 'PAUSE_60S',
            timeoutRule: snap.timeoutRule || 'AUTO_PICK',
            drawRule: snap.drawRule || 'TIEBREAKER',
            abandonedRule: snap.abandonedRule || 'HOST_REVIEW',
            title: snap.name || snap.title || 'Bingo Tournament',
            season: snap.season || 'Season 01',
            logo: snap.logo || '🏆',
            description: snap.description || '',
            format,
            playoffFormat: snap.playoffFormat || (Number(snap.qualificationSlots) === 2 ? 'TOP2_FINAL' : 'IPL_TOP4'),
            status,
            visibility: snap.visibility || 'OPEN',
            approvalMode: snap.approvalMode || 'AUTOMATIC',
            scheduleMode: snap.scheduleMode || 'AUTOMATIC',
            isTeamLeague: Boolean(snap.isTeamLeague),
            rulesText: snap.rulesText || null,
            turnTimerSeconds: Number(snap.turnTimerSeconds || 30),
            startTime,
            registrationDeadline,
            creatorId: dbCreatorId,
            minParticipants: Number(snap.minParticipants || 2),
            maxParticipants: Number(snap.maxParticipants || snap.maxPlayers || 8),
            matchesPerPlayer: snap.matchesPerPlayer ? Number(snap.matchesPerPlayer) : null,
            pointsPerWin: Number(snap.pointsPerWin ?? 2),
            pointsPerLoss: Number(snap.pointsPerLoss ?? 0),
            qualificationSlots: Number(snap.qualificationSlots || 4),
            entryFee: Number(snap.entryFee || 0),
            prizePool: Number(snap.prizePool || 0),
            requireReadyToStart: Boolean(snap.requireReadyToStart),
            championId: snap.champion?.id || null
          },
          update: {
            title: snap.name || snap.title || 'Bingo Tournament',
            description: snap.description || '',
            format,
            playoffFormat: snap.playoffFormat || (Number(snap.qualificationSlots) === 2 ? 'TOP2_FINAL' : 'IPL_TOP4'),
            status,
            visibility: snap.visibility || 'OPEN',
            approvalMode: snap.approvalMode || 'AUTOMATIC',
            scheduleMode: snap.scheduleMode || 'AUTOMATIC',
            rulesText: snap.rulesText || null,
            turnTimerSeconds: Number(snap.turnTimerSeconds || 30),
            startTime,
            registrationDeadline,
            joinUrl: snap.joinUrl || (snap.code ? `/tournaments/join/${snap.code}` : null),
            lobbyCode: snap.code || null,
            disconnectRule: snap.disconnectRule || 'PAUSE_60S',
            timeoutRule: snap.timeoutRule || 'AUTO_PICK',
            drawRule: snap.drawRule || 'TIEBREAKER',
            abandonedRule: snap.abandonedRule || 'HOST_REVIEW',
            minParticipants: Number(snap.minParticipants || 2),
            maxParticipants: Number(snap.maxParticipants || snap.maxPlayers || 8),
            matchesPerPlayer: snap.matchesPerPlayer ? Number(snap.matchesPerPlayer) : null,
            pointsPerWin: Number(snap.pointsPerWin ?? 2),
            pointsPerLoss: Number(snap.pointsPerLoss ?? 0),
            qualificationSlots: Number(snap.qualificationSlots || 4),
            entryFee: Number(snap.entryFee || 0),
            prizePool: Number(snap.prizePool || 0),
            requireReadyToStart: Boolean(snap.requireReadyToStart),
            championId: snap.champion?.id || null
          }
        });

        // Sync TournamentLobby atomically
        if (snap.lobby || snap.code) {
          await tx.tournamentLobby.upsert({
            where: { tournamentId: snap.id },
            create: {
              id: snap.lobby?.id || `lobby-${snap.id}`,
              tournamentId: snap.id,
              roomCode: snap.lobby?.code || snap.code || snap.id,
              joinUrl: snap.lobby?.joinUrl || snap.joinUrl || null,
              status: snap.lobby?.status || 'OPEN',
              maxCapacity: Number(snap.maxParticipants || snap.maxPlayers || 8),
              onlineCount: Number(snap.onlineCount || 0)
            },
            update: {
              status: snap.lobby?.status || 'OPEN',
              maxCapacity: Number(snap.maxParticipants || snap.maxPlayers || 8),
              onlineCount: Number(snap.onlineCount || 0)
            }
          });
        }

        // Sync participants atomically (remove kicked/left rows & upsert current roster)
        if (Array.isArray(snap.participants)) {
          const activeIds = snap.participants.map(p => String(p.id));
          await tx.tournamentParticipant.deleteMany({
            where: {
              tournamentId: snap.id,
              tempPlayerId: { notIn: activeIds }
            }
          });
          for (const p of snap.participants) {
            const dbUserId = await this._resolveDbUserId(p.id);
            await tx.tournamentParticipant.upsert({
              where: {
                tournamentId_tempPlayerId: {
                  tournamentId: snap.id,
                  tempPlayerId: String(p.id)
                }
              },
              create: {
                tournamentId: snap.id,
                userId: dbUserId,
                tempPlayerId: String(p.id),
                name: p.name || 'Player',
                avatar: p.avatar || '🦊',
                teamName: p.teamName || p.teamId || null,
                isBot: Boolean(p.isBot),
                isReady: Boolean(p.isReady),
                isOnline: Boolean(p.isOnline),
                qualificationStatus: p.qualificationStatus || 'REGISTERED',
                seed: p.seed || null
              },
              update: {
                name: p.name || 'Player',
                avatar: p.avatar || '🦊',
                teamName: p.teamName || p.teamId || null,
                isReady: Boolean(p.isReady),
                isOnline: Boolean(p.isOnline),
                qualificationStatus: p.qualificationStatus || 'REGISTERED',
                seed: p.seed || null
              }
            });
          }
        }

        // Sync matches/fixtures, MatchParticipant & MatchResult atomically
        const allMatches = Array.isArray(snap.matches) ? snap.matches : [];
        for (let i = 0; i < allMatches.length; i++) {
          const m = allMatches[i];
          const p1 = m.player1 || m.p1 || m.slots?.[0];
          const p2 = m.player2 || m.p2 || m.slots?.[1];
          const scores = Array.isArray(m.scores) ? m.scores : [0, 0];
          const p1Id = p1?.playerId || p1?.id || null;
          const p2Id = p2?.playerId || p2?.id || null;
          await tx.tournamentMatch.upsert({
            where: { id: m.id },
            create: {
              id: m.id,
              tournamentId: snap.id,
              roundName: m.round || m.roundTitle || 'Round',
              roundKey: m.roundKey || null,
              roundTitle: m.roundTitle || null,
              matchIndex: Number(m.index ?? i),
              label: m.label || `Match ${i + 1}`,
              player1Id: p1Id,
              player2Id: p2Id,
              player1Score: Number(scores[0] || 0),
              player2Score: Number(scores[1] || 0),
              winnerId: m.winnerId || null,
              status: String(m.status || 'WAITING').toUpperCase(),
              advancesToMatchId: m.advancesTo?.matchId || null,
              advancesToSlot: m.advancesTo?.slot ?? null,
              roomCode: m.roomCode || null,
              isBye: Boolean(m.isBye)
            },
            update: {
              player1Id: p1Id,
              player2Id: p2Id,
              player1Score: Number(scores[0] || 0),
              player2Score: Number(scores[1] || 0),
              winnerId: m.winnerId || null,
              status: String(m.status || 'WAITING').toUpperCase(),
              roomCode: m.roomCode || null
            }
          });

          for (const [slotIdx, playerObj] of [[0, p1], [1, p2]]) {
            const mpId = playerObj?.playerId || playerObj?.id;
            if (!mpId) continue;
            await tx.matchParticipant.upsert({
              where: {
                tournamentMatchId_playerId: {
                  tournamentMatchId: m.id,
                  playerId: String(mpId)
                }
              },
              create: {
                tournamentMatchId: m.id,
                playerId: String(mpId),
                name: playerObj.playerName || playerObj.name || 'Player',
                avatar: playerObj.avatar || '🦊',
                seed: playerObj.seed || null,
                score: Number(scores[slotIdx] || 0),
                isWinner: Boolean(m.winnerId && m.winnerId === mpId),
                qualificationStatus: m.winnerId
                  ? (m.winnerId === mpId ? 'QUALIFIED' : 'ELIMINATED')
                  : 'ACTIVE'
              },
              update: {
                score: Number(scores[slotIdx] || 0),
                isWinner: Boolean(m.winnerId && m.winnerId === mpId),
                qualificationStatus: m.winnerId
                  ? (m.winnerId === mpId ? 'QUALIFIED' : 'ELIMINATED')
                  : 'ACTIVE'
              }
            });
          }

          if (String(m.status).toUpperCase() === 'COMPLETED' && m.winnerId) {
            await tx.matchResult.upsert({
              where: { tournamentMatchId: m.id },
              create: {
                tournamentMatchId: m.id,
                winnerId: String(m.winnerId),
                loserId: m.loserId || null,
                scoresJson: JSON.stringify(scores),
                winReason: m.isBye ? 'BYE' : (m.isWalkover ? 'WALKOVER' : 'BINGO_5_LINES'),
                verifiedByServer: true
              },
              update: {
                winnerId: String(m.winnerId),
                loserId: m.loserId || null,
                scoresJson: JSON.stringify(scores)
              }
            });
          }
        }

        // Sync explicit IPL LeagueFixture rows atomically
        const leagueRows = Array.isArray(snap.leagueFixtures) ? snap.leagueFixtures : [];
        if (leagueRows.length > 0) {
          const lfIds = leagueRows.map(m => String(m.id));
          await tx.leagueFixture.deleteMany({ where: { tournamentId: snap.id, id: { notIn: lfIds } } });
          for (let li = 0; li < leagueRows.length; li++) {
            const m = leagueRows[li];
            const p1 = m.player1 || m.p1 || m.slots?.[0];
            const p2 = m.player2 || m.p2 || m.slots?.[1];
            const scores = Array.isArray(m.scores) ? m.scores : [0, 0];
            const p1Id = p1?.playerId || p1?.id || null;
            const p2Id = p2?.playerId || p2?.id || null;
            await tx.leagueFixture.upsert({
              where: { id: m.id },
              create: {
                id: m.id,
                tournamentId: snap.id,
                roundNumber: Number(m.roundNumber || 1),
                roundName: m.round || m.roundTitle || 'League Stage',
                fixtureIndex: Number(m.index ?? li),
                player1Id: p1Id,
                player2Id: p2Id,
                player1Score: Number(scores[0] || 0),
                player2Score: Number(scores[1] || 0),
                winnerId: m.winnerId || null,
                status: String(m.status || 'WAITING').toUpperCase(),
                roomCode: m.roomCode || null
              },
              update: {
                player1Id: p1Id,
                player2Id: p2Id,
                player1Score: Number(scores[0] || 0),
                player2Score: Number(scores[1] || 0),
                winnerId: m.winnerId || null,
                status: String(m.status || 'WAITING').toUpperCase(),
                roomCode: m.roomCode || null
              }
            });
          }
        }

        // Sync explicit IPL PlayoffFixture rows atomically
        const playoffRows = Array.isArray(snap.playoffMatches) ? snap.playoffMatches : [];
        if (playoffRows.length > 0) {
          const pfIds = playoffRows.map(m => String(m.id));
          await tx.playoffFixture.deleteMany({ where: { tournamentId: snap.id, id: { notIn: pfIds } } });
          for (let pi = 0; pi < playoffRows.length; pi++) {
            const m = playoffRows[pi];
            const p1 = m.player1 || m.p1 || m.slots?.[0];
            const p2 = m.player2 || m.p2 || m.slots?.[1];
            const scores = Array.isArray(m.scores) ? m.scores : [0, 0];
            const p1Id = p1?.playerId || p1?.id || null;
            const p2Id = p2?.playerId || p2?.id || null;
            await tx.playoffFixture.upsert({
              where: { id: m.id },
              create: {
                id: m.id,
                tournamentId: snap.id,
                playoffStage: String(m.playoffStage || m.roundKey || 'FINAL').toUpperCase(),
                roundName: m.round || m.roundTitle || 'Playoffs',
                fixtureIndex: Number(m.index ?? pi),
                player1Id: p1Id,
                player2Id: p2Id,
                player1Score: Number(scores[0] || 0),
                player2Score: Number(scores[1] || 0),
                winnerId: m.winnerId || null,
                loserId: m.loserId || null,
                status: String(m.status || 'WAITING').toUpperCase(),
                winnerAdvancesToId: m.advancesTo?.matchId || null,
                winnerAdvancesSlot: m.advancesTo?.slot ?? null,
                loserAdvancesToId: m.loserAdvancesTo?.matchId || null,
                loserAdvancesSlot: m.loserAdvancesTo?.slot ?? null,
                roomCode: m.roomCode || null
              },
              update: {
                player1Id: p1Id,
                player2Id: p2Id,
                player1Score: Number(scores[0] || 0),
                player2Score: Number(scores[1] || 0),
                winnerId: m.winnerId || null,
                loserId: m.loserId || null,
                status: String(m.status || 'WAITING').toUpperCase(),
                roomCode: m.roomCode || null
              }
            });
          }
        }

        // Sync standings atomically
        if (Array.isArray(snap.standings) && snap.standings.length > 0) {
          await tx.tournamentStanding.deleteMany({ where: { tournamentId: snap.id } });
          await tx.tournamentStanding.createMany({
            data: snap.standings.map((row, idx) => {
              const played = Number(row.played || 0);
              const won = Number(row.won || row.wins || 0);
              const winRate = row.winRate || (played > 0 ? `${Math.round((won / played) * 100)}%` : '0%');
              return {
                tournamentId: snap.id,
                participantId: String(row.playerId || row.id || `row-${idx}`),
                name: row.name || row.teamName || 'Player',
                avatar: row.avatar || '🦊',
                played,
                won,
                lost: Number(row.lost || row.losses || 0),
                points: Number(row.points || 0),
                winRate: String(winRate),
                h2hSummary: String(row.h2hSummary || '-'),
                rank: idx + 1
              };
            })
          });
        }

        // Sync champion result & rewards atomically
        if (snap.status === 'COMPLETED' && snap.champion) {
          await tx.tournamentResult.upsert({
            where: { tournamentId: snap.id },
            create: {
              tournamentId: snap.id,
              championId: String(snap.champion.id || snap.champion.name),
              championName: snap.champion.name || 'Champion',
              runnerUpId: snap.runnerUp?.id || null,
              prizeAwarded: Number(snap.prizePool || 0)
            },
            update: {
              championId: String(snap.champion.id || snap.champion.name),
              championName: snap.champion.name || 'Champion',
              runnerUpId: snap.runnerUp?.id || null,
              prizeAwarded: Number(snap.prizePool || 0)
            }
          });
        }

        if (Array.isArray(snap.rewards)) {
          for (const r of snap.rewards) {
            await tx.tournamentReward.upsert({
              where: {
                tournamentId_recipientId_placement: {
                  tournamentId: snap.id,
                  recipientId: String(r.recipientId),
                  placement: Number(r.placement || 1)
                }
              },
              create: {
                id: r.id,
                tournamentId: snap.id,
                recipientId: String(r.recipientId),
                recipientName: r.recipientName || 'Winner',
                placement: Number(r.placement || 1),
                coinsAwarded: Number(r.coinsAwarded || 0),
                status: r.status || 'AWARDED'
              },
              update: {
                coinsAwarded: Number(r.coinsAwarded || 0),
                status: r.status || 'AWARDED'
              }
            });
          }
        }
      });
      this._saveDiskSnapshot();
    } catch (err) {
      console.warn('[TournamentService] DB sync warning:', err?.message || err);
      if (rethrow) {
        throw err;
      }
      this._saveDiskSnapshot();
    }
  }

  /**
   * Hydrates persisted tournaments from PostgreSQL into the active engine on startup.
   */
  async hydrateFromDatabase() {
    if (!isDbConnected()) return 0;
    try {
      const dbTournaments = await prisma.tournament.findMany({
        where: { status: { not: 'CANCELLED' } },
        include: {
          lobby: true,
          participants: { orderBy: { seed: 'asc' } },
          matches: { orderBy: { matchIndex: 'asc' } },
          leagueFixtures: { orderBy: { fixtureIndex: 'asc' } },
          playoffFixtures: { orderBy: { fixtureIndex: 'asc' } },
          standings: { orderBy: { rank: 'asc' } },
          result: true,
          rewards: { orderBy: { placement: 'asc' } },
          auditLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
          notifications: { orderBy: { createdAt: 'desc' }, take: 50 },
          invitations: true
        }
      });

      let hydrated = 0;
      for (const row of dbTournaments) {
        if (tournamentManager.tournaments.has(row.id)) continue;

        const tourn = new Tournament(
          row.id,
          row.format,
          row.title,
          row.creatorId || 'host-1',
          'Host',
          {
            code: row.code,
            joinUrl: row.joinUrl,
            season: row.season,
            logo: row.logo,
            description: row.description,
            visibility: row.visibility,
            approvalMode: row.approvalMode,
            scheduleMode: row.scheduleMode,
            isTeamLeague: row.isTeamLeague,
            rulesText: row.rulesText,
            turnTimerSeconds: row.turnTimerSeconds,
            startTime: row.startTime,
            registrationDeadline: row.registrationDeadline,
            minParticipants: row.minParticipants,
            maxParticipants: row.maxParticipants,
            matchesPerPlayer: row.matchesPerPlayer,
            requireReadyToStart: row.requireReadyToStart,
            disconnectRule: row.disconnectRule,
            timeoutRule: row.timeoutRule,
            drawRule: row.drawRule,
            abandonedRule: row.abandonedRule,
            pointsPerWin: row.pointsPerWin,
            pointsPerLoss: row.pointsPerLoss,
            qualificationSlots: row.qualificationSlots,
            playoffFormat: row.playoffFormat,
            entryFee: row.entryFee,
            prizePool: row.prizePool,
            rewards: row.rewards || []
          }
        );

        tourn.status = row.status;
        if (row.lobby) {
          tourn.lobby = {
            id: row.lobby.id,
            tournamentId: row.id,
            code: row.lobby.roomCode,
            joinUrl: row.lobby.joinUrl,
            status: row.lobby.status,
            maxCapacity: row.lobby.maxCapacity,
            onlinePlayerIds: []
          };
        }
        if (row.participants.length > 0) {
          tourn.participants = row.participants.map((p, idx) => ({
            id: p.tempPlayerId,
            name: p.name,
            avatar: p.avatar,
            teamName: p.teamName,
            isBot: p.isBot,
            isReady: p.isReady,
            isOnline: Boolean(p.isOnline),
            qualificationStatus: p.qualificationStatus || 'REGISTERED',
            seed: p.seed || idx + 1
          }));
        }

        if (row.matches.length > 0) {
          const pMap = new Map(tourn.participants.map(p => [p.id, p]));
          const mappedMatches = row.matches.map((m, idx) => {
            const p1 = m.player1Id ? (pMap.get(m.player1Id) || { id: m.player1Id, name: m.player1Id }) : null;
            const p2 = m.player2Id ? (pMap.get(m.player2Id) || { id: m.player2Id, name: m.player2Id }) : null;
            return {
              id: m.id,
              tournamentId: row.id,
              round: m.roundName,
              roundKey: m.roundKey || 'r1',
              roundTitle: m.roundTitle || m.roundName,
              index: m.matchIndex ?? idx,
              label: m.label || `Match ${idx + 1}`,
              player1: p1,
              player2: p2,
              slots: [
                { playerId: p1?.id || null, playerName: p1?.name || 'TBD' },
                { playerId: p2?.id || null, playerName: p2?.name || 'TBD' }
              ],
              scores: [m.player1Score || 0, m.player2Score || 0],
              winnerId: m.winnerId || null,
              winner: m.winnerId ? (pMap.get(m.winnerId) || { id: m.winnerId }) : null,
              status: m.status,
              roomCode: m.roomCode || null,
              isBye: m.isBye,
              advancesTo: m.advancesToMatchId
                ? { matchId: m.advancesToMatchId, slot: m.advancesToSlot || 0 }
                : null
            };
          });

          if (row.format === 'KNOCKOUT') {
            tourn.knockoutMatches = mappedMatches;
          } else if (row.format === 'HYBRID') {
            const pMap = new Map(tourn.participants.map(p => [p.id, p]));
            if (Array.isArray(row.leagueFixtures) && row.leagueFixtures.length > 0) {
              tourn.leagueFixtures = row.leagueFixtures.map((lf, idx) => {
                const p1 = lf.player1Id ? (pMap.get(lf.player1Id) || { id: lf.player1Id, name: lf.player1Id }) : null;
                const p2 = lf.player2Id ? (pMap.get(lf.player2Id) || { id: lf.player2Id, name: lf.player2Id }) : null;
                return {
                  id: lf.id,
                  tournamentId: row.id,
                  stage: 'LEAGUE',
                  roundNumber: lf.roundNumber || 1,
                  round: lf.roundName,
                  roundKey: `r${lf.roundNumber || 1}`,
                  roundTitle: lf.roundName,
                  index: lf.fixtureIndex ?? idx,
                  label: `Match ${idx + 1}`,
                  player1: p1,
                  player2: p2,
                  slots: [
                    { playerId: p1?.id || null, playerName: p1?.name || 'TBD' },
                    { playerId: p2?.id || null, playerName: p2?.name || 'TBD' }
                  ],
                  scores: [lf.player1Score || 0, lf.player2Score || 0],
                  winnerId: lf.winnerId || null,
                  winner: lf.winnerId ? (pMap.get(lf.winnerId) || { id: lf.winnerId }) : null,
                  status: lf.status,
                  roomCode: lf.roomCode || null
                };
              });
            } else {
              const isPlayoffMatch = (m) => ['q1', 'elim', 'q2', 'sf', 'final', 'fin'].includes(String(m.roundKey || '').toLowerCase())
                || String(m.round || '').toLowerCase().includes('qualifier')
                || String(m.round || '').toLowerCase().includes('eliminator');
              tourn.leagueFixtures = mappedMatches.filter(m => !isPlayoffMatch(m));
            }
            if (Array.isArray(row.playoffFixtures) && row.playoffFixtures.length > 0) {
              tourn.playoffMatches = row.playoffFixtures.map((pf, idx) => {
                const p1 = pf.player1Id ? (pMap.get(pf.player1Id) || { id: pf.player1Id, name: pf.player1Id }) : null;
                const p2 = pf.player2Id ? (pMap.get(pf.player2Id) || { id: pf.player2Id, name: pf.player2Id }) : null;
                const stageKeyMap = { QUALIFIER_1: 'q1', Q1: 'q1', ELIMINATOR: 'elim', ELIM: 'elim', QUALIFIER_2: 'q2', Q2: 'q2', GRAND_FINAL: 'fin', FINAL: 'fin', SEMIFINAL: 'sf', SF1: 'sf', SF2: 'sf' };
                return {
                  id: pf.id,
                  tournamentId: row.id,
                  stage: 'PLAYOFFS',
                  playoffStage: pf.playoffStage,
                  round: pf.roundName,
                  roundKey: stageKeyMap[String(pf.playoffStage || '').toUpperCase()] || 'fin',
                  roundTitle: pf.roundName,
                  index: pf.fixtureIndex ?? idx,
                  label: pf.roundName,
                  player1: p1,
                  player2: p2,
                  slots: [
                    { playerId: p1?.id || null, playerName: p1?.name || 'TBD' },
                    { playerId: p2?.id || null, playerName: p2?.name || 'TBD' }
                  ],
                  scores: [pf.player1Score || 0, pf.player2Score || 0],
                  winnerId: pf.winnerId || null,
                  loserId: pf.loserId || null,
                  winner: pf.winnerId ? (pMap.get(pf.winnerId) || { id: pf.winnerId }) : null,
                  status: pf.status,
                  roomCode: pf.roomCode || null,
                  advancesTo: pf.winnerAdvancesToId ? { matchId: pf.winnerAdvancesToId, slot: pf.winnerAdvancesSlot ?? 0 } : null,
                  loserAdvancesTo: pf.loserAdvancesToId ? { matchId: pf.loserAdvancesToId, slot: pf.loserAdvancesSlot ?? 0 } : null
                };
              });
            } else {
              const isPlayoffMatch = (m) => ['q1', 'elim', 'q2', 'sf', 'final', 'fin'].includes(String(m.roundKey || '').toLowerCase())
                || String(m.round || '').toLowerCase().includes('qualifier')
                || String(m.round || '').toLowerCase().includes('eliminator');
              tourn.playoffMatches = mappedMatches.filter(isPlayoffMatch);
            }
          } else {
            tourn.leagueFixtures = mappedMatches;
          }
        }

        if (row.standings.length > 0) {
          tourn.pointsTable = row.standings.map(s => ({
            playerId: s.participantId,
            id: s.participantId,
            name: s.name,
            avatar: s.avatar || '🦊',
            played: s.played,
            won: s.won,
            wins: s.won,
            lost: s.lost,
            losses: s.lost,
            points: s.points,
            winRate: s.winRate || '0%',
            h2hSummary: s.h2hSummary || '-'
          }));
        }

        if (row.result) {
          tourn.champion = { id: row.result.championId, name: row.result.championName };
          if (row.result.runnerUpId) {
            tourn.runnerUp = { id: row.result.runnerUpId };
          }
        }

        tournamentManager.tournaments.set(row.id, tourn);
        hydrated++;
      }

      // Ensure default cups exist in DB too if online
      for (const t of tournamentManager.tournaments.values()) {
        await this._persistTournament(t);
      }
      return hydrated;
    } catch (err) {
      console.warn('[TournamentService] Database hydration warning:', err?.message || err);
      return 0;
    }
  }

  /**
   * Creates a new tournament (compatible with both REST snapshots and direct Prisma tests).
   */
  async createTournament({
    title,
    name,
    description = '',
    format = 'KNOCKOUT',
    type,
    entryFee = 0,
    prizePool = 1000,
    maxParticipants,
    maxPlayers,
    createdById = null,
    creatorId,
    hostId,
    creatorName,
    hostName,
    userName,
    ...rest
  }) {
    const cleanTitle = String(title || name || 'Bingo Tournament').trim();
    const validFormat = normalizeFormat(format || type || 'KNOCKOUT');
    const cleanMax = Number(maxParticipants || maxPlayers) || 8;
    const cleanCreatorId = String(creatorId || createdById || hostId || 'host-1');
    const cleanCreatorName = String(creatorName || hostName || userName || 'Host');
    const cleanEntryFee = Math.max(0, Number(entryFee) || 0);
    const cleanPrizePool = Number(prizePool) || Math.max(1000, cleanEntryFee * cleanMax);

    const tourn = tournamentManager.createTournament(validFormat, cleanTitle, cleanCreatorId, cleanCreatorName, {
      ...rest,
      description,
      entryFee: cleanEntryFee,
      prizePool: cleanPrizePool,
      maxParticipants: cleanMax,
      maxPlayers: cleanMax
    });

    await this._persistTournament(tourn);

    const snap = tourn.getSnapshot();
    // Preserve uppercase format for direct Prisma service tests while keeping snapshot intact for UI
    return {
      ...snap,
      title: snap.name,
      format: validFormat
    };
  }

  /**
   * Creates a new tournament and returns the standardized lowercase-format UI snapshot
   * alongside an atomically persisted multiplayer lobby/room.
   */
  async createTournamentSnapshot(body = {}) {
    const rawFormat = body.format || body.type;
    if (rawFormat !== undefined && rawFormat !== null && String(rawFormat).trim() !== '') {
      const upperFormat = String(rawFormat).trim().toUpperCase();
      if (!VALID_FORMATS.includes(upperFormat)) {
        throw { status: 400, message: `Unsupported tournament format "${rawFormat}". Use HYBRID, KNOCKOUT, LEAGUE, or TEAM_LEAGUE.` };
      }
    }
    const validFormat = normalizeFormat(rawFormat || 'KNOCKOUT');

    const title = String(body.title || body.name || '').trim();
    if (title.length < 3) {
      throw { status: 400, message: 'Tournament name must be at least 3 characters.' };
    }

    const rawCreatorId = body.creatorId || body.userId || body.hostId;
    if (!rawCreatorId || String(rawCreatorId).trim() === '') {
      throw { status: 401, message: 'Host identity is required to create a tournament.' };
    }
    const creatorId = String(rawCreatorId).trim();
    const creatorName = String(body.creatorName || body.userName || body.hostName || 'Host').trim() || 'Host';

    const suppliedMax = body.maxParticipants ?? body.maxPlayers;
    const cleanMax = (suppliedMax !== undefined && suppliedMax !== null && suppliedMax !== '')
      ? Number(suppliedMax)
      : 8;
    if (!Number.isInteger(cleanMax) || cleanMax < 2 || cleanMax > 16) {
      throw { status: 400, message: 'Total player capacity must be an integer between 2 and 16.' };
    }

    const suppliedMin = body.minParticipants;
    const cleanMin = (suppliedMin !== undefined && suppliedMin !== null && suppliedMin !== '')
      ? Number(suppliedMin)
      : 2;
    if (!Number.isInteger(cleanMin) || cleanMin < 2) {
      throw { status: 400, message: 'Minimum participants must be at least 2.' };
    }
    if (cleanMin > cleanMax) {
      throw { status: 400, message: `Minimum participants (${cleanMin}) cannot exceed total players (${cleanMax}).` };
    }

    const rawEntryFee = (body.entryFee !== undefined && body.entryFee !== null && body.entryFee !== '')
      ? Number(body.entryFee)
      : 0;
    if (!Number.isFinite(rawEntryFee) || rawEntryFee < 0) {
      throw { status: 400, message: 'Entry fee must be 0 or a positive coin amount.' };
    }

    const rawPointsWin = (body.pointsPerWin ?? body.pointsWin);
    const pointsWin = (rawPointsWin !== undefined && rawPointsWin !== null && rawPointsWin !== '')
      ? Number(rawPointsWin)
      : 2;
    const rawPointsLoss = (body.pointsPerLoss ?? body.pointsLoss);
    const pointsLoss = (rawPointsLoss !== undefined && rawPointsLoss !== null && rawPointsLoss !== '')
      ? Number(rawPointsLoss)
      : 0;
    if (!Number.isFinite(pointsWin) || pointsWin < 0 || !Number.isFinite(pointsLoss) || pointsLoss < 0) {
      throw { status: 400, message: 'Points per win and loss cannot be negative.' };
    }

    const rawTimer = (body.turnTimerSeconds !== undefined && body.turnTimerSeconds !== null && body.turnTimerSeconds !== '')
      ? Number(body.turnTimerSeconds)
      : 30;
    if (!Number.isFinite(rawTimer) || rawTimer < 10 || rawTimer > 120) {
      throw { status: 400, message: 'Turn clock duration must be between 10 and 120 seconds.' };
    }

    if (body.registrationDeadline !== undefined && body.registrationDeadline !== null && String(body.registrationDeadline).trim() !== '') {
      if (Number.isNaN(new Date(body.registrationDeadline).getTime())) {
        throw { status: 400, message: 'Invalid registration deadline format.' };
      }
    }
    if (body.startTime !== undefined && body.startTime !== null && String(body.startTime).trim() !== '') {
      if (Number.isNaN(new Date(body.startTime).getTime())) {
        throw { status: 400, message: 'Invalid start time format.' };
      }
    }

    const qualSlots = (body.qualificationSlots !== undefined && body.qualificationSlots !== null && body.qualificationSlots !== '')
      ? Number(body.qualificationSlots)
      : 4;
    if (validFormat === 'HYBRID' && (!Number.isInteger(qualSlots) || qualSlots < 2 || qualSlots > cleanMax)) {
      throw { status: 400, message: `Playoff qualification slots (${qualSlots}) cannot exceed total players (${cleanMax}).` };
    }

    const rawMatchesPerPlayer = (body.matchesPerPlayer !== undefined && body.matchesPerPlayer !== null && body.matchesPerPlayer !== '')
      ? Number(body.matchesPerPlayer)
      : null;
    const byePolicy = body.byePolicy ? String(body.byePolicy).toUpperCase() : 'NONE';
    if (rawMatchesPerPlayer !== null && (validFormat === 'LEAGUE' || validFormat === 'HYBRID')) {
      if (!Number.isFinite(rawMatchesPerPlayer) || rawMatchesPerPlayer < 1 || rawMatchesPerPlayer > cleanMax - 1) {
        throw {
          status: 400,
          message: `With ${cleanMax} players, league matches per player must be between 1 and ${Math.max(1, cleanMax - 1)} so opponents are not repeated.`
        };
      }
      if (cleanMax % 2 === 1 && rawMatchesPerPlayer % 2 === 1 && byePolicy === 'NONE') {
        throw {
          status: 400,
          message: `An odd player count (${cleanMax}) cannot schedule ${rawMatchesPerPlayer} two-player matches each without a bye policy.`
        };
      }
    }

    const defaultLeagueMatches = validFormat === 'HYBRID'
      ? Math.min(5, Math.max(2, cleanMax - 1))
      : undefined;
    const playoffFormat = body.playoffFormat
      || (validFormat === 'HYBRID' ? (qualSlots === 2 ? 'TOP2_FINAL' : 'IPL_TOP4') : undefined);

    const tourn = tournamentManager.createTournament(validFormat, title, creatorId, creatorName, {
      ...body,
      entryFee: rawEntryFee,
      turnTimerSeconds: rawTimer,
      maxParticipants: cleanMax,
      maxPlayers: cleanMax,
      minParticipants: cleanMin,
      matchesPerPlayer: rawMatchesPerPlayer !== null ? rawMatchesPerPlayer : defaultLeagueMatches,
      pointsPerWin: pointsWin,
      pointsPerLoss: pointsLoss,
      qualificationSlots: qualSlots,
      playoffFormat,
      byePolicy
    });

    if (!tourn || !tourn.id || !tourn.lobby || !tourn.code || !tourn.participants.some(p => p.id === creatorId)) {
      if (tourn?.id) tournamentManager.tournaments.delete(tourn.id);
      throw { status: 500, message: 'Failed to initialize tournament lobby and host participant.' };
    }

    try {
      await this._persistTournament(tourn, { rethrow: true });
    } catch (persistErr) {
      tournamentManager.tournaments.delete(tourn.id);
      this._saveDiskSnapshot();
      throw {
        status: persistErr?.status || 500,
        message: persistErr?.message || 'Failed to persist tournament and multiplayer lobby atomically.'
      };
    }

    this._emitUpdate(tourn);
    return tourn.getSnapshot();
  }

  /**
   * Registers a participant cleanly (supports teamName for prismaBackend.test.js).
   */
  async registerParticipant(tournamentId, userId, teamName = null) {
    const tourn = tournamentManager.getTournament(tournamentId) || tournamentManager.getTournamentByCode(tournamentId);
    if (!tourn) {
      throw { status: 404, message: 'Tournament not found.' };
    }

    const playerName = teamName || String(userId || 'Challenger');
    const res = tourn.addParticipant(String(userId), playerName);
    if (!res.success) {
      throw { status: 400, message: res.error || 'Could not register participant.' };
    }

    const added = tourn.participants.find(p => p.id === String(userId));
    if (added && teamName) {
      added.teamName = teamName;
    }

    // Deduct entry fee via walletService if this is an authenticated DB/wallet user
    if (tourn.entryFee > 0 && userId && !String(userId).startsWith('bot-')) {
      try {
        await walletService.deductCoins(String(userId), tourn.entryFee, `Entry fee for ${tourn.name}`);
      } catch {
        // Non-blocking in fallback test mode unless insufficient balance in authenticated flow
      }
    }

    await this._persistTournament(tourn);
    return {
      id: `tp-${tourn.id}-${userId}`,
      tournamentId: tourn.id,
      userId,
      teamName: teamName || added?.teamName || 'Challenger',
      seed: added?.seed || tourn.participants.length
    };
  }

  /**
   * Joins a tournament by ID or tournament code with explicit error feedback.
   */
  async joinTournament({ tournamentId, code, playerId, userId, playerName, name, teamName, avatar }) {
    const cleanIdOrCode = tournamentId || code;
    const tourn = tournamentManager.getTournament(cleanIdOrCode) ||
      tournamentManager.getTournamentByCode(code || tournamentId);

    if (!tourn) {
      return { success: false, status: 404, error: 'Tournament not found. Check the tournament code and try again.' };
    }

    const pId = String(playerId || userId || '').trim();
    if (!pId) {
      return { success: false, status: 400, error: 'Player identity is required to join a tournament.' };
    }

    const pName = String(playerName || name || teamName || 'Player').trim();

    if (tourn.participants.some(p => p.id === pId)) {
      return {
        success: false,
        status: 409,
        alreadyJoined: true,
        error: 'You have already joined this tournament.',
        tournament: tourn.getSnapshot()
      };
    }

    if (tourn.entryFee > 0 && !pId.startsWith('bot-') && !pId.startsWith('guest-')) {
      try {
        const wallet = await walletService.getWallet(pId);
        if (wallet && wallet.balance < tourn.entryFee) {
          return {
            success: false,
            status: 400,
            error: `Insufficient coins. Entry fee requires ${tourn.entryFee} coins (you have ${wallet.balance}).`
          };
        }
      } catch {
        // Ignore if wallet lookup fails in offline fallback
      }
    }

    const res = tourn.addParticipant(pId, pName, { avatar });
    if (!res.success) {
      return {
        success: false,
        status: res.status || 400,
        alreadyJoined: Boolean(res.alreadyJoined),
        error: res.error,
        tournament: res.tournament
      };
    }

    const added = tourn.participants.find(p => p.id === pId);
    if (added && teamName) {
      added.teamName = teamName;
    }

    if (!res.pendingApproval && tourn.entryFee > 0 && !pId.startsWith('bot-')) {
      await walletService.deductCoins(pId, tourn.entryFee, `Tournament Entry: ${tourn.name}`).catch(() => {});
    }

    await this._persistTournament(tourn);
    this._emitUpdate(tourn);
    return {
      success: true,
      pendingApproval: Boolean(res.pendingApproval),
      message: res.message,
      tournament: tourn.getSnapshot()
    };
  }

  /**
   * Retrieves tournaments with optional status/code filter.
   * Accepts either string status (`getTournaments('REGISTERING')`) or `{ status, code }`.
   */
  async getTournaments(filter = null) {
    let status = null;
    let code = null;
    if (typeof filter === 'string') {
      status = filter;
    } else if (filter && typeof filter === 'object') {
      status = filter.status || null;
      code = filter.code || null;
    }

    if (code) {
      const found = tournamentManager.getTournamentByCode(code);
      return found ? [found.getSnapshot()] : [];
    }

    let list = tournamentManager.listTournaments();
    if (status) {
      const target = String(status).toUpperCase();
      list = list.filter(t => String(t.status).toUpperCase() === target);
    }
    return list;
  }

  getTournament(idOrCode) {
    const tourn = tournamentManager.getTournament(idOrCode) || tournamentManager.getTournamentByCode(idOrCode);
    return tourn ? tourn.getSnapshot() : null;
  }

  async setParticipantReady(tournamentId, playerId, isReady) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.setParticipantReady(playerId, isReady);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async leaveTournament(tournamentId, playerId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const wasRegistering = tourn.status === 'REGISTERING';
    const result = tourn.leaveTournament(playerId);
    if (result.success) {
      if (wasRegistering && tourn.entryFee > 0 && playerId && !String(playerId).startsWith('bot-')) {
        await walletService.awardCoins(playerId, tourn.entryFee, 'TOURNAMENT_REFUND', `Refunded leave: ${tourn.name}`).catch(() => {});
      }
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async startTournament(tournamentId, hostId = null) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };

    const check = tourn.canStart(hostId);
    if (!check.ok) {
      const isAuthErr = hostId && tourn.creatorId && !tourn.creatorId.startsWith('system-') && tourn.creatorId !== hostId;
      return { success: false, status: isAuthErr ? 403 : 400, error: check.error };
    }

    const snapshot = tourn.startTournament(hostId);
    await this._persistTournament(tourn);
    this._emitUpdate(tourn);
    return { success: true, tournament: snapshot };
  }

  async fillBotsAndStart(tournamentId, hostId = null) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };

    if (hostId && tourn.creatorId && !tourn.creatorId.startsWith('system-') && tourn.creatorId !== hostId) {
      return { success: false, status: 403, error: 'Only the tournament host can fill bots and start.' };
    }

    tourn.fillWithBots();
    const snapshot = tourn.startTournament(hostId);
    await this._persistTournament(tourn);
    this._emitUpdate(tourn);
    return { success: true, tournament: snapshot };
  }

  async kickParticipant(tournamentId, hostId, playerId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.kickParticipant(hostId, playerId);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async approveParticipant(tournamentId, hostId, playerId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.approveParticipant(hostId, playerId);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async rejectParticipant(tournamentId, hostId, playerId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.rejectParticipant(hostId, playerId);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async createTeam(tournamentId, hostId, teamData) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.createTeam(hostId, teamData);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async updateSettings(tournamentId, hostId, settings) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.updateSettings(hostId, settings);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  async cancelTournament(tournamentId, hostId, reason) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const result = tourn.cancelTournament(hostId, reason);
    if (result.success) {
      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
    }
    return result;
  }

  /**
   * Creates or attaches a real WebSocket DeviceRoom to a tournament fixture.
   */
  async startMatch(tournamentId, matchId, playerId = null) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };

    const match = tourn.getMatchById ? tourn.getMatchById(matchId) : null;
    if (!match) {
      return { success: false, status: 404, error: 'Tournament fixture not found.' };
    }
    if (match.status === 'COMPLETED') {
      return { success: false, status: 400, error: 'This tournament match has already finished.' };
    }

    const p1 = match.player1 || match.p1;
    const p2 = match.player2 || match.p2;
    if (playerId) {
      const isParticipant = p1?.id === playerId || p2?.id === playerId;
      const isHost = tourn.creatorId === playerId;
      if (!isParticipant && !isHost) {
        return {
          success: false,
          status: 403,
          error: 'Only assigned players or the tournament host can open this match room.'
        };
      }
    }

    const matchRes = tourn.createTournamentMatchRoom(matchId, deviceRooms);
    if (!matchRes.success) {
      return { success: false, status: 400, error: matchRes.error };
    }

    const opp = (p1 && p1.id === playerId) ? p2 : p1;
    const room = deviceRooms.getRoom(matchRes.roomCode);

    if (room && opp && (opp.isBot || (typeof opp.id === 'string' && opp.id.startsWith('bot-')))) {
      if (!room.findPlayerById(opp.id)) {
        room.addPlayer(opp.id, `bot-token-${opp.id}`, opp.name, '🤖', true);
      }
    }

    await this._persistTournament(tourn);
    this._emitUpdate(tourn);
    return {
      success: true,
      roomCode: matchRes.roomCode,
      tournamentId,
      matchId,
      tournament: tourn.getSnapshot()
    };
  }

  /**
   * Authoritatively verifies & records tournament match outcome.
   * Rejects spoofed wins if an active live DeviceRoom exists with a different or unfinished state,
   * and forbids overriding an already-completed match with a different winner.
   */
  async recordVerifiedMatchResult(tournamentId, { matchId, winnerId, scores = [5, 3] }) {
    const lockKey = `${tournamentId}:${matchId}`;
    if (this._recordingLocks.has(lockKey)) {
      return { success: true, alreadyRecorded: true, tournament: this.getTournament(tournamentId) };
    }
    this._recordingLocks.add(lockKey);
    try {
      const tourn = tournamentManager.getTournament(tournamentId);
      if (!tourn) {
        return { success: false, status: 404, error: 'Tournament not found' };
      }

      const match = tourn.getMatchById ? tourn.getMatchById(matchId) : null;
      if (!match) {
        return { success: false, status: 404, error: 'Match not found in tournament.' };
      }

      if (match.status === 'COMPLETED' && match.winnerId) {
        if (winnerId && winnerId !== match.winnerId) {
          return {
            success: false,
            status: 403,
            error: 'Completed match results are final and cannot be overridden.'
          };
        }
        return { success: true, alreadyRecorded: true, tournament: tourn.getSnapshot() };
      }

      let authoritativeWinnerId = winnerId;

      // Enforce live server-authoritative verification when a live game session exists in the room
      if (match.roomCode) {
        const room = deviceRooms.getRoom(match.roomCode);
        const hasLiveSession = room && (
          room.players.some(p => Boolean(p.ws)) ||
          room.status === 'arranging' ||
          room.status === 'playing' ||
          room.status === 'finished'
        );
        if (hasLiveSession) {
          if (room.status !== 'finished') {
            return {
              success: false,
              status: 403,
              error: 'Live tournament match is still in progress. Complete the Bingo game to declare a winner.'
            };
          }
          if (room.winnerId && winnerId && room.winnerId !== winnerId) {
            return {
              success: false,
              status: 403,
              error: 'Winner verification failed: claimed winner does not match authoritative match winner.'
            };
          }
          if (room.winnerId) {
            authoritativeWinnerId = room.winnerId;
          }
        }
      }

      if (!authoritativeWinnerId) {
        return { success: false, status: 400, error: 'Missing winnerId for match outcome.' };
      }

      const snapshot = tourn.recordMatchResult(matchId, authoritativeWinnerId, scores);

      // Award prize pool & log tournament championship history once when champion is crowned
      if (snapshot.status === 'COMPLETED' && snapshot.champion && !tourn._prizeAwarded) {
        tourn._prizeAwarded = true;
        const champId = snapshot.champion.id;
        const runnerUpId = snapshot.runnerUp?.id || null;
        if (champId && !String(champId).startsWith('bot-')) {
          if (snapshot.prizePool > 0) {
            economy.awardMatchWin(champId, snapshot.prizePool, `${snapshot.name} Champion`);
            await walletService.awardCoins(
              champId,
              snapshot.prizePool,
              'TOURNAMENT_CHAMPION',
              `Champion Prize: ${snapshot.name}`
            ).catch(() => {});
          }
          await matchService.recordPlayerMatchHistory({
            userId: champId,
            matchId: `tourn-win-${snapshot.id}`,
            opponentName: snapshot.runnerUp?.name || snapshot.name,
            mode: 'TOURNAMENT_CHAMPION',
            result: 'WIN',
            linesCompleted: 5,
            coinsDelta: snapshot.prizePool || 0,
            durationSeconds: Math.max(1, Math.round(((snapshot.completedAt || Date.now()) - (snapshot.startedAt || snapshot.createdAt || Date.now())) / 1000))
          }).catch(() => {});
        }
        if (runnerUpId && !String(runnerUpId).startsWith('bot-')) {
          await matchService.recordPlayerMatchHistory({
            userId: runnerUpId,
            matchId: `tourn-fin-${snapshot.id}`,
            opponentName: snapshot.champion.name || snapshot.name,
            mode: 'TOURNAMENT_FINALIST',
            result: 'LOSS',
            linesCompleted: Number(scores?.[1] || 0),
            coinsDelta: 0,
            durationSeconds: Math.max(1, Math.round(((snapshot.completedAt || Date.now()) - (snapshot.startedAt || snapshot.createdAt || Date.now())) / 1000))
          }).catch(() => {});
        }
      }

      await this._persistTournament(tourn);
      this._emitUpdate(tourn);
      return { success: true, tournament: snapshot };
    } finally {
      this._recordingLocks.delete(lockKey);
    }
  }

  async recordWalkover(tournamentId, { matchId, winnerId, reason = 'No-show walkover' }) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return { success: false, status: 404, error: 'Tournament not found' };
    const match = tourn.getMatchById ? tourn.getMatchById(matchId) : null;
    if (match && match.status === 'COMPLETED') {
      return { success: false, status: 403, error: 'Completed match results are final and cannot be overridden.' };
    }
    const snapshot = tourn.recordWalkover(matchId, winnerId, reason);
    await this._persistTournament(tourn);
    this._emitUpdate(tourn);
    return { success: true, tournament: snapshot };
  }

  sendInvitation(tournamentId, { senderId, senderName, receiverId, receiverName }) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return null;
    const inv = tourn.sendInvitation(senderId, senderName, receiverId, receiverName);
    this._persistTournament(tourn).catch(() => {});
    return inv;
  }

  getInvitations(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    return tourn ? (tourn.invitations || []) : null;
  }

  getNotifications(tournamentId, userId = null) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return null;
    let notifs = tourn.notifications || [];
    if (userId) {
      notifs = notifs.filter(n => n.recipientId === userId);
    }
    return notifs;
  }

  getAllNotifications(userId = null) {
    return tournamentManager.getAllNotifications(userId);
  }

  getAuditLog(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    return tourn ? (tourn.auditLog || []) : null;
  }

  getFixtures(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return null;
    const snap = tourn.getSnapshot();
    return snap.fixtures || snap.matches || [];
  }

  async getStandings(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (tourn) {
      return tourn.pointsTable || [];
    }
    if (isDbConnected()) {
      try {
        return await prisma.tournamentStanding.findMany({
          where: { tournamentId },
          orderBy: [{ points: 'desc' }, { won: 'desc' }]
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }
    return [];
  }

  getBracket(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return null;
    const snap = tourn.getSnapshot();
    const knockoutStage = (snap.stages || []).find(s => s.type === 'knockout') || snap.stages?.[0];
    return {
      rounds: knockoutStage?.rounds || [],
      matches: tourn.knockoutMatches?.length ? tourn.knockoutMatches : (tourn.playoffMatches || [])
    };
  }

  getResults(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return null;
    const snap = tourn.getSnapshot();
    return {
      status: snap.status,
      champion: snap.champion,
      runnerUp: snap.runnerUp,
      prizePool: snap.prizePool,
      startedAt: snap.startedAt,
      completedAt: snap.completedAt,
      standings: snap.standings || [],
      matches: snap.matches || []
    };
  }

  getTournamentHistory(userId = null) {
    const all = tournamentManager.listTournaments()
      .filter(t => t.status === 'COMPLETED');
    const filtered = userId
      ? all.filter(t => t.participants?.some(p => p.id === userId) || t.creatorId === userId)
      : all;
    return filtered.sort((a, b) => (b.completedAt || b.createdAt || 0) - (a.completedAt || a.createdAt || 0));
  }

  getRewards(tournamentId) {
    const tourn = tournamentManager.getTournament(tournamentId);
    if (!tourn) return null;
    return tourn.rewards || [];
  }
}

export const tournamentService = new TournamentService();
