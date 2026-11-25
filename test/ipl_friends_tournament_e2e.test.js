import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { server } from '../server/server.js';
import { tournamentManager } from '../server/tournamentManager.js';
import { tournamentService } from '../server/services/tournamentService.js';

let baseUrl = '';
let port = 0;

function api(pathname, method = 'GET', body = null, token = null) {
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(async (res) => {
    const data = await res.json();
    return { status: res.status, data };
  });
}

function wsConnect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    const queue = [];
    const waiters = [];

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      const idx = waiters.findIndex(w => !w.type || w.type === msg.type);
      if (idx !== -1) {
        const w = waiters.splice(idx, 1)[0];
        clearTimeout(w.timer);
        w.resolve(msg);
      } else {
        queue.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        ws,
        sendMsg(type, payload = {}) {
          ws.send(JSON.stringify({ type, payload }));
        },
        nextMsg(type = null, timeoutMs = 6000) {
          const qIdx = queue.findIndex(m => !type || m.type === type);
          if (qIdx !== -1) {
            return Promise.resolve(queue.splice(qIdx, 1)[0]);
          }
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              rej(new Error(`Timeout waiting for WS event: ${type || 'any'}`));
            }, timeoutMs);
            waiters.push({ type, resolve: res, reject: rej, timer });
          });
        },
        drainType(type) {
          for (let i = queue.length - 1; i >= 0; i--) {
            if (queue[i].type === type) queue.splice(i, 1);
          }
        },
        close() {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        }
      });
    });

    ws.on('error', reject);
  });
}

// Winner grid: 1..25 sequentially (completes 5 lines early via Rows 0..2 + Col 0 + Main Diag by ~18-20 picks)
const WINNER_GRID = Array.from({ length: 25 }, (_, i) => i + 1);
// Permutation designed not to complete 5 lines before WINNER_GRID completes 5 lines
const LOSER_GRID = [
  25, 12, 3, 18, 9,
  14, 22, 7, 1, 20,
  11, 4, 16, 24, 6,
  2, 19, 23, 8, 15,
  5, 13, 21, 10, 17
];

// Deterministic call sequence: [1..21] completes 4 full Rows (1..20) + Col 0 (1,6,11,16,21) = 5 horizontal/vertical lines on WINNER_GRID
// while LOSER_GRID completes only 2 lines (Row 4 + Col 4)
const WINNER_PICK_ORDER = Array.from({ length: 25 }, (_, i) => i + 1);

async function playVerifiedWsBingoMatch(tournamentId, matchId, winnerPlayer, loserPlayer) {
  const startRes = await api(`/api/tournaments/${tournamentId}/matches/${matchId}/start`, 'POST', {
    playerId: winnerPlayer.id
  });
  assert.equal(startRes.status, 200, `Expected match ${matchId} room start 200, got ${startRes.status}: ${JSON.stringify(startRes.data)}`);
  const { roomCode } = startRes.data;
  assert.ok(roomCode && roomCode.length === 5);

  const wSock = await wsConnect();
  const lSock = await wsConnect();
  try {
    wSock.sendMsg('join_room', { code: roomCode, playerId: winnerPlayer.id, name: winnerPlayer.name, avatar: '👑' });
    await wSock.nextMsg('room_joined');

    lSock.sendMsg('join_room', { code: roomCode, playerId: loserPlayer.id, name: loserPlayer.name, avatar: '🦊' });
    await lSock.nextMsg('room_joined');

    lSock.sendMsg('set_ready', { ready: true });
    wSock.sendMsg('set_ready', { ready: true });

    await wSock.nextMsg('start_arranging');
    await lSock.nextMsg('start_arranging');

    wSock.sendMsg('lock_board', { grid: WINNER_GRID });
    lSock.sendMsg('lock_board', { grid: LOSER_GRID });

    const started = await wSock.nextMsg('match_started');
    await lSock.nextMsg('match_started');

    let currentTurnId = started.currentTurnPlayerId;
    const calledSet = new Set();
    let winnerLines = 0;

    for (let step = 0; step < 25; step++) {
      if (winnerLines >= 5) break;

      const nextNum = WINNER_PICK_ORDER.find(n => !calledSet.has(n));
      assert.ok(nextNum, 'Must have an uncalled number');

      const actingSocket = currentTurnId === winnerPlayer.id ? wSock : lSock;
      const actingId = currentTurnId;
      assert.ok(actingId, 'Acting player existed');

      actingSocket.sendMsg('call_number', { number: nextNum });
      const callMsg = await wSock.nextMsg('number_called');
      await lSock.nextMsg('number_called');
      calledSet.add(callMsg.number);
      currentTurnId = callMsg.nextTurnPlayerId;

      wSock.drainType('room_state');
      lSock.drainType('room_state');
      wSock.drainType('line_progress');
      lSock.drainType('line_progress');

      // Winner grid [1..25] completes Rows 0..3 + Col0 cleanly once 1..21 are called
      const hasWinLines = Array.from({ length: 21 }, (_, k) => k + 1).every(n => calledSet.has(n));
      if (hasWinLines) winnerLines = 5;
    }

    assert.ok(winnerLines >= 5, `Winner ${winnerPlayer.name} must achieve >= 5 completed lines (got ${winnerLines})`);
    wSock.sendMsg('claim_bingo', { claimId: `claim-${matchId}-${Date.now()}` });

    const verdict = await wSock.nextMsg('bingo_result');
    assert.equal(verdict.valid, true, `Authoritative Bingo claim must validate cleanly: ${verdict.reason}`);
    assert.equal(verdict.winnerId, winnerPlayer.id);

    // Wait briefly for server handleVictory -> tournament_updated sync
    await new Promise(r => setTimeout(r, 40));
  } finally {
    wSock.close();
    lSock.close();
  }
}

