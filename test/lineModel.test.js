import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GRID_SIZE,
  ROW_IDS,
  COL_IDS,
  DIAG_IDS,
  BINGO_LETTERS,
  validateGridArrangement,
  generateRandomGrid,
  getLineDefinitions,
  findCompletedLines,
  diffNewLines,
  lineGeometry
} from '../shared/lineModel.js';

test('Grid Arrangement Validation & Generation', () => {
  // Valid permutation
  const validGrid = Array.from({ length: 25 }, (_, i) => i + 1);
  assert.equal(validateGridArrangement(validGrid).valid, true);

  // Invalid lengths
  assert.equal(validateGridArrangement([1, 2, 3]).valid, false);
  assert.equal(validateGridArrangement(Array.from({ length: 26 }, (_, i) => i + 1)).valid, false);

  // Duplicates
  const dupeGrid = [...validGrid];
  dupeGrid[24] = 1;
  assert.equal(validateGridArrangement(dupeGrid).valid, false);

  // Out of range numbers
  const outOfRange = [...validGrid];
  outOfRange[0] = 0;
  assert.equal(validateGridArrangement(outOfRange).valid, false);

  // Fisher-Yates generator produces valid permutation
  const randomGrid = generateRandomGrid();
  assert.equal(validateGridArrangement(randomGrid).valid, true);
  assert.equal(new Set(randomGrid).size, 25);
});

test('Line Detection - All 10 rows and columns', () => {
  // Standard grid 1..25 sequential
  const grid = Array.from({ length: 25 }, (_, i) => i + 1);

  // Test every row r0..r4
  for (let r = 0; r < 5; r++) {
    const rowNumbers = grid.slice(r * 5, (r + 1) * 5);
    const completed = findCompletedLines(grid, rowNumbers);
    assert.deepEqual(completed, [`r${r}`]);
  }

  // Test every column c0..c4
  for (let c = 0; c < 5; c++) {
    const colNumbers = [grid[c], grid[c + 5], grid[c + 10], grid[c + 15], grid[c + 20]];
    const completed = findCompletedLines(grid, colNumbers);
    assert.deepEqual(completed, [`c${c}`]);
  }

  // Test diagonals with flag
  const d0Numbers = [grid[0], grid[6], grid[12], grid[18], grid[24]];
  assert.deepEqual(findCompletedLines(grid, d0Numbers, { includeDiagonals: false }), []);
  assert.deepEqual(findCompletedLines(grid, d0Numbers, { includeDiagonals: true }), ['d0']);

  const d1Numbers = [grid[4], grid[8], grid[12], grid[16], grid[20]];
  assert.deepEqual(findCompletedLines(grid, d1Numbers, { includeDiagonals: true }), ['d1']);
});

test('Multi-line completion and deterministic ordering', () => {
  const grid = Array.from({ length: 25 }, (_, i) => i + 1);
  // Mark row 2 (indices 10..14) and column 2 (indices 2, 7, 12, 17, 22)
  // Intersection is cell 12 (number 13)
  const marks = new Set([
    grid[10], grid[11], grid[13], grid[14], // r2 except intersection
    grid[2], grid[7], grid[17], grid[22]    // c2 except intersection
  ]);

  // Before intersection: 0 lines
  const before = findCompletedLines(grid, marks);
  assert.deepEqual(before, []);

  // Mark intersection cell 12 (number 13)
  marks.add(grid[12]);
  const after = findCompletedLines(grid, marks);

  // Deterministic order: rows first, then columns
  assert.deepEqual(after, ['r2', 'c2']);

  // Diffs: both appear as newLines
  const diff = diffNewLines([], after);
  assert.equal(diff.newLines.length, 2);
  assert.equal(diff.newLines[0].id, 'r2');
  assert.equal(diff.newLines[0].order, 1);
  assert.equal(diff.newLines[0].letter, 'B');
  assert.equal(diff.newLines[1].id, 'c2');
  assert.equal(diff.newLines[1].order, 2);
  assert.equal(diff.newLines[1].letter, 'I');
});

