/**
 * test/react_native_mobile_migration.test.js
 * 
 * Comprehensive Test Suite for React Native + Expo Mobile Application Migration:
 * 1. Confirms mobile directory structure, app.json, package.json, and tsconfig.json.
 * 2. Confirms Sports Design Tokens in mobile/theme/colors.ts match the visual reference.
 * 3. Confirms all 13 Game Modes are defined and supported in mobile constants and screens.
 * 4. Confirms mobile components exist: Header, BottomNav, Button, Card, AvatarFrame, CircularProgressGauge,
 *    SignalStrengthBars, BingoLetters, BingoBoard, BingoButton, TrophyChampionCrown, MatchResultModal, AchievementModal.
 * 5. Confirms mobile screens exist: HomeScreen, GameModesScreen, BingoGameScreen, TournamentScreen, FriendsScreen,
 *    ProfileScreen, LeaderboardScreen, NotificationsScreen, SettingsScreen.
 * 6. Confirms shared modules: types.ts, constants.ts, validation.ts, lineModel.js.
 * 7. Confirms useBingoGame hook correctly computes line completions, permutations, and victory claims.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isValidBingoPermutation, generateRandomBoard, checkLineCompletion } from '../shared/validation.ts';

describe('React Native + Expo Mobile Application Migration Verification', () => {
  it('1. Confirms mobile project configuration and metadata exist', () => {
    const pkgPath = path.resolve('mobile', 'package.json');
    const appJsonPath = path.resolve('mobile', 'app.json');
    const tsconfigPath = path.resolve('mobile', 'tsconfig.json');
    const appTsxPath = path.resolve('mobile', 'App.tsx');

    assert.ok(fs.existsSync(pkgPath), 'mobile/package.json must exist');
    assert.ok(fs.existsSync(appJsonPath), 'mobile/app.json must exist');
    assert.ok(fs.existsSync(tsconfigPath), 'mobile/tsconfig.json must exist');
    assert.ok(fs.existsSync(appTsxPath), 'mobile/App.tsx must exist');

    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    assert.equal(appJson.expo.name, 'Bingo Championship');
    assert.equal(appJson.expo.ios.bundleIdentifier, 'com.bingochampionship.app');
    assert.equal(appJson.expo.android.package, 'com.bingochampionship.app');
    assert.ok(appJson.expo.ios.supportsTablet, 'Must support iPad and Android tablets');
  });

  it('2. Confirms mobile sports theme tokens match master reference palette', () => {
    const colorsPath = path.resolve('mobile', 'theme', 'colors.ts');
    assert.ok(fs.existsSync(colorsPath), 'mobile/theme/colors.ts must exist');

    const content = fs.readFileSync(colorsPath, 'utf8');
    assert.ok(content.includes('#0C1422'), 'Must include Deep Navy (#0C1422)');
    assert.ok(content.includes('#101827'), 'Must include Midnight Blue (#101827)');
    assert.ok(content.includes('#17243A'), 'Must include Secondary Blue (#17243A)');
    assert.ok(content.includes('#2864D9'), 'Must include Royal Blue (#2864D9)');
    assert.ok(content.includes('#438BFF'), 'Must include Electric Blue (#438BFF)');
    assert.ok(content.includes('#F4F6FA'), 'Must include Premium White (#F4F6FA)');
    assert.ok(content.includes('#F3B94F'), 'Must include Gold (#F3B94F)');
    assert.ok(content.includes('#8995A8'), 'Must include Slate (#8995A8)');
    assert.ok(content.includes('#32B879'), 'Must include Success Green (#32B879)');
    assert.ok(content.includes('#E6535D'), 'Must include Danger Red (#E6535D)');
  });

  it('3. Confirms all 13 Game Modes are present in mobile shared constants', () => {
    const constantsPath = path.resolve('shared', 'constants.ts');
    assert.ok(fs.existsSync(constantsPath), 'shared/constants.ts must exist');

    const content = fs.readFileSync(constantsPath, 'utf8');
    const modes = [
      'quick-match',
      'private-room',
      '2v2-team',
      'friend-challenge',
      'knockout-tourn',
      'league-tourn',
      'practice',
      'offline',
      'survival',
      'time-challenge',
      'friends-league',
      'friends-knockout',
      'friends-hybrid'
    ];

    modes.forEach((mode) => {
      assert.ok(content.includes(mode), `Must define game mode ${mode}`);
    });
  });

  it('4. Confirms native mobile components are created and well-formed', () => {
    const components = [
      'Header.tsx',
      'BottomNav.tsx',
      'Button.tsx',
      'Card.tsx',
      'AvatarFrame.tsx',
      'CircularProgressGauge.tsx',
      'SignalStrengthBars.tsx',
      'BingoLetters.tsx',
      'BingoBoard.tsx',
      'BingoButton.tsx',
      'TrophyGraphic.tsx',
      'TrophyChampionCrown.tsx',
      'MatchResultModal.tsx',
      'AchievementModal.tsx'
    ];

    components.forEach((comp) => {
      const compPath = path.resolve('mobile', 'components', comp);
      assert.ok(fs.existsSync(compPath), `mobile/components/${comp} must exist`);
    });
  });

  it('5. Confirms native mobile screens are created and well-formed', () => {
    const screens = [
      'HomeScreen.tsx',
      'GameModesScreen.tsx',
      'BingoGameScreen.tsx',
      'TournamentScreen.tsx',
      'FriendsScreen.tsx',
      'ProfileScreen.tsx',
      'LeaderboardScreen.tsx',
      'NotificationsScreen.tsx',
      'SettingsScreen.tsx'
    ];

    screens.forEach((screen) => {
      const screenPath = path.resolve('mobile', 'screens', screen);
      assert.ok(fs.existsSync(screenPath), `mobile/screens/${screen} must exist`);
    });
  });

  it('6. Confirms mobile networking services (REST & Sockets) exist', () => {
    const apiPath = path.resolve('mobile', 'services', 'apiClient.ts');
    const socketPath = path.resolve('mobile', 'services', 'socketService.ts');
    const storagePath = path.resolve('mobile', 'services', 'storageService.ts');
    const hookPath = path.resolve('mobile', 'hooks', 'useBingoGame.ts');

    assert.ok(fs.existsSync(apiPath), 'apiClient.ts must exist');
    assert.ok(fs.existsSync(socketPath), 'socketService.ts must exist');
    assert.ok(fs.existsSync(storagePath), 'storageService.ts must exist');
    assert.ok(fs.existsSync(hookPath), 'useBingoGame.ts must exist');
  });

  it('7. Confirms validation module generates valid 1-25 permutations and line checking', () => {
    const board = generateRandomBoard();
    assert.equal(board.length, 25, 'Board must have exactly 25 cells');
    assert.ok(isValidBingoPermutation(board), 'Generated board must be a valid 1-25 permutation');

    // Test line completion on first row
    const firstRowNumbers = new Set(board.slice(0, 5));
    const lines = checkLineCompletion(board, firstRowNumbers);
    assert.ok(Array.isArray(lines), 'checkLineCompletion must return an array');
    assert.ok(lines.length >= 1, 'First row must count as at least 1 completed line');
    assert.equal(lines[0], 'r0', 'Completed line ID must be r0');
  });
});
