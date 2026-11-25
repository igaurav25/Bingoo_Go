/**
 * server/server.js
 *
 * Authoritative Realtime Multiplayer Bingo Server.
 * - Serves built React SPA across /, /r/:code, /modes/*, /tournaments/*, /leaderboard, /profile, /game
 * - Verifies frontend build artifacts on startup before binding port
 * - Provides honest /health & /api/health/db status (live DB vs offline fallback)
 * - Runs authoritative WebSocket engine for private rooms, quick matchmaking, bots,
 *   challenge invites, server-side turn timeout auto-picks, and live tournament rooms
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { deviceRooms, normalizeRoomCode } from './roomManager.js';
import { economy } from './economy.js';
import { friendsManager } from './friendsManager.js';
import { handleApiRequest } from './routes/apiRoutes.js';
import { checkDatabaseConnection, isDbConnected } from './db/prisma.js';
import { walletService, matchService, userService, friendService, tournamentService } from './services/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const DIST_JS_PATH = path.join(PUBLIC_DIR, 'dist', 'bingo-react.js');
const DIST_CSS_PATH = path.join(PUBLIC_DIR, 'dist', 'bingo-react.css');

const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_SIZE = 16 * 1024; // 16 KB
const QUICK_MATCH_TIMEOUT_MS = 25000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

function getBundleStatus() {
  try {
    const jsStat = fs.existsSync(DIST_JS_PATH) ? fs.statSync(DIST_JS_PATH) : null;
    const cssStat = fs.existsSync(DIST_CSS_PATH) ? fs.statSync(DIST_CSS_PATH) : null;
    const jsBytes = jsStat?.size || 0;
    const cssBytes = cssStat?.size || 0;
    const ready = jsBytes > 1024 && cssBytes > 128;
    return { ready, jsBytes, cssBytes };
  } catch {
    return { ready: false, jsBytes: 0, cssBytes: 0 };
  }
}

// Tracked WebSocket clients & Quick Match matchmaking queue
const socketClients = new Map(); // ws -> { roomCode, playerId, sessionToken, name, avatar, lastReactionAt }
const quickMatchQueue = []; // { ws, playerId, sessionToken, name, avatar, turnTimerSeconds, seriesTargetWins, queuedAt, timeoutTimer }

function send(ws, type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcastGlobal(type, payload = {}) {
  for (const [clientWs] of socketClients.entries()) {
    send(clientWs, type, payload);
  }
}

tournamentService.setBroadcaster((tournament) => {
  broadcastGlobal('tournament_updated', { tournament });
});

function broadcastToRoom(room, type, payload = {}, excludePlayerId = null) {
  if (!room) return;
  for (const player of room.players) {
    if (player.id !== excludePlayerId && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, type, payload);
    }
  }
}

function syncRoomState(room) {
  if (!room) return;
  for (const player of room.players) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, 'room_state', {
        room: room.getSnapshot(player.id)
      });
    }
  }
}

function removeFromQuickMatchQueue(wsOrPlayerId) {
  for (let i = quickMatchQueue.length - 1; i >= 0; i--) {
    const entry = quickMatchQueue[i];
    if (entry.ws === wsOrPlayerId || entry.playerId === wsOrPlayerId) {
      if (entry.timeoutTimer) clearTimeout(entry.timeoutTimer);
      quickMatchQueue.splice(i, 1);
      return entry;
    }
  }
  return null;
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  try {
    const handled = await handleApiRequest(req, res);
    if (handled) return;
  } catch (err) {
    console.error('API Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal Server Error' }));
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURI(urlObj.pathname);

  // 1. Honest health check
  if (pathname === '/health') {
    const bundle = getBundleStatus();
    const dbOnline = isDbConnected();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: bundle.ready ? 'ok' : 'degraded',
      uptime: process.uptime(),
      roomsCount: deviceRooms.rooms.size,
      frontendBundle: bundle,
      database: {
        connected: dbOnline,
        status: dbOnline ? 'online' : 'offline_fallback',
        orm: 'Prisma 6.19.3'
      },
      websocket: {
        activeClients: socketClients.size,
        quickMatchQueue: quickMatchQueue.length
      },
      timestamp: Date.now()
    }));
    return;
  }

  // 2. Legacy URL redirect
  const legacyMatch = urlObj.searchParams.get('match') || urlObj.searchParams.get('room');
  if (legacyMatch && pathname === '/') {
    const cleanCode = normalizeRoomCode(legacyMatch) || 'B4K8M';
    res.writeHead(302, { Location: `/r/${cleanCode}` });
    res.end();
    return;
  }

  // 3. Demo route
  if (pathname === '/demo') {
    const demoPath = path.join(PUBLIC_DIR, 'demo.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(demoPath).pipe(res);
    return;
  }

  // 4. Single Page App HTML shell for all app routes
  if (
    pathname === '/' ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/modes') ||
    pathname.startsWith('/tournaments') ||
    pathname === '/leaderboard' ||
    pathname === '/profile' ||
    pathname === '/game'
  ) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  // 5. Static asset delivery
  let filePath = '';
  if (pathname.startsWith('/shared/')) {
    filePath = path.join(ROOT_DIR, pathname);
  } else {
    filePath = path.join(PUBLIC_DIR, pathname);
  }

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackIndex = path.join(PUBLIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallbackIndex).pipe(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const isMutableAsset = ext === '.html' || pathname.startsWith('/dist/') || pathname === '/sw.js';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isMutableAsset ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_SIZE });

/**
 * Checks and schedules AI Bot turn when active in a Practice/Bot room.
 */
