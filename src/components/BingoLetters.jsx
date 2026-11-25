/**
 * src/components/BingoLetters.jsx
 * 
 * Top B — I — N — G — O word display.
 * Styled with distinct column colors matching the reference board:
 * - B: Coral Red (#E6535D)
 * - I: Amber Orange (#F59E0B)
 * - N: Teal Green (#10B981)
 * - G: Electric Blue (#3B82F6)
 * - O: Magenta Purple (#A855F7)
 * Crosses off letters sequentially as lines are completed (1st line = B, 2nd = I, etc.).
 */

import React from 'react';
import { BINGO_LETTERS } from '../../shared/lineModel.js';

const LETTER_COLORS = {
  B: '#E6535D',
  I: '#F59E0B',
  N: '#10B981',
  G: '#3B82F6',
  O: '#A855F7'
};

export function BingoLetters({ completedLinesCount = 0 }) {
  return (
    <div className="bingo-letters-row sports-bingo-letters" role="region" aria-label="BINGO letter progression">
      {BINGO_LETTERS.map((letter, index) => {
        const isStruck = index < completedLinesCount;
        const letterColor = LETTER_COLORS[letter] || '#438BFF';
        return (
          <div
            key={letter}
            className={`bingo-letter-tile ${isStruck ? 'struck' : ''}`}
            data-letter={letter}
            data-index={index}
            style={{
              borderColor: isStruck ? '#FBBF24' : letterColor,
              background: isStruck ? `linear-gradient(155deg, ${letterColor}40 0%, #141C3A 100%)` : 'var(--sports-midnight, #141C3A)',
              boxShadow: isStruck ? '0 0 16px rgba(251, 191, 36, 0.55)' : `0 0 10px ${letterColor}38`,
              color: isStruck ? '#FBBF24' : '#FFFFFF',
              transform: isStruck ? 'scale(1.06)' : 'scale(1)',
              transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-color 0.25s ease'
            }}
            aria-label={`Letter ${letter}${isStruck ? ' Crossed' : ''}`}
          >
            <span
              className="letter-glyph"
              style={{
                color: isStruck ? '#F3B94F' : '#FFFFFF',
                fontWeight: 900
              }}
            >
              {letter}
            </span>
            {isStruck && <span className="letter-strike-slash" aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );
}
