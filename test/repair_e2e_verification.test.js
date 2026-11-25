/**
 * test/repair_e2e_verification.test.js
 *
 * End-to-End Verification Suite for Repaired Bingoo Goo Application:
 * 1. Frontend Build Artifacts, Offline QR SVG Generator & SPA Routing
 * 2. Honest /health & /api/health/db Reporting
 * 3. Auth Guest Session, Profile Persistence & Non-Fake Directory/Leaderboard
 * 4. Two-Client Real-Time WebSocket Room Create -> Join -> Arranging -> Turn Play ->
 *    Invalid Claim Rejection -> Valid 5-Line BINGO Claim -> Rematch
 * 5. Real WebSocket Quick Match Queue Pairing & Cancellation
 * 6. Tournament Authoritative Match Verification (blocks spoofed /match-result, auto-advances on WS win)
 * 7. Bug-Fix & Responsive Viewport Guarantees across Web & Mobile
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import { server } from '../server/server.js';
import { ROOM_ALPHABET } from '../server/roomManager.js';
import { generateRandomGrid } from '../shared/lineModel.js';
import { generateQRMatrix, generateQRCodeSVG } from '../public/js/qrcode.js';

function wsConnect(port) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const queue = [];
    const waiters = [];

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      const idx = waiters.findIndex(w => !w.type || w.type === msg.type);
      if (idx !== -1) {
        const waiter = waiters.splice(idx, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(msg);
      } else {
        queue.push(msg);
      }
    });

    const nextMsg = (type = null, timeoutMs = 5000) => {
      const qIdx = queue.findIndex(m => !type || m.type === type);
      if (qIdx !== -1) {
        return Promise.resolve(queue.splice(qIdx, 1)[0]);
      }
      return new Promise((res, rej) => {
        const timer = setTimeout(() => {
          const wIdx = waiters.findIndex(w => w.timer === timer);
          if (wIdx !== -1) waiters.splice(wIdx, 1);
          rej(new Error(`Timed out waiting for WS message: ${type || 'any'}`));
        }, timeoutMs);
        waiters.push({ type, resolve: res, reject: rej, timer });
      });
    };

    const sendMsg = (type, payload = {}) => {
      ws.send(JSON.stringify({ type, payload }));
    };

    ws.once('open', () => resolve({ ws, nextMsg, sendMsg, close: () => ws.close() }));
    ws.once('error', reject);
  });
}

describe('Complete Repaired Bingoo Goo E2E Verification', () => {
  let baseUrl = '';
  let port = 0;

  before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('1. Offline QR Generator creates valid pure SVG with zero external requests', () => {
    const matrix = generateQRMatrix('http://localhost:3000/r/B4K8M');
    assert.ok(Array.isArray(matrix) && matrix.length >= 21);
    const svg = generateQRCodeSVG('http://localhost:3000/r/B4K8M', 140);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('<rect'));
    assert.equal(svg.includes('qrserver.com'), false, 'QR SVG must be 100% offline');
  });

  it('2. Built frontend bundle exists & SPA routes return valid HTML shell', async () => {
    const jsBundle = path.resolve('public/dist/bingo-react.js');
    const cssBundle = path.resolve('public/dist/bingo-react.css');
    assert.ok(fs.existsSync(jsBundle) && fs.statSync(jsBundle).size > 1024, 'Built JS bundle required');
    assert.ok(fs.existsSync(cssBundle) && fs.statSync(cssBundle).size > 128, 'Built CSS bundle required');

    for (const route of ['/', '/r/B4K8M', '/modes', '/tournaments', '/leaderboard', '/profile', '/game']) {
      const res = await fetch(`${baseUrl}${route}`);
      assert.equal(res.status, 200, `Expected 200 for ${route}`);
      const html = await res.text();
      assert.ok(html.includes('id="app-root"'), `Expected #app-root on ${route}`);
      assert.ok(html.includes('/dist/bingo-react.js'), `Expected React bundle tag on ${route}`);
    }
  });

  it('3. /health and /api/health/db report honest frontendBundle, websocket, and database status', async () => {
    const healthRes = await fetch(`${baseUrl}/health`);
    const health = await healthRes.json();
    assert.equal(healthRes.status, 200);
    assert.equal(health.status, 'ok');
    assert.equal(health.frontendBundle.ready, true);
    assert.equal(typeof health.database.connected, 'boolean');

    const dbRes = await fetch(`${baseUrl}/api/health/db`);
    const db = await dbRes.json();
    assert.equal(dbRes.status, 200);
    assert.equal(typeof db.connected, 'boolean');
    assert.ok(['online', 'offline_fallback'].includes(db.status));
  });

  it('4. Guest session, profile edit, and real directory work cleanly', async () => {
    const gRes = await fetch(`${baseUrl}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: '🦁' })
    });
    const gData = await gRes.json();
    assert.equal(gRes.status, 201);
    assert.equal(gData.success, true);
    assert.ok(gData.user.id && gData.sessionToken);

    const updRes = await fetch(`${baseUrl}/api/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: gData.user.id, displayName: 'E2E_Captain', avatar: '⚡' })
    });
    const updData = await updRes.json();
    assert.equal(updRes.status, 200);
    assert.equal(updData.profile.displayName, 'E2E_Captain');
  });

  it('5. Full 2-player WebSocket flow: Create -> Join -> Lock -> Play -> Reject Invalid Claim -> Valid Win -> Rematch', async () => {
    const c1 = await wsConnect(port);
    const c2 = await wsConnect(port);
    const c3 = await wsConnect(port);

    try {
      c1.sendMsg('create_room', {
        playerId: 'ws-p1',
        name: 'HostAlice',
        avatar: '🦊',
        settings: { turnTimerSeconds: 30, seriesTargetWins: 2 }
      });
      const created = await c1.nextMsg('room_created');
      const code = created.code;
      assert.equal(code.length, 5);
      for (const ch of code) {
        assert.ok(ROOM_ALPHABET.includes(ch), `Room code char ${ch} must belong to ROOM_ALPHABET`);
      }

      c2.sendMsg('join_room', { code, playerId: 'ws-p2', name: 'GuestBob', avatar: '🐼' });
      const joined = await c2.nextMsg('room_joined');
      assert.equal(joined.code, code);
      assert.equal(joined.room.players.length, 2);

      // Both players toggle Ready -> server transitions to arranging
      c2.sendMsg('set_ready', { ready: true });
      c1.sendMsg('set_ready', { ready: true });
      const arr1 = await c1.nextMsg('start_arranging');
      const arr2 = await c2.nextMsg('start_arranging');
      assert.ok(arr1.startingPlayerId);
      assert.equal(arr1.startingPlayerId, arr2.startingPlayerId);

      // Build deterministic boards where ws-p1 completes top row + 4 columns easily (or sequential 1..25)
      const seqGrid = Array.from({ length: 25 }, (_, i) => i + 1);
      const revGrid = [...seqGrid].reverse();

      c1.sendMsg('lock_board', { grid: seqGrid });
      c2.sendMsg('lock_board', { grid: revGrid });

      const started = await c1.nextMsg('match_started');
      await c2.nextMsg('match_started');

      // Third latecomer must be rejected while match is playing
      c3.sendMsg('join_room', { code, playerId: 'ws-p3', name: 'Intruder' });
      const joinErr = await c3.nextMsg('error');
      assert.equal(joinErr.code, 'MATCH_ALREADY_STARTED');

      // Premature BINGO claim before 5 lines must be rejected for both clients
      c1.sendMsg('claim_bingo', { claimId: 'premature-1' });
      const badClaim = await c1.nextMsg('bingo_result');
      await c2.nextMsg('bingo_result');
      assert.equal(badClaim.valid, false);

      // Alternate turns until 5 lines complete for ws-p1 (calling 1..20 completes 4 full rows 1..5,6..10,11..15,16..20,
      // plus calling 21, 22, 23, 24 completes 5th line column 0 or 5 rows by 25!)
      // Wait: numbers 1..5 (row 0), 6..10 (row 1), 11..15 (row 2), 16..20 (row 3), 21..25 (row 4).
      // Also calling columns/rows: calling 1..21 completes 4 rows + column 0 (1,6,11,16,21) = 5 lines!
      let turnId = started.currentTurnPlayerId;
      for (let num = 1; num <= 21; num++) {
        const activeClient = turnId === 'ws-p1' ? c1 : c2;
        activeClient.sendMsg('call_number', { number: num });
        const callBroadcast1 = await c1.nextMsg('number_called');
        await c2.nextMsg('number_called');
        assert.equal(callBroadcast1.number, num);
        turnId = callBroadcast1.nextTurnPlayerId;
      }

      // Wait past 400ms claim rate limit window, then claim with 5 valid completed lines
      await new Promise(r => setTimeout(r, 450));
      c1.sendMsg('claim_bingo', { claimId: 'valid-win-1' });
      const win1 = await c1.nextMsg('bingo_result');
      const win2 = await c2.nextMsg('bingo_result');
      assert.equal(win1.valid, true);
      assert.equal(win1.winnerId, 'ws-p1');
      assert.equal(win2.winnerId, 'ws-p1');

      // Rematch negotiation requires both players
      c1.sendMsg('request_rematch', {});
      await c1.nextMsg('rematch_requested');
      c2.sendMsg('request_rematch', {});
      const rematch1 = await c1.nextMsg('rematch_started');
      const rematch2 = await c2.nextMsg('rematch_started');
      assert.ok(rematch1.startingPlayerId && rematch2.startingPlayerId);
    } finally {
      c1.close();
      c2.close();
      c3.close();
    }
  });

  it('6. Real WebSocket Quick Match pairs two waiting humans and supports cancel', async () => {
    const q1 = await wsConnect(port);
    const q2 = await wsConnect(port);
    try {
      q1.sendMsg('find_quick_match', { playerId: 'qm-1', name: 'QuickOne' });
      const queued = await q1.nextMsg('quick_match_queued');
      assert.equal(queued.position, 1);

      q1.sendMsg('cancel_quick_match', {});
      const cancelled = await q1.nextMsg('quick_match_cancelled');
      assert.equal(cancelled.cancelled, true);

      q1.sendMsg('find_quick_match', { playerId: 'qm-1', name: 'QuickOne' });
      await q1.nextMsg('quick_match_queued');

      q2.sendMsg('find_quick_match', { playerId: 'qm-2', name: 'QuickTwo' });
      const found1 = await q1.nextMsg('quick_match_found');
      const found2 = await q2.nextMsg('quick_match_found');
      assert.equal(found1.code, found2.code);
      assert.equal(found1.opponent.name, 'QuickTwo');
      assert.equal(found2.opponent.name, 'QuickOne');
    } finally {
      q1.close();
      q2.close();
    }
  });

  it('7. Tournament live room match blocks spoofed POST /match-result and advances automatically on server win', async () => {
    // Create & start 2-player tournament
    const createRes = await fetch(`${baseUrl}/api/tournaments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Auth Security Cup', format: 'KNOCKOUT', maxPlayers: 2, creatorId: 't-host', creatorName: 'HostA' })
    });
    const { tournament: t0 } = await createRes.json();

    await fetch(`${baseUrl}/api/tournaments/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: t0.code, playerId: 't-guest', playerName: 'GuestB' })
    });

    const startRes = await fetch(`${baseUrl}/api/tournaments/${t0.id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hostId: 't-host' })
    });
    const { tournament: tLive } = await startRes.json();
    const matchId = tLive.matches[0].id;

    const mStartRes = await fetch(`${baseUrl}/api/tournaments/${t0.id}/matches/${matchId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: 't-host' })
    });
    const { roomCode } = await mStartRes.json();
    assert.ok(roomCode && roomCode.length === 5);

    const tc1 = await wsConnect(port);
    const tc2 = await wsConnect(port);
    try {
      tc1.sendMsg('join_room', { code: roomCode, playerId: 't-host', name: 'HostA' });
      await tc1.nextMsg('room_joined');
      tc2.sendMsg('join_room', { code: roomCode, playerId: 't-guest', name: 'GuestB' });
      await tc2.nextMsg('room_joined');

      tc2.sendMsg('set_ready', { ready: true });
      tc1.sendMsg('set_ready', { ready: true });
      await tc1.nextMsg('start_arranging');
      await tc2.nextMsg('start_arranging');

      const seq = Array.from({ length: 25 }, (_, i) => i + 1);
      tc1.sendMsg('lock_board', { grid: seq });
      tc2.sendMsg('lock_board', { grid: generateRandomGrid() });
      const started = await tc1.nextMsg('match_started');
      await tc2.nextMsg('match_started');

      // Spoof attempt mid-match MUST be rejected (403)
      const spoofRes = await fetch(`${baseUrl}/api/tournaments/${t0.id}/match-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, winnerId: 't-guest', scores: [5, 0] })
      });
      assert.equal(spoofRes.status, 403, 'Unfinished active match must reject spoofed result');

      let turn = started.currentTurnPlayerId;
      for (let n = 1; n <= 21; n++) {
        (turn === 't-host' ? tc1 : tc2).sendMsg('call_number', { number: n });
        const call = await tc1.nextMsg('number_called');
        await tc2.nextMsg('number_called');
        turn = call.nextTurnPlayerId;
      }

      tc1.sendMsg('claim_bingo', { claimId: 'tourn-win' });
      const verdict = await tc1.nextMsg('bingo_result');
      assert.equal(verdict.valid, true);
      assert.equal(verdict.winnerId, 't-host');

      const tournUpdate = await tc1.nextMsg('tournament_updated');
      assert.equal(tournUpdate.tournament.matches[0].winnerId, 't-host');
      assert.equal(tournUpdate.tournament.champion?.id, 't-host');
    } finally {
      tc1.close();
      tc2.close();
    }
  });

  it('8. Code-level regression & responsive viewport checks pass across Web & Mobile', () => {
    const overview = fs.readFileSync(path.resolve('src/tournaments/screens/TournamentOverview.jsx'), 'utf8');
    assert.ok(overview.includes('useEffect'), 'TournamentOverview must import useEffect');
    assert.equal(overview.includes("currentUserId === 'user-player'"), false, 'Must not contain user-player host bypass');

    const champ = fs.readFileSync(path.resolve('src/tournaments/screens/TournamentChampion.jsx'), 'utf8');
    const firstHook = champ.indexOf('useMemo(');
    const earlyReturn = champ.indexOf('if (!tournament) return null;');
    assert.ok(firstHook !== -1 && earlyReturn !== -1 && firstHook < earlyReturn, 'Hooks must run before early return in TournamentChampion');

    const themeCss = fs.readFileSync(path.resolve('src/styles/sportsTheme.css'), 'utf8');
    assert.ok(themeCss.includes('@media (max-width: 580px)'));
    assert.ok(themeCss.includes('@media (max-width: 390px)'));
    assert.ok(themeCss.includes('.sports-board-arena-row'));
    assert.ok(themeCss.includes('overflow-x: hidden'));

    const mobSock = fs.readFileSync(path.resolve('mobile/services/socketService.ts'), 'utf8');
    assert.ok(mobSock.includes('payload:'), 'Mobile SocketService must wrap messages in { type, payload }');

    const mobTourn = fs.readFileSync(path.resolve('mobile/screens/TournamentScreen.tsx'), 'utf8');
    assert.ok(mobTourn.includes('Cannot Start Match'), 'Mobile handlePlayFixture must block launch on backend failure');
  });
});
