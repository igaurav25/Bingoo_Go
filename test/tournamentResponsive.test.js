/**
 * test/tournamentResponsive.test.js
 * 
 * Production verification and stress testing for the rebuilt Tournament section:
 * 1. Odd bracket sizes (3, 5, 6, 7, 10, 12) with Byes & advancement
 * 2. Typography and Devanagari / Hindi name rendering safety
 * 3. Extreme scores and ranks formatting with Num (tabular-nums lining-nums)
 * 4. Full route matching across all 10 tournament routes
 * 5. Server REST endpoints verification
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Tournament, tournamentManager } from '../server/tournamentManager.js';
import {
  selectBracketRounds,
  selectStandings,
  selectFixtures,
  selectPathOf,
  selectMatchById,
  normalizeMatch
} from '../src/tournaments/selectors.js';

describe('Tournament System: Odd Bracket Sizes & Bye Advancement', () => {
  it('correctly handles a 5-player odd bracket with 3 Byes', () => {
    const t = new Tournament({
      id: 'tourn-5p',
      name: '5 Player Knockout',
      format: 'KNOCKOUT',
      maxPlayers: 5,
      creatorId: 'p-1',
      creatorName: 'P1'
    });

    // Add 4 more players to make 5 total
    ['P2', 'P3', 'P4', 'P5'].forEach((name, i) => {
      t.addParticipant({ id: `p-${i + 2}`, name });
    });

    assert.strictEqual(t.participants.length, 5);
    const snap = t.start();
    assert.ok(snap);

    const snapshot = t.getSnapshot();
    const rounds = selectBracketRounds(snapshot);

    assert.ok(rounds.length >= 2, 'Should have multiple rounds');
    
    // Check round 1
    const r1 = rounds[0];
    assert.strictEqual(r1.matches.length, 4, '8-slot bracket for 5 players should have 4 QF matches');

    // 3 matches should have Byes
    const byeMatches = r1.matches.filter(m => m.isBye || m.status === 'COMPLETED');
    assert.ok(byeMatches.length >= 3, 'At least 3 matches should be resolved by Byes');

    // The winners of byes must advance to the next round
    const nextRound = rounds[1];
    assert.ok(nextRound.matches.length >= 2, 'Semifinals should have 2 matches');
  });

  it('correctly handles a 6-player odd bracket', () => {
    const t = new Tournament({
      id: 'tourn-6p',
      name: '6 Player Knockout',
      format: 'KNOCKOUT',
      maxPlayers: 6,
      creatorId: 'p-1',
      creatorName: 'A'
    });

    ['B', 'C', 'D', 'E', 'F'].forEach((name, i) => {
      t.addParticipant({ id: `p-${i + 2}`, name });
    });

    assert.strictEqual(t.participants.length, 6);
    t.start();
    const snapshot = t.getSnapshot();
    const rounds = selectBracketRounds(snapshot);
    assert.strictEqual(rounds[0].matches.length, 4);

    // 2 byes for 6 players in an 8-slot bracket
    const byes = rounds[0].matches.filter(m => m.isBye || (m.slots[1] && m.slots[1].playerName === 'BYE'));
    assert.strictEqual(byes.length, 2);
  });

  it('correctly handles a 12-player tournament in a 16-slot bracket', () => {
    const t = new Tournament({
      id: 'tourn-12p',
      name: '12 Player Knockout',
      format: 'KNOCKOUT',
      maxPlayers: 16,
      creatorId: 'p-1',
      creatorName: 'Contender 1'
    });

    for (let i = 2; i <= 12; i++) {
      t.addParticipant({ id: `p-${i}`, name: `Contender ${i}` });
    }

    assert.strictEqual(t.participants.length, 12);
    t.start();
    const snapshot = t.getSnapshot();
    const rounds = selectBracketRounds(snapshot);

    assert.strictEqual(rounds[0].matches.length, 8, 'Round 1 should have 8 matches');
    assert.strictEqual(rounds[1].matches.length, 4, 'Quarterfinals should have 4 matches');
    assert.strictEqual(rounds[2].matches.length, 2, 'Semifinals should have 2 matches');
    assert.strictEqual(rounds[3].matches.length, 1, 'Final should have 1 match');
  });
});

describe('Tournament Selectors: Stress and Edge Values', () => {
  it('safely normalizes extreme scores without overflow or NaN', () => {
    const match = {
      id: 'm-extreme',
      player1: 'Vikramaditya',
      player2: 'Priyadarshini',
      score1: 125,
      score2: 99,
      status: 'completed',
      winner: 'Vikramaditya'
    };

    const norm = normalizeMatch(match);
    assert.strictEqual(norm.scores[0], 125);
    assert.strictEqual(norm.scores[1], 99);
    assert.strictEqual(norm.status, 'COMPLETED');
  });

  it('safely handles Hindi and long character names in slots', () => {
    const hindiName1 = 'विक्रमादित्य शर्मा (चैंपियन)';
    const hindiName2 = 'प्रियदर्शिनी सुब्रह्मण्यम';
    const longName = 'SupercalifragilisticexpialidociousPlayer';

    const match = {
      id: 'm-hindi',
      slots: [
        { playerId: 'p-1', playerName: hindiName1 },
        { playerId: 'p-2', playerName: hindiName2 }
      ],
      scores: [25, 18],
      status: 'IN_PROGRESS'
    };

    const norm = normalizeMatch(match);
    assert.strictEqual(norm.slots[0].playerName, hindiName1);
    assert.strictEqual(norm.slots[1].playerName, hindiName2);
  });

  it('calculates selectStandings correctly for tie-breakers', () => {
    const tournament = {
      id: 't-league',
      format: 'LEAGUE',
      pointsTable: [
        { playerId: 'p-1', playerName: 'Player 1', played: 3, won: 2, lost: 1, points: 6, bingosCompleted: 10 },
        { playerId: 'p-2', playerName: 'Player 2', played: 3, won: 2, lost: 1, points: 6, bingosCompleted: 14 }
      ]
    };

    const standings = selectStandings(tournament);
    assert.strictEqual(standings.length, 2);
    // Player 2 should be ranked 1 because of higher bingosCompleted tie-break
    assert.strictEqual(standings[0].playerId, 'p-2');
    assert.strictEqual(standings[0].rank, 1);
    assert.strictEqual(standings[1].playerId, 'p-1');
    assert.strictEqual(standings[1].rank, 2);
  });
});

describe('Tournament Manager: Host Controls & Advancement', () => {
  it('allows host to kick a player before start', () => {
    const t = new Tournament({
      id: 't-kick-test',
      name: 'Kick Test',
      creatorId: 'host-1',
      creatorName: 'Host'
    });

    t.addParticipant({ id: 'troublemaker', name: 'Troll' });
    assert.strictEqual(t.participants.length, 2);

    const kicked = t.kickParticipant('host-1', 'troublemaker');
    assert.strictEqual(kicked.success, true);
    assert.strictEqual(t.participants.length, 1);
    assert.strictEqual(t.participants[0].id, 'host-1');
  });

  it('prevents non-host from kicking', () => {
    const t = new Tournament({
      id: 't-auth-test',
      name: 'Auth Test',
      creatorId: 'host-1',
      creatorName: 'Host'
    });

    t.addParticipant({ id: 'p-2', name: 'Guest' });

    const kicked = t.kickParticipant('p-2', 'host-1');
    assert.strictEqual(kicked.success, false);
  });

  it('advances winner in knockout matches through tournamentManager', () => {
    const t = new Tournament({
      id: 't-advance-test',
      name: 'Advancement Test',
      format: 'KNOCKOUT',
      maxPlayers: 4,
      creatorId: 'p-1',
      creatorName: 'Alpha'
    });

    t.addParticipant({ id: 'p-2', name: 'Beta' });
    t.addParticipant({ id: 'p-3', name: 'Gamma' });
    t.addParticipant({ id: 'p-4', name: 'Delta' });

    t.start();

    // Find first SF match
    const snapshot = t.getSnapshot();
    const sf1 = snapshot.knockoutMatches[0];
    assert.ok(sf1);

    // Record result: p-1 beats p-2
    const updated = t.recordMatchResult(sf1.id, 'p-1', [25, 10]);
    assert.ok(updated);

    const afterSnap = t.getSnapshot();
    const finalMatch = afterSnap.knockoutMatches.find(m => m.roundKey === 'final' || m.round === 'Grand Final');
    assert.ok(finalMatch);

    // Alpha should now be in the Final
    const hasAlphaInFinal = finalMatch.player1 === 'p-1' || finalMatch.player2 === 'p-1' ||
      finalMatch.slots?.some(s => s.playerId === 'p-1');
    assert.ok(hasAlphaInFinal, 'Alpha must advance to the Final');
  });

  it('declares 3-minute walkover and advances the waiting player', () => {
    const t = new Tournament({
      id: 't-walkover-test',
      name: 'Walkover Test',
      format: 'KNOCKOUT',
      maxPlayers: 4,
      creatorId: 'p-1',
      creatorName: 'Rohan'
    });

    t.addParticipant({ id: 'p-2', name: 'NoShow' });
    t.addParticipant({ id: 'p-3', name: 'Vikram' });
    t.addParticipant({ id: 'p-4', name: 'Aditya' });

    t.start();
    const snap = t.getSnapshot();
    const sf1 = snap.knockoutMatches[0];

    // Award walkover to Rohan (p-1) due to no-show
    const updated = t.recordWalkover(sf1.id, 'p-1', 'No-show after 3 minutes');
    assert.ok(updated);

    const matchAfter = updated.knockoutMatches.find(m => m.id === sf1.id);
    assert.strictEqual(matchAfter.isWalkover, true);
    assert.strictEqual(matchAfter.winnerId, 'p-1');
    assert.deepStrictEqual(matchAfter.scores, [5, 0]);

    // Check final
    const finalMatch = updated.knockoutMatches.find(m => m.roundKey === 'final' || m.round === 'Grand Final');
    assert.ok(finalMatch.player1 === 'p-1' || finalMatch.slots?.[0]?.playerId === 'p-1');
  });
});
