/**
 * server/routes/apiRoutes.js
 *
 * RESTful HTTP API Router for BINGO Game.
 * Connects Web & Mobile clients to Prisma ORM backend services and authoritative
 * room/tournament managers.
 */

import { authService } from '../services/authService.js';
import { userService } from '../services/userService.js';
import { walletService } from '../services/walletService.js';
import { matchService } from '../services/matchService.js';
import { friendService } from '../services/friendService.js';
import { tournamentService } from '../services/tournamentService.js';
import { deviceRooms } from '../roomManager.js';
import { isDbConnected, checkDatabaseConnection } from '../db/prisma.js';

/**
 * Parses JSON body from incoming HTTP request.
 */
async function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        reject({ status: 413, message: 'Payload Too Large' });
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject({ status: 400, message: 'Invalid JSON payload' });
      }
    });
    req.on('error', err => reject({ status: 500, message: err.message }));
  });
}

/**
 * Sends a standardized JSON HTTP response.
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

/**
 * Extracts bearer token from Authorization header.
 */
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

/**
 * Resolves authenticated user from Authorization Bearer token if present.
 * Returns { user, invalidToken } so callers can reject tampered/expired Bearer tokens cleanly.
 */
async function resolveAuthContext(req) {
  const token = extractToken(req);
  if (!token) return { user: null, invalidToken: false };
  try {
    const user = await authService.verifySession(token);
    if (!user) return { user: null, invalidToken: true };
    return { user, invalidToken: false };
  } catch {
    return { user: null, invalidToken: true };
  }
}

async function resolveAuthUser(req) {
  const ctx = await resolveAuthContext(req);
  return ctx.user;
}

/**
 * Resolves and verifies tournament actor identity (rejecting invalid Bearer tokens or spoofed IDs).
 */
