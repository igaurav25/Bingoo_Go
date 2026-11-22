/**
 * server/gameState.js
 * 
 * Authoritative Bingo match state manager.
 * Enforces server-side line calculations, arrangement locking,
 * monotonic event sequence, serial action queuing, claim rate limiting,
 * and zero leakage of opponent grid arrangements.
 */

import {
  TOTAL_CELLS,
  validateGridArrangement,
  generateRandomGrid,
  findCompletedLines,
  diffNewLines
} from '../shared/lineModel.js';

export class Match {
  /**
   * @param {string} matchId
   * @param {string} player1Id
   * @param {string} player2Id
   * @param {object} [options]
   */
  constructor(matchId, player1Id, player2Id, options = {}) {
    this.matchId = matchId;
    this.options = {
      includeDiagonals: false,
      claimRateLimitMs: 500,
      ...options
    };

    this.status = 'ARRANGING'; // 'ARRANGING' | 'IN_PROGRESS' | 'FINISHED'
    this.eventSeq = 0;
    this.winnerId = null;
    this.finishReason = null;
    this.calledNumbers = [];
    this.calledNumbersSet = new Set();
    this.playerIds = [player1Id, player2Id];
    this.currentTurnPlayerId = player1Id;

    this.players = {
      [player1Id]: this._createPlayerRecord(player1Id, 'Player 1'),
      [player2Id]: this._createPlayerRecord(player2Id, 'Player 2')
    };

    // Serial event processing queue per match
    this._queue = Promise.resolve();
  }

  _createPlayerRecord(id, name) {
    return {
      id,
      name,
      grid: null,
      isLocked: false,
      markedNumbers: new Set(),
      completedLines: [], // append-only ordered list of line IDs (e.g. ['r0', 'c1'])
      claimsProcessed: new Map(), // claimId -> verdict
      lastClaimTimestamp: 0
    };
  }

  /**
   * Enqueue an operation to execute serially in this match.
   * @template T
   * @param {() => Promise<T> | T} task
   * @returns {Promise<T>}
   */
  enqueue(task) {
    const next = this._queue.then(async () => task());
    this._queue = next.catch(() => {});
    return next;
  }

  /**
   * Next monotonic event sequence number.
   * @returns {number}
   */
  nextEventSeq() {
    this.eventSeq += 1;
    return this.eventSeq;
  }

  /**
   * Validates and locks a player's arrangement.
   * @param {string} playerId
   * @param {number[]} grid - permutation of 1..25
   * @returns {{ success: boolean, error?: string, matchStarted?: boolean }}
   */
  setPlayerArrangement(playerId, grid) {
    const player = this.players[playerId];
    if (!player) {
      return { success: false, error: 'Player does not belong to this match' };
    }
    if (player.isLocked) {
      return { success: false, error: 'Arrangement is already locked and immutable' };
    }

    const valResult = validateGridArrangement(grid);
    if (!valResult.valid) {
      return { success: false, error: valResult.error };
    }

    // Lock immutable copy
    player.grid = Object.freeze([...grid]);
    player.isLocked = true;

    // Check if both players have locked arrangements
    const allLocked = this.playerIds.every(id => this.players[id].isLocked);
    let matchStarted = false;
    if (allLocked && this.status === 'ARRANGING') {
      this.status = 'IN_PROGRESS';
      matchStarted = true;
    }

    return { success: true, matchStarted };
  }

  /**
   * Generates and locks a random Fisher-Yates arrangement for a player.
   * @param {string} playerId
   * @returns {{ success: boolean, grid?: number[], error?: string, matchStarted?: boolean }}
   */
  autoRandomArrangement(playerId) {
    const grid = generateRandomGrid();
    const result = this.setPlayerArrangement(playerId, grid);
    if (result.success) {
      return { success: true, grid, matchStarted: result.matchStarted };
    }
    return result;
  }

  /**
   * Calls a number. Both players mark the called number.
   * Server computes line completions authoritative and diffs them.
   * 
   * @param {string} playerId
   * @param {number} number
   * @returns {{
   *   success: boolean,
   *   error?: string,
   *   number?: number,
   *   turnPlayerId?: string,
   *   nextTurnPlayerId?: string,
   *   events?: Array<{ recipientId: string, event: string, payload: any }>
   * }}
   */
  callNumber(playerId, number) {
    if (this.status !== 'IN_PROGRESS') {
      return { success: false, error: `Match is not in progress (current status: ${this.status})` };
    }
    if (this.currentTurnPlayerId !== playerId) {
      return { success: false, error: 'Not your turn' };
    }
    if (!Number.isInteger(number) || number < 1 || number > TOTAL_CELLS) {
      return { success: false, error: `Invalid number: ${number}` };
    }
    if (this.calledNumbersSet.has(number)) {
      return { success: false, error: `Number ${number} has already been called` };
    }

    // Legality check: number must belong to calling player's grid (1..25 always does in valid grid)
    const callingPlayer = this.players[playerId];
    if (!callingPlayer.grid.includes(number)) {
      return { success: false, error: `Number ${number} not found on player grid` };
    }

    this.calledNumbers.push(number);
    this.calledNumbersSet.add(number);

    const events = [];

    // Update marks and compute lines for both players
    for (const pId of this.playerIds) {
      const p = this.players[pId];
      p.markedNumbers.add(number);

      const completed = findCompletedLines(p.grid, p.markedNumbers, {
        includeDiagonals: this.options.includeDiagonals
      });

      const diff = diffNewLines(p.completedLines, completed);
      if (diff.newLines.length > 0) {
        p.completedLines = diff.allLines;
        const seq = this.nextEventSeq();

        // Event to owner with full line descriptors
        events.push({
          recipientId: pId,
          event: 'lines_completed',
          payload: {
            eventSeq: seq,
            newLines: diff.newLines,
            linesCompleted: p.completedLines.length
          }
        });

        // Event to opponent with count only (NEVER reveal opponent grid or line IDs)
        const opponentId = this.getOpponentId(pId);
        if (opponentId) {
          events.push({
            recipientId: opponentId,
            event: 'lines_completed',
            payload: {
              eventSeq: seq,
              playerId: pId,
              linesCompleted: p.completedLines.length
            }
          });
        }
      }
    }

    // Switch turn
    const previousTurnPlayerId = this.currentTurnPlayerId;
    this.currentTurnPlayerId = this.getOpponentId(playerId);

    return {
      success: true,
      number,
      turnPlayerId: previousTurnPlayerId,
      nextTurnPlayerId: this.currentTurnPlayerId,
      events
    };
  }

