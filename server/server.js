/**
 * server/server.js
 * 
 * Production HTTP & WebSocket game server for Bingo.
 * Supports:
 * 1. 1v1 Online Matches with continuous cutting lines & authoritative claim
 * 2. Private Rooms with unique codes & waiting lobbies
 * 3. Knockout & League Tournaments with bracket/fixtures progression
 * 4. Authoritative Coin & Virtual Economy rewards
 * 5. Intelligent AI Bot players
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Match } from './gameState.js';
import { economy } from './economy.js';
import { roomManager } from './roomManager.js';
import { tournamentManager } from './tournamentManager.js';
import { BingoBot } from './botPlayer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');

const PORT = process.env.PORT || 3000;

// Content types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav'
};

// HTTP Server
const server = http.createServer((req, res) => {
  let reqPath = decodeURI(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = '';
  if (reqPath.startsWith('/shared/')) {
    filePath = path.join(ROOT_DIR, reqPath);
  } else {
    filePath = path.join(PUBLIC_DIR, reqPath);
  }

  // Security check: prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server });

/**
 * Global match store: matchId -> Match
 * @type {Map<string, Match>}
 */
export const matches = new Map();

/**
 * Active bots per match: matchId -> BingoBot
 * @type {Map<string, BingoBot>}
 */
export const matchBots = new Map();

/**
 * Socket client store: socket -> { matchId, playerId, playerName }
 * @type {Map<WebSocket, { matchId: string, playerId: string, playerName: string }>}
 */
const clients = new Map();

