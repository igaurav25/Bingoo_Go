import test from 'node:test';
import assert from 'node:assert/strict';
import { Match } from '../server/gameState.js';
import { generateRandomGrid } from '../shared/lineModel.js';

test('Server: Arrangement validation and locking', () => {
  const match = new Match('m1', 'p1', 'p2');
  assert.equal(match.status, 'ARRANGING');

  // Invalid permutation rejected
  const badGrid = [1, 2, 3];
  const badRes = match.setPlayerArrangement('p1', badGrid);
  assert.equal(badRes.success, false);

  // Valid arrangement accepted
  const g1 = generateRandomGrid();
  const res1 = match.setPlayerArrangement('p1', g1);
  assert.equal(res1.success, true);
  assert.equal(res1.matchStarted, false);
  assert.equal(match.players['p1'].isLocked, true);

  // Attempting to change locked arrangement is rejected
  const changeRes = match.setPlayerArrangement('p1', generateRandomGrid());
  assert.equal(changeRes.success, false);

  // Second player locks -> match becomes IN_PROGRESS
  const g2 = generateRandomGrid();
  const res2 = match.setPlayerArrangement('p2', g2);
  assert.equal(res2.success, true);
  assert.equal(res2.matchStarted, true);
  assert.equal(match.status, 'IN_PROGRESS');
});

test('Server: Turn validation and number calling legality', () => {
  const match = new Match('m2', 'p1', 'p2');
  match.autoRandomArrangement('p1');
  match.autoRandomArrangement('p2');
  assert.equal(match.status, 'IN_PROGRESS');
  assert.equal(match.currentTurnPlayerId, 'p1');

  // p2 calling out of turn rejected
  const outOfTurn = match.callNumber('p2', 5);
  assert.equal(outOfTurn.success, false);
  assert.match(outOfTurn.error, /Not your turn/i);

  // p1 calling invalid number rejected
  assert.equal(match.callNumber('p1', 0).success, false);
  assert.equal(match.callNumber('p1', 26).success, false);

  // p1 calling valid number succeeds
  const call1 = match.callNumber('p1', 7);
  assert.equal(call1.success, true);
  assert.equal(call1.number, 7);
  assert.equal(match.currentTurnPlayerId, 'p2');

  // Calling already-called number rejected
  const duplicateCall = match.callNumber('p2', 7);
  assert.equal(duplicateCall.success, false);
  assert.match(duplicateCall.error, /already been called/i);
});

test('Server: Claim with 4 lines rejected, 5 accepted, finish lockout', () => {
  const match = new Match('m3', 'p1', 'p2', { claimRateLimitMs: 0 });
  // Construct predictable grids
  // p1: sequential 1..25
  const g1 = Array.from({ length: 25 }, (_, i) => i + 1);
  // p2: reversed 25..1
  const g2 = Array.from({ length: 25 }, (_, i) => 25 - i);

  match.setPlayerArrangement('p1', g1);
  match.setPlayerArrangement('p2', g2);

  // Call rows 0, 1, 2, 3 for p1 (numbers 1..20)
  // That gives p1 exactly 4 completed rows: r0, r1, r2, r3
  for (let n = 1; n <= 20; n++) {
    const turnPlayer = match.currentTurnPlayerId;
    const res = match.callNumber(turnPlayer, n);
    assert.equal(res.success, true);
  }

  assert.equal(match.players['p1'].completedLines.length, 4);

  // Claim with 4 lines rejected
  const claim4 = match.claimBingo('p1', 'claim-4-lines');
  assert.equal(claim4.valid, false);
  assert.match(claim4.reason, /need 5 completed lines/i);
  assert.equal(match.status, 'IN_PROGRESS');

  // Re-submitting same claimId returns cached verdict
  const cachedClaim = match.claimBingo('p1', 'claim-4-lines');
  assert.equal(cachedClaim.isCached, true);
  assert.equal(cachedClaim.valid, false);

  // Now call numbers 21..25 to complete row 4 (5th line!)
  for (let n = 21; n <= 25; n++) {
    const turnPlayer = match.currentTurnPlayerId;
    match.callNumber(turnPlayer, n);
  }

  assert.equal(match.players['p1'].completedLines.length >= 5, true);

  // Claim with 5 lines accepted
  const claim5 = match.claimBingo('p1', 'claim-5-lines');
  assert.equal(claim5.valid, true);
  assert.equal(claim5.winnerId, 'p1');
  assert.equal(match.status, 'FINISHED');

  // Any subsequent claim (from p1 or p2) rejected because match is finished
  const lateClaim = match.claimBingo('p2', 'claim-late');
  assert.equal(lateClaim.valid, false);
  assert.match(lateClaim.reason, /already finished/i);
});

test('Server: Simultaneous claims deterministically resolved via serial queue', async () => {
  const match = new Match('m4', 'p1', 'p2', { claimRateLimitMs: 0 });
  const g = Array.from({ length: 25 }, (_, i) => i + 1);
  match.setPlayerArrangement('p1', g);
  match.setPlayerArrangement('p2', g);

  // Call all 25 numbers
  for (let n = 1; n <= 25; n++) {
    match.callNumber(match.currentTurnPlayerId, n);
  }

  // Both players have completed 5 lines
  assert.ok(match.players['p1'].completedLines.length >= 5);
  assert.ok(match.players['p2'].completedLines.length >= 5);

  // Simulate concurrent claims arriving simultaneously
  const [verdict1, verdict2] = await Promise.all([
    match.enqueue(() => match.claimBingo('p1', 'c-p1')),
    match.enqueue(() => match.claimBingo('p2', 'c-p2'))
  ]);

  // First valid claim wins, second is rejected because match finished
  assert.equal(verdict1.valid, true);
  assert.equal(verdict1.winnerId, 'p1');
  assert.equal(verdict2.valid, false);
  assert.equal(verdict2.winnerId, 'p1');
});

test('Server: Reconnect snapshot correctness and privacy', () => {
  const match = new Match('m5', 'p1', 'p2');
  const g1 = generateRandomGrid();
  const g2 = generateRandomGrid();
  match.setPlayerArrangement('p1', g1);
  match.setPlayerArrangement('p2', g2);

  // Snapshot for p1
  const snap1 = match.getSnapshot('p1');
  assert.equal(snap1.matchId, 'm5');
  assert.equal(snap1.myState.playerId, 'p1');
  assert.deepEqual(snap1.myState.grid, g1);
  assert.equal(Array.isArray(snap1.myState.completedLines), true);

  // Crucial privacy checks: Opponent grid and opponent line IDs must NOT exist
  assert.equal(snap1.opponentState.grid, undefined);
  assert.equal(snap1.opponentState.completedLines, undefined);
  assert.equal(typeof snap1.opponentState.linesCompleted, 'number');

  // Snapshot for p2
  const snap2 = match.getSnapshot('p2');
  assert.equal(snap2.myState.playerId, 'p2');
  assert.deepEqual(snap2.myState.grid, g2);
  assert.equal(snap2.opponentState.grid, undefined);
  assert.equal(snap2.opponentState.completedLines, undefined);
});