  /**
   * Processes a BINGO claim from a player.
   * Server validates >= 5 lines, in-progress match, and is idempotent.
   * 
   * @param {string} playerId
   * @param {string} claimId
   * @returns {{
   *   claimId: string,
   *   valid: boolean,
   *   winnerId: string | null,
   *   reason: string,
   *   isCached?: boolean
   * }}
   */
  claimBingo(playerId, claimId) {
    const player = this.players[playerId];
    if (!player) {
      return {
        claimId,
        valid: false,
        winnerId: null,
        reason: 'Player not in match'
      };
    }

    // Idempotency: return cached verdict if claimId was already evaluated
    if (player.claimsProcessed.has(claimId)) {
      return {
        ...player.claimsProcessed.get(claimId),
        isCached: true
      };
    }

    const now = Date.now();
    // Rate limit check
    if (now - player.lastClaimTimestamp < this.options.claimRateLimitMs) {
      console.warn(`[Match ${this.matchId}] Rejected claim from ${playerId}: Rate limited.`);
      const rateLimitVerdict = {
        claimId,
        valid: false,
        winnerId: this.winnerId,
        reason: 'Claim rate limit exceeded. Please wait a moment before claiming again.'
      };
      player.claimsProcessed.set(claimId, rateLimitVerdict);
      return rateLimitVerdict;
    }
    player.lastClaimTimestamp = now;

    // Reject if match is finished
    if (this.status === 'FINISHED') {
      const finishedVerdict = {
        claimId,
        valid: false,
        winnerId: this.winnerId,
        reason: this.winnerId === playerId ? 'Match already won' : 'Match already finished'
      };
      player.claimsProcessed.set(claimId, finishedVerdict);
      return finishedVerdict;
    }

    // Reject if match is not in progress
    if (this.status !== 'IN_PROGRESS') {
      const notStartedVerdict = {
        claimId,
        valid: false,
        winnerId: null,
        reason: 'Match is not in progress'
      };
      player.claimsProcessed.set(claimId, notStartedVerdict);
      return notStartedVerdict;
    }

    // Re-derive completed lines authoritatively from server marks
    const serverDerivedLines = findCompletedLines(player.grid, player.markedNumbers, {
      includeDiagonals: this.options.includeDiagonals
    });

    if (serverDerivedLines.length < 5) {
      console.warn(`[Match ${this.matchId}] Rejected claim from ${playerId}: only ${serverDerivedLines.length} lines completed.`);
      const invalidVerdict = {
        claimId,
        valid: false,
        winnerId: null,
        reason: 'BINGO not verified. You need 5 completed lines.'
      };
      player.claimsProcessed.set(claimId, invalidVerdict);
      return invalidVerdict;
    }

    // Claim is valid! First valid claim processed wins.
    this.status = 'FINISHED';
    this.winnerId = playerId;
    this.finishReason = `Player ${playerId} completed ${serverDerivedLines.length} lines and claimed BINGO`;

    const successVerdict = {
      claimId,
      valid: true,
      winnerId: playerId,
      reason: 'Victory confirmed! 5 lines completed.'
    };
    player.claimsProcessed.set(claimId, successVerdict);
    return successVerdict;
  }

  /**
   * Returns opponent's player ID.
   * @param {string} playerId
   * @returns {string}
   */
  getOpponentId(playerId) {
    return this.playerIds.find(id => id !== playerId);
  }

  /**
   * Generates a snapshot for a player (hydration / join / reconnect).
   * STRICT PRIVACY: Opponent's grid and completedLine IDs are never exposed.
   * 
   * @param {string} playerId
   * @returns {object}
   */
  getSnapshot(playerId) {
    const player = this.players[playerId];
    const opponentId = this.getOpponentId(playerId);
    const opponent = this.players[opponentId];

    return {
      matchId: this.matchId,
      status: this.status,
      eventSeq: this.eventSeq,
      currentTurnPlayerId: this.currentTurnPlayerId,
      calledNumbers: [...this.calledNumbers],
      winnerId: this.winnerId,
      finishReason: this.finishReason,
      myState: player ? {
        playerId: player.id,
        name: player.name,
        grid: player.grid ? [...player.grid] : null,
        isLocked: player.isLocked,
        markedNumbers: Array.from(player.markedNumbers),
        completedLines: [...player.completedLines],
        linesCompleted: player.completedLines.length
      } : null,
      opponentState: opponent ? {
        playerId: opponent.id,
        name: opponent.name,
        isLocked: opponent.isLocked,
        linesCompleted: opponent.completedLines.length
        // NEVER include opponent.grid or opponent.completedLines!
      } : null
    };
  }
}
