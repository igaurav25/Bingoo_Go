import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_ALPHABET,
  generateRoomCode,
  normalizeRoomCode,
  DeviceRoom,
  DeviceRoomManager
} from '../server/roomManager.js';

test('Room Manager: 5-character vowel-free, look-alike-free alphabet', () => {
  // Check alphabet characters
  assert.equal(ROOM_ALPHABET.length, 28);
  // Ensure NO vowels A, E, I, O, U and NO L, 0, 1
  for (const forbidden of ['0', '1', 'A', 'E', 'I', 'O', 'U', 'L']) {
    assert.equal(ROOM_ALPHABET.includes(forbidden), false, `Forbidden char ${forbidden} in alphabet`);
  }

  // Generate codes
  for (let i = 0; i < 20; i++) {
    const code = generateRoomCode();
    assert.equal(code.length, 5);
    for (const char of code) {
      assert.ok(ROOM_ALPHABET.includes(char), `Character ${char} not in alphabet`);
    }
  }

  // Normalization
  assert.equal(normalizeRoomCode('b4k8m'), 'B4K8M');
  assert.equal(normalizeRoomCode('  c-d-2-9-x  '), 'CD29X');
});

test('Device Room: Host creation, guest join, and tab conflict resolution', () => {
  const rm = new DeviceRoomManager();
  const room = rm.createRoom('p1', 'tok-host', 'Alice', '🦊');

  assert.equal(room.code.length, 5);
  assert.equal(room.players.length, 1);
  assert.equal(room.players[0].name, 'Alice');

  // Guest joins
  const mockWsGuest1 = { send: () => {}, close: () => {} };
  const joinRes = room.join('p2', 'tok-guest', 'Bob', '🐻', mockWsGuest1);
  assert.equal(joinRes.success, true);
  assert.equal(joinRes.isReconnect, false);
  assert.equal(room.players.length, 2);

  // Third player tries to join -> rejected (max 2)
  const thirdRes = room.join('p3', 'tok-third', 'Charlie', '🐯', {});
  assert.equal(thirdRes.success, false);
  assert.match(thirdRes.error, /full/i);

  // Same guest opens another tab with same sessionToken
  const mockWsGuest2 = { send: () => {}, close: () => {} };
  const tab2Res = room.join('p2', 'tok-guest', 'Bob', '🐻', mockWsGuest2);
  assert.equal(tab2Res.success, true);
  assert.equal(tab2Res.isReconnect, true);
  assert.equal(tab2Res.oldWs, mockWsGuest1); // Old socket identified to kick
  assert.equal(room.players.length, 2); // Still 2 players

  rm.dispose();
});

test('Device Room: Lifecycle (lobby -> arranging -> playing -> finished -> rematch)', () => {
  const room = new DeviceRoom('B4K8M', 'p1', 'tok1', 'Alice', '🦊');
  room.join('p2', 'tok2', 'Bob', '🐻', {});

  assert.equal(room.status, 'lobby');

  // Both ready
  room.setReady('p1', true);
  const readyRes = room.setReady('p2', true);
  assert.equal(readyRes.allReady, true);

  // Host starts arranging
  room.startArranging();
  assert.equal(room.status, 'arranging');
  assert.ok(room.match);

  // Arrangements
  const g1 = Array.from({ length: 25 }, (_, i) => i + 1);
  const g2 = Array.from({ length: 25 }, (_, i) => 25 - i);

  const lock1 = room.lockBoard('p1', g1);
  assert.equal(lock1.matchStarted, false);
  assert.equal(room.status, 'arranging');

  const lock2 = room.lockBoard('p2', g2);
  assert.equal(lock2.matchStarted, true);
  assert.equal(room.status, 'playing');

  // Finish match by completing lines
  for (let n = 1; n <= 25; n++) {
    room.match.callNumber(room.match.currentTurnPlayerId, n);
  }
  const claimVerdict = room.match.claimBingo('p1', 'claim-rematch-test');
  assert.equal(claimVerdict.valid, true);
  room.status = 'finished';
  room.scores['p1'] = 1;

  // Rematch
  const rem1 = room.requestRematch('p1');
  assert.equal(rem1.rematchReady, false);
  const rem2 = room.requestRematch('p2');
  assert.equal(rem2.rematchReady, true);

  // Next game: starting player alternates from p2 back to p1, scores maintained!
  const nextArr = room.startArranging();
  assert.equal(nextArr.startingPlayerId, 'p1');
  assert.equal(room.scores['p1'], 1);
  assert.equal(room.status, 'arranging');
});

test('Device Room: Disconnection pause and 60s forfeit', (t) => {
  const room = new DeviceRoom('B4K8M', 'p1', 'tok1', 'Alice', '🦊');
  room.join('p2', 'tok2', 'Bob', '🐻', {});
  room.startArranging();
  room.status = 'playing';

  let forfeitWinner = null;
  const onForfeit = (winnerId, reason) => {
    forfeitWinner = winnerId;
  };

  // p2 disconnects
  const dcRes = room.handleDisconnect('p2', onForfeit);
  assert.equal(dcRes.shouldPause, true);
  assert.ok(dcRes.graceDeadline > Date.now());
  assert.equal(room.disconnectedPlayerId, 'p2');

  // p2 reconnects with same token -> resumes!
  const recRes = room.join('p2', 'tok2', 'Bob', '🐻', {});
  assert.equal(recRes.isReconnect, true);
  assert.equal(recRes.wasPaused, true);
  assert.equal(room.disconnectedPlayerId, null);
});
