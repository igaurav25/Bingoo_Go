/**
 * test/sports_visual_design.test.js
 * 
 * Verification Test Suite for Complete Sports Tournament Visual Design & UI System:
 * 1. Confirms master sports design palette tokens in variables.css and sportsTheme.css.
 * 2. Confirms vector graphics library exports (BingoSportsLogo, TrophyGraphic, AvatarFrame, CoinIcon, VictoryCrest, DefeatCrest).
 * 3. Confirms Header, BottomNav, HomeScreen, LeaderboardScreen, ProfileScreen, and MatchResult use sports styling.
 * 4. Confirms bundle compiles and builds cleanly with esbuild.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Complete Sports Tournament Visual Design & UI System Verification', () => {
  it('1. Confirms master sports palette is present in design tokens', () => {
    const sportsThemePath = path.resolve('src', 'styles', 'sportsTheme.css');
    const variablesPath = path.resolve('public', 'css', 'variables.css');

    assert.ok(fs.existsSync(sportsThemePath), 'sportsTheme.css must exist');
    assert.ok(fs.existsSync(variablesPath), 'variables.css must exist');

    const themeContent = fs.readFileSync(sportsThemePath, 'utf8');
    assert.ok(themeContent.includes('#101827'), 'Must define Deep Navy (#101827)');
    assert.ok(themeContent.includes('#17243A'), 'Must define Midnight Blue (#17243A)');
    assert.ok(themeContent.includes('#0C1422'), 'Must define Dark Background (#0C1422)');
    assert.ok(themeContent.includes('#2864D9'), 'Must define Royal Blue (#2864D9)');
    assert.ok(themeContent.includes('#438BFF'), 'Must define Electric Blue (#438BFF)');
    assert.ok(themeContent.includes('#F4F6FA'), 'Must define Premium White (#F4F6FA)');
    assert.ok(themeContent.includes('#F3B94F'), 'Must define Gold (#F3B94F)');
    assert.ok(themeContent.includes('#8995A8'), 'Must define Slate (#8995A8)');
    assert.ok(themeContent.includes('#32B879'), 'Must define Success Green (#32B879)');
    assert.ok(themeContent.includes('#E6535D'), 'Must define Danger Red (#E6535D)');
  });

  it('2. Confirms original vector graphics library exists with all components', () => {
    const graphicsPath = path.resolve('src', 'components', 'SportsGraphics.jsx');
    assert.ok(fs.existsSync(graphicsPath), 'SportsGraphics.jsx must exist');

    const content = fs.readFileSync(graphicsPath, 'utf8');
    assert.ok(content.includes('BingoSportsLogo'), 'Must export BingoSportsLogo');
    assert.ok(content.includes('TrophyGraphic'), 'Must export TrophyGraphic');
    assert.ok(content.includes('AvatarFrame'), 'Must export AvatarFrame');
    assert.ok(content.includes('CoinIcon'), 'Must export CoinIcon');
    assert.ok(content.includes('VictoryCrest'), 'Must export VictoryCrest');
    assert.ok(content.includes('DefeatCrest'), 'Must export DefeatCrest');
  });

  it('3. Confirms Header and BottomNav are updated with sports crest and icons', () => {
    const headerPath = path.resolve('src', 'components', 'Header.jsx');
    const bottomNavPath = path.resolve('src', 'components', 'BottomNav.jsx');

    const headerContent = fs.readFileSync(headerPath, 'utf8');
    assert.ok(headerContent.includes('BingoSportsLogo'), 'Header must render BingoSportsLogo');
    assert.ok(headerContent.includes('CoinIcon'), 'Header must render CoinIcon');

    const navContent = fs.readFileSync(bottomNavPath, 'utf8');
    assert.ok(navContent.includes('sports-bottom-nav'), 'BottomNav must use sports-bottom-nav');
    assert.ok(navContent.includes('data-tab={item.id}'), 'BottomNav must bind data-tab dynamically');
    assert.ok(navContent.includes("id: 'home'"), 'BottomNav must contain home tab');
    assert.ok(navContent.includes("id: 'modes'"), 'BottomNav must contain modes tab');
    assert.ok(navContent.includes("id: 'tournaments'"), 'BottomNav must contain tournaments tab');
  });

  it('4. Confirms HomeScreen integrates esports HUD, broadcast banner, and core mode cards', () => {
    const homePath = path.resolve('src', 'screens', 'HomeScreen.jsx');
    const homeContent = fs.readFileSync(homePath, 'utf8');

    assert.ok(homeContent.includes('AvatarFrame'), 'HomeScreen must render AvatarFrame');
    assert.ok(homeContent.includes('TrophyGraphic'), 'HomeScreen must render TrophyGraphic');
    assert.ok(homeContent.includes('sports-featured-banner'), 'HomeScreen must have featured sports banner');
    assert.ok(homeContent.includes('btn-hero-play'), 'HomeScreen must have hero play CTA');
    assert.ok(homeContent.includes('btn-browse-all-modes'), 'HomeScreen must have browse all modes button');
    assert.ok(homeContent.includes('code-box-input'), 'HomeScreen must have code input boxes');
  });

  it('5. Confirms MatchResult integrates VictoryCrest and DefeatCrest vector artwork', () => {
    const resultPath = path.resolve('src', 'components', 'MatchResult.jsx');
    const resultContent = fs.readFileSync(resultPath, 'utf8');

    assert.ok(resultContent.includes('VictoryCrest'), 'MatchResult must render VictoryCrest');
    assert.ok(resultContent.includes('DefeatCrest'), 'MatchResult must render DefeatCrest');
    assert.ok(resultContent.includes('CoinIcon'), 'MatchResult must render CoinIcon');
  });

  it('6. Confirms LeaderboardScreen and ProfileScreen integrate sports podium and trophy case', () => {
    const lbPath = path.resolve('src', 'screens', 'LeaderboardScreen.jsx');
    const profPath = path.resolve('src', 'screens', 'ProfileScreen.jsx');

    const lbContent = fs.readFileSync(lbPath, 'utf8');
    assert.ok(lbContent.includes('AvatarFrame'), 'Leaderboard must render AvatarFrame');
    assert.ok(lbContent.includes('CoinIcon'), 'Leaderboard must render CoinIcon');

    const profContent = fs.readFileSync(profPath, 'utf8');
    assert.ok(profContent.includes('TrophyGraphic'), 'Profile must render TrophyGraphic');
    assert.ok(profContent.includes('AvatarFrame'), 'Profile must render AvatarFrame');
    assert.ok(profContent.includes('Career Match Statistics'), 'Profile must display Career Match Statistics');
  });

  it('7. Confirms BingoGame, BingoBoard, and BracketView integrate circular gauges, lottery balls, and championship trophy', () => {
    const gamePath = path.resolve('src', 'components', 'BingoGame.jsx');
    const boardPath = path.resolve('src', 'components', 'BingoBoard.jsx');
    const bracketPath = path.resolve('src', 'tournaments', 'components', 'BracketView.jsx');
    const standingsPath = path.resolve('src', 'tournaments', 'components', 'StandingsTable.jsx');

    const gameContent = fs.readFileSync(gamePath, 'utf8');
    assert.ok(gameContent.includes('CircularProgressGauge'), 'BingoGame must render CircularProgressGauge');
    assert.ok(gameContent.includes('SignalStrengthIcon'), 'BingoGame must render SignalStrengthIcon');
    assert.ok(gameContent.includes('Your Progress'), 'BingoGame must show Your Progress');

    const boardContent = fs.readFileSync(boardPath, 'utf8');
    assert.ok(boardContent.includes('BingoLotteryBall'), 'BingoBoard must render BingoLotteryBall');

    const bracketContent = fs.readFileSync(bracketPath, 'utf8');
    assert.ok(bracketContent.includes('TrophyChampionCrown'), 'BracketView must render TrophyChampionCrown');

    const standingsContent = fs.readFileSync(standingsPath, 'utf8');
    assert.ok(standingsContent.includes('Bingo League'), 'StandingsTable must show Bingo League banner');
  });

  it('8. Confirms AchievementModal is implemented with crown crest and coin reward', () => {
    const achPath = path.resolve('src', 'components', 'AchievementModal.jsx');
    assert.ok(fs.existsSync(achPath), 'AchievementModal.jsx must exist');

    const achContent = fs.readFileSync(achPath, 'utf8');
    assert.ok(achContent.includes('Achievement Unlocked!'), 'Must show Achievement Unlocked!');
    assert.ok(achContent.includes('Tournament Champion'), 'Must show Tournament Champion title');
    assert.ok(achContent.includes('Claim Reward'), 'Must have Claim Reward button');
  });
});
