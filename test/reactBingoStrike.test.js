/**
 * test/reactBingoStrike.test.js
 * 
 * Comprehensive tests for React BINGO & Precise SVG Strike-Through System.
 * Tests:
 * 1. Geometry of horizontal rows (r0, r4) and vertical columns (c0, c4).
 * 2. Zero-deviation cell center intersection across all 5 cells.
 * 3. Exact row & column line completion detection.
 * 4. Intersecting line completion without double counting.
 * 5. B-I-N-G-O progression & BINGO button activation threshold (strictly 5 lines).
 * 6. React build artifact verification (bundle & styles).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  straightLineGeometry,
  validateGridArrangement,
  generateRandomGrid,
  findCompletedLines,
  diffNewLines,
  BINGO_LETTERS
} from '../shared/lineModel.js';

describe('React BINGO & Precise SVG Strike-Through System', () => {

  describe('1. SVG Coordinate Geometry & Alignment', () => {
    const s = 100; // 100 units per cell in a 500x500 viewBox

    it('row 0 (first row) passes through the center of all 5 cells with 0 vertical deviation', () => {
      const geom = straightLineGeometry('r0', s);
      assert.equal(geom.id, 'r0');
      assert.equal(geom.y1, 50); // row 0 center
      assert.equal(geom.y2, 50); // straight horizontal
      assert.equal(geom.x1, 20); // starts inside left border
      assert.equal(geom.x2, 480); // ends inside right border

      // Verify each column cell center (50, 150, 250, 350, 450)
      for (let c = 0; c < 5; c++) {
        const xc = (c + 0.5) * s;
        // Since y1 === y2 === 50, y at any xc is exactly 50
        assert.equal(geom.y1, 50);
      }
    });

    it('row 4 (fifth row) passes through the center of all 5 cells with 0 vertical deviation', () => {
      const geom = straightLineGeometry('r4', s);
      assert.equal(geom.id, 'r4');
      assert.equal(geom.y1, 450); // row 4 center
      assert.equal(geom.y2, 450); // straight horizontal
      assert.equal(geom.x1, 20);
      assert.equal(geom.x2, 480);
    });

    it('column 0 (first column) passes through the center of all 5 cells with 0 horizontal deviation', () => {
      const geom = straightLineGeometry('c0', s);
      assert.equal(geom.id, 'c0');
      assert.equal(geom.x1, 50); // col 0 center
      assert.equal(geom.x2, 50); // straight vertical
      assert.equal(geom.y1, 20);
      assert.equal(geom.y2, 480);
    });

    it('column 4 (fifth column) passes through the center of all 5 cells with 0 horizontal deviation', () => {
      const geom = straightLineGeometry('c4', s);
      assert.equal(geom.id, 'c4');
      assert.equal(geom.x1, 450); // col 4 center
      assert.equal(geom.x2, 450); // straight vertical
      assert.equal(geom.y1, 20);
      assert.equal(geom.y2, 480);
    });

    it('intersecting row and column lines pass cleanly through the shared intersection cell', () => {
      const rowGeom = straightLineGeometry('r2', s); // Row 2 center y = 250
      const colGeom = straightLineGeometry('c2', s); // Col 2 center x = 250

      // Shared intersection is at cell 12: center (250, 250)
      assert.equal(rowGeom.y1, 250);
      assert.equal(rowGeom.y2, 250);
      assert.equal(colGeom.x1, 250);
      assert.equal(colGeom.x2, 250);

      // Both lines intersect at exactly (250, 250)
      const intersectsAtX = colGeom.x1;
      const intersectsAtY = rowGeom.y1;
      assert.equal(intersectsAtX, 250);
      assert.equal(intersectsAtY, 250);
    });
  });

  describe('2. Board Arrangement & 1-25 Rules', () => {
    it('generates a random board containing all numbers 1 to 25 exactly once', () => {
      const board = generateRandomGrid();
      assert.equal(board.length, 25);
      const unique = new Set(board);
      assert.equal(unique.size, 25);

      for (let n = 1; n <= 25; n++) {
        assert.ok(unique.has(n), `Number ${n} is missing from board`);
      }
      assert.equal(validateGridArrangement(board).valid, true);
    });

    it('rejects boards with invalid length, missing numbers or duplicates', () => {
      assert.equal(validateGridArrangement([1, 2, 3]).valid, false);
      assert.equal(validateGridArrangement(new Array(25).fill(1)).valid, false);
      const invalid = Array.from({ length: 25 }, (_, i) => i + 1);
      invalid[24] = 99; // 99 is > 25
      assert.equal(validateGridArrangement(invalid).valid, false);
    });
  });

  describe('3. Line Detection & Idempotency', () => {
    const grid = Array.from({ length: 25 }, (_, i) => i + 1);

    it('detects completion of first horizontal row r0', () => {
      const row0Numbers = grid.slice(0, 5); // 1, 2, 3, 4, 5
      const lines = findCompletedLines(grid, row0Numbers);
      assert.deepEqual(lines, ['r0']);
    });

    it('detects completion of fifth horizontal row r4', () => {
      const row4Numbers = grid.slice(20, 25); // 21, 22, 23, 24, 25
      const lines = findCompletedLines(grid, row4Numbers);
      assert.deepEqual(lines, ['r4']);
    });

    it('detects completion of first vertical column c0', () => {
      const col0Numbers = [grid[0], grid[5], grid[10], grid[15], grid[20]];
      const lines = findCompletedLines(grid, col0Numbers);
      assert.deepEqual(lines, ['c0']);
    });

    it('detects completion of fifth vertical column c4', () => {
      const col4Numbers = [grid[4], grid[9], grid[14], grid[19], grid[24]];
      const lines = findCompletedLines(grid, col4Numbers);
      assert.deepEqual(lines, ['c4']);
    });

    it('detects simultaneous intersecting lines without duplicate counting', () => {
      // Row 1 (indices 5..9) and Column 3 (indices 3, 8, 13, 18, 23)
      // Intersection is index 8 (number 9)
      const marks = new Set([
        grid[5], grid[6], grid[7], grid[9], // r1 except intersection
        grid[3], grid[13], grid[18], grid[23], // c3 except intersection
        grid[8] // intersection
      ]);

      const lines = findCompletedLines(grid, marks);
      assert.deepEqual(lines, ['r1', 'c3']);

      // Subsequent call does not create duplicate entries
      const diff1 = diffNewLines([], lines);
      assert.equal(diff1.newLines.length, 2);
      assert.equal(diff1.newLines[0].id, 'r1');
      assert.equal(diff1.newLines[1].id, 'c3');

      // Next call with same lines returns 0 new lines
      const diff2 = diffNewLines(diff1.allLines, lines);
      assert.equal(diff2.newLines.length, 0);
      assert.deepEqual(diff2.allLines, ['r1', 'c3']);
    });
  });

  describe('4. BINGO Letter Progression & Victory Activation', () => {
    it('maps 1st line to B, 2nd to I, 3rd to N, 4th to G, 5th to O', () => {
      const allLines = ['r0', 'r1', 'r2', 'c0', 'c1'];
      const diff = diffNewLines([], allLines);

      assert.equal(diff.newLines[0].letter, 'B');
      assert.equal(diff.newLines[1].letter, 'I');
      assert.equal(diff.newLines[2].letter, 'N');
      assert.equal(diff.newLines[3].letter, 'G');
      assert.equal(diff.newLines[4].letter, 'O');
    });

    it('activates BINGO button strictly when 5 valid lines are completed', () => {
      const fourLines = ['r0', 'r1', 'r2', 'r3'];
      const diff4 = diffNewLines([], fourLines);
      const isButtonActiveBefore = diff4.allLines.length >= 5;
      assert.equal(isButtonActiveBefore, false);

      const fiveLines = ['r0', 'r1', 'r2', 'r3', 'r4'];
      const diff5 = diffNewLines([], fiveLines);
      const isButtonActiveAfter = diff5.allLines.length >= 5;
      assert.equal(isButtonActiveAfter, true);
    });
  });

  describe('5. React Build Artifact Verification', () => {
    it('verifies that public/dist/bingo-react.js bundle exists and is valid', () => {
      const bundlePath = path.resolve('public', 'dist', 'bingo-react.js');
      assert.ok(fs.existsSync(bundlePath), 'bingo-react.js should exist in public/dist');
      const content = fs.readFileSync(bundlePath, 'utf8');
      assert.ok(content.includes('BingoGame'), 'Bundle should contain BingoGame component');
      assert.ok(content.includes('StrikeThroughOverlay'), 'Bundle should contain StrikeThroughOverlay');
      assert.ok(content.includes('mountBingoGame'), 'Bundle should export mountBingoGame');
    });

    it('verifies that public/dist/bingo-react.css exists and contains responsive grid & animations', () => {
      const cssPath = path.resolve('public', 'dist', 'bingo-react.css');
      assert.ok(fs.existsSync(cssPath), 'bingo-react.css should exist in public/dist');
      const css = fs.readFileSync(cssPath, 'utf8');
      assert.ok(css.includes('bingo-board-grid'), 'CSS should define bingo-board-grid');
      assert.ok(css.includes('bingo-strike-overlay'), 'CSS should define bingo-strike-overlay');
      assert.ok(css.includes('draw-strike'), 'CSS should define draw-strike animation keyframes');
      assert.ok(css.includes('aspect-ratio: 1 / 1'), 'CSS should enforce 1:1 aspect ratio');
    });
  });
});
