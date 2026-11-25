/**
 * test/sharedProtocol.test.js
 * 
 * Tests for M1 Shared rules and protocol definitions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  normalizeRoomCode,
  generateRoomCode,
  validateNumberCall,
  createPublicPlayerSnapshot,
  validateGridArrangement,
  generateRandomGrid,
  findCompletedLines,
  diffNewLines,
  lineGeometry
} from '../shared/index.js';

describe('M1: Shared Rules & Protocol Validation', () => {
  it('generates a 5-character vowel-free and look-alike-free room code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      assert.strictEqual(code.length, ROOM_CODE_LENGTH);
      for (const char of code) {
        assert.ok(ROOM_CODE_ALPHABET.includes(char), `Character ${char} should be in alphabet`);
        assert.ok(!'AEIOU01'.includes(char), `Character ${char} must not be a vowel or ambiguous number`);
      }
    }
  });

  it('normalizes room codes with trimming and case-insensitivity', () => {
    const res = normalizeRoomCode('  2345k  ');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.normalized, '2345K');

    const badLength = normalizeRoomCode('ABC');
    assert.strictEqual(badLength.valid, false);

    const badChar = normalizeRoomCode('2345A'); // 'A' is a vowel
    assert.strictEqual(badChar.valid, false);
  });

  it('validates number calls strictly between 1 and 25 without duplicates', () => {
    assert.strictEqual(validateNumberCall(12, []).valid, true);
    assert.strictEqual(validateNumberCall(26, []).valid, false);
    assert.strictEqual(validateNumberCall(0, []).valid, false);
    assert.strictEqual(validateNumberCall(-5, []).valid, false);
    assert.strictEqual(validateNumberCall('12', []).valid, false);

    // Rejects duplicate calls
    assert.strictEqual(validateNumberCall(7, [7, 14, 21]).valid, false);
    assert.strictEqual(validateNumberCall(8, [7, 14, 21]).valid, true);
  });

  it('creates sanitized public snapshots with strict privacy (never leaks grid)', () => {
    const secretPlayer = {
      id: 'player-123',
      name: 'Rohan Sharma',
      avatar: '👑',
      grid: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25],
      linesCount: 3,
      completedLines: ['r0', 'c1', 'r2'],
      lettersStruck: ['B', 'I', 'N'],
      secretSessionToken: 'top-secret-token'
    };

    const publicSnapshot = createPublicPlayerSnapshot(secretPlayer);

    assert.strictEqual(publicSnapshot.id, 'player-123');
    assert.strictEqual(publicSnapshot.name, 'Rohan Sharma');
    assert.strictEqual(publicSnapshot.linesCount, 3);
    assert.deepStrictEqual(publicSnapshot.lettersStruck, ['B', 'I', 'N']);

    // Strict privacy checks
    assert.strictEqual(publicSnapshot.grid, undefined, 'Grid MUST NOT be exposed to opponent');
    assert.strictEqual(publicSnapshot.secretSessionToken, undefined, 'Session token MUST NOT be exposed');
  });

  it('computes continuous slanted red-pen stroke geometry correctly', () => {
    const row0 = lineGeometry('r0', 100);
    assert.strictEqual(row0.id, 'r0');
    // Start x should have overshoot (-15)
    assert.strictEqual(row0.x1, -15);
    // End x should overshoot 500 (515)
    assert.strictEqual(row0.x2, 515);
    // y1 should be center (50) + slant (25) = 75
    assert.strictEqual(row0.y1, 75);
    // y2 should be center (50) - slant (25) = 25
    assert.strictEqual(row0.y2, 25);
  });
});
