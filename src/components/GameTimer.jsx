/**
 * src/components/GameTimer.jsx
 * 
 * Turn Indicator and Turn Countdown Timer Component.
 */

import React from 'react';

export function GameTimer({ isMyTurn = true, turnPlayerName = 'You', secondsRemaining = 30 }) {
  return (
    <div className="turn-timer-strip">
      <div className={`turn-badge ${isMyTurn ? 'my-turn' : 'opponent-turn'}`}>
        <span className="turn-dot">●</span>
        <span className="turn-text">
          {isMyTurn ? 'Your Turn' : `${turnPlayerName}'s Turn`}
        </span>
      </div>

      <div className="timer-clock" aria-label={`Time remaining: ${secondsRemaining} seconds`}>
        <span className="clock-icon">⏱️</span>
        <span className="clock-digits">{secondsRemaining}s</span>
      </div>
    </div>
  );
}
