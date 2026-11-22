/**
 * server/botPlayer.js
 * 
 * Intelligent Bingo Bot for single-player practice, private room opponent fillers,
 * and tournament bracket completion.
 */

import { generateRandomGrid, findCompletedLines } from '../shared/lineModel.js';

export class BingoBot {
  /**
   * @param {string} botId
   * @param {string} name
   */
  constructor(botId, name = 'Bingo Bot') {
    this.botId = botId;
    this.name = name;
    this.grid = generateRandomGrid();
    this.isBot = true;
  }

  /**
   * Picks the smartest uncalled number to call.
   * Prioritizes numbers that help complete lines with 4/5 or 3/5 numbers already marked.
   * 
   * @param {number[]} calledNumbers
   * @param {object} [options]
   * @returns {number}
   */
  chooseNumber(calledNumbers = [], options = {}) {
    const calledSet = new Set(calledNumbers);
    const uncalledNumbersOnGrid = this.grid.filter(num => !calledSet.has(num));

    if (uncalledNumbersOnGrid.length === 0) {
      // Fallback: any uncalled number 1..25
      for (let n = 1; n <= 25; n++) {
        if (!calledSet.has(n)) return n;
      }
      return 1;
    }

    // Heuristic: inspect each row and column, score candidate uncalled numbers
    const numberScores = new Map();
    uncalledNumbersOnGrid.forEach(n => numberScores.set(n, 1));

    // Rows
    for (let r = 0; r < 5; r++) {
      const rowNums = this.grid.slice(r * 5, (r + 1) * 5);
      const markedCount = rowNums.filter(n => calledSet.has(n)).length;
      rowNums.forEach(n => {
        if (!calledSet.has(n)) {
          numberScores.set(n, (numberScores.get(n) || 0) + Math.pow(2, markedCount));
        }
      });
    }

    // Columns
    for (let c = 0; c < 5; c++) {
      const colNums = [this.grid[c], this.grid[c + 5], this.grid[c + 10], this.grid[c + 15], this.grid[c + 20]];
      const markedCount = colNums.filter(n => calledSet.has(n)).length;
      colNums.forEach(n => {
        if (!calledSet.has(n)) {
          numberScores.set(n, (numberScores.get(n) || 0) + Math.pow(2, markedCount));
        }
      });
    }

    // Pick candidate with highest score
    let bestNum = uncalledNumbersOnGrid[0];
    let maxScore = -1;
    for (const [num, score] of numberScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        bestNum = num;
      }
    }

    return bestNum;
  }
}
