/**
 * src/components/BingoCell.jsx
 * 
 * Individual cell on the 5x5 Bingo board.
 * Supports numbers 1-25, marked state, arranging state, and keyboard accessibility.
 */

import React from 'react';

export function BingoCell({
  index,
  number,
  isMarked,
  isArranging,
  isRecentCall,
  onClick
}) {
  const row = Math.floor(index / 5);
  const col = index % 5;

  let cellClasses = 'bingo-cell btn-tactile';
  if (isMarked) cellClasses += ' marked';
  if (isRecentCall) cellClasses += ' recent-call';
  if (isArranging) cellClasses += ' arranging';

  return (
    <button
      type="button"
      className={cellClasses}
      onClick={() => onClick && onClick(number, index)}
      aria-label={`Row ${row + 1}, Column ${col + 1}, Number ${number || 'Empty'}${isMarked ? ', Marked' : ''}`}
      aria-pressed={isMarked}
      data-index={index}
      data-row={row}
      data-col={col}
      data-number={number}
    >
      <span className="cell-number">
        {number ? (
          <>
            {index === 12 && !isMarked && (
              <span style={{ color: '#FBBF24', fontSize: '0.78em', marginRight: '2px' }}>★</span>
            )}
            {number}
          </>
        ) : (
          <span style={{ opacity: 0.28, fontSize: '0.7em' }}>+</span>
        )}
      </span>
      {isMarked && (
        <span className="cell-stamp" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="stamp-icon">
            <path
              d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"
              fill="currentColor"
            />
          </svg>
        </span>
      )}
    </button>
  );
}
