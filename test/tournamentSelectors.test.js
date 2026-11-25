/**
 * test/tournamentSelectors.test.js
 * 
 * Unit tests for tournament data selectors and models.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMatch,
  selectBracketRounds,
  selectStandings,
  selectFixtures,
  selectPathOf,
  selectMatchById
} from '../src/tournaments/selectors.js';
import { Tournament } from '../server/tournamentManager.js';

describe('Tournament Selectors & Data Models', () => {

  describe('1. normalizeMatch', () => {
    it('normalizes legacy match with player1/player2 into standard slots and label', () => {
      const legacy = {
        id: 'ko-1',
        round: 'Quarterfinal 1',
        player1: { id: 'p1', name: 'Alpha' },
        player2: { id: 'p2', name: 'Beta' },
        winner: { id: 'p1', name: 'Alpha' },
        status: 'COMPLETED'
      };

      const norm = normalizeMatch(legacy, 0);
      assert.equal(norm.id, 'ko-1');
      assert.equal(norm.label, 'Match 01');
      assert.equal(norm.slots.length, 2);
      assert.equal(norm.slots[0].playerId, 'p1');
      assert.equal(norm.slots[0].playerName, 'Alpha');
      assert.equal(norm.slots[1].playerId, 'p2');
      assert.equal(norm.slots[1].playerName, 'Beta');
      assert.equal(norm.winnerId, 'p1');
      assert.equal(norm.status, 'COMPLETED');
    });

    it('handles bye matches cleanly with visible Bye slot', () => {
      const byeMatch = {
        id: 'ko-bye',
        round: 'Round 1',
        isBye: true,
        player1: { id: 'p1', name: 'Seeded Player' },
        player2: null,
        winner: { id: 'p1', name: 'Seeded Player' }
      };

      const norm = normalizeMatch(byeMatch, 0);
      assert.equal(norm.isBye, true);
      assert.equal(norm.slots[0].playerId, 'p1');
      assert.equal(norm.slots[1].playerName, 'Bye');
      assert.equal(norm.slots[1].isBye, true);
    });
  });

  describe('2. selectBracketRounds', () => {
    it('groups 8-player knockout matches into Quarterfinals, Semifinals, and Final', () => {
      const tourn = new Tournament('t-8', 'KNOCKOUT', 'Epic 8', 'p1', 'Player 1', { maxParticipants: 8 });
      tourn.fillWithBots();
      const snap = tourn.startTournament();

      const rounds = selectBracketRounds(snap);
      assert.equal(rounds.length, 3);
      assert.equal(rounds[0].title, 'Quarterfinals');
      assert.equal(rounds[0].matches.length, 4);
      assert.equal(rounds[1].title, 'Semifinals');
      assert.equal(rounds[1].matches.length, 2);
      assert.equal(rounds[2].title, 'Grand Final');
      assert.equal(rounds[2].matches.length, 1);
    });

    it('correctly builds odd-size bracket (e.g. 5 players) with automatic Byes in round 1', () => {
      const tourn = new Tournament('t-5', 'KNOCKOUT', 'Odd 5 Cup', 'p1', 'P1', { maxParticipants: 5 });
      tourn.addParticipant('p2', 'P2');
      tourn.addParticipant('p3', 'P3');
      tourn.addParticipant('p4', 'P4');
      tourn.addParticipant('p5', 'P5');
      const snap = tourn.startTournament();

      const rounds = selectBracketRounds(snap);
      assert.ok(rounds.length >= 2);
      // In round 1, byes advance automatically
      const r1 = rounds[0];
      const byeMatches = r1.matches.filter(m => m.isBye);
      assert.ok(byeMatches.length > 0, 'Should have byes for 5-player tournament');
    });
  });

  describe('3. selectStandings', () => {
    it('sorts standings by points descending, then wins, and marks qualification', () => {
      const tourn = new Tournament('t-lg', 'LEAGUE', 'Premier League', 'p1', 'Alpha', {
        maxParticipants: 4,
        pointsPerWin: 3,
        qualificationSlots: 2
      });
      tourn.addParticipant('p2', 'Beta');
      tourn.addParticipant('p3', 'Gamma');
      tourn.addParticipant('p4', 'Delta');
      tourn.startTournament();

      // Record results: p1 wins vs p2
      tourn.recordMatchResult(tourn.leagueFixtures[0].id, 'p1');
      // p3 wins vs p4
      tourn.recordMatchResult(tourn.leagueFixtures[1].id, 'p3');

      const standings = selectStandings(tourn.getSnapshot());
      assert.equal(standings.length, 4);
      assert.equal(standings[0].rank, 1);
      assert.equal(standings[0].points, 3);
      assert.equal(standings[0].qualified, true);
      assert.equal(standings[1].rank, 2);
      assert.equal(standings[1].points, 3);
      assert.equal(standings[1].qualified, true);
      assert.equal(standings[2].rank, 3);
      assert.equal(standings[2].points, 0);
      assert.equal(standings[2].qualified, false); // top 2 qualify
    });
  });

  describe('4. selectFixtures', () => {
    it('filters fixtures by all, mine, live, and done', () => {
      const tourn = new Tournament('t-lg', 'LEAGUE', 'League Fixtures', 'p1', 'Alpha', { maxParticipants: 4 });
      tourn.addParticipant('p2', 'Beta');
      tourn.addParticipant('p3', 'Gamma');
      tourn.addParticipant('p4', 'Delta');
      tourn.startTournament();

      // Complete fixture 1
      tourn.recordMatchResult(tourn.leagueFixtures[0].id, 'p1');
      const snap = tourn.getSnapshot();

      const all = selectFixtures(snap, null, 'all');
      assert.equal(all.length, 6); // 4C2 = 6 fixtures

      const mine = selectFixtures(snap, null, 'mine', 'p1');
      assert.equal(mine.length, 3); // 3 fixtures involving p1

      const done = selectFixtures(snap, null, 'done');
      assert.equal(done.length, 1);

      const live = selectFixtures(snap, null, 'live');
      assert.equal(live.length, 1);
    });
  });

  describe('5. selectPathOf', () => {
    it('traces path of winner through bracket up to Champion', () => {
      const tourn = new Tournament('t-ko', 'KNOCKOUT', 'Cup', 'p1', 'WinnerGuy', { maxParticipants: 4 });
      tourn.addParticipant('p2', 'P2');
      tourn.addParticipant('p3', 'P3');
      tourn.addParticipant('p4', 'P4');
      tourn.startTournament();

      // p1 wins SF1
      tourn.recordMatchResult(tourn.knockoutMatches[0].id, 'p1');
      // p3 wins SF2
      tourn.recordMatchResult(tourn.knockoutMatches[1].id, 'p3');
      // p1 wins Final
      tourn.recordMatchResult(tourn.knockoutMatches[2].id, 'p1');

      const pathP1 = selectPathOf(tourn.getSnapshot(), 'p1');
      assert.equal(pathP1.matchIds.size, 2); // SF1 and Final
      assert.equal(pathP1.isChampion, true);
      assert.equal(pathP1.isEliminated, false);

      const pathP2 = selectPathOf(tourn.getSnapshot(), 'p2');
      assert.equal(pathP2.isEliminated, true);
      assert.equal(pathP2.isChampion, false);
    });
  });
});
