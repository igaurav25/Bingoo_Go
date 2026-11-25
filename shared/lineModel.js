/**
 * shared/lineModel.js
 * 
 * Pure, authoritative line module used across server, client, tests, and bots.
 * Governs 5x5 Bingo grid line detection, deterministic line ordering,
 * letter mapping (B-I-N-G-O), and mathematical stroke geometry.
 */

// Feature flags configuration for additive backward-compatibility
export const FEATURE_FLAGS = Object.freeze({
  ANIMATED_LINE_CUTS: true,
  AUTHORITATIVE_CLAIM_FLOW: true,
  ENABLE_DIAGONALS: false
});

// Grid dimension
export const GRID_SIZE = 5;
export const TOTAL_CELLS = 25;

// Line identifiers: 5 rows (r0..r4) and 5 columns (c0..c4).
// Optional diagonals (d0, d1) are supported if enabled via options.
export const ROW_IDS = ['r0', 'r1', 'r2', 'r3', 'r4'];
export const COL_IDS = ['c0', 'c1', 'c2', 'c3', 'c4'];
export const DIAG_IDS = ['d0', 'd1'];

export const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];

/**
 * Returns line definitions mapping lineId to array of 0-based cell indices (0..24).
 * @param {boolean} includeDiagonals - whether to include d0 and d1
 * @returns {Record<string, number[]>}
 */
export function getLineDefinitions(includeDiagonals = false) {
  const lines = {};

  // Rows r0..r4
  for (let r = 0; r < GRID_SIZE; r++) {
    const cells = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      cells.push(r * GRID_SIZE + c);
    }
    lines[`r${r}`] = cells;
  }

  // Columns c0..c4
  for (let c = 0; c < GRID_SIZE; c++) {
    const cells = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      cells.push(r * GRID_SIZE + c);
    }
    lines[`c${c}`] = cells;
  }

  // Diagonals d0 (top-left to bottom-right), d1 (top-right to bottom-left)
  if (includeDiagonals) {
    const d0 = [];
    const d1 = [];
    for (let i = 0; i < GRID_SIZE; i++) {
      d0.push(i * GRID_SIZE + i);
      d1.push(i * GRID_SIZE + (GRID_SIZE - 1 - i));
    }
    lines['d0'] = d0;
    lines['d1'] = d1;
  }

  return lines;
}

/**
 * Validates a grid arrangement: must be an array of length 25
 * containing integers 1..25 with no duplicates.
 * @param {number[]} grid
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateGridArrangement(grid) {
  if (!Array.isArray(grid)) {
    return { valid: false, error: 'Grid must be an array' };
  }
  if (grid.length !== TOTAL_CELLS) {
    return { valid: false, error: `Grid must contain exactly ${TOTAL_CELLS} cells` };
  }
  const seen = new Set();
  for (let i = 0; i < grid.length; i++) {
    const val = grid[i];
    if (!Number.isInteger(val) || val < 1 || val > TOTAL_CELLS) {
      return { valid: false, error: `Invalid cell value at index ${i}: ${val}` };
    }
    if (seen.has(val)) {
      return { valid: false, error: `Duplicate number found: ${val}` };
    }
    seen.add(val);
  }
  return { valid: true };
}

// Aliases for backward-compatibility with alternate naming
export const validateBoardArrangement = validateGridArrangement;
export const checkLineCompletion = (grid, marked, options) => {
  return findCompletedLines(grid, marked, options);
};

/**
 * Generates a random valid 5x5 permutation of numbers 1-25 using Fisher-Yates shuffle.
 * @param {() => number} [rng=Math.random]
 * @returns {number[]}
 */
