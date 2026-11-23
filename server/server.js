/**
 * server/server.js
 * 
 * Part 2 Authoritative Realtime Bingo Server.
 * Supports:
 * - Single-page app routing: / and /r/:code
 * - Redirects for legacy query parameters (?match=... / ?room=...)
 * - Cold-start health check: /health
 * - Anonymous session tokens (no accounts, seat ownership, zero opponent leakage)
 * - 5-character vowel-free room codes (2-9, consonants except L)
 * - Disconnect grace period (60s pause, forfeit on timeout)
 * - Tab conflict resolution (newest tab wins)
 * - Turn timer with server-authoritative deadlines & auto-pick on timeout
 * - Rematch support with alternating first turns
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { deviceRooms, normalizeRoomCode } from './roomManager.js';
import { economy } from './economy.js';
import { tournamentManager } from './tournamentManager.js';
import { friendsManager } from './friendsManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');

const PORT = process.env.PORT || 3000;
const MAX_MESSAGE_SIZE = 16 * 1024; // 16 KB

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

// HTTP Server
const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURI(urlObj.pathname);

  // 1. Health check for cold starts
  if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      uptime: process.uptime(),
      roomsCount: deviceRooms.rooms.size,
      timestamp: Date.now()
    }));
    return;
  }

  // 2. Legacy URL redirect: ?match=XYZ or ?room=XYZ -> /r/:code
  const legacyMatch = urlObj.searchParams.get('match') || urlObj.searchParams.get('room');
  if (legacyMatch && pathname === '/') {
    const cleanCode = normalizeRoomCode(legacyMatch) || 'B4K8M';
    res.writeHead(302, { Location: `/r/${cleanCode}` });
    res.end();
    return;
  }

  // 3. Single App, One URL Routing: / and /r/:code serve index.html; /demo serves standalone demo
  if (pathname === '/demo') {
    const demoPath = path.join(PUBLIC_DIR, 'demo.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(demoPath).pipe(res);
    return;
  }

  if (pathname === '/' || pathname.startsWith('/r/') || pathname.startsWith('/modes')) {
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  // 4. Static asset delivery
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
      // Fallback for SPA routing
      const fallbackIndex = path.join(PUBLIC_DIR, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(fallbackIndex).pipe(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server, maxPayload: MAX_MESSAGE_SIZE });

/**
 * Socket client tracking: ws -> { roomCode, playerId, sessionToken, lastReactionAt }
 */
const socketClients = new Map();

