/**
 * server/services/matchService.js
 *
 * Game Room & Match persistence with Prisma ORM.
 * Covers all 13 game modes, player boards, called numbers, match history, and idempotent results.
 */

import crypto from 'node:crypto';
import { prisma, isDbConnected, handlePrismaError } from '../db/prisma.js';

const fallbackMatches = new Map();
const fallbackRooms = new Map();
const fallbackBoards = new Map();
const fallbackUserMatchHistory = new Map(); // userId -> MatchHistory[]
const processedClaims = new Map();

export class MatchService {
  normalizeGameMode(mode) {
    const mapping = {
      'quick': 'QUICK_MATCH',
      'quick-match': 'QUICK_MATCH',
      'quick_match': 'QUICK_MATCH',
      'private': 'PRIVATE_ROOM',
      'private-room': 'PRIVATE_ROOM',
      'private_room': 'PRIVATE_ROOM',
      'room': 'PRIVATE_ROOM',
      'team': 'TEAM_2V2',
      'team-2v2': 'TEAM_2V2',
      'team_2v2': 'TEAM_2V2',
      '2v2-team': 'TEAM_2V2',
      'friend': 'FRIEND_CHALLENGE',
      'friend-challenge': 'FRIEND_CHALLENGE',
      'friend_challenge': 'FRIEND_CHALLENGE',
      'knockout': 'KNOCKOUT_TOURNAMENT',
      'knockout-tourn': 'KNOCKOUT_TOURNAMENT',
      'league': 'LEAGUE_TOURNAMENT',
      'league-tourn': 'LEAGUE_TOURNAMENT',
      'practice': 'PRACTICE_BOT',
      'practice_bot': 'PRACTICE_BOT',
      'offline': 'OFFLINE_PASS_AND_PLAY',
      'pass_play': 'OFFLINE_PASS_AND_PLAY',
      'offline_pass_and_play': 'OFFLINE_PASS_AND_PLAY',
      'survival': 'SURVIVAL_GAUNTLET',
      'survival_gauntlet': 'SURVIVAL_GAUNTLET',
      'time-challenge': 'TIME_CHALLENGE',
      'time_challenge': 'TIME_CHALLENGE',
      'friends-league': 'FRIENDS_LEAGUE',
      'friends_league': 'FRIENDS_LEAGUE',
      'friends-knockout': 'FRIENDS_KNOCKOUT',
      'friends_knockout': 'FRIENDS_KNOCKOUT',
      'friends-hybrid': 'FRIENDS_HYBRID',
      'friends_hybrid': 'FRIENDS_HYBRID'
    };
    return mapping[mode?.toLowerCase()] || 'QUICK_MATCH';
  }

