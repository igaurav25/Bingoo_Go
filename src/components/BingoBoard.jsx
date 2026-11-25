/**
 * src/components/BingoBoard.jsx
 * 
 * 5x5 Bingo Board Container with CSS Grid and SVG Strike-Through Overlay.
 * Strictly maintains a 1:1 aspect ratio.
 * Features 3D corner lottery balls matching visual reference board.
 */

import React from 'react';
import { BingoCell } from './BingoCell.jsx';
import { StrikeThroughOverlay } from './StrikeThroughOverlay.jsx';
import { BingoLotteryBall } from './SportsGraphics.jsx';

export function BingoBoard({
  board = [],
  markedNumbers = new Set(),
  completedLines = [],
  newlyStruckLineId = null,
  recentCalls = [],
  isArranging = false,
  onCellClick
}) {
  const lastCalledNumber = recentCalls.length > 0 ? recentCalls[0] : null;

  return (
    <div className="bingo-board-wrapper" style={{ position: 'relative' }}>
      <div className="bingo-board-grid">
        {board.map((num, idx) => (
          <BingoCell
            key={idx}
            index={idx}
            number={num}
            isMarked={num !== null && markedNumbers.has(num)}
            isArranging={isArranging}
            isRecentCall={num !== null && num === lastCalledNumber}
            onClick={onCellClick}
          />
        ))}

        {/* SVG Strike-through Overlay */}
        <StrikeThroughOverlay
          completedLines={completedLines}
          newlyStruckLineId={newlyStruckLineId}
        />
      </div>

      {/* Corner 3D Lottery Balls from Visual Reference */}
      <div
        className="board-lottery-balls-bottom-left"
        style={{
          position: 'absolute',
          bottom: '-12px',
          left: '-10px',
          display: 'flex',
          gap: '2px',
          zIndex: 12,
          pointerEvents: 'none'
        }}
      >
        <BingoLotteryBall number={7} color="#EF4444" size={26} />
        <BingoLotteryBall number={7} color="#06B6D4" size={26} />
      </div>

      <div
        className="board-lottery-balls-bottom-right"
        style={{
          position: 'absolute',
          bottom: '-12px',
          right: '-10px',
          display: 'flex',
          gap: '2px',
          zIndex: 12,
          pointerEvents: 'none'
        }}
      >
        <BingoLotteryBall number={19} color="#6366F1" size={26} />
        <BingoLotteryBall number={22} color="#EC4899" size={26} />
      </div>
    </div>
  );
}
