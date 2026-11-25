/**
 * shared/protocol.js
 * 
 * Authoritative protocol definitions, command validators, and room code rules.
 * Used by server, client, bots, and tests.
 */

// 5-character vowel-free, look-alike-free alphabet (avoids 0, 1, O, I, A, E, U)
export const ROOM_CODE_ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 5;

/**
 * Normalizes and validates a room code.
 * @param {string} code 
 * @returns {{ valid: boolean, normalized: string, error?: string }}
 */
export function normalizeRoomCode(code) {
  if (typeof code !== 'string') {
    return { valid: false, normalized: '', error: 'Room code must be a string' };
  }
  const clean = code.trim().toUpperCase();
  if (clean.length !== ROOM_CODE_LENGTH) {
    return { valid: false, normalized: clean, error: `Room code must be exactly ${ROOM_CODE_LENGTH} characters` };
  }
  for (let i = 0; i < clean.length; i++) {
    if (!ROOM_CODE_ALPHABET.includes(clean[i])) {
      return { valid: false, normalized: clean, error: `Invalid character '${clean[i]}' in room code` };
    }
  }
  return { valid: true, normalized: clean };
}

/**
 * Generates a random 5-character room code using the vowel-free alphabet.
 * @param {() => number} [rng=Math.random]
 * @returns {string}
 */
export function generateRoomCode(rng = Math.random) {
  let result = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    const idx = Math.floor(rng() * ROOM_CODE_ALPHABET.length);
    result += ROOM_CODE_ALPHABET[idx];
  }
  return result;
}

// Client to Server Message Actions
export const CLIENT_ACTIONS = Object.freeze({
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  LOCK_BOARD: 'lock_board',
  CALL_NUMBER: 'call_number',
  CLAIM_BINGO: 'claim_bingo',
  REQUEST_REMATCH: 'request_rematch',
  SET_READY: 'set_ready',
  PING: 'ping'
});

// Server to Client Events
export const SERVER_EVENTS = Object.freeze({
  ROOM_CREATED: 'room_created',
  ROOM_STATE: 'room_state',
  BOARD_LOCKED: 'board_locked',
  MATCH_STARTED: 'match_started',
  TURN_STARTED: 'turn_started',
  NUMBER_CALLED: 'number_called',
  LINE_COMPLETED: 'line_completed',
  BINGO_CLAIMED: 'bingo_claimed',
  MATCH_FINISHED: 'match_finished',
  PLAYER_DISCONNECTED: 'player_disconnected',
  PLAYER_RECONNECTED: 'player_reconnected',
  SEAT_HOLD_EXPIRED: 'seat_hold_expired',
  REMATCH_ACCEPTED: 'rematch_accepted',
  ERROR: 'error',
  PONG: 'pong'
});

/**
 * Validates a called number intent: must be an integer between 1 and 25
 * and not already present in the list of called numbers.
 * 
 * @param {number} num 
 * @param {number[] | Set<number>} calledHistory 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateNumberCall(num, calledHistory = []) {
  if (!Number.isInteger(num) || num < 1 || num > 25) {
    return { valid: false, error: 'Called number must be an integer between 1 and 25' };
  }
  const historySet = calledHistory instanceof Set ? calledHistory : new Set(calledHistory);
  if (historySet.has(num)) {
    return { valid: false, error: `Number ${num} has already been called` };
  }
  return { valid: true };
}

/**
 * Creates a sanitized public snapshot of a player for their opponent.
 * Crucial Rule: The player's 5x5 grid is NEVER sent to the opponent!
 * 
 * @param {object} player 
 * @returns {object} Safe public state containing only calls, line count, and crossed letters
 */
export function createPublicPlayerSnapshot(player) {
  if (!player) return null;
  return {
    id: player.id,
    name: player.name || 'Opponent',
    avatar: player.avatar || '👤',
    isReady: Boolean(player.isReady),
    isLocked: Boolean(player.isLocked),
    connected: Boolean(player.connected),
    linesCount: Number(player.linesCount || 0),
    completedLines: Array.isArray(player.completedLines) ? player.completedLines : [],
    lettersStruck: Array.isArray(player.lettersStruck) ? player.lettersStruck : [],
    score: Number(player.score || 0)
    // NOTICE: grid is intentionally omitted!
  };
}