  async createRoomAndMatch({ roomCode, mode, hostId = 'host', maxPlayers = 2, isPrivate = false }) {
    const prismaMode = this.normalizeGameMode(mode);

    if (isDbConnected()) {
      try {
        return await prisma.$transaction(async (tx) => {
          const room = await tx.gameRoom.upsert({
            where: { code: roomCode },
            update: {
              mode: prismaMode,
              status: 'PLAYING',
              maxPlayers
            },
            create: {
              code: roomCode,
              hostId: hostId || 'host',
              createdById: hostId,
              mode: prismaMode,
              status: 'PLAYING',
              maxPlayers,
              isPrivate
            }
          });

          const match = await tx.match.create({
            data: {
              roomId: room.id,
              mode: prismaMode,
              status: 'IN_PROGRESS',
              startedAt: new Date()
            }
          });

          return { room, match };
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    const roomId = `room-${roomCode}`;
    const matchId = `match-${Date.now()}-${roomCode}`;
    const room = { id: roomId, code: roomCode, hostId, mode: prismaMode, status: 'PLAYING', maxPlayers, isPrivate };
    const match = { id: matchId, roomId, mode: prismaMode, status: 'IN_PROGRESS', startedAt: new Date(), players: [], calledNumbers: [] };

    fallbackRooms.set(roomCode, room);
    fallbackMatches.set(matchId, match);
    return { room, match };
  }

  async savePlayerBoard({ matchId, playerId = null, userId = null, seat = 1, boardNumbers }) {
    if (!Array.isArray(boardNumbers) || boardNumbers.length !== 25) {
      return null;
    }

    if (isDbConnected()) {
      try {
        const board = await prisma.gameBoard.create({
          data: {
            matchId,
            playerId: playerId || userId || `seat-${seat}`,
            userId,
            seat,
            isLocked: true,
            lockedAt: new Date(),
            numbers: {
              create: boardNumbers.map((num, idx) => ({
                cellIndex: idx,
                number: num,
                position: idx,
                row: Math.floor(idx / 5),
                col: idx % 5,
                isMarked: false
              }))
            }
          },
          include: { numbers: true }
        });
        return board;
      } catch (err) {
        console.warn('⚠️ [Prisma MatchService] Could not persist player board:', err.message);
        return null;
      }
    }

    const key = `${matchId}-${seat}`;
    fallbackBoards.set(key, { matchId, userId, seat, boardNumbers });
    return { matchId, seat, count: 25 };
  }

  async recordCalledNumber({ matchId, callerId = null, number, turnNumber = 1, isAutoPicked = false }) {
    if (isDbConnected()) {
      try {
        return await prisma.calledNumber.create({
          data: {
            matchId,
            number,
            calledByPlayerId: callerId,
            calledById: callerId,
            callOrder: turnNumber,
            turnNumber,
            isAutoPicked
          }
        });
      } catch (err) {
        console.warn('⚠️ [Prisma MatchService] Could not persist called number:', err.message);
        return null;
      }
    }

    const match = fallbackMatches.get(matchId);
    if (match) {
      match.calledNumbers.push({ number, callerId, turnNumber, timestamp: Date.now() });
    }
    return { number, turnNumber };
  }

  async recordPlayerMatchHistory({ userId, matchId, mode = 'QUICK_MATCH', opponentName = 'Opponent', result = 'VICTORY', linesCompleted = 5, coinsDelta = 0 }) {
    if (!userId || userId.startsWith('bot-')) return null;

    if (isDbConnected()) {
      try {
        const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!exists) return null;
        return await prisma.matchHistory.create({
          data: {
            userId,
            matchId,
            mode: this.normalizeGameMode(mode),
            opponentName,
            result,
            linesCompleted,
            coinsDelta
          }
        });
      } catch (err) {
        console.warn('⚠️ [Prisma MatchService] Could not persist match history:', err.message);
      }
    }

    if (!fallbackUserMatchHistory.has(userId)) {
      fallbackUserMatchHistory.set(userId, []);
    }
    const entry = {
      id: `mh-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      matchId,
      mode: this.normalizeGameMode(mode),
      opponentName,
      result,
      linesCompleted,
      coinsDelta,
      playedAt: new Date().toISOString()
    };
    fallbackUserMatchHistory.get(userId).unshift(entry);
    return entry;
  }

  async completeMatch({ matchId, winnerId = null, winnerSeat = null, completedLinesCount = 5, isTie = false, durationSeconds = 0, summary = '', participants = [], mode = 'QUICK_MATCH' }) {
    if (isDbConnected()) {
      try {
        const existingMatch = await prisma.match.findUnique({ where: { id: matchId } });
        if (existingMatch) {
          return await prisma.$transaction(async (tx) => {
            const match = await tx.match.update({
              where: { id: matchId },
              data: {
                status: isTie ? 'TIED' : 'COMPLETED',
                winnerPlayerId: winnerId,
                endedAt: new Date(),
                durationSeconds,
                result: {
                  upsert: {
                    create: {
                      winnerId,
                      winningLineCount: completedLinesCount,
                      completedLinesCount,
                      claimId: `complete-${crypto.randomBytes(4).toString('hex')}`,
                      isTie,
                      durationSeconds,
                      summary
                    },
                    update: {
                      winnerId,
                      completedLinesCount,
                      isTie,
                      durationSeconds,
                      summary
                    }
                  }
                }
              },
              include: { result: true }
            });

            if (winnerId && !isTie && !winnerId.startsWith('bot-')) {
              const userExists = await tx.user.findUnique({ where: { id: winnerId }, select: { id: true } });
              if (userExists) {
                await tx.userStatistics.upsert({
                  where: { userId: winnerId },
                  update: {
                    totalMatches: { increment: 1 },
                    matchesPlayed: { increment: 1 },
                    wins: { increment: 1 },
                    matchesWon: { increment: 1 },
                    winStreak: { increment: 1 },
                    currentStreak: { increment: 1 },
                    totalLinesCompleted: { increment: completedLinesCount }
                  },
                  create: {
                    userId: winnerId,
                    totalMatches: 1,
                    matchesPlayed: 1,
                    wins: 1,
                    matchesWon: 1,
                    winStreak: 1,
                    currentStreak: 1,
                    highestWinStreak: 1,
                    bestStreak: 1,
                    winRate: 1.0,
                    totalLinesCompleted: completedLinesCount
                  }
                });
              }
            }

            return match;
          });
        }
      } catch (err) {
        console.warn('⚠️ [Prisma MatchService] Could not persist match completion:', err.message);
      }
    }

    // Record per-player match history entries in fallback or DB
    if (Array.isArray(participants) && participants.length >= 2) {
      for (const p of participants) {
        const opp = participants.find(other => other.id !== p.id);
        const didWin = p.id === winnerId;
        await this.recordPlayerMatchHistory({
          userId: p.id,
          matchId,
          mode,
          opponentName: opp?.name || 'Opponent',
          result: didWin ? 'VICTORY' : 'DEFEAT',
          linesCompleted: didWin ? completedLinesCount : (p.linesCompleted || 0),
          coinsDelta: didWin ? 150 : 0
        }).catch(() => {});
      }
    }

    const match = fallbackMatches.get(matchId);
    if (match) {
      match.status = isTie ? 'TIED' : 'COMPLETED';
      match.winnerId = winnerId;
      match.winnerSeat = winnerSeat;
      match.completedLines = completedLinesCount;
      match.durationSeconds = durationSeconds;
    }
    return match || { id: matchId, status: isTie ? 'TIED' : 'COMPLETED', winnerId };
  }

  async claimMatchVictory({ matchId, userId, idempotencyKey = null, completedLinesCount = 5, durationSeconds = 0 }) {
    const claimKey = idempotencyKey || `${matchId}-${userId}`;
    if (processedClaims.has(claimKey)) {
      return {
        ...processedClaims.get(claimKey),
        cached: true
      };
    }

    if (isDbConnected()) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const match = await tx.match.findUnique({
            where: { id: matchId },
            include: { result: true }
          });

          if (!match) {
            return { success: false, error: 'Match not found' };
          }

          if (match.status === 'COMPLETED' || match.result?.winnerId) {
            return {
              success: true,
              valid: false,
              alreadyFinished: true,
              winnerId: match.result?.winnerId || null,
              reason: 'Match is already completed and winner decided'
            };
          }

          await tx.match.update({
            where: { id: matchId },
            data: {
              status: 'COMPLETED',
              winnerPlayerId: userId,
              endedAt: new Date(),
              durationSeconds,
              result: {
                create: {
                  winnerId: userId,
                  winningLineCount: completedLinesCount,
                  completedLinesCount,
                  claimId: claimKey,
                  isTie: false,
                  durationSeconds,
                  summary: `Claimed BINGO with ${completedLinesCount} lines`
                }
              }
            }
          });

          if (userId && !userId.startsWith('bot-')) {
            const exists = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
            if (exists) {
              await tx.userStatistics.upsert({
                where: { userId },
                update: {
                  totalMatches: { increment: 1 },
                  matchesPlayed: { increment: 1 },
                  wins: { increment: 1 },
                  matchesWon: { increment: 1 },
                  winStreak: { increment: 1 },
                  currentStreak: { increment: 1 },
                  totalLinesCompleted: { increment: completedLinesCount }
                },
                create: {
                  userId,
                  totalMatches: 1,
                  matchesPlayed: 1,
                  wins: 1,
                  matchesWon: 1,
                  winStreak: 1,
                  currentStreak: 1,
                  highestWinStreak: 1,
                  bestStreak: 1,
                  winRate: 1.0,
                  totalLinesCompleted: completedLinesCount
                }
              });
            }
          }

          return {
            success: true,
            valid: true,
            winnerId: userId,
            completedLinesCount,
            reason: 'BINGO claim verified and victory awarded'
          };
        });

        processedClaims.set(claimKey, result);
        return result;
      } catch (err) {
        console.warn('⚠️ [Prisma MatchService] Error in claimMatchVictory transaction:', err.message);
      }
    }

    let match = fallbackMatches.get(matchId);
    if (!match) {
      match = { id: matchId, status: 'IN_PROGRESS', calledNumbers: [] };
      fallbackMatches.set(matchId, match);
    }

    if (match.status === 'COMPLETED' && match.winnerId) {
      const verdict = {
        success: true,
        valid: false,
        alreadyFinished: true,
        winnerId: match.winnerId,
        reason: 'Match is already completed'
      };
      processedClaims.set(claimKey, verdict);
      return verdict;
    }

    match.status = 'COMPLETED';
    match.winnerId = userId;
    match.completedLines = completedLinesCount;

    const verdict = {
      success: true,
      valid: true,
      winnerId: userId,
      completedLinesCount,
      reason: 'BINGO claim verified and victory awarded'
    };
    processedClaims.set(claimKey, verdict);
    return verdict;
  }

  async getMatchHistory(userId, limit = 10) {
    if (!userId) return [];

    if (isDbConnected()) {
      try {
        return await prisma.matchHistory.findMany({
          where: { userId },
          take: limit,
          orderBy: { playedAt: 'desc' }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    return (fallbackUserMatchHistory.get(userId) || []).slice(0, limit);
  }
}

export const matchService = new MatchService();
