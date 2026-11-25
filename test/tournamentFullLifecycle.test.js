/**
 * test/tournamentFullLifecycle.test.js
 * Comprehensive end-to-end test verifying:
 * - Tournament Creation (Knockout, League, Hybrid)
 * - Joining via unique Code
 * - Host Start & Fixture / Bracket generation
 * - Match Room creation and Live Gameplay linking
 * - Match completion, Server Validation & Result Recording
 * - Standings & Progression updates up to Champion Declaration
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Tournament, TournamentManager } from '../server/tournamentManager.js';
import { deviceRooms } from '../server/roomManager.js';

describe('Tournament Full Lifecycle End-to-End Test', () => {
  it('Complete Knockout Tournament Lifecycle: Create -> Join -> Start -> Play Matches -> Champion', () => {
    const tm = new TournamentManager();

    // 1. Create 4-player Knockout Tournament
    const tourn = tm.createTournament('KNOCKOUT', 'Thunder Knockout Cup', 'host-p1', 'Alice Host', {
      maxParticipants: 4,
      entryFee: 100,
      prizePool: 1500
    });

    assert.ok(tourn.id.startsWith('tourn-'), 'Tournament ID should start with tourn-');
    assert.strictEqual(tourn.type, 'KNOCKOUT');
    assert.strictEqual(tourn.status, 'REGISTERING');
    assert.strictEqual(tourn.participants.length, 1);
    assert.ok(tourn.code && tourn.code.length >= 4, 'Unique code generated');

    // 2. Join players via code/ID
    const join2 = tourn.addParticipant('p2', 'Bob Player');
    const join3 = tourn.addParticipant('p3', 'Charlie Player');
    const join4 = tourn.addParticipant('p4', 'Dave Player');

    assert.strictEqual(join2.success, true);
    assert.strictEqual(join3.success, true);
    assert.strictEqual(join4.success, true);
    assert.strictEqual(tourn.participants.length, 4);

    // 3. Host starts tournament
    const started = tourn.startTournament();
    assert.strictEqual(started.status, 'IN_PROGRESS');
    assert.strictEqual(tourn.knockoutMatches.length, 3); // SF1, SF2, Final

    const sf1 = tourn.knockoutMatches[0];
    const sf2 = tourn.knockoutMatches[1];
    const fin = tourn.knockoutMatches[2];

    assert.strictEqual(sf1.status, 'READY');
    assert.strictEqual(sf2.status, 'READY');
    assert.strictEqual(fin.status, 'WAITING');

    // 4. Start live match room for Semifinal 1
    const matchRoomRes = tourn.createTournamentMatchRoom(sf1.id, deviceRooms);
    assert.strictEqual(matchRoomRes.success, true);
    assert.ok(matchRoomRes.roomCode, 'Valid device room code created for match');
    assert.strictEqual(matchRoomRes.tournamentId, tourn.id);

    // 5. Complete Semifinal 1: Alice Host (host-p1) wins vs Bob (p2)
    const afterSf1 = tourn.recordMatchResult(sf1.id, 'host-p1', [5, 2]);
    assert.strictEqual(afterSf1.knockoutMatches[0].status, 'COMPLETED');
    assert.strictEqual(afterSf1.knockoutMatches[0].winnerId, 'host-p1');

    // 6. Complete Semifinal 2: Dave (p4) wins vs Charlie (p3)
    const afterSf2 = tourn.recordMatchResult(sf2.id, 'p4', [5, 3]);
    assert.strictEqual(afterSf2.knockoutMatches[1].status, 'COMPLETED');
    assert.strictEqual(afterSf2.knockoutMatches[1].winnerId, 'p4');

    // 7. Verify Final is now READY with the two winners
    const finalMatch = tourn.knockoutMatches[2];
    assert.strictEqual(finalMatch.status, 'READY');
    assert.strictEqual(finalMatch.player1.id, 'host-p1');
    assert.strictEqual(finalMatch.player2.id, 'p4');

    // 8. Play and Complete Grand Final: Alice Host wins championship!
    const concluded = tourn.recordMatchResult(finalMatch.id, 'host-p1', [5, 4]);
    assert.strictEqual(concluded.status, 'COMPLETED');
    assert.strictEqual(concluded.champion.id, 'host-p1');
    assert.strictEqual(concluded.champion.name, 'Alice Host');
    assert.strictEqual(concluded.runnerUp.id, 'p4');
  });

  it('Complete League Tournament Lifecycle: Create -> Fixtures -> Matches -> Points Table -> Champion', () => {
    const tm = new TournamentManager();

    // 1. Create 4-player League Tournament
    const tourn = tm.createTournament('LEAGUE', 'Premier League 2026', 'host-p1', 'Alice Host', {
      maxParticipants: 4,
      pointsPerWin: 3,
      pointsPerLoss: 0
    });

    tourn.addParticipant('p2', 'Bob Player');
    tourn.addParticipant('p3', 'Charlie Player');
    tourn.addParticipant('p4', 'Dave Player');

    tourn.startTournament();
    assert.strictEqual(tourn.status, 'IN_PROGRESS');
    // In a 4-player single round-robin: 4*3/2 = 6 fixtures
    assert.strictEqual(tourn.leagueFixtures.length, 6);
    assert.strictEqual(tourn.pointsTable.length, 4);

    // Initial points table all 0s
    for (const row of tourn.pointsTable) {
      assert.strictEqual(row.points, 0);
      assert.strictEqual(row.played, 0);
    }

    // Play all 6 fixtures with real results
    for (const fix of tourn.leagueFixtures) {
      const winnerId = fix.player1.id; // Deterministic winner for test
      tourn.recordMatchResult(fix.id, winnerId, [5, 2]);
    }

    // Verify all fixtures completed
    assert.ok(tourn.leagueFixtures.every(f => f.status === 'COMPLETED'), 'All fixtures must be completed');
    
    // Verify points table is sorted by points descending
    const snapshot = tourn.getSnapshot();
    assert.ok(snapshot.pointsTable[0].points >= snapshot.pointsTable[1].points, 'Rank 1 must have >= points than Rank 2');
    assert.strictEqual(tourn.status, 'COMPLETED');
    assert.ok(tourn.champion, 'Champion declared from top of points table');
  });

  it('Complete Hybrid Tournament Lifecycle: Group Stage -> Playoffs -> Champion', () => {
    const tm = new TournamentManager();

    // 1. Create 4-player Hybrid Tournament
    const tourn = tm.createTournament('HYBRID', 'Champions Trophy', 'host-p1', 'Alice Host', {
      maxParticipants: 4,
      qualificationSlots: 4
    });

    tourn.addParticipant('p2', 'Bob Player');
    tourn.addParticipant('p3', 'Charlie Player');
    tourn.addParticipant('p4', 'Dave Player');

    tourn.startTournament();
    assert.strictEqual(tourn.status, 'IN_PROGRESS');
    assert.strictEqual(tourn.playoffMatches.length, 3); // SF1, SF2, Final

    // Complete all group fixtures
    for (const fix of tourn.leagueFixtures) {
      tourn.recordMatchResult(fix.id, fix.player1.id, [5, 1]);
    }

    // Verify playoffs are now READY with qualified top players
    assert.strictEqual(tourn.status, 'PLAYOFFS');
    const sf1 = tourn.playoffMatches[0];
    const sf2 = tourn.playoffMatches[1];
    assert.strictEqual(sf1.status, 'READY');
    assert.strictEqual(sf2.status, 'READY');

    // Complete Semifinals
    tourn.recordMatchResult(sf1.id, sf1.player1.id, [5, 3]);
    tourn.recordMatchResult(sf2.id, sf2.player1.id, [5, 4]);

    // Final is now READY
    const finalMatch = tourn.playoffMatches[2];
    assert.strictEqual(finalMatch.status, 'READY');

    // Conclude Final
    const finished = tourn.recordMatchResult(finalMatch.id, finalMatch.player1.id, [5, 2]);
    assert.strictEqual(finished.status, 'COMPLETED');
    assert.ok(finished.champion, 'Hybrid champion crowned');
  });
});
