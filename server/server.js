/**
 * server/server.js
 * 
 * Production HTTP & WebSocket game server for Bingo.
 * Handles client connections, room management, monotonic event sequencing,
 * serial turn processing, authoritative BINGO verification, and static assets.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { Match } from './gameState.js';

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
 * Socket client store: socket -> { matchId, playerId, playerName }
 * @type {Map<WebSocket, { matchId: string, playerId: string, playerName: string }>}
 */
const clients = new Map();

/**
 * Sends a JSON message safely to a WebSocket client.
 * @param {WebSocket} ws
 * @param {string} type
 * @param {object} payload
 */
function send(ws, type, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

/**
 * Finds a connected client's socket by matchId and playerId.
 * @param {string} matchId
 * @param {string} playerId
 * @returns {WebSocket | null}
 */
function findClientSocket(matchId, playerId) {
  for (const [ws, info] of clients.entries()) {
    if (info.matchId === matchId && info.playerId === playerId) {
      return ws;
    }
  }
  return null;
}

/**
 * Broadcasts a message to all players in a match.
 * @param {string} matchId
 * @param {string} type
 * @param {object} payload
 */
function broadcastToMatch(matchId, type, payload) {
  for (const [ws, info] of clients.entries()) {
    if (info.matchId === matchId) {
      send(ws, type, payload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      const { type, matchId, playerId, payload = {} } = message;

      if (!type) return;

      switch (type) {
        case 'join_match': {
          const playerName = payload.playerName || `Player ${playerId}`;
          clients.set(ws, { matchId, playerId, playerName });

          let match = matches.get(matchId);
          if (!match) {
            // First player to join creates the match, waiting for second player
            match = new Match(matchId, playerId, 'pending_opponent');
            matches.set(matchId, match);
          } else if (match.players['pending_opponent']) {
            // Second player joins
            delete match.players['pending_opponent'];
            match.players[playerId] = match._createPlayerRecord(playerId, playerName);
            match.playerIds = [match.playerIds[0], playerId];
            match.currentTurnPlayerId = match.playerIds[0];
          }

          // Send current state snapshot to the joining player
          const snapshot = match.getSnapshot(playerId);
          send(ws, 'state_snapshot', { snapshot });

          // Notify room of connection status
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

            // Acknowledge arrangement locked
            send(ws, 'arrangement_locked', {
              playerId,
              grid: match.players[playerId].grid
            });

            // If both locked, match starts!
            if (res.matchStarted) {
              broadcastToMatch(matchId, 'match_started', {
                matchId,
                currentTurnPlayerId: match.currentTurnPlayerId,
                status: match.status
              });
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

            // Broadcast called number to both clients
            broadcastToMatch(matchId, 'number_called', {
              number: callRes.number,
              turnPlayerId: callRes.turnPlayerId,
              nextTurnPlayerId: callRes.nextTurnPlayerId,
              calledNumbers: match.calledNumbers
            });

            // Dispatch lines_completed events
            // Note: owner gets line descriptors; opponent gets count only
            for (const evt of callRes.events) {
              const targetWs = findClientSocket(matchId, evt.recipientId);
              if (targetWs) {
                send(targetWs, evt.event, evt.payload);
              }
            }
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
              // Broadcast victory to both players
              broadcastToMatch(matchId, 'bingo_result', {
                claimId: verdict.claimId,
                valid: true,
                winnerId: verdict.winnerId,
                reason: verdict.reason
              });
            } else {
              // Send rejection only to claimant (or broadcast if needed, spec: server -> both)
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

        default:
          console.warn(`[WebSocket] Unhandled message type: ${type}`);
      }
    } catch (err) {
      console.error('[WebSocket] Message handling error:', err);
      send(ws, 'error', { message: 'Internal server error processing message' });
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
