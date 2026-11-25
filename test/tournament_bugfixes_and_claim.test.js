/**
 * test/tournament_bugfixes_and_claim.test.js
 * 
 * Verification suite for critical bug fixes:
 * 1. BINGO Claim Idempotency & Duplicate Prevention
 * 2. Production Tournament Initial Fixtures (Non-zero matches)
 * 3. Tournament Fill-with-Bots and AutoStart Lifecycle
 * 4. Match Progression and Winner Advancement to Champion
 * 5. Mobile TournamentScreen 7-Tab Completeness & Responsive Wizard Layout
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { matchService } from '../server/services/matchService.js';
import { tournamentManager } from '../server/tournamentManager.js';
import { deviceRooms } from '../server/roomManager.js';
import { economy } from '../server/economy.js';

describe('Critical Bug Fixes: Claim Idempotency & Tournament Lifecycle', () => {

  describe('1. Server BINGO Claim Idempotency & Single Victory Resolution', () => {
    it('awards victory on first valid claim and returns success', async () => {
      const matchId = `match-claim-test-${Date.now()}`;
      const claimId = `claim-key-1-${Date.now()}`;
      const userId = 'player-winner-01';

      const firstClaim = await matchService.claimMatchVictory({
        matchId,
        userId,
        idempotencyKey: claimId,
        completedLinesCount: 5
      });

      assert.strictEqual(firstClaim.success, true);
      assert.strictEqual(firstClaim.valid, true);
      assert.strictEqual(firstClaim.winnerId, userId);
      assert.strictEqual(firstClaim.completedLinesCount, 5);
    });

    it('rejects duplicate claim with same idempotency key and returns cached result', async () => {
      const matchId = `match-claim-test-${Date.now()}`;
      const claimId = `claim-key-repeat-${Date.now()}`;
      const userId = 'player-winner-02';

      // First call
      const first = await matchService.claimMatchVictory({
        matchId,
        userId,
        idempotencyKey: claimId,
        completedLinesCount: 5
      });
      assert.strictEqual(first.valid, true);

      // Rapid duplicate call with identical claimId
      const duplicate = await matchService.claimMatchVictory({
        matchId,
        userId,
        idempotencyKey: claimId,
        completedLinesCount: 5
      });

      assert.strictEqual(duplicate.cached, true);
      assert.strictEqual(duplicate.winnerId, userId);
    });

    it('rejects a second player claim on an already finished match', async () => {
      const matchId = `match-claim-finish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const p1 = 'player-fast';
      const p2 = 'player-slow';

      // Player 1 claims victory first
      const p1Claim = await matchService.claimMatchVictory({
        matchId,
        userId: p1,
        idempotencyKey: `claim-p1-${Date.now()}-${Math.random()}`,
        completedLinesCount: 5
      });
      assert.strictEqual(p1Claim.valid, true);
      assert.strictEqual(p1Claim.winnerId, p1);

      // Player 2 attempts to claim after match is finished
      const p2Claim = await matchService.claimMatchVictory({
        matchId,
        userId: p2,
        idempotencyKey: `claim-p2-${Date.now()}-${Math.random()}`,
        completedLinesCount: 5
      });

      assert.strictEqual(p2Claim.valid, false);
      assert.strictEqual(p2Claim.alreadyFinished, true);
      assert.strictEqual(p2Claim.winnerId, p1); // Winner remains player 1
    });
  });

  describe('2. Initial Production Tournaments have Non-Zero Fixtures', () => {
    it('confirms default Knockout tournament has full 7 bracket matches generated', () => {
      const ko = tournamentManager.getTournament('tourn-cobalt-cup');
      assert.ok(ko, 'tourn-cobalt-cup should exist');
      assert.strictEqual(ko.status, 'IN_PROGRESS');
      assert.strictEqual(ko.knockoutMatches.length, 7, '8-player knockout must have 4 QFs, 2 SFs, 1 Final');
      assert.strictEqual(ko.matches.length, 7);
    });

    it('confirms default League tournament has round-robin fixtures and points table', () => {
      const league = tournamentManager.getTournament('tourn-premier-league');
      assert.ok(league, 'tourn-premier-league should exist');
      assert.strictEqual(league.status, 'IN_PROGRESS');
      assert.ok(league.leagueFixtures.length > 0, 'League must have scheduled fixtures');
      assert.ok(league.pointsTable.length >= 6, 'League must have points table with 6 teams');
    });

    it('confirms default Hybrid tournament has both league stage and playoffs initialized', () => {
      const hybrid = tournamentManager.getTournament('tourn-champions-hybrid');
      assert.ok(hybrid, 'tourn-champions-hybrid should exist');
      assert.strictEqual(hybrid.status, 'IN_PROGRESS');
      assert.ok(hybrid.matches.length > 0, 'Hybrid must have matches');
    });
  });

  describe('3. Tournament Creation & Fill-Bots Lifecycle', () => {
    it('creates a custom tournament with autoStart: true and generates matches immediately', () => {
      const tourn = tournamentManager.createTournament(
        'KNOCKOUT',
        'Auto Start Cup',
        'host-user',
        'Host Pro',
        {
          maxParticipants: 4,
          autoStart: true
        }
      );

      assert.ok(tourn.id.startsWith('tourn-'));
      assert.strictEqual(tourn.status, 'IN_PROGRESS');
      assert.strictEqual(tourn.knockoutMatches.length, 3, '4-player knockout must have 2 SFs and 1 Final');
      assert.strictEqual(tourn.participants.length, 4);
    });

    it('creates a registering tournament and uses fillWithBots() + startTournament()', () => {
      const tourn = tournamentManager.createTournament(
        'LEAGUE',
        'Friends BPL Season',
        'host-123',
        'Captain Cool',
        {
          maxParticipants: 6
        }
      );

      assert.strictEqual(tourn.status, 'REGISTERING');
      assert.strictEqual(tourn.participants.length, 1);

      // Host fills remaining slots with AI bots
      tourn.fillWithBots();
      assert.strictEqual(tourn.participants.length, 6);

      // Host starts tournament
      const snapshot = tourn.startTournament();
      assert.strictEqual(snapshot.status, 'IN_PROGRESS');
      assert.ok(snapshot.fixtures.length > 0, 'Must have fixtures after starting');
      assert.ok(snapshot.standings.length === 6, 'Must have 6 rows in standings');
    });
  });

  describe('4. Match Outcome & Knockout Winner Advancement', () => {
    it('advances QF winner into Semifinal slot and Final winner becomes Champion', () => {
      const tourn = tournamentManager.createTournament(
        'KNOCKOUT',
        'Advancement Test Cup',
        'host-test',
        'Host',
        { maxParticipants: 4, autoStart: true }
      );

      const sf1 = tourn.knockoutMatches[0];
      const sf2 = tourn.knockoutMatches[1];
      const final = tourn.knockoutMatches[2];

      const p1 = sf1.player1;
      const p3 = sf2.player1;

      // SF 1 win for p1
      tourn.recordMatchResult(sf1.id, p1.id, [5, 2]);
      assert.strictEqual(sf1.status, 'COMPLETED');
      assert.strictEqual(sf1.winnerId, p1.id);
      assert.strictEqual(final.player1?.id, p1.id); // Advanced into Final slot 0

      // SF 2 win for p3
      tourn.recordMatchResult(sf2.id, p3.id, [5, 3]);
      assert.strictEqual(sf2.status, 'COMPLETED');
      assert.strictEqual(sf2.winnerId, p3.id);
      assert.strictEqual(final.player2?.id, p3.id); // Advanced into Final slot 1
      assert.strictEqual(final.status, 'READY');

      // Final win for p1
      tourn.recordMatchResult(final.id, p1.id, [5, 4]);
      assert.strictEqual(final.status, 'COMPLETED');
      assert.strictEqual(tourn.champion?.id, p1.id);
      assert.strictEqual(tourn.status, 'COMPLETED');
    });
  });

  describe('5. Mobile TournamentScreen & Responsive Layout Audit', () => {
    it('confirms mobile TournamentScreen.tsx exists and implements all 7 tabs', () => {
      const tournScreenPath = path.resolve('mobile/screens/TournamentScreen.tsx');
      assert.ok(fs.existsSync(tournScreenPath), 'mobile/screens/TournamentScreen.tsx must exist');

      const content = fs.readFileSync(tournScreenPath, 'utf8');
      assert.ok(content.includes('overview'), 'Must have overview tab');
      assert.ok(content.includes('fixtures'), 'Must have fixtures tab');
      assert.ok(content.includes('standings'), 'Must have standings tab');
      assert.ok(content.includes('bracket'), 'Must have bracket tab');
      assert.ok(content.includes('participants'), 'Must have participants tab');
      assert.ok(content.includes('results'), 'Must have results tab');
      assert.ok(content.includes('stats'), 'Must have stats tab');
      assert.ok(content.includes('TrophyChampionCrown'), 'Must render TrophyChampionCrown');
      assert.ok(content.includes('apiClient'), 'Must integrate apiClient');
    });

    it('confirms client hook useBingoGame contains synchronous claim locking', () => {
      const hookPath = path.resolve('mobile/hooks/useBingoGame.ts');
      const hookContent = fs.readFileSync(hookPath, 'utf8');
      assert.ok(hookContent.includes('isClaimingRef'), 'useBingoGame.ts must use isClaimingRef lock');
      assert.ok(hookContent.includes('bingoClaimed'), 'useBingoGame.ts must track bingoClaimed');

      const webHookPath = path.resolve('src/hooks/useBingoGame.js');
      const webHookContent = fs.readFileSync(webHookPath, 'utf8');
      assert.ok(webHookContent.includes('isClaimingRef'), 'useBingoGame.js must use isClaimingRef lock');
    });

    it('confirms tournaments.css contains responsive mobile rules for create wizard and layout', () => {
      const cssPath = path.resolve('src/styles/tournaments.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');
      assert.ok(cssContent.includes('@media (max-width: 839px)'), 'Must contain tablet/mobile media query');
      assert.ok(cssContent.includes('.tourn-create-layout'), 'Must format tourn-create-layout for single column');
      assert.ok(cssContent.includes('.tourn-wizard-stepper'), 'Must support scrollable or wrapped stepper');
    });
  });
});