async function resolveTournamentActor(req, body = {}, idKeys = ['playerId', 'userId']) {
  const ctx = await resolveAuthContext(req);
  if (ctx.invalidToken) {
    return { error: 'Invalid or expired authentication token.', status: 401 };
  }
  const suppliedId = idKeys.map(k => body?.[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '');
  if (ctx.user && suppliedId && String(suppliedId) !== String(ctx.user.id)) {
    return { error: 'Authenticated user does not match supplied player identity.', status: 403 };
  }
  const actorId = ctx.user?.id || (suppliedId ? String(suppliedId).trim() : null);
  const actorName = body?.playerName || body?.name || body?.creatorName || body?.hostName || ctx.user?.username || null;
  return { actorId, actorName, authUser: ctx.user };
}

/**
 * Resolves and verifies hostId when host-only mutations are invoked.
 */
async function resolveHostActor(req, body) {
  const ctx = await resolveAuthContext(req);
  if (ctx.invalidToken) {
    return { error: 'Invalid or expired authentication token.', status: 401 };
  }
  if (ctx.user && body.hostId && body.hostId !== ctx.user.id) {
    return { error: 'Authenticated user does not match hostId.', status: 403 };
  }
  return { hostId: body.hostId || ctx.user?.id || null };
}

/**
 * Main API request handler. Returns true if request was handled, false otherwise.
 */
export async function handleApiRequest(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method.toUpperCase();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return true;
  }

  if (!pathname.startsWith('/api/')) {
    return false;
  }

  try {
    // ----------------------------------------------------
    // Database Health Check: /api/health/db
    // ----------------------------------------------------
    if (pathname === '/api/health/db' && method === 'GET') {
      const connected = await checkDatabaseConnection();
      sendJson(res, 200, {
        database: 'PostgreSQL',
        orm: 'Prisma 6.19.3',
        connected,
        status: connected ? 'online' : 'offline_fallback',
        timestamp: new Date().toISOString()
      });
      return true;
    }

    // ----------------------------------------------------
    // Auth Routes: /api/auth/*
    // ----------------------------------------------------
    if (pathname === '/api/auth/register' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await authService.register(body);
      sendJson(res, 201, { success: true, ...result });
      return true;
    }

    if (pathname === '/api/auth/login' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await authService.login(body);
      sendJson(res, 200, { success: true, ...result });
      return true;
    }

    if (pathname === '/api/auth/guest' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await authService.createGuestSession(body || {});
      sendJson(res, 201, { success: true, ...result });
      return true;
    }

    if (pathname === '/api/auth/me' && method === 'GET') {
      const token = extractToken(req) || urlObj.searchParams.get('token');
      const user = await authService.verifySession(token);
      if (!user) {
        sendJson(res, 401, { error: 'Unauthorized or expired session' });
        return true;
      }
      sendJson(res, 200, { success: true, user });
      return true;
    }

    if (pathname === '/api/auth/otp/request' && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await authService.requestOTP(body.identifier);
      sendJson(res, 200, { success: true, identifier: result.identifier, expiresAt: result.expiresAt });
      return true;
    }

    if (pathname === '/api/auth/otp/verify' && method === 'POST') {
      const body = await parseJsonBody(req);
      const verified = await authService.verifyOTP(body.identifier, body.code);
      if (!verified) {
        sendJson(res, 400, { success: false, message: 'Invalid or expired OTP code.' });
        return true;
      }
      sendJson(res, 200, { success: true, message: 'OTP verified successfully.' });
      return true;
    }

    // ----------------------------------------------------
    // User & Leaderboard Routes: /api/users/*
    // ----------------------------------------------------
    if (pathname === '/api/users/profile' && method === 'GET') {
      const authUser = await resolveAuthUser(req);
      const userId = urlObj.searchParams.get('id') || authUser?.id;
      if (!userId) {
        sendJson(res, 400, { error: 'Missing userId parameter' });
        return true;
      }
      const user = await userService.getUserById(userId);
      if (!user) {
        sendJson(res, 404, { error: 'User not found' });
        return true;
      }
      sendJson(res, 200, { success: true, user });
      return true;
    }

    if (pathname === '/api/users/profile' && method === 'PUT') {
      const authUser = await resolveAuthUser(req);
      const body = await parseJsonBody(req);
      const targetUserId = body.userId || authUser?.id;
      if (!targetUserId) {
        sendJson(res, 400, { error: 'Missing userId' });
        return true;
      }
      const updated = await userService.updateProfile(targetUserId, body);
      sendJson(res, 200, { success: true, profile: updated });
      return true;
    }

    if (pathname === '/api/users/directory' && method === 'GET') {
      const excludeUserId = urlObj.searchParams.get('excludeUserId') || null;
      const search = urlObj.searchParams.get('q') || '';
      const users = await userService.listUsersDirectory(excludeUserId, search);
      sendJson(res, 200, { success: true, users });
      return true;
    }

    if (pathname === '/api/users/leaderboard' && method === 'GET') {
      const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);
      const category = urlObj.searchParams.get('category') || 'wins';
      const leaderboard = await userService.getLeaderboard(limit, category);
      sendJson(res, 200, { success: true, category, leaderboard });
      return true;
    }

    // ----------------------------------------------------
    // Wallet & Economy Routes: /api/wallet/*
    // ----------------------------------------------------
    if (pathname === '/api/wallet/balance' && method === 'GET') {
      const authUser = await resolveAuthUser(req);
      const userId = urlObj.searchParams.get('userId') || authUser?.id;
      if (!userId) {
        sendJson(res, 400, { error: 'Missing userId parameter' });
        return true;
      }
      const wallet = await walletService.getWallet(userId);
      sendJson(res, 200, { success: true, wallet });
      return true;
    }

    if (pathname === '/api/wallet/transactions' && method === 'GET') {
      const authUser = await resolveAuthUser(req);
      const userId = urlObj.searchParams.get('userId') || authUser?.id;
      if (!userId) {
        sendJson(res, 400, { error: 'Missing userId parameter' });
        return true;
      }
      const limit = parseInt(urlObj.searchParams.get('limit') || '20', 10);
      const history = await walletService.getTransactionHistory(userId, limit);
      sendJson(res, 200, { success: true, transactions: history });
      return true;
    }

    // ----------------------------------------------------
    // Social & Friends Routes: /api/friends/*
    // ----------------------------------------------------
    if (pathname === '/api/friends/list' && method === 'GET') {
      const authUser = await resolveAuthUser(req);
      const userId = urlObj.searchParams.get('userId') || authUser?.id;
      const friends = userId ? await friendService.getFriends(userId) : [];
      sendJson(res, 200, { success: true, friends });
      return true;
    }

    if (pathname === '/api/friends/pending' && method === 'GET') {
      const authUser = await resolveAuthUser(req);
      const userId = urlObj.searchParams.get('userId') || authUser?.id;
      const requests = userId ? await friendService.getPendingRequests(userId) : [];
      sendJson(res, 200, { success: true, requests });
      return true;
    }

    if (pathname === '/api/friends/request' && method === 'POST') {
      const body = await parseJsonBody(req);
      const reqRecord = await friendService.sendFriendRequest(body.senderId, body.receiverId);
      sendJson(res, 201, { success: true, request: reqRecord });
      return true;
    }

    if (pathname === '/api/friends/respond' && method === 'POST') {
      const body = await parseJsonBody(req);
      const updated = await friendService.respondToFriendRequest(body.requestId, body.accept);
      sendJson(res, 200, { success: true, request: updated });
      return true;
    }

    // ----------------------------------------------------
    // Tournament Routes: /api/tournaments/*
    // ----------------------------------------------------
    if (pathname === '/api/tournaments' && method === 'GET') {
      const status = urlObj.searchParams.get('status');
      const code = urlObj.searchParams.get('code');
      const tournaments = await tournamentService.getTournaments({ status, code });
      sendJson(res, 200, { success: true, tournaments });
      return true;
    }

    if (pathname === '/api/tournaments' && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveTournamentActor(req, body, ['creatorId', 'userId', 'hostId']);
      if (actor.error) {
        sendJson(res, actor.status || 401, { success: false, error: actor.error });
        return true;
      }
      if (!actor.actorId) {
        sendJson(res, 401, {
          success: false,
          error: 'Authentication or valid host user identity is required to create a tournament.'
        });
        return true;
      }
      const payload = {
        ...body,
        creatorId: actor.actorId,
        creatorName: body.creatorName || body.userName || body.hostName || actor.actorName || 'Host'
      };
      const tournament = await tournamentService.createTournamentSnapshot(payload);
      if (!tournament || !tournament.id || (!tournament.room && !tournament.lobby)) {
        sendJson(res, 500, {
          success: false,
          error: 'Tournament creation did not produce a valid multiplayer lobby.'
        });
        return true;
      }
      sendJson(res, 201, {
        success: true,
        message: 'Tournament and multiplayer lobby created successfully.',
        tournament,
        room: tournament.room || tournament.lobby
      });
      return true;
    }

    if (pathname === '/api/tournaments/join' && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveTournamentActor(req, body, ['playerId', 'userId']);
      if (actor.error) {
        sendJson(res, actor.status || 401, { success: false, error: actor.error });
        return true;
      }
      if (!actor.actorId) {
        sendJson(res, 401, { success: false, error: 'Authentication required to join a tournament.' });
        return true;
      }
      const result = await tournamentService.joinTournament({
        tournamentId: body.tournamentId,
        code: body.code,
        playerId: actor.actorId,
        playerName: body.playerName || body.name || actor.actorName,
        avatar: body.avatar,
        teamName: body.teamName
      });
      if (!result.success) {
        sendJson(res, result.status || 400, {
          success: false,
          alreadyJoined: Boolean(result.alreadyJoined),
          error: result.error,
          tournament: result.tournament
        });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        pendingApproval: Boolean(result.pendingApproval),
        message: result.message,
        tournament: result.tournament
      });
      return true;
    }

    const tournJoinByIdMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/join$/);
    if (tournJoinByIdMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveTournamentActor(req, body, ['playerId', 'userId']);
      if (actor.error) {
        sendJson(res, actor.status || 401, { success: false, error: actor.error });
        return true;
      }
      if (!actor.actorId) {
        sendJson(res, 401, { success: false, error: 'Authentication required to join a tournament.' });
        return true;
      }
      const result = await tournamentService.joinTournament({
        tournamentId: tournJoinByIdMatch[1],
        code: body.code,
        playerId: actor.actorId,
        playerName: body.playerName || body.name || actor.actorName,
        avatar: body.avatar,
        teamName: body.teamName
      });
      if (!result.success) {
        sendJson(res, result.status || 400, {
          success: false,
          alreadyJoined: Boolean(result.alreadyJoined),
          error: result.error,
          tournament: result.tournament
        });
        return true;
      }
      sendJson(res, 200, {
        success: true,
        pendingApproval: Boolean(result.pendingApproval),
        message: result.message,
        tournament: result.tournament
      });
      return true;
    }

    if (pathname === '/api/tournaments/history' && method === 'GET') {
      const userId = urlObj.searchParams.get('userId') || null;
      const history = tournamentService.getTournamentHistory(userId);
      sendJson(res, 200, { success: true, history });
      return true;
    }

    if (pathname === '/api/tournaments/register' && method === 'POST') {
      const body = await parseJsonBody(req);
      const authUser = await resolveAuthUser(req);
      const userId = body.userId || body.playerId || authUser?.id;
      const result = await tournamentService.joinTournament({
        tournamentId: body.tournamentId,
        code: body.code,
        playerId: userId,
        playerName: body.playerName || body.name || body.teamName || authUser?.username,
        teamName: body.teamName
      });
      if (!result.success) {
        sendJson(res, result.status || 400, { success: false, error: result.error });
        return true;
      }
      sendJson(res, 200, { success: true, tournament: result.tournament });
      return true;
    }

    if (pathname === '/api/tournaments/standings' && method === 'GET') {
      const tournamentId = urlObj.searchParams.get('id');
      const standings = await tournamentService.getStandings(tournamentId);
      sendJson(res, 200, { success: true, standings });
      return true;
    }

    // Detail: GET /api/tournaments/:id
    const tournDetailMatch = pathname.match(/^\/api\/tournaments\/([^/]+)$/);
    if (tournDetailMatch && method === 'GET') {
      const tournId = tournDetailMatch[1];
      const tournament = tournamentService.getTournament(tournId);
      if (!tournament) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, tournament, room: tournament.room || tournament.lobby || null });
      return true;
    }

    // GET /api/tournaments/:id/fixtures | standings | bracket | results
    const tournFixturesMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/fixtures$/);
    if (tournFixturesMatch && method === 'GET') {
      const fixtures = tournamentService.getFixtures(tournFixturesMatch[1]);
      if (!fixtures) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, fixtures });
      return true;
    }

    const tournStandingsMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/standings$/);
    if (tournStandingsMatch && method === 'GET') {
      const standings = await tournamentService.getStandings(tournStandingsMatch[1]);
      sendJson(res, 200, { success: true, standings });
      return true;
    }

    const tournBracketMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/bracket$/);
    if (tournBracketMatch && method === 'GET') {
      const bracket = tournamentService.getBracket(tournBracketMatch[1]);
      if (!bracket) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, ...bracket });
      return true;
    }

    const tournResultsMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/results$/);
    if (tournResultsMatch && method === 'GET') {
      const results = tournamentService.getResults(tournResultsMatch[1]);
      if (!results) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, ...results });
      return true;
    }

    const tournRewardsMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/rewards$/);
    if (tournRewardsMatch && method === 'GET') {
      const rewards = tournamentService.getRewards(tournRewardsMatch[1]);
      if (rewards === null) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, rewards });
      return true;
    }

    // Ready state: POST /api/tournaments/:id/ready
    const tournReadyMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/ready$/);
    if (tournReadyMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveTournamentActor(req, body, ['playerId', 'userId']);
      if (actor.error) {
        sendJson(res, actor.status || 401, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.setParticipantReady(
        tournReadyMatch[1],
        actor.actorId,
        body.isReady
      );
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Leave lobby: POST /api/tournaments/:id/leave
    const tournLeaveMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/leave$/);
    if (tournLeaveMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveTournamentActor(req, body, ['playerId', 'userId']);
      if (actor.error) {
        sendJson(res, actor.status || 401, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.leaveTournament(
        tournLeaveMatch[1],
        actor.actorId
      );
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Host Action: Start tournament POST /api/tournaments/:id/start
    const tournStartMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/start$/);
    if (tournStartMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.startTournament(tournStartMatch[1], actor.hostId);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Host Action: Kick participant POST /api/tournaments/:id/kick
    const tournKickMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/kick$/);
    if (tournKickMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.kickParticipant(tournKickMatch[1], actor.hostId, body.playerId);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Start Match in Live Room POST /api/tournaments/:id/matches/:matchId/start
    const tournMatchStart = pathname.match(/^\/api\/tournaments\/([^/]+)\/matches\/([^/]+)\/start$/);
    if (tournMatchStart && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveTournamentActor(req, body, ['playerId', 'userId']);
      if (actor.error) {
        sendJson(res, actor.status || 401, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.startMatch(
        tournMatchStart[1],
        tournMatchStart[2],
        actor.actorId || null
      );
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Record Authoritative Match Outcome POST /api/tournaments/:id/match-result
    const tournResultMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/match-result$/);
    if (tournResultMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await tournamentService.recordVerifiedMatchResult(tournResultMatch[1], {
        matchId: body.matchId,
        winnerId: body.winnerId,
        scores: body.scores || [5, 3]
      });
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Declare no-show walkover POST /api/tournaments/:id/walkover
    const tournWalkoverMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/walkover$/);
    if (tournWalkoverMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const result = await tournamentService.recordWalkover(tournWalkoverMatch[1], {
        matchId: body.matchId,
        winnerId: body.winnerId,
        reason: body.reason || 'No-show walkover'
      });
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Approve registration POST /api/tournaments/:id/approve
    const tournApproveMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/approve$/);
    if (tournApproveMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.approveParticipant(tournApproveMatch[1], actor.hostId, body.playerId);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Reject registration POST /api/tournaments/:id/reject
    const tournRejectMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/reject$/);
    if (tournRejectMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.rejectParticipant(tournRejectMatch[1], actor.hostId, body.playerId);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Create Team POST /api/tournaments/:id/teams
    const tournTeamsMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/teams$/);
    if (tournTeamsMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.createTeam(tournTeamsMatch[1], actor.hostId, body);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Host Action: Cancel Tournament POST /api/tournaments/:id/cancel
    const tournCancelMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/cancel$/);
    if (tournCancelMatch && method === 'POST') {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.cancelTournament(tournCancelMatch[1], actor.hostId, body.reason);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Host Action: Update Settings PATCH/POST /api/tournaments/:id/settings
    const tournSettingsMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/settings$/);
    if (tournSettingsMatch && (method === 'PATCH' || method === 'POST')) {
      const body = await parseJsonBody(req);
      const actor = await resolveHostActor(req, body);
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.updateSettings(tournSettingsMatch[1], actor.hostId, body);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // Audit Log: GET /api/tournaments/:id/audit-log
    const tournAuditMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/audit-log$/);
    if (tournAuditMatch && method === 'GET') {
      const auditLog = tournamentService.getAuditLog(tournAuditMatch[1]);
      if (!auditLog) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, auditLog });
      return true;
    }

    // Send Invitation: POST /api/tournaments/:id/invitations
    const tournInvitePost = pathname.match(/^\/api\/tournaments\/([^/]+)\/invitations$/);
    if (tournInvitePost && method === 'POST') {
      const body = await parseJsonBody(req);
      const inv = tournamentService.sendInvitation(tournInvitePost[1], body);
      if (!inv) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 201, { success: true, invitation: inv });
      return true;
    }

    // Get Invitations: GET /api/tournaments/:id/invitations
    if (tournInvitePost && method === 'GET') {
      const invitations = tournamentService.getInvitations(tournInvitePost[1]);
      if (!invitations) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, invitations });
      return true;
    }

    // Notifications: GET /api/tournaments/:id/notifications
    const tournNotifMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/notifications$/);
    if (tournNotifMatch && method === 'GET') {
      const userId = urlObj.searchParams.get('userId');
      const notifs = tournamentService.getNotifications(tournNotifMatch[1], userId);
      if (!notifs) {
        sendJson(res, 404, { success: false, error: 'Tournament not found' });
        return true;
      }
      sendJson(res, 200, { success: true, notifications: notifs });
      return true;
    }

    // Global / User Notifications: GET /api/notifications
    if (pathname === '/api/notifications' && method === 'GET') {
      const userId = urlObj.searchParams.get('userId');
      const notifications = tournamentService.getAllNotifications(userId);
      sendJson(res, 200, { success: true, notifications });
      return true;
    }

    // Host Action: Fill Bots & Start POST /api/tournaments/:id/fill-bots
    const tournFillBotsMatch = pathname.match(/^\/api\/tournaments\/([^/]+)\/fill-bots$/);
    if (tournFillBotsMatch && method === 'POST') {
      const body = await parseJsonBody(req).catch(() => ({}));
      const actor = await resolveHostActor(req, body || {});
      if (actor.error) {
        sendJson(res, actor.status || 403, { success: false, error: actor.error });
        return true;
      }
      const result = await tournamentService.fillBotsAndStart(tournFillBotsMatch[1], actor.hostId);
      sendJson(res, result.success ? 200 : (result.status || 400), result);
      return true;
    }

    // ----------------------------------------------------
    // Match Claim & Victory Routes: /api/matches/*
    // ----------------------------------------------------
    const matchClaimRoute = pathname.match(/^\/api\/matches\/([^/]+)\/claim$/);
    if (matchClaimRoute && method === 'POST') {
      const matchId = matchClaimRoute[1];
      const body = await parseJsonBody(req);
      const verdict = await matchService.claimMatchVictory({
        matchId,
        userId: body.userId || body.playerId,
        idempotencyKey: body.claimId || body.idempotencyKey,
        completedLinesCount: body.completedLinesCount || 5,
        durationSeconds: body.durationSeconds || 0
      });

      if (verdict.valid && !verdict.cached && !verdict.alreadyFinished) {
        const winnerId = body.userId || body.playerId;
        if (winnerId && !String(winnerId).startsWith('bot-')) {
          await walletService.awardCoins(winnerId, 150, 'MATCH_WIN', `BINGO Victory on Match ${matchId}`).catch(() => {});
        }
      }

      sendJson(res, 200, {
        success: true,
        ...verdict,
        coinsAwarded: verdict.valid ? 150 : 0
      });
      return true;
    }

    if (pathname === '/api/matches/history' && method === 'GET') {
      const userId = urlObj.searchParams.get('userId');
      const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);
      const history = await matchService.getMatchHistory(userId, limit);
      sendJson(res, 200, { success: true, history });
      return true;
    }

    // Route not found under /api/
    sendJson(res, 404, { error: 'API endpoint not found', path: pathname });
    return true;
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    sendJson(res, status, { success: false, error: message, code: err.code });
    return true;
  }
}
