import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { soundManager } from '../public/js/audio.js';

describe('UI/UX Redesign, Motion, Audio & Theme Verification', () => {
  it('1. SoundManager exposes volume, music toggle, countdown, shuffle, claim, and tournament cues', () => {
    assert.equal(typeof soundManager.playTap, 'function');
    assert.equal(typeof soundManager.playMark, 'function');
    assert.equal(typeof soundManager.playLineStroke, 'function');
    assert.equal(typeof soundManager.playLetterStrike, 'function');
    assert.equal(typeof soundManager.playButtonReady, 'function');
    assert.equal(typeof soundManager.playVictory, 'function');
    assert.equal(typeof soundManager.playDefeat, 'function');
    assert.equal(typeof soundManager.playCountdownBeep, 'function');
    assert.equal(typeof soundManager.playPaperShuffle, 'function');
    assert.equal(typeof soundManager.playBingoClaim, 'function');
    assert.equal(typeof soundManager.playTournamentFanfare, 'function');
    assert.equal(typeof soundManager.setVolume, 'function');
    assert.equal(typeof soundManager.toggleMusic, 'function');

    const prevVol = soundManager.volume;
    assert.equal(soundManager.setVolume(0.45), 0.45);
    soundManager.setVolume(prevVol);
  });

  it('2. Arena design system CSS defines dark/light themes, GPU keyframes, desktop rail, and reduced-motion rules', () => {
    const sportsCss = fs.readFileSync(path.resolve('src/styles/sportsTheme.css'), 'utf8');
    const bingoCss = fs.readFileSync(path.resolve('src/styles/bingo.css'), 'utf8');
    const tournCss = fs.readFileSync(path.resolve('src/styles/tournaments.css'), 'utf8');

    assert.ok(sportsCss.includes('[data-theme="light"]'));
    assert.ok(sportsCss.includes('prefers-reduced-motion: reduce'));
    assert.ok(sportsCss.includes('.arena-screen-enter'));
    assert.ok(sportsCss.includes('.responsive-nav-rail'));
    assert.ok(sportsCss.includes('.arena-home-grid'));
    assert.ok(sportsCss.includes('.countdown-overlay'));

    assert.ok(bingoCss.includes('cell-mark-pop'));
    assert.ok(bingoCss.includes('draw-strike'));

    assert.ok(tournCss.includes('@media (max-width: 839px)'));
    assert.ok(tournCss.includes('.tourn-ipl-hero-banner'));
  });

  it('3. Core React screens and components preserve contracts and wire redesigned features cleanly', () => {
    const standings = fs.readFileSync(path.resolve('src/tournaments/components/StandingsTable.jsx'), 'utf8');
    assert.ok(standings.includes('tournament = null'), 'StandingsTable must accept tournament prop');
    assert.ok(standings.includes('tieBreakerNote'), 'StandingsTable must display tie-breaker notes');

    const bingoGame = fs.readFileSync(path.resolve('src/components/BingoGame.jsx'), 'utf8');
    assert.ok(bingoGame.includes('countdownStep'), 'BingoGame must include match start countdown');
    assert.ok(bingoGame.includes('claim-invalid-shake'), 'BingoGame must shake on invalid action/claim');
    assert.ok(bingoGame.includes('onSendReaction='), 'BingoGame must pass reaction handler to GameControls');

    const overview = fs.readFileSync(path.resolve('src/tournaments/screens/TournamentOverview.jsx'), 'utf8');
    for (const tabId of ['overview', 'lobby', 'league', 'live', 'schedule', 'table', 'players', 'playoffs', 'final', 'champion', 'stats', 'results', 'history', 'rewards', 'rules']) {
      assert.ok(overview.includes(`id: '${tabId}'`), `TournamentOverview must render '${tabId}' tab`);
    }

    const header = fs.readFileSync(path.resolve('src/components/Header.jsx'), 'utf8');
    assert.ok(header.includes('wsConnected'), 'Header must display real WebSocket connectivity status');
  });
});