function send(ws, type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function findClientSocket(matchId, playerId) {
  for (const [ws, info] of clients.entries()) {
    if (info.matchId === matchId && info.playerId === playerId) {
      return ws;
    }
  }
  return null;
}

function broadcastToMatch(matchId, type, payload) {
  for (const [ws, info] of clients.entries()) {
    if (info.matchId === matchId) {
      send(ws, type, payload);
    }
  }
}

/**
 * Triggers a bot turn if the current turn belongs to an active bot.
 * @param {string} matchId
 * @param {Match} match
 */
function checkBotTurn(matchId, match) {
  if (match.status !== 'IN_PROGRESS') return;
  const currentTurnId = match.currentTurnPlayerId;
  const bot = matchBots.get(matchId);

  if (bot && bot.botId === currentTurnId) {
    setTimeout(async () => {
      if (match.status !== 'IN_PROGRESS' || match.currentTurnPlayerId !== bot.botId) return;

      await match.enqueue(() => {
        // Check if bot can claim BINGO
        const botPlayer = match.players[bot.botId];
        if (botPlayer && botPlayer.completedLines.length >= 5) {
          const verdict = match.claimBingo(bot.botId, `claim-bot-${Date.now()}`);
          if (verdict.valid) {
            broadcastToMatch(matchId, 'bingo_result', verdict);
            return;
          }
        }

        // Choose number and call
        const num = bot.chooseNumber(match.calledNumbers);
        const callRes = match.callNumber(bot.botId, num);
        if (callRes.success) {
          broadcastToMatch(matchId, 'number_called', {
            number: callRes.number,
            turnPlayerId: callRes.turnPlayerId,
            nextTurnPlayerId: callRes.nextTurnPlayerId,
            calledNumbers: match.calledNumbers
          });

          for (const evt of callRes.events) {
            const targetWs = findClientSocket(matchId, evt.recipientId);
            if (targetWs) {
              send(targetWs, evt.event, evt.payload);
            }
          }

          // If bot reached 5 lines with this call, claim immediately
          if (match.players[bot.botId].completedLines.length >= 5) {
            setTimeout(async () => {
              if (match.status === 'IN_PROGRESS') {
                const verdict = match.claimBingo(bot.botId, `claim-bot-${Date.now()}`);
                if (verdict.valid) {
                  broadcastToMatch(matchId, 'bingo_result', verdict);
                }
              }
            }, 600);
          } else {
            // Next turn might be bot again or human
            checkBotTurn(matchId, match);
          }
        }
      });
    }, 1100);
  }
}

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const { type, matchId, playerId, payload = {} } = message;

      if (!type) return;

      switch (type) {
        // --- Wallet & Economy ---
        case 'get_wallet': {
          const wallet = economy.getWallet(playerId);
          send(ws, 'wallet_update', { wallet });
          break;
        }

        // --- Private Rooms ---
        case 'create_private_room': {
          const room = roomManager.createRoom(playerId, payload.playerName || 'Player');
          clients.set(ws, { matchId: `room-${room.code}`, playerId, playerName: payload.playerName });
          send(ws, 'private_room_created', { room: room.getLobbySnapshot() });
          break;
        }

        case 'join_private_room': {
          const room = roomManager.getRoom(payload.roomCode);
          if (!room) {
            send(ws, 'error', { message: 'Room code not found' });
            return;
          }
          const res = room.addPlayer(playerId, payload.playerName || 'Player');
          if (!res.success) {
            send(ws, 'error', { message: res.error });
            return;
          }
          clients.set(ws, { matchId: `room-${room.code}`, playerId, playerName: payload.playerName });
          // Broadcast updated lobby to all clients in this room
          broadcastToMatch(`room-${room.code}`, 'private_room_updated', { room: res.room });
          break;
        }

        case 'add_room_bot': {
          const room = roomManager.getRoom(payload.roomCode);
          if (room && room.hostId === playerId) {
            const res = room.addBot();
            broadcastToMatch(`room-${room.code}`, 'private_room_updated', { room: res.room });
          }
          break;
        }

        case 'start_private_match': {
          const room = roomManager.getRoom(payload.roomCode);
          if (!room || room.hostId !== playerId) {
            send(ws, 'error', { message: 'Only room host can start the match' });
            return;
          }
          const res = room.startMatch();
          if (!res.success) {
            send(ws, 'error', { message: res.error });
            return;
          }
          matches.set(res.matchId, res.match);
          if (room.bot) {
            matchBots.set(res.matchId, room.bot);
          }

          broadcastToMatch(`room-${room.code}`, 'private_match_started', {
            matchId: res.matchId,
            roomCode: room.code
          });
          break;
        }

        // --- Tournaments ---
        case 'create_tournament': {
          const { tournamentType, tournamentName, playerName } = payload;
          const tourn = tournamentManager.createTournament(
            tournamentType || 'KNOCKOUT',
            tournamentName || 'Grand Bingo Arena',
            playerId,
            playerName || 'Host'
          );
          send(ws, 'tournament_created', { tournament: tourn.getSnapshot() });
          break;
        }

        case 'join_tournament': {
          const tourn = tournamentManager.getTournament(payload.tournamentId);
          if (tourn) {
            tourn.addParticipant(playerId, payload.playerName || 'Player');
            send(ws, 'tournament_updated', { tournament: tourn.getSnapshot() });
          }
          break;
        }

        case 'start_tournament': {
          const tourn = tournamentManager.getTournament(payload.tournamentId);
          if (tourn) {
            const snapshot = tourn.startTournament();
            send(ws, 'tournament_updated', { tournament: snapshot });
          }
          break;
        }

        case 'list_tournaments': {
          send(ws, 'tournament_list', { tournaments: tournamentManager.listTournaments() });
          break;
        }

        // --- Core Match Gameplay ---
        case 'join_match': {
          const playerName = payload.playerName || `Player ${playerId}`;
          clients.set(ws, { matchId, playerId, playerName });

          let match = matches.get(matchId);
          if (!match) {
            match = new Match(matchId, playerId, 'pending_opponent');
            matches.set(matchId, match);
          } else if (match.players['pending_opponent']) {
            delete match.players['pending_opponent'];
            match.players[playerId] = match._createPlayerRecord(playerId, playerName);
            match.playerIds = [match.playerIds[0], playerId];
            match.currentTurnPlayerId = match.playerIds[0];
          }

          // Send current state snapshot to joining player
          const snapshot = match.getSnapshot(playerId);
          send(ws, 'state_snapshot', { snapshot });

          // Send wallet balance
          const wallet = economy.getWallet(playerId);
          send(ws, 'wallet_update', { wallet });

          broadcastToMatch(matchId, 'player_joined', {
            matchId,
            playerId,
            playerName,
            players: match.playerIds.map(id => ({
              id,
              name: match.players[id]?.name || id,
              isLocked: match.players[id]?.isLocked || false
            }))
          });
          break;
        }

        case 'set_arrangement': {
          const match = matches.get(matchId);
          if (!match) {
            send(ws, 'error', { message: 'Match not found' });
            return;
          }

          await match.enqueue(() => {
            const { grid } = payload;
            const res = match.setPlayerArrangement(playerId, grid);
            if (!res.success) {
              send(ws, 'error', { message: res.error });
              return;
            }

            send(ws, 'arrangement_locked', {
              playerId,
              grid: match.players[playerId].grid
            });

            if (res.matchStarted) {
              broadcastToMatch(matchId, 'match_started', {
                matchId,
                currentTurnPlayerId: match.currentTurnPlayerId,
                status: match.status
              });
              checkBotTurn(matchId, match);
            } else {
              broadcastToMatch(matchId, 'player_ready', { playerId });
            }
          });
          break;
        }

        case 'auto_arrangement': {
          const match = matches.get(matchId);
          if (!match) {
            send(ws, 'error', { message: 'Match not found' });
            return;
          }

          await match.enqueue(() => {
            const res = match.autoRandomArrangement(playerId);
            if (!res.success) {
              send(ws, 'error', { message: res.error });
              return;
            }

            send(ws, 'arrangement_locked', {
              playerId,
              grid: res.grid
            });

            if (res.matchStarted) {
              broadcastToMatch(matchId, 'match_started', {
                matchId,
                currentTurnPlayerId: match.currentTurnPlayerId,
                status: match.status
              });
              checkBotTurn(matchId, match);
            } else {
              broadcastToMatch(matchId, 'player_ready', { playerId });
            }
          });
          break;
        }

        case 'call_number': {
          const match = matches.get(matchId);
          if (!match) {
            send(ws, 'error', { message: 'Match not found' });
            return;
          }

          await match.enqueue(() => {
            const num = Number(payload.number);
            const callRes = match.callNumber(playerId, num);
            if (!callRes.success) {
              send(ws, 'error', { message: callRes.error });
              return;
            }

            broadcastToMatch(matchId, 'number_called', {
              number: callRes.number,
              turnPlayerId: callRes.turnPlayerId,
              nextTurnPlayerId: callRes.nextTurnPlayerId,
              calledNumbers: match.calledNumbers
            });

            for (const evt of callRes.events) {
              const targetWs = findClientSocket(matchId, evt.recipientId);
              if (targetWs) {
                send(targetWs, evt.event, evt.payload);
              }
            }

            // Trigger bot turn if next turn is bot
            checkBotTurn(matchId, match);
          });
          break;
        }

        case 'claim_bingo': {
          const match = matches.get(matchId);
          if (!match) {
            send(ws, 'error', { message: 'Match not found' });
            return;
          }

          await match.enqueue(() => {
            const claimId = payload.claimId || `claim-${Date.now()}`;
            const verdict = match.claimBingo(playerId, claimId);

            if (verdict.valid) {
              // Authoritative coin reward for match victory
              if (!playerId.startsWith('bot-')) {
                const opponentId = match.getOpponentId(playerId);
                const opponentName = match.players[opponentId]?.name || 'Opponent';
                economy.awardMatchWin(playerId, 150, opponentName);
              }

              broadcastToMatch(matchId, 'bingo_result', {
                claimId: verdict.claimId,
                valid: true,
                winnerId: verdict.winnerId,
                reason: verdict.reason
              });

              // Send updated wallet to winner
              const winnerWs = findClientSocket(matchId, verdict.winnerId);
              if (winnerWs) {
                send(winnerWs, 'wallet_update', { wallet: economy.getWallet(verdict.winnerId) });
              }
            } else {
              broadcastToMatch(matchId, 'bingo_result', {
                claimId: verdict.claimId,
                valid: false,
                winnerId: verdict.winnerId,
                reason: verdict.reason
              });
            }
          });
          break;
        }

        case 'request_snapshot': {
          const match = matches.get(matchId);
          if (!match) {
            send(ws, 'error', { message: 'Match not found' });
            return;
          }
          const snapshot = match.getSnapshot(playerId);
          send(ws, 'state_snapshot', { snapshot });
          break;
        }
      }
    } catch (err) {
      console.error('[WebSocket] Message handling error:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

export { server, wss };

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`[Bingo Server] Running at http://localhost:${PORT}`);
  });
}