function handleBotTurnIfNeeded(room) {
  if (!room || !room.match || room.status !== 'playing' || room.disconnectedPlayerId) return;

  const currentTurnId = room.match.currentTurnPlayerId;
  const botPlayer = room.players.find(p => p.id === currentTurnId && p.isBot);

  if (botPlayer && botPlayer.botInstance) {
    setTimeout(async () => {
      if (room.status !== 'playing' || !room.match || room.match.currentTurnPlayerId !== botPlayer.id) return;

      await room.match.enqueue(() => {
        const botData = room.match.players[botPlayer.id];
        if (botData && botData.completedLines.length >= 5) {
          const verdict = room.match.claimBingo(botPlayer.id, `claim-bot-${Date.now()}`);
          if (verdict.valid) {
            handleVictory(room, verdict);
            return;
          }
        }

        const number = botPlayer.botInstance.chooseNumber(room.match.calledNumbers);
        if (number == null) return;
        const callRes = room.match.callNumber(botPlayer.id, number);

        if (callRes.success) {
          room._startTurnTimerIfNeeded();

          broadcastToRoom(room, 'number_called', {
            number: callRes.number,
            turnPlayerId: callRes.turnPlayerId,
            nextTurnPlayerId: callRes.nextTurnPlayerId,
            calledNumbers: room.match.calledNumbers,
            turnDeadline: room.turnDeadline,
            isAutoPicked: false
          });

          for (const evt of callRes.events) {
            const p = room.findPlayerById(evt.recipientId);
            if (p && p.ws) {
              send(p.ws, evt.event, evt.payload);
            }
          }

          syncRoomState(room);

          if (room.match.players[botPlayer.id].completedLines.length >= 5) {
            setTimeout(() => {
              if (room.status === 'playing' && room.match) {
                const verdict = room.match.claimBingo(botPlayer.id, `claim-bot-${Date.now()}`);
                if (verdict.valid) {
                  handleVictory(room, verdict);
                }
              }
            }, 450);
          } else {
            handleBotTurnIfNeeded(room);
          }
        }
      });
    }, 950);
  }
}

/**
 * Authoritative turn-deadline sweeper: automatically picks an uncalled number if a player's timer expires.
 */
const turnTimeoutSweeper = setInterval(() => {
  const now = Date.now();
  for (const room of deviceRooms.rooms.values()) {
    if (
      room.status === 'playing' &&
      room.match &&
      !room.disconnectedPlayerId &&
      room.turnDeadline &&
      now >= room.turnDeadline
    ) {
      const turnPlayerId = room.match.currentTurnPlayerId;
      room._clearTurnTimer();

      room.match.enqueue(() => {
        if (room.status !== 'playing' || !room.match || room.match.currentTurnPlayerId !== turnPlayerId) return;
        if (room.settings?.timeoutRule === 'SKIP_TURN') {
          const skipRes = room.match.skipTurn(turnPlayerId);
          if (skipRes.success) {
            room._startTurnTimerIfNeeded();
            broadcastToRoom(room, 'turn_skipped', {
              skippedPlayerId: skipRes.skippedPlayerId,
              nextTurnPlayerId: skipRes.nextTurnPlayerId,
              turnDeadline: room.turnDeadline
            });
            syncRoomState(room);
            handleBotTurnIfNeeded(room);
          }
          return;
        }
        const uncalled = [];
        for (let n = 1; n <= 25; n++) {
          if (!room.match.calledNumbersSet.has(n)) uncalled.push(n);
        }
        if (uncalled.length === 0) return;

        const pick = uncalled[Math.floor(Math.random() * uncalled.length)];
        const callRes = room.match.callNumber(turnPlayerId, pick);
        if (callRes.success) {
          room._startTurnTimerIfNeeded();
          broadcastToRoom(room, 'number_called', {
            number: callRes.number,
            turnPlayerId: callRes.turnPlayerId,
            nextTurnPlayerId: callRes.nextTurnPlayerId,
            calledNumbers: room.match.calledNumbers,
            turnDeadline: room.turnDeadline,
            isAutoPicked: true
          });

          for (const evt of callRes.events) {
            const p = room.findPlayerById(evt.recipientId);
            if (p && p.ws) {
              send(p.ws, evt.event, evt.payload);
            }
          }

          syncRoomState(room);
          handleBotTurnIfNeeded(room);
        }
      }).catch(() => {});
    }
  }
}, 1000);
if (turnTimeoutSweeper.unref) turnTimeoutSweeper.unref();

/**
 * Atomic idempotent victory resolution + tournament sync + wallet/history persistence.
 */