describe('IPL-Style Friends Tournament Complete E2E Suite', () => {
  before(async () => {
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('1. 8-Player Authenticated Friends Knockout: Create -> Associated Lobby & Online Presence -> Real WS Bingo QF->SF->Final -> Champion & Rewards', async () => {
    // Register 8 distinct authenticated player accounts + 1 outsider
    const friends = [];
    for (let i = 0; i < 8; i++) {
      const uname = `ipluser_${Date.now().toString(36)}_${i}`;
      const regRes = await api('/api/auth/register', 'POST', {
        username: uname,
        password: 'StrongPassword!1',
        avatar: '🏏'
      });
      assert.equal(regRes.status, 201);
      assert.ok(regRes.data.token && regRes.data.user?.id);
      friends.push({
        id: regRes.data.user.id,
        name: uname,
        token: regRes.data.token
      });
    }
    const outsiderReg = await api('/api/auth/register', 'POST', {
      username: `ipl_outsider_${Date.now().toString(36)}`,
      password: 'StrongPassword!1'
    });
    const outsider = { id: outsiderReg.data.user.id, name: outsiderReg.data.user.username, token: outsiderReg.data.token };

    // Security check: forged Bearer token rejected with 401
    const forgedCreate = await api('/api/tournaments', 'POST', {
      name: 'Invalid Token Cup',
      format: 'KNOCKOUT'
    }, 'forged-invalid-token');
    assert.equal(forgedCreate.status, 401);

    // Step 1: Account A creates 8-player Knockout requiring all 8 players with configurable rules
    const createRes = await api('/api/tournaments', 'POST', {
      name: 'IPL Friends Super Cup',
      description: 'Real 8-friend Knockout Championship',
      format: 'KNOCKOUT',
      minParticipants: 8,
      maxParticipants: 8,
      entryFee: 100,
      prizePool: 800,
      turnTimerSeconds: 30,
      disconnectRule: 'PAUSE_60S',
      timeoutRule: 'AUTO_PICK'
    }, friends[0].token);
    assert.equal(createRes.status, 201);
    const created = createRes.data.tournament;
    assert.ok(created.id && created.code && created.code.length >= 5);
    assert.equal(created.joinUrl, `/tournaments/join/${created.code}`);
    assert.equal(created.status, 'REGISTERING');
    assert.equal(created.participants.length, 1);
    assert.equal(created.creatorId, friends[0].id);
    // Automatic associated Lobby verification
    assert.ok(created.lobby && created.lobby.code === created.code && created.lobby.status === 'OPEN');

    // Step 2: Early start attempt BEFORE minParticipants must fail (400) and NEVER invent bots
    const tooEarlyStart = await api(`/api/tournaments/${created.id}/start`, 'POST', {}, friends[0].token);
    assert.equal(tooEarlyStart.status, 400);
    assert.match(tooEarlyStart.data.error, /at least 8/i);

    // Step 3: Duplicate join by Host must be blocked (409) & spoofed identity with mismatched token rejected (403)
    const spoofJoin = await api('/api/tournaments/join', 'POST', {
      code: created.code,
      playerId: friends[0].id
    }, friends[1].token);
    assert.equal(spoofJoin.status, 403);

    const dupJoin = await api('/api/tournaments/join', 'POST', {
      code: created.code
    }, friends[0].token);
    assert.equal(dupJoin.status, 409);
    assert.equal(dupJoin.data.alreadyJoined, true);

    // Step 4: Accounts B..H join with real Bearer tokens & toggle ready
    for (let i = 1; i < friends.length; i++) {
      const joinRes = await api('/api/tournaments/join', 'POST', {
        code: created.code
      }, friends[i].token);
      assert.equal(joinRes.status, 200);
      assert.equal(joinRes.data.tournament.participants.length, i + 1);
      const joined = joinRes.data.tournament.participants.find(p => p.id === friends[i].id);
      assert.equal(joined.isBot, false);
      assert.equal(joined.qualificationStatus, 'REGISTERED');

      const readyRes = await api(`/api/tournaments/${created.id}/ready`, 'POST', {
        isReady: true
      }, friends[i].token);
      assert.equal(readyRes.status, 200);
    }

    // Real-time WebSocket Lobby Presence check
    const lobbySockA = await wsConnect();
    lobbySockA.sendMsg('join_tournament_lobby', { tournamentId: created.id, playerId: friends[0].id, name: friends[0].name });
    const presenceUpdate = await lobbySockA.nextMsg('tournament_updated');
    assert.ok(presenceUpdate.tournament.lobby.onlinePlayerIds.includes(friends[0].id));
    lobbySockA.close();
    await new Promise(r => setTimeout(r, 30));

    // Step 5: 9th outsider blocked (Full) & non-host cannot start (403)
    const ninthJoin = await api('/api/tournaments/join', 'POST', {
      code: created.code
    }, outsider.token);
    assert.equal(ninthJoin.status, 400);
    assert.match(ninthJoin.data.error, /full/i);

    const nonHostStart = await api(`/api/tournaments/${created.id}/start`, 'POST', {}, friends[1].token);
    assert.equal(nonHostStart.status, 403);

    // Confirm tournament STILL hasn't auto-started just from reaching capacity
    const preStartCheck = await api(`/api/tournaments/${created.id}`);
    assert.equal(preStartCheck.data.tournament.status, 'REGISTERING');
    assert.equal(preStartCheck.data.tournament.readyCount, 8);

    // Step 6: Host A officially starts tournament
    const startRes = await api(`/api/tournaments/${created.id}/start`, 'POST', {}, friends[0].token);
    assert.equal(startRes.status, 200);
    const liveTourn = startRes.data.tournament;
    assert.equal(liveTourn.status, 'IN_PROGRESS');
    assert.equal(liveTourn.lobby.status, 'LOCKED');
    assert.equal(liveTourn.knockoutMatches.length, 7);

    // Invite/join now blocked because registration closed
    const postStartJoin = await api('/api/tournaments/join', 'POST', {
      code: created.code
    }, outsider.token);
    assert.equal(postStartJoin.status, 400);

    // Outsider cannot start or enter QF1 match room!
    const [qf1, qf2, qf3, qf4] = liveTourn.knockoutMatches.slice(0, 4);
    const outsiderStartRoom = await api(`/api/tournaments/${created.id}/matches/${qf1.id}/start`, 'POST', {}, outsider.token);
    assert.equal(outsiderStartRoom.status, 403);

    const p1StartRoom = await api(`/api/tournaments/${created.id}/matches/${qf1.id}/start`, 'POST', {}, friends[0].token);
    assert.equal(p1StartRoom.status, 200);
    const outsiderWs = await wsConnect();
    outsiderWs.sendMsg('join_room', { code: p1StartRoom.data.roomCode, playerId: outsider.id, name: outsider.name });
    const errEv = await outsiderWs.nextMsg('error');
    assert.equal(errEv.code, 'UNAUTHORIZED_PLAYER');
    outsiderWs.close();

    // Step 7: Play all 4 Quarterfinals via real WS Bingo matches!
    await playVerifiedWsBingoMatch(created.id, qf1.id, qf1.player1, qf1.player2); // A defeats B
    await playVerifiedWsBingoMatch(created.id, qf2.id, qf2.player1, qf2.player2); // C defeats D
    await playVerifiedWsBingoMatch(created.id, qf3.id, qf3.player1, qf3.player2); // E defeats F
    await playVerifiedWsBingoMatch(created.id, qf4.id, qf4.player1, qf4.player2); // G defeats H

    // Verify Host CANNOT override completed match winner (403)
    const tamperRes = await api(`/api/tournaments/${created.id}/match-result`, 'POST', {
      matchId: qf1.id,
      winnerId: qf1.player2.id,
      scores: [5, 0]
    });
    assert.equal(tamperRes.status, 403);

    // Step 8: Fetch updated tournament and confirm QUALIFIED / ELIMINATED + Semifinals READY
    const afterQfRes = await api(`/api/tournaments/${created.id}`);
    const afterQf = afterQfRes.data.tournament;
    assert.equal(afterQf.participants.find(p => p.id === qf1.player1.id).qualificationStatus, 'QUALIFIED');
    assert.equal(afterQf.participants.find(p => p.id === qf1.player2.id).qualificationStatus, 'ELIMINATED');
    const sf1 = afterQf.knockoutMatches[4];
    const sf2 = afterQf.knockoutMatches[5];
    assert.equal(sf1.status, 'READY');
    assert.equal(sf2.status, 'READY');
    assert.equal(sf1.player1.id, qf1.player1.id);
    assert.equal(sf1.player2.id, qf2.player1.id);
    assert.equal(sf2.player1.id, qf3.player1.id);
    assert.equal(sf2.player2.id, qf4.player1.id);

    // Play Semifinals via real WS Bingo matches
    await playVerifiedWsBingoMatch(created.id, sf1.id, sf1.player1, sf1.player2); // A beats C
    await playVerifiedWsBingoMatch(created.id, sf2.id, sf2.player1, sf2.player2); // E beats G

    // Step 9: Fetch Grand Final and play Grand Final via real WS Bingo
    const afterSfRes = await api(`/api/tournaments/${created.id}`);
    const finalMatch = afterSfRes.data.tournament.knockoutMatches[6];
    assert.equal(finalMatch.status, 'READY');
    assert.equal(finalMatch.player1.id, friends[0].id);
    assert.equal(finalMatch.player2.id, friends[4].id);

    await playVerifiedWsBingoMatch(created.id, finalMatch.id, finalMatch.player1, finalMatch.player2); // A beats E

    // Step 10: Verify Champion, Runner-up, Rewards, Results & History
    const finalStateRes = await api(`/api/tournaments/${created.id}`);
    const finished = finalStateRes.data.tournament;
    assert.equal(finished.status, 'COMPLETED');
    assert.equal(finished.lobby.status, 'CLOSED');
    assert.equal(finished.champion.id, friends[0].id);
    assert.equal(finished.runnerUp.id, friends[4].id);
    assert.equal(finished.participants.find(p => p.id === friends[0].id).qualificationStatus, 'CHAMPION');
    assert.equal(finished.participants.find(p => p.id === friends[4].id).qualificationStatus, 'RUNNER_UP');

    const rewardsRes = await api(`/api/tournaments/${created.id}/rewards`);
    assert.equal(rewardsRes.status, 200);
    assert.equal(rewardsRes.data.rewards.length, 2);
    assert.equal(rewardsRes.data.rewards[0].recipientId, friends[0].id);

    const histRes = await api(`/api/tournaments/history?userId=${friends[0].id}`);
    assert.equal(histRes.status, 200);
    assert.ok(histRes.data.history.some(t => t.id === created.id && t.champion?.id === friends[0].id));
  });

  it('2. Supports 4, 6 (Byes), 10 (Byes), 12 (Byes), 14 (Byes), and 16-Player Knockout progressions to Champion', () => {
    for (const size of [4, 6, 10, 12, 14, 16]) {
      const tourn = tournamentManager.createTournament(
        'KNOCKOUT',
        `Bracket Size ${size} Cup`,
        'u1',
        'Player 1',
        { maxParticipants: size, minParticipants: size }
      );
      for (let i = 2; i <= size; i++) {
        const res = tourn.addParticipant(`u${i}`, `Player ${i}`);
        assert.equal(res.success, true);
      }
      const started = tourn.startTournament('u1');
      assert.equal(started.status, 'IN_PROGRESS');

      // Advance every non-completed match deterministically until tournament completes
      let safety = 0;
      while (tourn.status !== 'COMPLETED' && safety < 40) {
        safety++;
        const nextReady = tourn.knockoutMatches.find(m => m.status === 'READY');
        assert.ok(nextReady, `Size ${size}: expected a READY match while not completed`);
        assert.ok(nextReady.player1 && nextReady.player2, `Size ${size}: READY match must have both real players`);
        tourn.recordMatchResult(nextReady.id, nextReady.player1.id, [5, 3]);
      }

      assert.equal(tourn.status, 'COMPLETED', `Size ${size} knockout must reach COMPLETED`);
      assert.ok(tourn.champion && tourn.champion.id, `Size ${size} must crown a valid Champion`);
    }
  });

  it('3. Supports Unique Code Collision Prevention, Registration Deadline Rejection & League matchesPerPlayer', async () => {
    // Uniqueness across rapid creations
    const t1 = tournamentManager.createTournament('LEAGUE', 'Rapid Cup 1', 'host1', 'H1', { maxParticipants: 6, matchesPerPlayer: 2 });
    const t2 = tournamentManager.createTournament('LEAGUE', 'Rapid Cup 2', 'host1', 'H1', { maxParticipants: 6, matchesPerPlayer: 2 });
    assert.notEqual(t1.id, t2.id);
    assert.notEqual(t1.code, t2.code);

    // Partial matchesPerPlayer round-robin check
    for (let i = 2; i <= 6; i++) t1.addParticipant(`p${i}`, `Player ${i}`);
    const snap = t1.startTournament('host1');
    assert.equal(snap.leagueFixtures.length, 6, '6 players x 2 matches each / 2 = 6 fixtures');

    // Registration deadline expired check
    const expiredT = tournamentManager.createTournament('KNOCKOUT', 'Closed Deadline Cup', 'h1', 'Host', {
      maxParticipants: 4,
      registrationDeadline: new Date(Date.now() - 60_000).toISOString()
    });
    const expiredJoin = expiredT.addParticipant('late-user', 'Late');
    assert.equal(expiredJoin.success, false);
    assert.match(expiredJoin.error, /deadline/i);
  });

  it('4. Survives Server Restart via Persistence & Supports Full Hybrid League->Playoffs E2E', async () => {
    const tmpFile = path.join(os.tmpdir(), `bingoo-tourn-restart-${Date.now()}.json`);
    tournamentService.setStoreFilePath(tmpFile);
    try {
      const created = await tournamentService.createTournamentSnapshot({
        name: 'Restart Durable Hybrid Cup',
        format: 'HYBRID',
        maxParticipants: 4,
        minParticipants: 4,
        pointsPerWin: 3,
        pointsPerLoss: 0,
        qualificationSlots: 4,
        prizePool: 1200,
        creatorId: 'r-u1',
        creatorName: 'Ravi Host'
      });
      await tournamentService.joinTournament({ code: created.code, playerId: 'r-u2', playerName: 'Sita' });
      await tournamentService.joinTournament({ code: created.code, playerId: 'r-u3', playerName: 'Kabir' });
      await tournamentService.joinTournament({ code: created.code, playerId: 'r-u4', playerName: 'Meera' });
      const started = await tournamentService.startTournament(created.id, 'r-u1');
      assert.equal(started.success, true);

      // Play all 6 league fixtures + IPL Top-4 Playoffs (Q1 -> Elim -> Q2 -> Final) via verified match result recording
      for (const fix of started.tournament.leagueFixtures) {
        await tournamentService.recordVerifiedMatchResult(created.id, {
          matchId: fix.id,
          winnerId: fix.player1.id,
          scores: [5, 2]
        });
      }
      let mid = tournamentService.getTournament(created.id);
      assert.equal(mid.status, 'PLAYOFFS');
      assert.equal(mid.playoffMatches.length, 4);

      await tournamentService.recordVerifiedMatchResult(created.id, {
        matchId: mid.playoffMatches[0].id, // Q1
        winnerId: mid.playoffMatches[0].player1.id,
        scores: [5, 3]
      });
      await tournamentService.recordVerifiedMatchResult(created.id, {
        matchId: mid.playoffMatches[1].id, // Eliminator
        winnerId: mid.playoffMatches[1].player1.id,
        scores: [5, 4]
      });
      mid = tournamentService.getTournament(created.id);
      const q2Match = mid.playoffMatches[2];
      assert.equal(q2Match.status, 'READY');
      await tournamentService.recordVerifiedMatchResult(created.id, {
        matchId: q2Match.id, // Q2
        winnerId: q2Match.player1.id,
        scores: [5, 2]
      });

      mid = tournamentService.getTournament(created.id);
      const fin = mid.playoffMatches[3];
      assert.equal(fin.status, 'READY');
      await tournamentService.recordVerifiedMatchResult(created.id, {
        matchId: fin.id, // Grand Final
        winnerId: fin.player1.id,
        scores: [5, 1]
      });

      const doneBeforeRestart = tournamentService.getTournament(created.id);
      assert.equal(doneBeforeRestart.status, 'COMPLETED');
      const expectedChampionId = doneBeforeRestart.champion.id;
      assert.equal(doneBeforeRestart.rewards.length, 2);

      // Simulate server restart: wipe active Map and re-hydrate from storage
      tournamentManager.tournaments.clear();
      assert.equal(tournamentService.getTournament(created.id), null);

      const restoredCount = await tournamentService.hydrateFromStorage();
      assert.ok(restoredCount >= 1, 'Restart recovery must restore stored tournaments');
      const restored = tournamentService.getTournament(created.id);
      assert.ok(restored, 'Tournament must survive server restart');
      assert.equal(restored.code, created.code);
      assert.equal(restored.status, 'COMPLETED');
      assert.equal(restored.playoffFormat, 'IPL_TOP4');
      assert.equal(restored.champion.id, expectedChampionId);
      assert.equal(restored.rewards.length, 2);
    } finally {
      tournamentService.setStoreFilePath(null);
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('5. Complete 8-Player IPL League + Playoffs Season E2E (16 League Matches -> Locked H2H Points Table -> Q1/Elim/Q2/Grand Final via Real WS Bingo -> Champion)', async () => {
    const friends = [];
    for (let i = 0; i < 8; i++) {
      const uname = `ipl8_${Date.now().toString(36)}_${i}`;
      const regRes = await api('/api/auth/register', 'POST', {
        username: uname,
        password: 'StrongPassword!1',
        avatar: ['🏏', '🐯', '🦁', '⚡', '👑', '🔥', '🛡️', '🚀'][i]
      });
      assert.equal(regRes.status, 201);
      friends.push({
        id: regRes.data.user.id,
        name: regRes.data.user.username,
        token: regRes.data.token
      });
    }

    const host = friends[0];
    const createRes = await api('/api/tournaments', 'POST', {
      name: 'Friends IPL Championship Cup',
      format: 'HYBRID',
      maxPlayers: 8,
      minParticipants: 8,
      matchesPerPlayer: 4,
      pointsPerWin: 2,
      pointsPerLoss: 0,
      qualificationSlots: 4,
      playoffFormat: 'IPL_TOP4',
      prizePool: 4000,
      creatorId: host.id,
      creatorName: host.name
    }, host.token);
    assert.equal(createRes.status, 201, `Create failed: ${JSON.stringify(createRes.data)}`);
    const created = createRes.data.tournament;
    assert.equal(created.playoffFormat, 'IPL_TOP4');
    assert.equal(created.pointsPerWin, 2);
    assert.ok(created.code && created.code.length >= 5);

    // Join remaining 7 friends via room code + check duplicate-join block
    for (let i = 1; i < friends.length; i++) {
      const joinRes = await api(`/api/tournaments/${created.id}/join`, 'POST', {
        code: created.code,
        playerId: friends[i].id,
        playerName: friends[i].name
      }, friends[i].token);
      assert.equal(joinRes.status, 200, `Join ${i} failed: ${JSON.stringify(joinRes.data)}`);
    }
    const dupJoin = await api(`/api/tournaments/${created.id}/join`, 'POST', {
      code: created.code,
      playerId: friends[1].id,
      playerName: friends[1].name
    }, friends[1].token);
    assert.equal(dupJoin.status, 409);

    // Start tournament
    const startRes = await api(`/api/tournaments/${created.id}/start`, 'POST', {
      hostId: host.id
    }, host.token);
    assert.equal(startRes.status, 200);
    const liveTourn = startRes.data.tournament;

    // Verify 16 balanced non-overlapping league fixtures (8 players x 4 matches / 2 = 16)
    assert.equal(liveTourn.leagueFixtures.length, 16);
    assert.equal(liveTourn.playoffMatches.length, 4);
    assert.ok(liveTourn.playoffMatches.every(m => m.status === 'WAITING'), 'Playoffs must remain WAITING until League completes');

    const countByPlayer = new Map(friends.map(f => [f.id, 0]));
    const oppsByPlayer = new Map(friends.map(f => [f.id, new Set()]));
    for (const fx of liveTourn.leagueFixtures) {
      assert.ok(fx.player1?.id && fx.player2?.id);
      assert.notEqual(fx.player1.id, fx.player2.id);
      countByPlayer.set(fx.player1.id, countByPlayer.get(fx.player1.id) + 1);
      countByPlayer.set(fx.player2.id, countByPlayer.get(fx.player2.id) + 1);
      oppsByPlayer.get(fx.player1.id).add(fx.player2.id);
      oppsByPlayer.get(fx.player2.id).add(fx.player1.id);
    }
    for (const f of friends) {
      assert.equal(countByPlayer.get(f.id), 4, `${f.name} must play strictly 4 league matches`);
      assert.equal(oppsByPlayer.get(f.id).size, 4, `${f.name} must face 4 unique opponents`);
    }

    // Play all 16 league fixtures via REAL WebSocket 5x5 Bingoo matches; verify no player has 2 READY matches concurrently
    const seedOrder = new Map(friends.map((f, idx) => [f.id, idx]));
    for (let playedCount = 0; playedCount < 16; playedCount++) {
      const snapRes = await api(`/api/tournaments/${created.id}`);
      const snap = snapRes.data.tournament;
      const readyBatch = snap.leagueFixtures.filter(m => m.status === 'READY');
      assert.ok(readyBatch.length >= 1, `Expected at least 1 READY league match at step ${playedCount}`);

      const activePlayers = new Set();
      for (const m of readyBatch) {
        assert.ok(!activePlayers.has(m.player1.id), `Concurrent match conflict for ${m.player1.id}`);
        assert.ok(!activePlayers.has(m.player2.id), `Concurrent match conflict for ${m.player2.id}`);
        activePlayers.add(m.player1.id);
        activePlayers.add(m.player2.id);
      }

      const nextFx = readyBatch[0];
      const idx1 = seedOrder.get(nextFx.player1.id);
      const idx2 = seedOrder.get(nextFx.player2.id);
      const winnerObj = idx1 < idx2 ? nextFx.player1 : nextFx.player2;
      const loserObj = idx1 < idx2 ? nextFx.player2 : nextFx.player1;
      await playVerifiedWsBingoMatch(created.id, nextFx.id, winnerObj, loserObj);
    }

    // Check League Completion -> Locked Points Table -> Q1 & Eliminator READY
    const postLeagueRes = await api(`/api/tournaments/${created.id}`);
    const afterLeague = postLeagueRes.data.tournament;
    assert.equal(afterLeague.leagueLocked, true, 'Points table must lock after League completes');
    assert.equal(afterLeague.status, 'PLAYOFFS');
    assert.equal(afterLeague.standings.length, 8);
    assert.ok(afterLeague.standings[0].h2hSummary && afterLeague.standings[0].h2hSummary !== '-', 'H2H summary must populate');
    assert.equal(afterLeague.standings[0].points, 8, 'Rank #1 (undefeated 4/4 at 2 pts/win) must have 8 points');

    // Verify completed league fixture cannot be replayed / restarted (league locked guard)
    const replayAttempt = await api(`/api/tournaments/${created.id}/matches/${afterLeague.leagueFixtures[0].id}/start`, 'POST', {
      playerId: afterLeague.leagueFixtures[0].player1.id
    });
    assert.equal(replayAttempt.status, 400);

    const [q1, elim, q2Init, finInit] = afterLeague.playoffMatches;
    assert.equal(q1.playoffStage, 'QUALIFIER_1');
    assert.equal(q1.status, 'READY');
    assert.equal(q1.player1.id, afterLeague.standings[0].playerId);
    assert.equal(q1.player2.id, afterLeague.standings[1].playerId);

    assert.equal(elim.playoffStage, 'ELIMINATOR');
    assert.equal(elim.status, 'READY');
    assert.equal(elim.player1.id, afterLeague.standings[2].playerId);
    assert.equal(elim.player2.id, afterLeague.standings[3].playerId);

    assert.equal(q2Init.playoffStage, 'QUALIFIER_2');
    assert.equal(q2Init.status, 'WAITING');
    assert.equal(finInit.playoffStage, 'GRAND_FINAL');
    assert.equal(finInit.status, 'WAITING');

    // Play Qualifier 1 via Real WS Bingoo: Rank #1 (q1.player1) wins -> Final; Rank #2 (q1.player2) drops to Qualifier 2!
    await playVerifiedWsBingoMatch(created.id, q1.id, q1.player1, q1.player2);
    const afterQ1 = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    const q1LoserParticipant = afterQ1.participants.find(p => p.id === q1.player2.id);
    assert.notEqual(q1LoserParticipant.qualificationStatus, 'ELIMINATED', 'Qualifier 1 loser must NOT be eliminated');
    assert.equal(afterQ1.playoffMatches[2].player1.id, q1.player2.id, 'Q1 loser must move into Qualifier 2 slot 0');
    assert.equal(afterQ1.playoffMatches[3].player1.id, q1.player1.id, 'Q1 winner must advance directly to Grand Final slot 0');

    // Play Eliminator via Real WS Bingoo: Rank #3 (elim.player1) wins -> Q2; Rank #4 (elim.player2) is ELIMINATED!
    await playVerifiedWsBingoMatch(created.id, elim.id, elim.player1, elim.player2);
    const afterElim = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    const elimLoserParticipant = afterElim.participants.find(p => p.id === elim.player2.id);
    assert.equal(elimLoserParticipant.qualificationStatus, 'ELIMINATED', 'Eliminator loser must be ELIMINATED');
    const readyQ2 = afterElim.playoffMatches[2];
    assert.equal(readyQ2.status, 'READY');
    assert.equal(readyQ2.player1.id, q1.player2.id);
    assert.equal(readyQ2.player2.id, elim.player1.id);

    // Play Qualifier 2 via Real WS Bingoo: Q1 loser (readyQ2.player1) wins redemption into Grand Final!
    await playVerifiedWsBingoMatch(created.id, readyQ2.id, readyQ2.player1, readyQ2.player2);
    const afterQ2 = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    assert.equal(afterQ2.participants.find(p => p.id === readyQ2.player2.id).qualificationStatus, 'ELIMINATED');
    const readyFinal = afterQ2.playoffMatches[3];
    assert.equal(readyFinal.status, 'READY');
    assert.equal(readyFinal.player1.id, q1.player1.id);
    assert.equal(readyFinal.player2.id, readyQ2.player1.id);

    // Play Grand Final via Real WS Bingoo: Q1 loser wins Grand Final!
    await playVerifiedWsBingoMatch(created.id, readyFinal.id, readyFinal.player2, readyFinal.player1);
    const championRes = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    assert.equal(championRes.status, 'COMPLETED');
    assert.equal(championRes.champion.id, readyFinal.player2.id);
    assert.equal(championRes.runnerUp.id, readyFinal.player1.id);
    assert.equal(championRes.participants.find(p => p.id === readyFinal.player2.id).qualificationStatus, 'CHAMPION');
    assert.equal(championRes.participants.find(p => p.id === readyFinal.player1.id).qualificationStatus, 'RUNNER_UP');

    const rewardsRes = await api(`/api/tournaments/${created.id}/rewards`);
    assert.equal(rewardsRes.status, 200);
    assert.equal(rewardsRes.data.rewards.length, 2);
    assert.equal(rewardsRes.data.rewards[0].recipientId, readyFinal.player2.id);
  });

  it('6. Odd Player Counts (5 & 7 Players) Balanced League Scheduling + Top-2 Grand Final + Restart Recovery', async () => {
    const tmpFile = path.join(os.tmpdir(), `bingoo-ipl-odd-top2-${Date.now()}.json`);
    tournamentService.setStoreFilePath(tmpFile);
    try {
      // Case A: 5 players x 4 matches + Top-2 Direct Grand Final
      const t5 = await tournamentService.createTournamentSnapshot({
        name: '5-Player Top-2 IPL Cup',
        format: 'HYBRID',
        maxParticipants: 5,
        minParticipants: 5,
        matchesPerPlayer: 4,
        pointsPerWin: 2,
        pointsPerLoss: 0,
        qualificationSlots: 2,
        playoffFormat: 'TOP2_FINAL',
        prizePool: 2000,
        creatorId: 'odd-u1',
        creatorName: 'Player 1'
      });
      for (let i = 2; i <= 5; i++) {
        await tournamentService.joinTournament({ code: t5.code, playerId: `odd-u${i}`, playerName: `Player ${i}` });
      }
      const s5 = await tournamentService.startTournament(t5.id, 'odd-u1');
      assert.equal(s5.success, true);
      assert.equal(s5.tournament.leagueFixtures.length, 10, '5 players x 4 matches / 2 = 10 fixtures');
      assert.equal(s5.tournament.playoffMatches.length, 1, 'TOP2_FINAL must have 1 Grand Final match');

      const c5 = new Map([1, 2, 3, 4, 5].map(n => [`odd-u${n}`, 0]));
      for (const fx of s5.tournament.leagueFixtures) {
        c5.set(fx.player1.id, c5.get(fx.player1.id) + 1);
        c5.set(fx.player2.id, c5.get(fx.player2.id) + 1);
      }
      for (const [pid, cnt] of c5.entries()) {
        assert.equal(cnt, 4, `${pid} must have 4 fixtures in 5-player league`);
      }

      // Play all 10 league matches checking non-overlapping READY batches
      for (let step = 0; step < 10; step++) {
        const cur = tournamentService.getTournament(t5.id);
        const ready = cur.leagueFixtures.filter(m => m.status === 'READY');
        assert.ok(ready.length >= 1, `5-player league step ${step} needs READY match`);
        const seen = new Set();
        for (const m of ready) {
          assert.ok(!seen.has(m.player1.id) && !seen.has(m.player2.id), 'Odd-player scheduler must never double-book READY matches');
          seen.add(m.player1.id);
          seen.add(m.player2.id);
        }
        const m0 = ready[0];
        const w = m0.player1.id < m0.player2.id ? m0.player1.id : m0.player2.id;
        await tournamentService.recordVerifiedMatchResult(t5.id, { matchId: m0.id, winnerId: w, scores: [5, 2] });
      }

      const mid5 = tournamentService.getTournament(t5.id);
      assert.equal(mid5.leagueLocked, true);
      assert.equal(mid5.status, 'PLAYOFFS');
      const final5 = mid5.playoffMatches[0];
      assert.equal(final5.status, 'READY');
      assert.equal(final5.player1.id, mid5.standings[0].playerId);
      assert.equal(final5.player2.id, mid5.standings[1].playerId);

      await tournamentService.recordVerifiedMatchResult(t5.id, {
        matchId: final5.id,
        winnerId: final5.player2.id,
        scores: [5, 4]
      });

      const done5 = tournamentService.getTournament(t5.id);
      assert.equal(done5.status, 'COMPLETED');
      assert.equal(done5.champion.id, final5.player2.id);

      // Restart recovery check on TOP2_FINAL tournament
      tournamentManager.tournaments.clear();
      await tournamentService.hydrateFromStorage();
      const restored5 = tournamentService.getTournament(t5.id);
      assert.equal(restored5.playoffFormat, 'TOP2_FINAL');
      assert.equal(restored5.leagueLocked, true);
      assert.equal(restored5.champion.id, final5.player2.id);

      // Case B: 7 players x 4 matches = 14 balanced fixtures (harary odd-N circle packing)
      const t7 = tournamentManager.createTournament('HYBRID', '7-Player Balanced League', 'o7-1', 'S1', {
        maxParticipants: 7,
        minParticipants: 7,
        matchesPerPlayer: 4,
        pointsPerWin: 2,
        qualificationSlots: 4,
        playoffFormat: 'IPL_TOP4'
      });
      for (let i = 2; i <= 7; i++) t7.addParticipant(`o7-${i}`, `S${i}`);
      const s7 = t7.startTournament('o7-1');
      assert.equal(s7.leagueFixtures.length, 14, '7 players x 4 matches / 2 = 14 fixtures');
      const c7 = new Map([1, 2, 3, 4, 5, 6, 7].map(n => [`o7-${n}`, 0]));
      const opp7 = new Map([1, 2, 3, 4, 5, 6, 7].map(n => [`o7-${n}`, new Set()]));
      for (const fx of s7.leagueFixtures) {
        c7.set(fx.player1.id, c7.get(fx.player1.id) + 1);
        c7.set(fx.player2.id, c7.get(fx.player2.id) + 1);
        opp7.get(fx.player1.id).add(fx.player2.id);
        opp7.get(fx.player2.id).add(fx.player1.id);
      }
      for (const [pid, cnt] of c7.entries()) {
        assert.equal(cnt, 4, `7-player ${pid} must play 4 matches`);
        assert.equal(opp7.get(pid).size, 4, `7-player ${pid} must face 4 unique opponents`);
      }
    } finally {
      tournamentService.setStoreFilePath(null);
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    }
  });

  it('7. Default 5-Match IPL Season E2E (8 Players -> 20 Real WS Bingo League Matches -> Tie-Breaker Note -> Q1/Elim/Q2/Final -> Champion & Locks)', async () => {
    // 1. Validate invalid configuration combinations before creation
    const invalid4x5 = await api('/api/tournaments', 'POST', {
      name: 'Invalid 4x5 Cup',
      format: 'HYBRID',
      maxPlayers: 4,
      matchesPerPlayer: 5,
      creatorId: 'val-u1',
      creatorName: 'Validator'
    });
    assert.equal(invalid4x5.status, 400);
    assert.match(invalid4x5.data.error, /matches per player/i);

    const invalidOdd5x3 = await api('/api/tournaments', 'POST', {
      name: 'Invalid Odd 5x3 Cup',
      format: 'HYBRID',
      maxPlayers: 5,
      matchesPerPlayer: 3,
      creatorId: 'val-u1',
      creatorName: 'Validator'
    });
    assert.equal(invalidOdd5x3.status, 400);
    assert.match(invalidOdd5x3.data.error, /odd/i);

    // 2. Register 8 real authenticated players
    const players = [];
    for (let i = 0; i < 8; i++) {
      const uname = `ipl5_${Date.now().toString(36)}_${i}`;
      const regRes = await api('/api/auth/register', 'POST', {
        username: uname,
        password: 'StrongPassword!1',
        avatar: ['🏏', '🐯', '🦁', '⚡', '👑', '🔥', '🛡️', '🚀'][i]
      });
      assert.equal(regRes.status, 201);
      assert.ok(regRes.data.sessionToken && regRes.data.user?.id);
      players.push({
        id: regRes.data.user.id,
        name: regRes.data.user.username,
        token: regRes.data.sessionToken
      });
    }

    const host = players[0];
    // Create HYBRID tournament relying on backend IPL defaults (no matchesPerPlayer/pointsPerWin/playoffFormat specified)
    const createRes = await api('/api/tournaments', 'POST', {
      name: 'Default 5-Match IPL Cup',
      format: 'HYBRID',
      maxPlayers: 8,
      minParticipants: 8,
      prizePool: 5000,
      creatorId: host.id,
      creatorName: host.name
    }, host.token);
    assert.equal(createRes.status, 201);
    const created = createRes.data.tournament;
    assert.equal(created.matchesPerPlayer, 5, 'Default HYBRID matchesPerPlayer must be 5');
    assert.equal(created.pointsPerWin, 2, 'Default pointsPerWin must be 2');
    assert.equal(created.pointsPerLoss, 0, 'Default pointsPerLoss must be 0');
    assert.equal(created.qualificationSlots, 4, 'Default qualificationSlots must be 4');
    assert.equal(created.playoffFormat, 'IPL_TOP4', 'Default playoffFormat must be IPL_TOP4');
    assert.ok(created.lobby && created.lobby.code === created.code);

    for (let i = 1; i < players.length; i++) {
      const jRes = await api(`/api/tournaments/${created.id}/join`, 'POST', {
        code: created.code,
        playerId: players[i].id,
        playerName: players[i].name
      }, players[i].token);
      assert.equal(jRes.status, 200);
    }

    const startRes = await api(`/api/tournaments/${created.id}/start`, 'POST', {
      hostId: host.id
    }, host.token);
    assert.equal(startRes.status, 200);
    const live = startRes.data.tournament;

    // Post-start settings modification must be locked
    const lockedEdit = await api(`/api/tournaments/${created.id}/settings`, 'PATCH', {
      hostId: host.id,
      pointsPerWin: 10,
      matchesPerPlayer: 2
    }, host.token);
    assert.equal(lockedEdit.status, 400);
    assert.match(lockedEdit.data.error, /started/i);

    // Verify 20 fixtures, 40 appearances, 5 matches per player, 5 unique opponents each
    assert.equal(live.leagueFixtures.length, 20, '8 players x 5 matches / 2 = 20 fixtures');
    const appearances = new Map(players.map(p => [p.id, 0]));
    const opps = new Map(players.map(p => [p.id, new Set()]));
    for (const fx of live.leagueFixtures) {
      assert.notEqual(fx.player1.id, fx.player2.id);
      appearances.set(fx.player1.id, appearances.get(fx.player1.id) + 1);
      appearances.set(fx.player2.id, appearances.get(fx.player2.id) + 1);
      opps.get(fx.player1.id).add(fx.player2.id);
      opps.get(fx.player2.id).add(fx.player1.id);
    }
    let totalAppearances = 0;
    for (const pl of players) {
      assert.equal(appearances.get(pl.id), 5, `${pl.name} must play 5 league matches`);
      assert.equal(opps.get(pl.id).size, 5, `${pl.name} must face 5 unique opponents`);
      totalAppearances += appearances.get(pl.id);
    }
    assert.equal(totalAppearances, 40);

    // Concurrent duplicate result race guard check on fixture #1 after real WS Bingoo completion
    const seedOrder = new Map(players.map((p, idx) => [p.id, idx]));
    for (let step = 0; step < 20; step++) {
      const snap = (await api(`/api/tournaments/${created.id}`)).data.tournament;
      const ready = snap.leagueFixtures.filter(m => m.status === 'READY');
      assert.ok(ready.length >= 1, `Step ${step} requires READY league fixture`);
      const activeIds = new Set();
      for (const m of ready) {
        assert.ok(!activeIds.has(m.player1.id) && !activeIds.has(m.player2.id), 'No player scheduled concurrently');
        activeIds.add(m.player1.id);
        activeIds.add(m.player2.id);
      }
      const nextFx = ready[0];
      const i1 = seedOrder.get(nextFx.player1.id);
      const i2 = seedOrder.get(nextFx.player2.id);
      const winnerObj = i1 < i2 ? nextFx.player1 : nextFx.player2;
      const loserObj = i1 < i2 ? nextFx.player2 : nextFx.player1;
      await playVerifiedWsBingoMatch(created.id, nextFx.id, winnerObj, loserObj);

      if (step === 0) {
        // Attempt duplicate concurrent submission of already-completed fixture -> points awarded strictly once
        const [dupA, dupB] = await Promise.all([
          tournamentService.recordVerifiedMatchResult(created.id, { matchId: nextFx.id, winnerId: winnerObj.id, scores: [5, 2] }),
          tournamentService.recordVerifiedMatchResult(created.id, { matchId: nextFx.id, winnerId: winnerObj.id, scores: [5, 2] })
        ]);
        assert.equal(dupA.success, true);
        assert.equal(dupB.success, true);
        const afterDup = (await api(`/api/tournaments/${created.id}`)).data.tournament;
        const wRow = afterDup.standings.find(s => s.playerId === winnerObj.id);
        assert.equal(wRow.points, 2, 'Duplicate recording must never double-credit points');
      }
    }

    // Verify all 20 league matches completed -> Standings locked -> Points & Tie-Breaker explanation populated -> Top 4 Q1 & Elim ready
    const postLeague = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    assert.equal(postLeague.leagueLocked, true);
    assert.equal(postLeague.status, 'PLAYOFFS');
    assert.equal(postLeague.standings[0].played, 5);
    assert.equal(postLeague.standings[0].won, 5);
    assert.equal(postLeague.standings[0].points, 10);
    // Check intermediate ranks have tied points or tieBreakerNote
    assert.ok(postLeague.standings.some(s => Boolean(s.tieBreakerNote)), 'Tie-breaker explanation note must be present when players tie on points');

    const [q1, elim] = postLeague.playoffMatches;
    await playVerifiedWsBingoMatch(created.id, q1.id, q1.player1, q1.player2);
    await playVerifiedWsBingoMatch(created.id, elim.id, elim.player1, elim.player2);

    const preQ2 = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    const q2 = preQ2.playoffMatches[2];
    await playVerifiedWsBingoMatch(created.id, q2.id, q2.player1, q2.player2);

    const preFinal = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    const grandFinal = preFinal.playoffMatches[3];
    await playVerifiedWsBingoMatch(created.id, grandFinal.id, grandFinal.player1, grandFinal.player2);

    const done = (await api(`/api/tournaments/${created.id}`)).data.tournament;
    assert.equal(done.status, 'COMPLETED');
    assert.equal(done.champion.id, grandFinal.player1.id);
    assert.equal(done.runnerUp.id, grandFinal.player2.id);
    assert.equal(done.rewards.length, 2);

    const hist = await api(`/api/tournaments/history?userId=${grandFinal.player1.id}`);
    assert.equal(hist.status, 200);
    assert.ok(hist.data.history.some(t => t.id === created.id && t.champion?.id === grandFinal.player1.id));
  });
});
