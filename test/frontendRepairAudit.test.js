/**
 * test/frontendRepairAudit.test.js
 * Verification test suite for Frontend Emergency Repairs:
 * - Universal Navigation & Back button target resolution
 * - Responsive layout & modal overflow safety
 * - Landscape gameplay layout rules
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Emergency Frontend Repair Audit', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf-8');
  const gameClientJs = fs.readFileSync(path.join(__dirname, '../public/js/gameClient.js'), 'utf-8');
  const responsiveCss = fs.readFileSync(path.join(__dirname, '../public/css/responsive.css'), 'utf-8');
  const globalCss = fs.readFileSync(path.join(__dirname, '../public/css/global.css'), 'utf-8');
  const modalsCss = fs.readFileSync(path.join(__dirname, '../public/css/components/modals.css'), 'utf-8');
  const gameplayCss = fs.readFileSync(path.join(__dirname, '../public/css/features/gameplay.css'), 'utf-8');
  const bingoCss = fs.readFileSync(path.join(__dirname, '../src/styles/bingo.css'), 'utf-8');

  it('All 13 dedicated mode screens have valid back button targets to modes-hub', () => {
    // There should be no data-back="modes" anywhere in index.html
    assert.strictEqual(indexHtml.includes('data-back="modes"'), false, 'data-back="modes" should be replaced with modes-hub');
    
    // There should be 13 mode screen back buttons with data-back="modes-hub"
    const matches = indexHtml.match(/data-back="modes-hub"/g);
    assert.ok(matches && matches.length >= 13, `Expected at least 13 modes-hub back buttons, found ${matches ? matches.length : 0}`);
  });

  it('gameClient.js normalizes "modes" navigation to "modes-hub" defensively', () => {
    assert.ok(gameClientJs.includes("if (targetScreen === 'modes') targetScreen = 'modes-hub';"), 'navigateTo should normalize modes');
    assert.ok(gameClientJs.includes("if (screenName === 'modes') screenName = 'modes-hub';"), '_showScreen should normalize modes');
  });

  it('Responsive CSS eliminated the 460px bottleneck for tablets and desktops', () => {
    assert.strictEqual(responsiveCss.includes('max-width: 460px'), false, 'max-width: 460px bottleneck must be removed');
    assert.ok(responsiveCss.includes('max-width: 720px'), 'Tablets should support up to 720px');
    assert.ok(responsiveCss.includes('max-width: 1024px'), 'Desktop should support up to 1024px');
  });

  it('Global CSS ensures natural scrolling on small viewports and strict no-scroll on gameplay', () => {
    assert.ok(globalCss.includes('overflow-y: auto'), '.screen-view should allow vertical scrolling on content overflow');
    assert.ok(globalCss.includes('overflow: hidden !important;'), 'Gameplay views must strictly enforce no-scroll');
  });

  it('Modal CSS prevents cut-off on short or landscape viewports', () => {
    assert.ok(modalsCss.includes('max-height: calc(100dvh - 32px)'), 'Modals must not exceed viewport height');
    assert.ok(modalsCss.includes('overflow-y: auto'), 'Modals must scroll if content exceeds viewport');
  });

  it('Landscape 2-column layout is implemented for mobile landscape viewports in both CSS files', () => {
    assert.ok(gameplayCss.includes('@media (orientation: landscape) and (max-height: 520px)'), 'gameplay.css has landscape adaptation');
    assert.ok(gameplayCss.includes('grid-template-columns: auto 1fr'), 'gameplay.css uses 2-column layout in landscape');
    assert.ok(bingoCss.includes('@media (orientation: landscape) and (max-height: 520px)'), 'bingo.css has landscape adaptation');
    assert.ok(bingoCss.includes('grid-template-columns: auto 1fr'), 'bingo.css uses 2-column layout in landscape');
  });
});
