/**
 * shared/validation.ts
 * 
 * Game validation, 1-25 board checking, room code validation.
 */

import {
  validateGridArrangement,
  findCompletedLines,
  generateRandomGrid,
  BINGO_LETTERS,
  GRID_SIZE,
  TOTAL_CELLS
} from './lineModel.js';

export {
  validateGridArrangement,
  findCompletedLines,
  generateRandomGrid,
  BINGO_LETTERS,
  GRID_SIZE,
  TOTAL_CELLS
};

export const validateBoardArrangement = validateGridArrangement;
export const checkLineCompletion = findCompletedLines;
export const generateRandomBoard = generateRandomGrid;

/**
 * Validates whether an array of 25 numbers is a valid permutation of numbers 1 to 25.
 */
export function isValidBingoPermutation(board: (number | null)[]): boolean {
  if (!Array.isArray(board) || board.length !== 25) return false;
  const seen = new Set<number>();
  for (const num of board) {
    if (typeof num !== 'number' || num < 1 || num > 25) return false;
    if (seen.has(num)) return false;
    seen.add(num);
  }
  return seen.size === 25;
}