export function generateRandomGrid(rng = Math.random) {
  const arr = Array.from({ length: TOTAL_CELLS }, (_, i) => i + 1);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Finds all completed lines on a grid given a set or array of marked numbers.
 * Deterministic order: rows in ascending index (r0..r4), then columns (c0..c4), then diagonals.
 * 
 * @param {number[]} grid - 25 numbers
 * @param {Set<number> | number[]} marked - marked numbers
 * @param {object} [options]
 * @param {boolean} [options.includeDiagonals=false]
 * @returns {string[]} array of completed line IDs in deterministic order
 */
export function findCompletedLines(grid, marked, options = {}) {
  const markedSet = marked instanceof Set ? marked : new Set(marked);
  const includeDiagonals = !!options.includeDiagonals;
  const lineDefs = getLineDefinitions(includeDiagonals);
  const completed = [];

  // Check rows r0..r4
  for (let r = 0; r < GRID_SIZE; r++) {
    const id = `r${r}`;
    const cells = lineDefs[id];
    if (cells.every(idx => markedSet.has(grid[idx]))) {
      completed.push(id);
    }
  }

  // Check columns c0..c4
  for (let c = 0; c < GRID_SIZE; c++) {
    const id = `c${c}`;
    const cells = lineDefs[id];
    if (cells.every(idx => markedSet.has(grid[idx]))) {
      completed.push(id);
    }
  }

  // Check diagonals d0..d1 if enabled
  if (includeDiagonals) {
    for (const dId of DIAG_IDS) {
      const cells = lineDefs[dId];
      if (cells.every(idx => markedSet.has(grid[idx]))) {
        completed.push(dId);
      }
    }
  }

  return completed;
}

/**
 * Diffs previously stored lines against current completed lines.
 * Returns only newly completed line descriptors, maintaining deterministic ordering.
 * 
 * Each new line contains:
 * - id: e.g. 'r0', 'c2'
 * - type: 'row' | 'column' | 'diagonal'
 * - index: 0..4 (or 0..1 for diagonals)
 * - order: 1-based order in the player's append-only list
 * - letter: 'B', 'I', 'N', 'G', 'O' for order 1..5, or null for 6th+
 * 
 * @param {string[]} prevLineIds - ordered existing line IDs
 * @param {string[]} currentLineIds - currently detected line IDs
 * @returns {{
 *   newLines: Array<{ id: string, type: string, index: number, order: number, letter: string | null }>,
 *   allLines: string[]
 * }}
 */
export function diffNewLines(prevLineIds = [], currentLineIds = []) {
  const prevSet = new Set(prevLineIds);
  const allLines = [...prevLineIds];
  const newLines = [];

  for (const lineId of currentLineIds) {
    if (!prevSet.has(lineId)) {
      prevSet.add(lineId);
      allLines.push(lineId);

      const type = lineId.startsWith('r') ? 'row' : (lineId.startsWith('c') ? 'column' : 'diagonal');
      const index = parseInt(lineId.slice(1), 10);
      const order = allLines.length; // 1-based
      const letter = order <= 5 ? BINGO_LETTERS[order - 1] : null;

      newLines.push({
        id: lineId,
        type,
        index,
        order,
        letter
      });
    }
  }

  return { newLines, allLines };
}

/**
 * Returns stroke geometry for an SVG overlay with 1 cell = cellSize units (default 100).
 * 
 * Spec:
 * s = one cell (default 100)
 * yc = (r + 0.5) * s
 * xc = (c + 0.5) * s
 * SLANT = 0.25, OVERSHOOT = 0.15
 * Row r:    (-OVERSHOOT*s, yc + SLANT*s) -> (5s + OVERSHOOT*s, yc - SLANT*s) [lower-left to upper-right]
 * Column c: (xc - SLANT*s, -OVERSHOOT*s) -> (xc + SLANT*s, 5s + OVERSHOOT*s) [upper-left to lower-right]
 * Diagonal d0: (-OVERSHOOT*s, -OVERSHOOT*s) -> (5s + OVERSHOOT*s, 5s + OVERSHOOT*s)
 * Diagonal d1: (5s + OVERSHOOT*s, -OVERSHOOT*s) -> (-OVERSHOOT*s, 5s + OVERSHOOT*s)
 * 
 * @param {string} lineId - 'r0'..'r4', 'c0'..'c4', 'd0'..'d1'
 * @param {number} [s=100] - cell size in viewBox units
 * @returns {{ x1: number, y1: number, x2: number, y2: number, id: string }}
 */
export function lineGeometry(lineId, s = 100) {
  const SLANT = 0.25;
  const OVERSHOOT = 0.15;
  const span = GRID_SIZE * s; // 500

  if (lineId.startsWith('r')) {
    const r = parseInt(lineId.slice(1), 10);
    const yc = (r + 0.5) * s;
    return {
      id: lineId,
      x1: -OVERSHOOT * s,
      y1: yc + SLANT * s,
      x2: span + OVERSHOOT * s,
      y2: yc - SLANT * s
    };
  }

  if (lineId.startsWith('c')) {
    const c = parseInt(lineId.slice(1), 10);
    const xc = (c + 0.5) * s;
    return {
      id: lineId,
      x1: xc - SLANT * s,
      y1: -OVERSHOOT * s,
      x2: xc + SLANT * s,
      y2: span + OVERSHOOT * s
    };
  }

  if (lineId === 'd0') {
    return {
      id: lineId,
      x1: -OVERSHOOT * s,
      y1: -OVERSHOOT * s,
      x2: span + OVERSHOOT * s,
      y2: span + OVERSHOOT * s
    };
  }

  if (lineId === 'd1') {
    return {
      id: lineId,
      x1: span + OVERSHOOT * s,
      y1: -OVERSHOOT * s,
      x2: -OVERSHOOT * s,
      y2: span + OVERSHOOT * s
    };
  }

  throw new Error(`Unknown line id: ${lineId}`);
}

/**
 * Returns exact straight line coordinates for React SVG Overlay.
 * Horizontal rows pass straight through row center: (20, yc) -> (span - 20, yc)
 * Vertical columns pass straight through col center: (xc, 20) -> (xc, span - 20)
 * 
 * @param {string} lineId - 'r0'..'r4', 'c0'..'c4'
 * @param {number} [s=100] - cell size (span = 5 * s = 500)
 * @returns {{ id: string, x1: number, y1: number, x2: number, y2: number }}
 */
export function straightLineGeometry(lineId, s = 100) {
  const span = GRID_SIZE * s; // 500
  if (lineId.startsWith('r')) {
    const r = parseInt(lineId.slice(1), 10);
    const yc = (r + 0.5) * s;
    return {
      id: lineId,
      x1: 20,
      y1: yc,
      x2: span - 20,
      y2: yc
    };
  }
  if (lineId.startsWith('c')) {
    const c = parseInt(lineId.slice(1), 10);
    const xc = (c + 0.5) * s;
    return {
      id: lineId,
      x1: xc,
      y1: 20,
      x2: xc,
      y2: span - 20
    };
  }
  throw new Error(`Unknown line id: ${lineId}`);
}

/**
 * Calculates stroke geometry for a slanted letter strike (bottom-left to top-right)
 * from real measured glyph bounds with an overshoot factor (default 10%).
 * 
 * @param {{ width: number, height: number }} bounds - layout rect or getBBox
 * @param {number} [overshoot=0.10]
 * @returns {{ x1: number, y1: number, x2: number, y2: number, length: number, angleDeg: number }}
 */
export function calculateLetterStrokeGeometry(bounds, overshoot = 0.10) {
  const w = bounds.width || 36;
  const h = bounds.height || 38;

  const dx = w * (1 + 2 * overshoot);
  const dy = h * (1 + 2 * overshoot);

  const length = Math.hypot(dx, dy);
  const angleDeg = -Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);

  return {
    x1: -overshoot * w,
    y1: h + overshoot * h,
    x2: w + overshoot * w,
    y2: -overshoot * h,
    length,
    angleDeg
  };
}