function send(ws, type, payload = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcastToRoom(room, type, payload = {}, excludePlayerId = null) {
  if (!room) return;
  for (const player of room.players) {
    if (player.id !== excludePlayerId && player.ws && player.ws.readyState === WebSocket.OPEN) {
      send(player.ws, type, payload);
    }
  }
}

/**
 * Dispatches room state update to all connected players in room.
 * @param {DeviceRoom} room
 */
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

/**
 * Checks and schedules bot turn if applicable.
 * @param {DeviceRoom} room
 */
function handleBotTurnIfNeeded(room) {
  if (!room || !room.match || room.status !== 'playing' || room.disconnectedPlayerId) return;

  const currentTurnId = room.match.currentTurnPlayerId;
  const botPlayer = room.players.find(p => p.id === currentTurnId && p.isBot);

  if (botPlayer && botPlayer.botInstance) {
    setTimeout(async () => {
      if (room.status !== 'playing' || room.match.currentTurnPlayerId !== botPlayer.id) return;

      await room.match.enqueue(() => {
        // Check if bot can claim BINGO
        const botData = room.match.players[botPlayer.id];
        if (botData && botData.completedLines.length >= 5) {
          const verdict = room.match.claimBingo(botPlayer.id, `claim-bot-${Date.now()}`);
          if (verdict.valid) {
            handleVictory(room, verdict);
            return;
          }
        }

        // Pick smart uncalled number
        const number = botPlayer.botInstance.chooseNumber(room.match.calledNumbers);
        const callRes = room.match.callNumber(botPlayer.id, number);

        if (callRes.success) {
          broadcastToRoom(room, 'number_called', {
            number: callRes.number,
            turnPlayerId: callRes.turnPlayerId,
            nextTurnPlayerId: callRes.nextTurnPlayerId,
            calledNumbers: room.match.calledNumbers,
            isAutoPicked: false
          });

          // Dispatch lines_completed
          for (const evt of callRes.events) {
            const p = room.findPlayerById(evt.recipientId);
            if (p && p.ws) {
              send(p.ws, evt.event, evt.payload);
            }
          }

          // Restart turn timer if configured
          room._startTurnTimerIfNeeded();
          syncRoomState(room);

          // If bot reached 5 lines, claim
          if (room.match.players[botPlayer.id].completedLines.length >= 5) {
            setTimeout(async () => {
              if (room.status === 'playing') {
                const verdict = room.match.claimBingo(botPlayer.id, `claim-bot-${Date.now()}`);
                if (verdict.valid) {
                  handleVictory(room, verdict);
                }
              }
            }, 500);
          } else {
            handleBotTurnIfNeeded(room);
          }
        }
      });
    }, 1100);
  }
}

/**
 * Handles match victory and awards series points/coins.
 * @param {DeviceRoom} room
 * @param {object} verdict
 */
function handleVictory(room, verdict) {
  room.status = 'finished';
  room._clearTurnTimer();

  if (verdict.valid && verdict.winnerId) {
    room.scores[verdict.winnerId] = (room.scores[verdict.winnerId] || 0) + 1;

    // Award virtual coins to winner if not bot
    if (!verdict.winnerId.startsWith('bot-')) {
      const winner = room.findPlayerById(verdict.winnerId);
      const opponent = room.players.find(p => p.id !== verdict.winnerId);
      if (winner) {
        economy.awardMatchWin(verdict.winnerId, 150, opponent?.name || 'Opponent');
      }
    }
  }

  broadcastToRoom(room, 'bingo_result', {
    claimId: verdict.claimId,
    valid: verdict.valid,
    winnerId: verdict.winnerId,
    reason: verdict.reason,
    scores: room.scores
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

        // --- Room Creation & Joining ---
        case 'create_room': {
          // Rate limit creation
          if (!deviceRooms.checkRateLimit(ip, 'create', 15, 60 * 1000)) {
            send(ws, 'error', { message: 'Too many room creations. Please wait a moment.' });
            return;
          }

          const hostPlayerId = payload.playerId || `p-${crypto.randomBytes(3).toString('hex')}`;
          const hostSessionToken = payload.sessionToken || crypto.randomBytes(16).toString('hex');
          const hostName = payload.name || 'Player 1';
          const hostAvatar = payload.avatar || '🦊';

          const room = deviceRooms.createRoom(hostPlayerId, hostSessionToken, hostName, hostAvatar);
          const hostPlayer = room.players[0];
          hostPlayer.ws = ws;

          socketClients.set(ws, {
            roomCode: room.code,
            playerId: hostPlayerId,
            sessionToken: hostSessionToken,
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
              message: 'Room not found. Check the code and try again.'
            });
            return;
          }

          const playerId = payload.playerId || `p-${crypto.randomBytes(3).toString('hex')}`;
          const sessionToken = payload.sessionToken || crypto.randomBytes(16).toString('hex');
          const name = payload.name || 'Guest';
          const avatar = payload.avatar || '🐻';

          const joinResult = room.join(playerId, sessionToken, name, avatar, ws);
          if (!joinResult.success) {
            send(ws, 'error', {
              code: 'ROOM_FULL',
              message: joinResult.error || 'Unable to join room.'
            });
            return;
          }

          // Tab conflict resolution: if this sessionToken was already connected on another socket, kick old socket
          if (joinResult.isReconnect && joinResult.oldWs && joinResult.oldWs !== ws) {
            send(joinResult.oldWs, 'tab_conflict', {
              message: 'Opened in another tab. This session is now inactive.'
            });
            try { joinResult.oldWs.close(); } catch {}
          }

          socketClients.set(ws, {
            roomCode: room.code,
            playerId: joinResult.player.id,
            sessionToken: joinResult.player.sessionToken,
            lastReactionAt: 0
          });

          send(ws, 'room_joined', {
            code: room.code,
            playerId: joinResult.player.id,
            sessionToken: joinResult.player.sessionToken,
            isReconnect: joinResult.isReconnect,
            room: room.getSnapshot(joinResult.player.id)
          });

          // Broadcast presence
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

          // If both players are ready in lobby, host or server can start arranging!
          if (allReady && room.status === 'lobby') {
            room.startArranging();
            broadcastToRoom(room, 'start_arranging', {
              startingPlayerId: room.lastStartingPlayerId
            });
            syncRoomState(room);
          }
          break;
        }

        case 'start_arranging': {
          const client = socketClients.get(ws);
          if (!client) return;
          const room = deviceRooms.getRoom(client.roomCode);
          if (room && room.hostPlayerId === client.playerId && room.status === 'lobby') {
            room.startArranging();
            broadcastToRoom(room, 'start_arranging', {
              startingPlayerId: room.lastStartingPlayerId
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

            // Restart turn timer
            room._startTurnTimerIfNeeded();

            // Broadcast called number
            broadcastToRoom(room, 'number_called', {
              number: callRes.number,
              turnPlayerId: callRes.turnPlayerId,
              nextTurnPlayerId: callRes.nextTurnPlayerId,
              calledNumbers: room.match.calledNumbers,
              turnDeadline: room.turnDeadline,
              isAutoPicked: false
            });

            // Dispatch lines completed events
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

          // Rate limit: 1 reaction per 2 seconds
          const now = Date.now();
          if (now - (client.lastReactionAt || 0) < 2000) {
            return;
          }
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
          socketClients.delete(ws);
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
          const wallet = economy.getWallet(playerId);
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
          send(ws, 'daily_reward_claimed', {
            balance: acc.balance,
            transaction: tx
          });
          break;
        }

        case 'get_tournaments': {
          send(ws, 'tournaments_data', {
            knockout: {
              id: 'tourn-ko-1',
              title: 'Cobalt Cup Knockout',
              prizePool: 2500,
              entryFee: 100,
              status: 'LIVE',
              rounds: [
                {
                  name: 'Quarterfinals',
                  matches: [
                    { id: 'm1', p1: { name: 'You', score: 5, winner: true }, p2: { name: 'Viper99', score: 3 } },
                    { id: 'm2', p1: { name: 'Alex_Pro', score: 5, winner: true }, p2: { name: 'Zara', score: 4 } },
                    { id: 'm3', p1: { name: 'Rohit', score: 5, winner: true }, p2: { name: 'Kiran', score: 2 } },
                    { id: 'm4', p1: { name: 'Shadow', score: 5, winner: true }, p2: { name: 'Priya', score: 1 } }
                  ]
                },
                {
                  name: 'Semifinals',
                  matches: [
                    { id: 'm5', p1: { name: 'You', score: 0 }, p2: { name: 'Alex_Pro', score: 0 } },
                    { id: 'm6', p1: { name: 'Rohit', score: 0 }, p2: { name: 'Shadow', score: 0 } }
                  ]
                },
                {
                  name: 'Final',
                  matches: [
                    { id: 'm7', p1: { name: 'TBD', score: 0 }, p2: { name: 'TBD', score: 0 } }
                  ]
                }
              ]
            },
            league: {
              id: 'tourn-lg-1',
              title: 'Premier Bingo League',
              prizePool: 5000,
              standings: [
                { rank: 1, name: 'Alex_Pro', avatar: '⚡', mp: 10, w: 9, l: 1, pts: 27 },
                { rank: 2, name: 'Rohit', avatar: '🦊', mp: 10, w: 8, l: 2, pts: 24 },
                { rank: 3, name: 'You', avatar: '🎮', mp: 10, w: 7, l: 3, pts: 21 },
                { rank: 4, name: 'Shadow', avatar: '🐱', mp: 10, w: 6, l: 4, pts: 18 },
                { rank: 5, name: 'Zara', avatar: '🐼', mp: 10, w: 5, l: 5, pts: 15 },
                { rank: 6, name: 'Viper99', avatar: '🐍', mp: 10, w: 4, l: 6, pts: 12 },
                { rank: 7, name: 'Kiran', avatar: '🐯', mp: 10, w: 2, l: 8, pts: 6 },
                { rank: 8, name: 'Priya', avatar: '🐰', mp: 10, w: 1, l: 9, pts: 3 }
              ]
            }
          });
          break;
        }

        case 'get_leaderboard': {
          send(ws, 'leaderboard_data', {
            top3: [
              { rank: 1, name: 'Alex_Pro', avatar: '⚡', wins: 142, winRate: '78%', coins: 8450, medal: 'gold' },
              { rank: 2, name: 'Rohit', avatar: '🦊', wins: 128, winRate: '74%', coins: 6920, medal: 'silver' },
              { rank: 3, name: 'LuckyStar', avatar: '⭐', wins: 115, winRate: '71%', coins: 5800, medal: 'bronze' }
            ],
            ranks: [
              { rank: 4, name: 'Shadow', avatar: '🐱', wins: 98, winRate: '65%', coins: 4320 },
              { rank: 5, name: 'Zara', avatar: '🐼', wins: 87, winRate: '62%', coins: 3950 },
              { rank: 6, name: 'BingoViper', avatar: '🐍', wins: 76, winRate: '59%', coins: 3100 },
              { rank: 7, name: 'CyberSam', avatar: '🤖', wins: 64, winRate: '55%', coins: 2800 },
              { rank: 8, name: 'Kiran', avatar: '🐯', wins: 55, winRate: '52%', coins: 2350 },
              { rank: 9, name: 'NeonRider', avatar: '🚀', wins: 49, winRate: '49%', coins: 1980 },
              { rank: 10, name: 'Priya', avatar: '🐰', wins: 42, winRate: '46%', coins: 1650 }
            ],
            userRank: {
              rank: 14,
              wins: 28,
              winRate: '68%',
              coins: economy.getWallet(payload.playerId || 'guest').balance
            }
          });
          break;
        }

        // --- Friends Directory & Challenges (Mode 4) ---
        case 'get_friends_list': {
          const playerId = payload.playerId || socketClients.get(ws)?.playerId || 'guest';
          const friends = friendsManager.getFriendsList(playerId);
          send(ws, 'friends_list_data', { friends });
          break;
        }

        case 'send_challenge': {
          const fromId = payload.fromId || socketClients.get(ws)?.playerId || 'p1';
          const fromName = payload.fromName || 'Player';
          const fromAvatar = payload.fromAvatar || '🦊';
          const targetFriendId = payload.targetFriendId;

          const challenge = friendsManager.createChallenge({ id: fromId, name: fromName, avatar: fromAvatar }, targetFriendId);
          send(ws, 'challenge_sent', { challenge });

          // If target friend is an AI/mock friend or online player, simulate realistic duel accept
          setTimeout(() => {
            const code = deviceRooms.createRoom(fromId, `tok-${fromId}`, fromName, fromAvatar);
            const room = deviceRooms.getRoom(code);
            const friendName = targetFriendId.includes('alex') ? 'Alex_Pro' : (targetFriendId.includes('rohit') ? 'Rohit' : 'Friend_Duelist');
            room.joinPlayer(`bot-${Date.now()}`, `tok-f`, friendName, '⚡');
            send(ws, 'challenge_accepted', {
              challengeId: challenge.id,
              roomCode: code,
              opponentName: friendName
            });
          }, 1500);
          break;
        }

        // --- Friends Custom Tournaments (Modes 5, 6, 11, 12, 13) ---
        case 'create_custom_tournament': {
          const creatorId = payload.creatorId || socketClients.get(ws)?.playerId || 'p1';
          const creatorName = payload.creatorName || 'Host';
          const format = payload.format || 'LEAGUE'; // 'KNOCKOUT' | 'LEAGUE' | 'HYBRID'
          const title = payload.title || 'Friends Premier Cup';
          const maxParticipants = Number(payload.maxParticipants) || 8;
          const pointsPerWin = Number(payload.pointsPerWin) || 2;
          const pointsPerLoss = Number(payload.pointsPerLoss) || 0;

          const tourn = tournamentManager.createTournament(format, title, creatorId, creatorName, {
            maxParticipants,
            pointsPerWin,
            pointsPerLoss,
            qualificationSlots: 4
          });

          send(ws, 'custom_tournament_created', { tournament: tourn.getSnapshot() });
          break;
        }

        case 'start_custom_tournament': {
          const tourn = tournamentManager.getTournament(payload.tournamentId);
          if (tourn) {
            const snapshot = tourn.startTournament();
            send(ws, 'tournament_updated', { tournament: snapshot });
          }
          break;
        }

        case 'record_tournament_match_outcome': {
          const tourn = tournamentManager.getTournament(payload.tournamentId);
          if (tourn) {
            const snapshot = tourn.recordMatchResult(payload.matchId, payload.winnerId);
            send(ws, 'tournament_updated', { tournament: snapshot });
          }
          break;
        }
      }
    } catch (err) {
      console.error('[WebSocket] Message error:', err);
    }
  });

  ws.on('close', () => {
    const client = socketClients.get(ws);
    if (!client) return;

    const room = deviceRooms.getRoom(client.roomCode);
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
  server.listen(PORT, () => {
    console.log(`[Bingo Night Desk Server] Running live at http://localhost:${PORT}`);
  });
}
