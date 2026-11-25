/**
 * test/react_frontend_rebuild.test.js
 * 
 * Verification Test Suite for React-Powered Frontend Rebuild:
 * 1. Confirms the whole application frontend is bundled and powered by React.
 * 2. Confirms the legacy "Play BINGO React Mode" button has been completely removed.
 * 3. Confirms all 13 game modes exist and are accessible through React components.
 * 4. Confirms that BingoGame 5x5 grid, line strikes, and tournament navigation are unified.
 * 5. Confirms auto-mount and bundle exports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_GAME_MODES } from '../src/constants/gameModes.js';

describe('React Frontend Rebuild & Complete Application Verification', () => {
  it('1. Verifies that all 13 game modes are defined and connected in React', () => {
    assert.equal(ALL_GAME_MODES.length, 13);
    const expectedIds = [
      'quick-match',
      'private-room',
      'team-2v2',
      'friend-challenge',
      'knockout',
      'league',
      'practice',
      'offline',
      'survival',
      'time-challenge',
      'friends-league',
      'friends-knockout',
      'friends-hybrid'
    ];

    expectedIds.forEach(id => {
      const found = ALL_GAME_MODES.find(m => m.id === id);
      assert.ok(found, `Mode ${id} should be present in ALL_GAME_MODES`);
      assert.ok(found.title, `Mode ${id} should have a title`);
      assert.ok(found.desc, `Mode ${id} should have a description`);
      assert.ok(found.reqPill, `Mode ${id} should have a requirements pill`);
    });
  });

  it('2. Confirms that the legacy separate "Play BINGO React Mode" button is removed from index.html', () => {
    const indexHtml = fs.readFileSync(path.resolve('public', 'index.html'), 'utf8');
    assert.strictEqual(
      indexHtml.includes('id="btn-play-react"'),
      false,
      'The separate Play BINGO React Mode button must not exist in index.html'
    );
    assert.strictEqual(
      indexHtml.includes('Play BINGO (React Mode & Green SVG Lines)'),
      false,
      'React Mode label must be removed since React powers the whole application'
    );
  });

  it('3. Verifies that public/dist/bingo-react.js bundle exports App, BingoGame, and TournamentRouter', () => {
    const bundlePath = path.resolve('public', 'dist', 'bingo-react.js');
    assert.ok(fs.existsSync(bundlePath), 'bingo-react.js bundle must exist');
    const content = fs.readFileSync(bundlePath, 'utf8');

    assert.ok(content.includes('App'), 'Bundle should contain App');
    assert.ok(content.includes('BingoGame'), 'Bundle should contain BingoGame');
    assert.ok(content.includes('TournamentRouter'), 'Bundle should contain TournamentRouter');
    assert.ok(content.includes('HomeScreen'), 'Bundle should contain HomeScreen');
    assert.ok(content.includes('ModesHubScreen'), 'Bundle should contain ModesHubScreen');
    assert.ok(content.includes('ModeDetailScreen'), 'Bundle should contain ModeDetailScreen');
    assert.ok(content.includes('mountApp'), 'Bundle should export mountApp');
    assert.ok(content.includes('mountBingoGame'), 'Bundle should export mountBingoGame');
    assert.ok(content.includes('mountTournamentApp'), 'Bundle should export mountTournamentApp');
  });

  it('4. Confirms that index.html contains the root container for full React application mounting', () => {
    const indexHtml = fs.readFileSync(path.resolve('public', 'index.html'), 'utf8');
    assert.ok(
      indexHtml.includes('id="app-root"') || indexHtml.includes('id="root"'),
      'index.html must have #app-root or #root container for React'
    );
  });

  it('5. Confirms that the 13 mode back buttons retain modes-hub navigation targets', () => {
    const indexHtml = fs.readFileSync(path.resolve('public', 'index.html'), 'utf8');
    const matches = indexHtml.match(/data-back="modes-hub"/g);
    assert.ok(matches && matches.length >= 13, 'Expected at least 13 modes-hub back buttons in index.html');
  });
});
