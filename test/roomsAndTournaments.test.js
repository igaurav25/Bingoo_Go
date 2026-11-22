import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../server/roomManager.js';
import { TournamentManager } from '../server/tournamentManager.js';

test('Private Rooms: Room code creation, bot addition, and start match', () => {
  const rm = new RoomManager();
  const room = rm.createRoom('host-1', 'Alice');

  assert.equal(room.code.length, 6);
  assert.equal(room.status, 'LOBBY');
  assert.equal(room.players.length, 1);

  // Add AI Bot
  const botRes = room.addBot();
  assert.equal(botRes.success, true);
  assert.equal(room.players.length, 2);
  assert.equal(room.players[1].isBot, true);

  // Start match
  const startRes = room.startMatch();
  assert.equal(startRes.success, true);
  assert.equal(room.status, 'IN_MATCH');
  assert.ok(startRes.match);
});

test('Tournaments: Knockout bracket progression and champion', () => {
  const tm = new TournamentManager();
  const tourn = tm.createTournament('KNOCKOUT', 'Neon Cup', 'host-1', 'Alice');

  assert.equal(tourn.status, 'REGISTERING');
  // Fill with bots and start
  const started = tourn.startTournament();
  assert.equal(started.status, 'IN_PROGRESS');
  assert.equal(started.knockoutMatches.length, 3); // SF1, SF2, Final

  // Advance SF1
  const sf1WinnerId = started.knockoutMatches[0].player1.id;
  tourn.recordMatchResult(started.knockoutMatches[0].id, sf1WinnerId);

  // Advance SF2
  const sf2WinnerId = started.knockoutMatches[1].player1.id;
  tourn.recordMatchResult(started.knockoutMatches[1].id, sf2WinnerId);

  // Final match is now READY with both finalists
  assert.equal(tourn.knockoutMatches[2].status, 'READY');
  assert.equal(tourn.knockoutMatches[2].player1.id, sf1WinnerId);
  assert.equal(tourn.knockoutMatches[2].player2.id, sf2WinnerId);

  // Play Final
  const finalSnap = tourn.recordMatchResult(tourn.knockoutMatches[2].id, sf1WinnerId);
  assert.equal(finalSnap.status, 'COMPLETED');
  assert.equal(finalSnap.champion.id, sf1WinnerId);
});

test('Tournaments: League round-robin fixtures and points table', () => {
  const tm = new TournamentManager();
  const tourn = tm.createTournament('LEAGUE', 'Premier League', 'host-1', 'Alice');
  tourn.startTournament();

  assert.equal(tourn.leagueFixtures.length, 6);
  assert.equal(tourn.pointsTable.length, 4);

  // Play fixture 1: win awards 3 points
  const f1 = tourn.leagueFixtures[0];
  const snap1 = tourn.recordMatchResult(f1.id, f1.p1.id);
  const winnerRow = snap1.pointsTable.find(r => r.id === f1.p1.id);
  assert.equal(winnerRow.points, 3);
  assert.equal(winnerRow.won, 1);
});