test('Letter mapping up to 5 and 6th+ line behavior', () => {
  let prev = [];
  const linesToComplete = ['r0', 'r1', 'r2', 'c0', 'c1', 'r3'];

  // Add line 1 (r0) -> B
  let diff = diffNewLines(prev, ['r0']);
  assert.equal(diff.newLines[0].letter, 'B');
  assert.equal(diff.newLines[0].order, 1);
  prev = diff.allLines;

  // Add line 2 (r1) -> I
  diff = diffNewLines(prev, ['r0', 'r1']);
  assert.equal(diff.newLines[0].letter, 'I');
  assert.equal(diff.newLines[0].order, 2);
  prev = diff.allLines;

  // Add line 3 (r2) -> N
  diff = diffNewLines(prev, ['r0', 'r1', 'r2']);
  assert.equal(diff.newLines[0].letter, 'N');
  assert.equal(diff.newLines[0].order, 3);
  prev = diff.allLines;

  // Add line 4 (c0) -> G
  diff = diffNewLines(prev, ['r0', 'r1', 'r2', 'c0']);
  assert.equal(diff.newLines[0].letter, 'G');
  assert.equal(diff.newLines[0].order, 4);
  prev = diff.allLines;

  // Add line 5 (c1) -> O
  diff = diffNewLines(prev, ['r0', 'r1', 'r2', 'c0', 'c1']);
  assert.equal(diff.newLines[0].letter, 'O');
  assert.equal(diff.newLines[0].order, 5);
  prev = diff.allLines;

  // Add line 6 (r3) -> 6th line is drawn (has id, order 6) but letter is null
  diff = diffNewLines(prev, ['r0', 'r1', 'r2', 'c0', 'c1', 'r3']);
  assert.equal(diff.newLines.length, 1);
  assert.equal(diff.newLines[0].id, 'r3');
  assert.equal(diff.newLines[0].order, 6);
  assert.equal(diff.newLines[0].letter, null);
  assert.equal(diff.allLines.length, 6);
});

test('Deduplication and Idempotency', () => {
  const existing = ['r0', 'r1'];
  // Re-evaluating with same lines produces zero new lines
  const diff = diffNewLines(existing, ['r0', 'r1']);
  assert.equal(diff.newLines.length, 0);
  assert.deepEqual(diff.allLines, ['r0', 'r1']);

  // Even if duplicates are in currentLineIds, allLines stays unique
  const diffDup = diffNewLines(existing, ['r0', 'r1', 'r1', 'r0']);
  assert.equal(diffDup.newLines.length, 0);
  assert.deepEqual(diffDup.allLines, ['r0', 'r1']);
});

test('Geometry Spec Verification', () => {
  const s = 100;
  // Test each row r0..r4
  for (let r = 0; r < 5; r++) {
    const geom = lineGeometry(`r${r}`, s);
    const yc = (r + 0.5) * s;
    // Lower-left to upper-right: x1 < 0, y1 > yc, x2 > 500, y2 < yc
    assert.equal(geom.x1, -15);
    assert.equal(geom.y1, yc + 25);
    assert.equal(geom.x2, 515);
    assert.equal(geom.y2, yc - 25);

    // Continuous segment across all 5 cells (x = 50, 150, 250, 350, 450)
    for (let c = 0; c < 5; c++) {
      const xc = (c + 0.5) * s;
      // Line equation: y = y1 + ((xc - x1) / (x2 - x1)) * (y2 - y1)
      const t = (xc - geom.x1) / (geom.x2 - geom.x1);
      const yAtDigitCenter = geom.y1 + t * (geom.y2 - geom.y1);

      // Distance from digit center (xc, yc):
      const dist = Math.abs(yAtDigitCenter - yc);
      // Centerline stays within 0.2 cell-heights (0.2 * 100 = 20)
      assert.ok(dist <= 20, `Row ${r} col ${c} centerline distance ${dist} exceeds 20`);

      // Verify it never touches digits of neighboring lines (neighboring row center is at yc +/- 100)
      const distToNeighborAbove = Math.abs(yAtDigitCenter - (yc - 100));
      const distToNeighborBelow = Math.abs(yAtDigitCenter - (yc + 100));
      assert.ok(distToNeighborAbove > 70, 'Centerline too close to neighbor above');
      assert.ok(distToNeighborBelow > 70, 'Centerline too close to neighbor below');
    }
  }

  // Test each column c0..c4
  for (let c = 0; c < 5; c++) {
    const geom = lineGeometry(`c${c}`, s);
    const xc = (c + 0.5) * s;
    // Upper-left to lower-right: x1 < xc, y1 < 0, x2 > xc, y2 > 500
    assert.equal(geom.x1, xc - 25);
    assert.equal(geom.y1, -15);
    assert.equal(geom.x2, xc + 25);
    assert.equal(geom.y2, 515);

    // Continuous segment across all 5 cells (y = 50, 150, 250, 350, 450)
    for (let r = 0; r < 5; r++) {
      const yc = (r + 0.5) * s;
      const t = (yc - geom.y1) / (geom.y2 - geom.y1);
      const xAtDigitCenter = geom.x1 + t * (geom.x2 - geom.x1);

      // Distance from digit center (xc, yc):
      const dist = Math.abs(xAtDigitCenter - xc);
      // Centerline stays within 0.2 cell-widths (20)
      assert.ok(dist <= 20, `Col ${c} row ${r} centerline distance ${dist} exceeds 20`);

      // Verify it never touches digits of neighboring lines
      const distToNeighborLeft = Math.abs(xAtDigitCenter - (xc - 100));
      const distToNeighborRight = Math.abs(xAtDigitCenter - (xc + 100));
      assert.ok(distToNeighborLeft > 70, 'Centerline too close to neighbor left');
      assert.ok(distToNeighborRight > 70, 'Centerline too close to neighbor right');
    }
  }
});
