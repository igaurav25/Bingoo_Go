/**
 * test/integration.test.js
 * 
 * End-to-end integration test simulating two WebSocket clients playing a full match.
 * Verifies real-time event synchronization, line completion choreography,
 * letter strike progression, BINGO button verification, and privacy preservation.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { Match } from '../server/gameState.js';

// Test harness creating a local ephemeral WebSocket server
function createTestServer() {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  const matches = new Map();
  const clients = new Map();

  function send(ws, type, payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, ...payload }));
    }
  }

  function broadcastToMatch(matchId, type, payload) {
    for (const [ws, info] of clients.entries()) {
      if (info.matchId === matchId) {
        send(ws, type, payload);
      }
    }
  }

  function findSocket(matchId, playerId) {
    for (const [ws, info] of clients.entries()) {
      if (info.matchId === matchId && info.playerId === playerId) {
        return ws;
      }
    }
    return null;
  }

  wss.on('connection', (ws) => {
    ws.on('message', async (data) => {
      const msg = JSON.parse(data.toString());
      const { type, matchId, playerId, payload = {} } = msg;

      switch (type) {
        case 'join_match': {
          clients.set(ws, { matchId, playerId, playerName: payload.playerName || playerId });
          let match = matches.get(matchId);
          if (!match) {
            match = new Match(matchId, playerId, 'pending_opponent', { claimRateLimitMs: 0 });
            matches.set(matchId, match);
          } else if (match.players['pending_opponent']) {
            delete match.players['pending_opponent'];
            match.players[playerId] = match._createPlayerRecord(playerId, payload.playerName || playerId);
            match.playerIds = [match.playerIds[0], playerId];
            match.currentTurnPlayerId = match.playerIds[0];
          }
          send(ws, 'state_snapshot', { snapshot: match.getSnapshot(playerId) });
          break;
        }

        case 'set_arrangement': {
          const match = matches.get(matchId);
          await match.enqueue(() => {
            const res = match.setPlayerArrangement(playerId, payload.grid);
            send(ws, 'arrangement_locked', { playerId, grid: match.players[playerId].grid });
            if (res.matchStarted) {
              broadcastToMatch(matchId, 'match_started', {
                matchId,
                currentTurnPlayerId: match.currentTurnPlayerId,
                status: match.status
              });
            }
          });
          break;
        }

        case 'call_number': {
          const match = matches.get(matchId);
          await match.enqueue(() => {
            const res = match.callNumber(playerId, payload.number);
            if (!res.success) {
              send(ws, 'error', { message: res.error });
              return;
            }
            broadcastToMatch(matchId, 'number_called', {
              number: res.number,
              turnPlayerId: res.turnPlayerId,
              nextTurnPlayerId: res.nextTurnPlayerId
            });
            for (const evt of res.events) {
              const targetWs = findSocket(matchId, evt.recipientId);
              if (targetWs) {
                send(targetWs, evt.event, evt.payload);
              }
            }
          });
          break;
        }

        case 'claim_bingo': {
          const match = matches.get(matchId);
          await match.enqueue(() => {
            const verdict = match.claimBingo(playerId, payload.claimId);
            broadcastToMatch(matchId, 'bingo_result', verdict);
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({
        port,
        close: () => new Promise(res => {
          wss.close();
          server.close(res);
        })
      });
    });
  });
}

// Client helper
class SimulatedClient {
  constructor(port, matchId, playerId, name) {
    this.url = `ws://127.0.0.1:${port}`;
    this.matchId = matchId;
    this.playerId = playerId;
    this.name = name;
    this.messages = [];
    this.ws = null;
  }

  connect() {
    return new Promise((resolve) => {
      this.ws = new WebSocket(this.url);
      this.ws.on('open', () => {
        this.send('join_match', { playerName: this.name });
        resolve();
      });
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        this.messages.push(msg);
      });
    });
  }

  send(type, payload = {}) {
    this.ws.send(JSON.stringify({
      type,
      matchId: this.matchId,
      playerId: this.playerId,
      payload
    }));
  }

  async waitForMessage(type, timeoutMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const found = this.messages.find(m => m.type === type);
      if (found) return found;
      await new Promise(r => setTimeout(r, 20));
    }
    throw new Error(`Timeout waiting for message type: ${type}`);
  }

  getMessages(type) {
    return this.messages.filter(m => m.type === type);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

test('Integration: Two simulated clients play full match with strict privacy and letter strikes', async () => {
  const server = await createTestServer();
  const matchId = 'integration-match-1';

  const client1 = new SimulatedClient(server.port, matchId, 'player-1', 'Alice');
  const client2 = new SimulatedClient(server.port, matchId, 'player-2', 'Bob');

  try {
    await client1.connect();
    await client2.connect();

    await client1.waitForMessage('state_snapshot');
    await client2.waitForMessage('state_snapshot');

    // Both players submit arrangements
    // p1: 1..25 sequential
    const grid1 = Array.from({ length: 25 }, (_, i) => i + 1);
    // p2: 25..1 reverse
    const grid2 = Array.from({ length: 25 }, (_, i) => 25 - i);

    client1.send('set_arrangement', { grid: grid1 });
    client2.send('set_arrangement', { grid: grid2 });

    await client1.waitForMessage('match_started');
    await client2.waitForMessage('match_started');

    // Call numbers 1..25 to complete lines
    for (let n = 1; n <= 25; n++) {
      // Find whose turn it is from the latest number_called or match_started
      const latestTurn = client1.messages.filter(m => m.nextTurnPlayerId || m.currentTurnPlayerId).pop();
      const currentTurn = latestTurn?.nextTurnPlayerId || latestTurn?.currentTurnPlayerId || 'player-1';

      if (currentTurn === 'player-1') {
        client1.send('call_number', { number: n });
      } else {
        client2.send('call_number', { number: n });
      }

      // Small tick for message dispatch
      await new Promise(r => setTimeout(r, 15));
    }

    // Verify client1 received line completion events with B-I-N-G-O letters
    const p1LineEvents = client1.getMessages('lines_completed');
    assert.ok(p1LineEvents.length > 0, 'Client 1 should receive lines_completed events');

    // Gather all newLines sent to client1
    const p1NewLines = p1LineEvents.flatMap(e => e.newLines || []);
    assert.ok(p1NewLines.length >= 5, `Expected at least 5 lines, got ${p1NewLines.length}`);

    // Verify first 5 lines mapped to B, I, N, G, O
    assert.equal(p1NewLines[0].letter, 'B');
    assert.equal(p1NewLines[1].letter, 'I');
    assert.equal(p1NewLines[2].letter, 'N');
    assert.equal(p1NewLines[3].letter, 'G');
    assert.equal(p1NewLines[4].letter, 'O');

    // Verify Client 2's received lines_completed events:
    // MUST contain linesCompleted count and playerId, but NEVER newLines with line IDs
    const p2LineEvents = client2.getMessages('lines_completed');
    const p2EventsForP1 = p2LineEvents.filter(e => e.playerId === 'player-1');
    assert.ok(p2EventsForP1.length > 0, 'Client 2 should receive public count updates for Client 1');
    for (const evt of p2EventsForP1) {
      assert.equal(evt.newLines, undefined, 'Opponent event must NEVER include newLines');
      assert.equal(typeof evt.linesCompleted, 'number');
    }

    // Client 1 claims BINGO
    client1.send('claim_bingo', { claimId: 'claim-p1-win' });

    const p1BingoResult = await client1.waitForMessage('bingo_result');
    assert.equal(p1BingoResult.valid, true);
    assert.equal(p1BingoResult.winnerId, 'player-1');

    const p2BingoResult = await client2.waitForMessage('bingo_result');
    assert.equal(p2BingoResult.valid, true);
    assert.equal(p2BingoResult.winnerId, 'player-1');

    // STRICT PRIVACY AUDIT:
    // Scan every single payload received by Client 2 to ensure Client 1's grid arrangement was NEVER leaked
    for (const msg of client2.messages) {
      const serialized = JSON.stringify(msg);
      // Grid 1 is [1, 2, 3, 4, 5, 6, 7, 8, ...]
      assert.equal(serialized.includes(JSON.stringify(grid1)), false, 'Opponent leaked client 1 grid array');
      if (msg.type === 'state_snapshot') {
        assert.equal(msg.snapshot.opponentState.grid, undefined);
        assert.equal(msg.snapshot.opponentState.completedLines, undefined);
      }
    }
  } finally {
    client1.close();
    client2.close();
    await server.close();
  }
});
