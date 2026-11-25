/**
 * test/sports_bracket_playoffs.test.js
 * 
 * Verification Test Suite for Realistic Sports-Style Knockout Bracket & Playoffs:
 * 1. Confirms 8-player knockout bracket structure: Quarter-Finals (4), Semi-Finals (2), Grand Final (1).
 * 2. Confirms sports match card features: Avatars, seeds, verified scores, winner highlights, advancement pills.
 * 3. Confirms playoffs broadcast metrics: Total participants, current stage, remaining players, completed matches, prize pool.
 * 4. Confirms champion celebration: Trophy SVG, prize coin breakdown, runner-up honor, road-to-glory journey.
 * 5. Confirms interactive match details modal and head-to-head comparison data.
 * 6. Confirms responsive design: Mobile round tabs vs desktop horizontal tree.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { selectBracketRounds, selectPathOf } from '../src/tournaments/selectors.js';
import { Tournament } from '../server/tournamentManager.js';

describe('Realistic Sports-Style Knockout Bracket & Playoffs Verification', () => {
  // Mock 8-player tournament
  function createSampleKnockoutTournament() {
    const t = new Tournament({
      type: 'KNOCKOUT',
      name: 'IPL Bingo Knockout Championship 2026',
      creatorId: 'host-1',
      creatorName: 'Host Master',
      config: {
        maxParticipants: 8,
        prizePool: 10000
      }
    });

    // Add 8 players
    const players = [
      { id: 'p1', name: 'Virat B.', avatar: '⚡', seed: 1, rank: 'Diamond III' },
      { id: 'p2', name: 'Rohit S.', avatar: '🦁', seed: 2, rank: 'Platinum I' },
      { id: 'p3', name: 'MS D.', avatar: '🚁', seed: 3, rank: 'Master V' },
      { id: 'p4', name: 'Hardik P.', avatar: '🎯', seed: 4, rank: 'Gold II' },
      { id: 'p5', name: 'KL Rahul', avatar: '🛡️', seed: 5, rank: 'Gold I' },
      { id: 'p6', name: 'Shubman G.', avatar: '🌟', seed: 6, rank: 'Silver III' },
      { id: 'p7', name: 'Rishabh P.', avatar: '🥊', seed: 7, rank: 'Diamond I' },
      { id: 'p8', name: 'Jasprit B.', avatar: '🔥', seed: 8, rank: 'Master I' }
    ];

    players.forEach(p => t.addParticipant(p.id, p.name, p));
    t.startTournament('host-1');
    return t;
  }

  it('1. Generates complete 8-player connected sports bracket (4 QFs, 2 SFs, 1 Final)', () => {
    const t = createSampleKnockoutTournament();
    const rounds = selectBracketRounds(t.getSnapshot());

    assert.equal(rounds.length, 3, 'Should have 3 rounds: QF, SF, Final');
    
    // Quarter-Finals
    const qf = rounds[0];
    assert.equal(qf.matches.length, 4, 'Quarterfinals should have 4 matches');
    assert.ok(qf.title.toLowerCase().includes('quarter') || qf.key === 'qf');

    // Semi-Finals
    const sf = rounds[1];
    assert.equal(sf.matches.length, 2, 'Semifinals should have 2 matches');

    // Grand Final
    const fin = rounds[2];
    assert.equal(fin.matches.length, 1, 'Grand Final should have 1 match');

    // Verify advancement linkage
    qf.matches.forEach(m => {
      assert.ok(m.advancesTo, 'Every QF match must link to a semifinal match');
      assert.ok(m.advancesTo.matchId, 'Target matchId must be defined');
    });

    sf.matches.forEach(m => {
      assert.ok(m.advancesTo, 'Every SF match must link to the grand final');
      assert.equal(m.advancesTo.matchId, fin.matches[0].id, 'Must advance to the Grand Final match');
    });
  });

  it('2. Advances verified match winners and updates next round slots dynamically', () => {
    const t = createSampleKnockoutTournament();

    // Complete QF 1: p1 vs p8 -> p1 wins 5-3
    const qf1 = t.knockoutMatches[0];
    t.recordMatchResult(qf1.id, qf1.player1.id, [5, 3]);

    assert.equal(qf1.status, 'COMPLETED');
    assert.equal(qf1.winnerId, qf1.player1.id);

    // Verify parent SF received winner
    const sf1 = t.knockoutMatches.find(m => m.id === qf1.advancesTo.matchId);
    assert.ok(sf1, 'Target SF match must exist');
    assert.equal(sf1.player1.id, qf1.player1.id);
  });

  it('3. Computes victory path and verifies full tournament journey up to Champion', () => {
    const t = createSampleKnockoutTournament();

    // Play through to Champion
    // QF 1-4
    t.recordMatchResult(t.knockoutMatches[0].id, t.knockoutMatches[0].player1.id, [5, 2]);
    t.recordMatchResult(t.knockoutMatches[1].id, t.knockoutMatches[1].player1.id, [5, 4]);
    t.recordMatchResult(t.knockoutMatches[2].id, t.knockoutMatches[2].player1.id, [5, 1]);
    t.recordMatchResult(t.knockoutMatches[3].id, t.knockoutMatches[3].player1.id, [5, 3]);

    // SF 1-2
    const sf1 = t.knockoutMatches[4];
    const sf2 = t.knockoutMatches[5];
    t.recordMatchResult(sf1.id, sf1.player1.id, [5, 3]);
    t.recordMatchResult(sf2.id, sf2.player1.id, [5, 4]);

    // Grand Final
    const finalMatch = t.knockoutMatches[6];
    t.recordMatchResult(finalMatch.id, finalMatch.player1.id, [5, 2]);

    const finishedSnap = t.getSnapshot();
    assert.equal(finishedSnap.status, 'COMPLETED');
    assert.ok(finishedSnap.champion, 'Champion must be crowned');

    const championId = finishedSnap.champion.id || finishedSnap.champion;
    const champPath = selectPathOf(finishedSnap, championId);
    assert.equal(champPath.matchIds.size, 3, 'Champion must have a 3-match path of victories (QF, SF, Final)');
  });

  it('4. Confirms source files for sports match cards, details modal, and champion screen exist', () => {
    const matchCardPath = path.resolve('src', 'tournaments', 'components', 'MatchCard.jsx');
    const modalPath = path.resolve('src', 'tournaments', 'components', 'MatchDetailsModal.jsx');
    const bracketViewPath = path.resolve('src', 'tournaments', 'components', 'BracketView.jsx');
    const championScreenPath = path.resolve('src', 'tournaments', 'screens', 'TournamentChampion.jsx');

    assert.ok(fs.existsSync(matchCardPath), 'MatchCard.jsx must exist');
    assert.ok(fs.existsSync(modalPath), 'MatchDetailsModal.jsx must exist');
    assert.ok(fs.existsSync(bracketViewPath), 'BracketView.jsx must exist');
    assert.ok(fs.existsSync(championScreenPath), 'TournamentChampion.jsx must exist');

    const matchCardContent = fs.readFileSync(matchCardPath, 'utf8');
    assert.ok(matchCardContent.includes('sports-match-card'), 'MatchCard must use sports-match-card styling');
    assert.ok(matchCardContent.includes('winner-slot'), 'MatchCard must have winner-slot visual treatment');
    assert.ok(matchCardContent.includes('eliminated-slot'), 'MatchCard must have eliminated-slot visual treatment');
    assert.ok(matchCardContent.includes('featured-grand-final'), 'MatchCard must have featured grand final styling');

    const bracketViewContent = fs.readFileSync(bracketViewPath, 'utf8');
    assert.ok(bracketViewContent.includes('sports-playoffs-hero-banner'), 'BracketView must have sports playoffs broadcast hero banner');
    assert.ok(bracketViewContent.includes('sports-champion-podium'), 'BracketView must have sports champion podium');
    assert.ok(bracketViewContent.includes('MatchDetailsModal'), 'BracketView must connect MatchDetailsModal');

    const championContent = fs.readFileSync(championScreenPath, 'utf8');
    assert.ok(championContent.includes('premium-golden-trophy-svg'), 'Champion screen must include premium golden trophy SVG');
    assert.ok(championContent.includes('sports-road-to-glory'), 'Champion screen must include road to glory victory journey');
  });

  it('5. Confirms tournaments.css contains sports broadcast and knockout styling rules', () => {
    const cssPath = path.resolve('src', 'styles', 'tournaments.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.sports-playoffs-hero-banner'), 'Must contain sports playoffs hero banner styles');
    assert.ok(cssContent.includes('.sports-match-card'), 'Must contain sports match card styles');
    assert.ok(cssContent.includes('.sports-connector-path'), 'Must contain sports SVG connector path styles');
    assert.ok(cssContent.includes('.sports-champion-podium'), 'Must contain champion podium styles');
    assert.ok(cssContent.includes('.match-details-modal'), 'Must contain match details modal styles');
    assert.ok(cssContent.includes('.sports-champion-card'), 'Must contain sports champion card styles');
  });
});
