/**
 * test/tournamentLiveApi.test.js
 * In-process live HTTP API test for all tournament endpoints:
 * - GET /api/tournaments
 * - POST /api/tournaments (Creation)
 * - POST /api/tournaments/join (Joining by Code)
 * - POST /api/tournaments/:id/start (Starting)
 * - POST /api/tournaments/:id/matches/:matchId/start (Match room linking)
 * - POST /api/tournaments/:id/match-result (Result recording)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { server } from '../server/server.js';

describe('Live Tournament API Lifecycle Verification', () => {
  let port;

  before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function request(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: data ? { 'Content-Type': 'application/json' } : {}
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let parsed = {};
          try { parsed = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode, data: parsed, body });
        });
      });
      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  it('1. GET /api/tournaments returns initialized production tournaments', async () => {
    const res = await request('/api/tournaments');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.tournaments));
    assert.ok(res.data.tournaments.length >= 3);
  });

  it('2. POST /api/tournaments creates a new custom tournament', async () => {
    const res = await request('/api/tournaments', 'POST', {
      name: 'Thunderbolt Championship',
      format: 'KNOCKOUT',
      maxPlayers: 4,
      entryFee: 100,
      creatorId: 'player-alice',
      creatorName: 'Alice Host'
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.tournament.id.startsWith('tourn-'));
    assert.strictEqual(res.data.tournament.name, 'Thunderbolt Championship');
    assert.strictEqual(res.data.tournament.status, 'REGISTERING');
    assert.ok(res.data.tournament.code && res.data.tournament.code.length >= 4);

    // Save for subsequent steps
    global._testTourn = res.data.tournament;
  });

  it('3. GET /api/tournaments?code=:code finds the tournament by code', async () => {
    const code = global._testTourn.code;
    const res = await request(`/api/tournaments?code=${code}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.tournaments.length, 1);
    assert.strictEqual(res.data.tournaments[0].id, global._testTourn.id);
  });

  it('4. POST /api/tournaments/join adds participants by tournament code', async () => {
    const code = global._testTourn.code;
    const res2 = await request('/api/tournaments/join', 'POST', {
      code,
      playerId: 'player-bob',
      playerName: 'Bob Striker'
    });
    assert.strictEqual(res2.status, 200);

    const res3 = await request('/api/tournaments/join', 'POST', {
      code,
      playerId: 'player-charlie',
      playerName: 'Charlie Ace'
    });
    assert.strictEqual(res3.status, 200);

    const res4 = await request('/api/tournaments/join', 'POST', {
      code,
      playerId: 'player-dave',
      playerName: 'Dave Champ'
    });
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.data.tournament.participants.length, 4);
  });

  it('5. POST /api/tournaments/:id/start starts the tournament and generates matches', async () => {
    const id = global._testTourn.id;
    const res = await request(`/api/tournaments/${id}/start`, 'POST', {
      hostId: 'player-alice'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.tournament.status, 'IN_PROGRESS');
    assert.strictEqual(res.data.tournament.knockoutMatches.length, 3);
    assert.strictEqual(res.data.tournament.knockoutMatches[0].status, 'READY');

    global._testMatch = res.data.tournament.knockoutMatches[0];
  });

  it('6. POST /api/tournaments/:id/matches/:matchId/start creates a device room for gameplay', async () => {
    const tournId = global._testTourn.id;
    const matchId = global._testMatch.id;

    const res = await request(`/api/tournaments/${tournId}/matches/${matchId}/start`, 'POST', {
      playerId: 'player-alice'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.roomCode && res.data.roomCode.length === 5, 'Valid 5-char room code');
    assert.strictEqual(res.data.matchId, matchId);
    assert.strictEqual(res.data.tournamentId, tournId);
  });

  it('7. POST /api/tournaments/:id/match-result records match outcome and advances winner', async () => {
    const tournId = global._testTourn.id;
    const matchId = global._testMatch.id;

    const res = await request(`/api/tournaments/${tournId}/match-result`, 'POST', {
      matchId,
      winnerId: 'player-alice',
      scores: [5, 2]
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.tournament.knockoutMatches[0].status, 'COMPLETED');
    assert.strictEqual(res.data.tournament.knockoutMatches[0].winnerId, 'player-alice');
  });
});