function handleVictory(room, verdict) {
  if (!room || room.victoryProcessed) return;

  room.victoryProcessed = true;
  room.status = 'finished';
  room.winnerId = verdict.winnerId;
  room._clearTurnTimer();

  const durationSeconds = room.createdAt ? Math.max(1, Math.round((Date.now() - room.createdAt) / 1000)) : 0;

  if (verdict.valid && verdict.winnerId) {
    room.scores[verdict.winnerId] = (room.scores[verdict.winnerId] || 0) + 1;

    if (!String(verdict.winnerId).startsWith('bot-')) {
      const winner = room.findPlayerById(verdict.winnerId);
      const opponent = room.players.find(p => p.id !== verdict.winnerId);
      if (winner) {
        economy.awardMatchWin(verdict.winnerId, 150, opponent?.name || 'Opponent');
        walletService.awardCoins(
          verdict.winnerId,
          150,
          'MATCH_WIN',
          `Match Victory vs ${opponent?.name || 'Opponent'}`
        ).catch(() => {});
      }
    }

    matchService.completeMatch({
      matchId: room.matchId || `match-${room.code}`,
      winnerId: verdict.winnerId,
      completedLinesCount: verdict.completedLines?.length || 5,
      isTie: false,
      durationSeconds,
      summary: `Won with ${verdict.completedLines?.length || 5} lines: ${verdict.completedLines?.join(', ') || ''}`
    }).catch(() => {});

    for (const p of room.players) {
      if (!p.isBot && !String(p.id).startsWith('bot-')) {
        const opp = room.players.find(o => o.id !== p.id);
        const matchStatePlayer = room.match?.players?.[p.id];
        matchService.recordPlayerMatchHistory({
          userId: p.id,
          matchId: room.matchId || `match-${room.code}`,
          opponentName: opp?.name || 'Opponent',
          mode: room.tournamentId ? 'TOURNAMENT' : 'MULTIPLAYER',
          result: p.id === verdict.winnerId ? 'WIN' : 'LOSS',
          linesCompleted: matchStatePlayer?.completedLines?.length || 0,
          coinsDelta: p.id === verdict.winnerId ? 150 : 0,
          durationSeconds
        }).catch(() => {});
      }
    }

    // Update tournament fixture automatically when this room belongs to a tournament match
    if (room.tournamentId && room.tournamentMatchId) {
      const p1Lines = room.match?.players?.[room.players[0]?.id]?.completedLines?.length || (room.players[0]?.id === verdict.winnerId ? 5 : 2);
      const p2Lines = room.match?.players?.[room.players[1]?.id]?.completedLines?.length || (room.players[1]?.id === verdict.winnerId ? 5 : 2);
      tournamentService.recordVerifiedMatchResult(room.tournamentId, {
        matchId: room.tournamentMatchId,
        winnerId: verdict.winnerId,
        scores: [p1Lines, p2Lines]
      }).then((res) => {
        if (res.success && res.tournament) {
          broadcastGlobal('tournament_updated', {
            tournament: res.tournament,
            matchId: room.tournamentMatchId,
            winnerId: verdict.winnerId
          });
        }
      }).catch(() => {});
    }
  }

  for (const p of room.players) {
    if (!p.isBot) friendsManager.setUserStatus(p.id, 'online');
  }

  broadcastToRoom(room, 'bingo_result', {
    claimId: verdict.claimId,
    valid: verdict.valid,
    winnerId: verdict.winnerId,
    reason: verdict.reason,
    scores: room.scores,
    durationSeconds
  });

  syncRoomState(room);
}

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const { type, payload = {} } = msg;

      switch (type) {
        case 'ping': {
          send(ws, 'pong', { time: Date.now() });
          break;
        }

        case 'identify': {
          const playerId = payload.playerId || `p-${crypto.randomBytes(3).toString('hex')}`;
          const name = payload.name || 'Player';
          const avatar = payload.avatar || '🦊';
          const sessionToken = payload.sessionToken || crypto.randomBytes(16).toString('hex');

          const existing = socketClients.get(ws) || {};
          socketClients.set(ws, {
            ...existing,
            playerId,
            sessionToken,
            name,
            avatar
          });
          friendsManager.registerUser(playerId, name, avatar, ws);
          send(ws, 'identified', { playerId, name, avatar });
          break;
        }

        // --- Quick Match Real Human Matchmaking Queue ---
        case 'find_quick_match': {
          const playerId = payload.playerId || `p-${crypto.randomBytes(3).toString('hex')}`;
          const sessionToken = payload.sessionToken || crypto.randomBytes(16).toString('hex');
          const name = (payload.name || 'Player').slice(0, 16);
          const avatar = payload.avatar || '🦊';
          const turnTimerSeconds = Number(payload.turnTimerSeconds ?? 30);
          const seriesTargetWins = Number(payload.seriesTargetWins ?? 1);

          friendsManager.registerUser(playerId, name, avatar, ws);
          removeFromQuickMatchQueue(ws);
          removeFromQuickMatchQueue(playerId);

          // Look for another active waiting human player
          let matchedPeer = null;
          while (quickMatchQueue.length > 0) {
            const candidate = quickMatchQueue.shift();
            if (candidate.timeoutTimer) clearTimeout(candidate.timeoutTimer);
            if (
              candidate.ws &&
              candidate.ws.readyState === WebSocket.OPEN &&
              candidate.playerId !== playerId
            ) {
              matchedPeer = candidate;
              break;
            }
          }

          if (matchedPeer) {
            const room = deviceRooms.createRoom(
              matchedPeer.playerId,
              matchedPeer.sessionToken,
              matchedPeer.name,
              matchedPeer.avatar,
              {
                turnTimerSeconds: matchedPeer.turnTimerSeconds || turnTimerSeconds,
                seriesTargetWins: matchedPeer.seriesTargetWins || seriesTargetWins
              }
            );

            room.players[0].ws = matchedPeer.ws;
            room.players[0].isReady = true;

            const joinRes = room.join(playerId, sessionToken, name, avatar, ws);
            if (joinRes.player) {
              joinRes.player.isReady = true;
            }

            socketClients.set(matchedPeer.ws, {
              roomCode: room.code,
              playerId: matchedPeer.playerId,
              sessionToken: matchedPeer.sessionToken,
              name: matchedPeer.name,
              avatar: matchedPeer.avatar,
              lastReactionAt: 0
            });
            socketClients.set(ws, {
              roomCode: room.code,
              playerId: joinRes.player.id,
              sessionToken: joinRes.player.sessionToken,
              name: joinRes.player.name,
              avatar: joinRes.player.avatar,
              lastReactionAt: 0
            });

            friendsManager.setUserStatus(matchedPeer.playerId, 'in_game');
            friendsManager.setUserStatus(joinRes.player.id, 'in_game');

            const { startingPlayerId } = room.startArranging();

            send(matchedPeer.ws, 'quick_match_found', {
              code: room.code,
              playerId: matchedPeer.playerId,
              sessionToken: matchedPeer.sessionToken,
              startingPlayerId,
              opponent: { id: joinRes.player.id, name: joinRes.player.name, avatar: joinRes.player.avatar },
              room: room.getSnapshot(matchedPeer.playerId)
            });

            send(ws, 'quick_match_found', {
              code: room.code,
              playerId: joinRes.player.id,
              sessionToken: joinRes.player.sessionToken,
              startingPlayerId,
              opponent: { id: matchedPeer.playerId, name: matchedPeer.name, avatar: matchedPeer.avatar },
              room: room.getSnapshot(joinRes.player.id)
            });

            broadcastToRoom(room, 'start_arranging', { startingPlayerId });
            syncRoomState(room);
          } else {
            const timeoutTimer = setTimeout(() => {
              const removed = removeFromQuickMatchQueue(ws);
              if (removed && ws.readyState === WebSocket.OPEN) {
                send(ws, 'matchmaking_timeout', {
                  message: 'No live opponent joined within 25 seconds. Try Private Room or Practice vs AI.'
                });
              }
            }, QUICK_MATCH_TIMEOUT_MS);
            if (timeoutTimer.unref) timeoutTimer.unref();

            const entry = {
              ws,
              playerId,
              sessionToken,
              name,
              avatar,
              turnTimerSeconds,
              seriesTargetWins,
              queuedAt: Date.now(),
              timeoutTimer
            };
            quickMatchQueue.push(entry);

            const existingClient = socketClients.get(ws) || {};
            socketClients.set(ws, { ...existingClient, playerId, sessionToken, name, avatar });

            send(ws, 'quick_match_queued', {
              position: quickMatchQueue.length,
              timeoutSeconds: Math.round(QUICK_MATCH_TIMEOUT_MS / 1000)
            });
          }
          break;
        }

        case 'cancel_quick_match': {
          removeFromQuickMatchQueue(ws);
          send(ws, 'quick_match_cancelled', { cancelled: true });
          break;
        }

        // --- Room Creation & Joining ---
        case 'create_room': {
          if (!deviceRooms.checkRateLimit(ip, 'create', 25, 60 * 1000)) {
            send(ws, 'error', { message: 'Too many room creations. Please wait a moment.' });
            return;
          }

          removeFromQuickMatchQueue(ws);
          const hostPlayerId = payload.playerId || `p-${crypto.randomBytes(3).toString('hex')}`;
          const hostSessionToken = payload.sessionToken || crypto.randomBytes(16).toString('hex');
          const hostName = payload.name || 'Player 1';
          const hostAvatar = payload.avatar || '🦊';

          const room = deviceRooms.createRoom(
            hostPlayerId,
            hostSessionToken,
            hostName,
            hostAvatar,
            payload.settings || {}
          );
          const hostPlayer = room.players[0];
          hostPlayer.ws = ws;

          friendsManager.registerUser(hostPlayerId, hostName, hostAvatar, ws);

          socketClients.set(ws, {
            roomCode: room.code,
            playerId: hostPlayerId,
            sessionToken: hostSessionToken,
            name: hostName,
            avatar: hostAvatar,
            lastReactionAt: 0
          });

          send(ws, 'room_created', {
            code: room.code,
            playerId: hostPlayerId,
            sessionToken: hostSessionToken,
            room: room.getSnapshot(hostPlayerId)
          });
          break;
        }

        case 'join_room': {
          const rawCode = payload.code || '';
          const code = normalizeRoomCode(rawCode);
          const room = deviceRooms.getRoom(code);

          if (!room) {
            send(ws, 'error', {
              code: 'ROOM_NOT_FOUND',
              message: 'Room not found. Check the 5-character code and try again.'
            });
            return;
          }

          removeFromQuickMatchQueue(ws);
          const playerId = payload.playerId || `p-${crypto.randomBytes(3).toString('hex')}`;
          const sessionToken = payload.sessionToken || crypto.randomBytes(16).toString('hex');
          const name = payload.name || 'Guest';
          const avatar = payload.avatar || '🐻';

          const joinResult = room.join(playerId, sessionToken, name, avatar, ws);
          if (!joinResult.success) {
            send(ws, 'error', {
              code: joinResult.code || 'ROOM_FULL',
              message: joinResult.error || 'Unable to join room.'
            });
            return;
          }

          if (joinResult.isReconnect && joinResult.oldWs && joinResult.oldWs !== ws) {
            send(joinResult.oldWs, 'tab_conflict', {
              message: 'Opened in another tab. This session is now inactive.'
            });
            try { joinResult.oldWs.close(); } catch {}
          }

          friendsManager.registerUser(joinResult.player.id, joinResult.player.name, joinResult.player.avatar, ws);

          socketClients.set(ws, {
            roomCode: room.code,
            playerId: joinResult.player.id,
            sessionToken: joinResult.player.sessionToken,
            name: joinResult.player.name,
            avatar: joinResult.player.avatar,
            lastReactionAt: 0
          });

          send(ws, 'room_joined', {
            code: room.code,
            playerId: joinResult.player.id,
            sessionToken: joinResult.player.sessionToken,
            isReconnect: joinResult.isReconnect,
            room: room.getSnapshot(joinResult.player.id)
          });

          if (joinResult.wasPaused) {
            broadcastToRoom(room, 'player_reconnected', {
              playerId: joinResult.player.id,
              name: joinResult.player.name
            });
          } else {
            broadcastToRoom(room, 'player_joined', {
              playerId: joinResult.player.id,
              name: joinResult.player.name,
              avatar: joinResult.player.avatar
            }, joinResult.player.id);
          }

          syncRoomState(room);
          handleBotTurnIfNeeded(room);
          break;
        }

        case 'add_bot': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (room && room.hostPlayerId === client.playerId) {
            const botRes = room.addBot();
            if (botRes.success) {
              syncRoomState(room);
            } else {
              send(ws, 'error', { message: botRes.error });
            }
          }
          break;
        }

        case 'set_ready': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room) return;

          const { allReady } = room.setReady(client.playerId, payload.ready);
          syncRoomState(room);

          if (allReady && room.status === 'lobby') {
            const arr = room.startArranging();
            if (!arr.error) {
              broadcastToRoom(room, 'start_arranging', {
                startingPlayerId: arr.startingPlayerId
              });
              syncRoomState(room);
            }
          }
          break;
        }

        case 'start_arranging': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room) return;

          if (room.hostPlayerId !== client.playerId) {
            send(ws, 'error', { message: 'Only the room host can start the match.' });
            return;
          }
          if (room.players.length < 2) {
            send(ws, 'error', { message: 'Wait for an opponent or add a Practice Bot before starting.' });
            return;
          }
          const guestNotReady = room.players.some(p => !p.isHost && !p.isBot && !p.isReady);
          if (guestNotReady) {
            send(ws, 'error', { message: 'Opponent must tap Ready before starting.' });
            return;
          }

          if (room.status === 'lobby') {
            const arr = room.startArranging();
            if (arr.error) {
              send(ws, 'error', { message: arr.error });
              return;
            }
            broadcastToRoom(room, 'start_arranging', {
              startingPlayerId: arr.startingPlayerId
            });
            syncRoomState(room);
          }
          break;
        }

        case 'lock_board': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room || room.status !== 'arranging') return;

          const lockRes = room.lockBoard(client.playerId, payload.grid);
          if (!lockRes.success) {
            send(ws, 'error', { message: lockRes.error });
            return;
          }

          send(ws, 'board_locked', { playerId: client.playerId });

          if (lockRes.matchStarted) {
            for (const p of room.players) {
              if (!p.isBot) friendsManager.setUserStatus(p.id, 'in_game');
            }
            broadcastToRoom(room, 'match_started', {
              currentTurnPlayerId: lockRes.currentTurnPlayerId,
              turnDeadline: room.turnDeadline
            });
            handleBotTurnIfNeeded(room);
          }

          syncRoomState(room);
          break;
        }

        case 'call_number': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room || !room.match || room.status !== 'playing') return;

          await room.match.enqueue(() => {
            const num = Number(payload.number);
            const callRes = room.match.callNumber(client.playerId, num);
            if (!callRes.success) {
              send(ws, 'error', { message: callRes.error });
              return;
            }

            room._startTurnTimerIfNeeded();

            broadcastToRoom(room, 'number_called', {
              number: callRes.number,
              turnPlayerId: callRes.turnPlayerId,
              nextTurnPlayerId: callRes.nextTurnPlayerId,
              calledNumbers: room.match.calledNumbers,
              turnDeadline: room.turnDeadline,
              isAutoPicked: false
            });

            for (const evt of callRes.events) {
              const p = room.findPlayerById(evt.recipientId);
              if (p && p.ws) {
                send(p.ws, evt.event, evt.payload);
              }
            }

            syncRoomState(room);
            handleBotTurnIfNeeded(room);
          });
          break;
        }

        case 'claim_bingo': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room || !room.match) return;

          await room.match.enqueue(() => {
            const claimId = payload.claimId || `claim-${Date.now()}`;
            const verdict = room.match.claimBingo(client.playerId, claimId);
            if (verdict.valid) {
              handleVictory(room, verdict);
            } else {
              broadcastToRoom(room, 'bingo_result', verdict);
            }
          });
          break;
        }

        case 'request_rematch': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room) return;

          const { rematchReady } = room.requestRematch(client.playerId);
          broadcastToRoom(room, 'rematch_requested', {
            playerId: client.playerId,
            rematchRequests: Array.from(room.rematchRequests)
          });

          if (rematchReady) {
            const { startingPlayerId } = room.startArranging();
            broadcastToRoom(room, 'rematch_started', {
              startingPlayerId,
              scores: room.scores
            });
          }

          syncRoomState(room);
          break;
        }

        case 'send_reaction': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (!room) return;

          const now = Date.now();
          if (now - (client.lastReactionAt || 0) < 2000) return;
          client.lastReactionAt = now;

          const emoji = String(payload.emoji || '🔥').slice(0, 4);
          broadcastToRoom(room, 'reaction', {
            playerId: client.playerId,
            emoji
          });
          break;
        }

        case 'update_settings': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (room && room.hostPlayerId === client.playerId) {
            if (payload.turnTimerSeconds !== undefined) {
              room.settings.turnTimerSeconds = Number(payload.turnTimerSeconds) || 0;
            }
            if (payload.seriesTargetWins !== undefined) {
              room.settings.seriesTargetWins = Number(payload.seriesTargetWins) || 1;
            }
            syncRoomState(room);
          }
          break;
        }

        case 'leave_room': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (room) {
            room.removePlayer(client.playerId);
            broadcastToRoom(room, 'player_left', { playerId: client.playerId });
            syncRoomState(room);
          }
          client.roomCode = null;
          friendsManager.setUserStatus(client.playerId, 'online');
          break;
        }

        case 'request_snapshot': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (room) {
            send(ws, 'room_state', { room: room.getSnapshot(client.playerId) });
          }
          break;
        }

        // --- Economy, Rewards, Tournaments & Leaderboards ---
        case 'get_wallet': {
          const playerId = payload.playerId || socketClients.get(ws)?.playerId || 'guest';
          const wallet = await walletService.getWallet(playerId).catch(() => economy.getWallet(playerId));
          send(ws, 'wallet_data', wallet);
          break;
        }

        case 'claim_daily_reward': {
          const playerId = payload.playerId || socketClients.get(ws)?.playerId || 'guest';
          const acc = economy.getAccount(playerId);
          acc.balance += 100;
          const tx = {
            id: `tx-daily-${Date.now()}`,
            timestamp: Date.now(),
            type: 'DAILY_REWARD',
            amount: 100,
            balanceAfter: acc.balance,
            description: '🎁 Daily Login Reward: 100 Coins'
          };
          acc.history.unshift(tx);
          await walletService.awardCoins(playerId, 100, 'DAILY_REWARD', 'Daily Login Bonus').catch(() => {});
          send(ws, 'daily_reward_claimed', {
            balance: acc.balance,
            transaction: tx
          });
          break;
        }

        case 'get_tournaments': {
          const list = await tournamentService.getTournaments();
          const ko = list.find(t => t.format === 'knockout');
          const league = list.find(t => t.format === 'league');
          send(ws, 'tournaments_data', {
            tournaments: list,
            knockout: ko ? {
              id: ko.id,
              title: ko.title,
              prizePool: ko.prizePool,
              entryFee: ko.entryFee,
              status: ko.status,
              rounds: ko.stages?.[0]?.rounds || []
            } : null,
            league: league ? {
              id: league.id,
              title: league.title,
              prizePool: league.prizePool,
              entryFee: league.entryFee,
              status: league.status,
              standings: league.stages?.[0]?.standings || league.pointsTable || []
            } : null
          });
          break;
        }

        case 'get_leaderboard': {
          const category = payload.category || 'global';
          const playerId = payload.playerId || socketClients.get(ws)?.playerId;
          const rows = await userService.getLeaderboard(20, 'wins').catch(() => []);
          const formatted = rows.map((r, idx) => ({
            rank: idx + 1,
            id: r.id,
            name: r.username,
            avatar: r.avatar || '🦊',
            wins: r.wins || 0,
            winRate: `${r.winRate || 0}%`,
            coins: r.coins || 0,
            medal: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? 'bronze' : undefined,
            isMe: Boolean(playerId && r.id === playerId)
          }));
          const myEntry = formatted.find(r => r.isMe) || { rank: formatted.length + 1, wins: 0, winRate: '0%', coins: 0 };
          send(ws, 'leaderboard_data', {
            category,
            top3: formatted.slice(0, 3),
            ranks: formatted.slice(3),
            userRank: myEntry
          });
          break;
        }

        case 'get_friends_list': {
          const playerId = payload.playerId || socketClients.get(ws)?.playerId;
          const onlinePeers = friendsManager.getFriendsList(playerId, false);
          const dbFriends = playerId ? await friendService.getFriends(playerId).catch(() => []) : [];
          const merged = [...dbFriends];
          for (const peer of onlinePeers) {
            if (!merged.some(f => f.id === peer.id)) {
              merged.push(peer);
            }
          }
          send(ws, 'friends_list_data', { friends: merged });
          break;
        }

        case 'send_challenge': {
          const fromId = payload.fromId || socketClients.get(ws)?.playerId;
          const fromName = payload.fromName || socketClients.get(ws)?.name || 'Player';
          const fromAvatar = payload.fromAvatar || socketClients.get(ws)?.avatar || '🦊';
          const targetFriendId = payload.targetFriendId;

          if (!fromId || !targetFriendId) {
            send(ws, 'error', { message: 'Invalid challenge sender or target.' });
            break;
          }

          const targetUser = friendsManager.getUser(targetFriendId);
          if (!targetUser || !targetUser.ws || targetUser.ws.readyState !== WebSocket.OPEN) {
            send(ws, 'error', {
              code: 'PLAYER_OFFLINE',
              message: 'That player is not currently online. Share a private room code instead.'
            });
            break;
          }

          const challenge = friendsManager.createChallenge(
            { id: fromId, name: fromName, avatar: fromAvatar },
            targetFriendId
          );
          send(ws, 'challenge_sent', { challenge });
          send(targetUser.ws, 'challenge_received', { challenge });
          break;
        }

        case 'respond_challenge': {
          const responderId = payload.playerId || socketClients.get(ws)?.playerId;
          const res = friendsManager.respondToChallenge(payload.challengeId, Boolean(payload.accept));
          if (!res.success) {
            send(ws, 'error', { message: res.error });
            break;
          }
          const challenge = res.challenge;
          const sender = friendsManager.getUser(challenge.fromId);
          if (!Boolean(payload.accept)) {
            if (sender?.ws) {
              send(sender.ws, 'challenge_declined', { challengeId: challenge.id, byName: payload.name || 'Player' });
            }
            break;
          }

          const responderName = payload.name || socketClients.get(ws)?.name || 'Challenger';
          const responderAvatar = payload.avatar || socketClients.get(ws)?.avatar || '🐼';

          const room = deviceRooms.createRoom(challenge.fromId, `chal-${challenge.fromId}`, challenge.fromName, challenge.fromAvatar);
          if (sender?.ws) {
            room.players[0].ws = sender.ws;
            socketClients.set(sender.ws, {
              roomCode: room.code,
              playerId: challenge.fromId,
              sessionToken: room.players[0].sessionToken,
              name: challenge.fromName,
              avatar: challenge.fromAvatar,
              lastReactionAt: 0
            });
          }
          const joined = room.join(responderId || challenge.toId, `chal-${responderId || challenge.toId}`, responderName, responderAvatar, ws);
          if (joined.player) {
            socketClients.set(ws, {
              roomCode: room.code,
              playerId: joined.player.id,
              sessionToken: joined.player.sessionToken,
              name: joined.player.name,
              avatar: joined.player.avatar,
              lastReactionAt: 0
            });
          }

          if (sender?.ws) {
            send(sender.ws, 'challenge_accepted', {
              challengeId: challenge.id,
              roomCode: room.code,
              opponentName: responderName
            });
          }
          send(ws, 'challenge_accepted', {
            challengeId: challenge.id,
            roomCode: room.code,
            opponentName: challenge.fromName
          });
          syncRoomState(room);
          break;
        }

        // --- Tournament Realtime Messages ---
        case 'create_custom_tournament': {
          const creatorId = payload.creatorId || socketClients.get(ws)?.playerId || 'p1';
          const creatorName = payload.creatorName || socketClients.get(ws)?.name || 'Host';
          const snapshot = await tournamentService.createTournamentSnapshot({
            ...payload,
            creatorId,
            creatorName
          });
          send(ws, 'custom_tournament_created', { tournament: snapshot });
          broadcastGlobal('tournament_updated', { tournament: snapshot });
          break;
        }

        case 'start_custom_tournament': {
          const result = await tournamentService.startTournament(payload.tournamentId, payload.hostId || null);
          if (result.success) {
            broadcastGlobal('tournament_updated', { tournament: result.tournament });
          } else {
            send(ws, 'error', { message: result.error });
          }
          break;
        }

        case 'join_custom_tournament': {
          const playerId = payload.playerId || socketClients.get(ws)?.playerId;
          const playerName = payload.playerName || socketClients.get(ws)?.name || 'Player';
          const res = await tournamentService.joinTournament({
            tournamentId: payload.tournamentId,
            code: payload.code,
            playerId,
            playerName
          });
          if (!res.success) {
            send(ws, 'error', { message: res.error });
            break;
          }
          send(ws, 'tournament_joined', { tournament: res.tournament });
          broadcastGlobal('tournament_updated', { tournament: res.tournament });
          break;
        }

        case 'start_tournament_match': {
          const res = await tournamentService.startMatch(
            payload.tournamentId,
            payload.matchId,
            payload.playerId || socketClients.get(ws)?.playerId
          );
          if (!res.success) {
            send(ws, 'error', { message: res.error });
            break;
          }
          send(ws, 'tournament_match_ready', {
            roomCode: res.roomCode,
            tournamentId: res.tournamentId,
            matchId: res.matchId,
            tournament: res.tournament
          });
          break;
        }

        case 'kick_tournament_participant': {
          const res = await tournamentService.kickParticipant(payload.tournamentId, payload.hostId, payload.playerId);
          if (res.success) {
            broadcastGlobal('tournament_updated', { tournament: res.tournament });
          } else {
            send(ws, 'error', { message: res.error });
          }
          break;
        }

        case 'cancel_custom_tournament': {
          const res = await tournamentService.cancelTournament(payload.tournamentId, payload.hostId, payload.reason);
          if (res.success) {
            broadcastGlobal('tournament_updated', { tournament: res.tournament });
          } else {
            send(ws, 'error', { message: res.error });
          }
          break;
        }

        case 'join_tournament_lobby': {
          const tournId = payload.tournamentId;
          const playerId = payload.playerId || socketClients.get(ws)?.playerId;
          if (!tournId || !playerId) break;
          const prev = socketClients.get(ws) || {};
          socketClients.set(ws, { ...prev, playerId, tournamentLobbyId: tournId });
          await tournamentService.setParticipantOnline(tournId, playerId, true);
          break;
        }

        case 'leave_tournament_lobby': {
          const prev = socketClients.get(ws) || {};
          const tournId = payload.tournamentId || prev.tournamentLobbyId;
          const playerId = payload.playerId || prev.playerId;
          if (prev.tournamentLobbyId) {
            socketClients.set(ws, { ...prev, tournamentLobbyId: null });
          }
          if (tournId && playerId) {
            await tournamentService.setParticipantOnline(tournId, playerId, false);
          }
          break;
        }

        case 'record_tournament_match_outcome': {
          const res = await tournamentService.recordVerifiedMatchResult(payload.tournamentId, {
            matchId: payload.matchId,
            winnerId: payload.winnerId,
            scores: payload.scores
          });
          if (res.success) {
            broadcastGlobal('tournament_updated', { tournament: res.tournament });
          } else {
            send(ws, 'error', { message: res.error });
          }
          break;
        }
      }
    } catch (err) {
      console.error('[WebSocket] Message error:', err);
    }
  });

  ws.on('close', () => {
    removeFromQuickMatchQueue(ws);

    const client = socketClients.get(ws);
    if (!client) return;

    friendsManager.unregisterUser(client.playerId, ws);

    if (client.tournamentLobbyId && client.playerId) {
      tournamentService.setParticipantOnline(client.tournamentLobbyId, client.playerId, false).catch(() => {});
    }

    const room = client.roomCode ? deviceRooms.getRoom(client.roomCode) : null;
    if (room) {
      const dcInfo = room.handleDisconnect(client.playerId, (winnerId, reason) => {
        handleVictory(room, {
          claimId: `forfeit-${Date.now()}`,
          valid: true,
          winnerId,
          reason
        });
      });

      if (dcInfo.shouldPause) {
        broadcastToRoom(room, 'player_disconnected', {
          playerId: client.playerId,
          graceSecondsRemaining: 60,
          pauseCount: dcInfo.pauseCount
        });
      }

      syncRoomState(room);
    }

    socketClients.delete(ws);
  });
});

export { server, wss };

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const bundle = getBundleStatus();
  if (!bundle.ready) {
    console.error(
      `[Bingo Server] Startup aborted: built frontend artifacts missing or incomplete (${DIST_JS_PATH}, ${DIST_CSS_PATH}). Run "npm run build" first.`
    );
    process.exit(1);
  }

  checkDatabaseConnection()
    .then(async (connected) => {
      const restored = await tournamentService.hydrateFromStorage();
      if (connected) {
        console.log(`[Database] PostgreSQL connected via Prisma (restored ${restored} tournaments)`);
      } else {
        console.log(`[Database] PostgreSQL offline — offline_fallback mode active (restored ${restored} tournaments from local store)`);
      }
    })
    .catch(() => {});

  server.listen(PORT, () => {
    console.log(`[Bingo Night Desk Server] Running live at http://localhost:${PORT} (bundle ${(bundle.jsBytes / 1024).toFixed(1)} KB)`);
  });
}
