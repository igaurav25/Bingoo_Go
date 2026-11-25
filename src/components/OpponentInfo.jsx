/**
 * src/components/OpponentInfo.jsx
 */

import React from 'react';

export function OpponentInfo({ opponent = {} }) {
  const { name = 'Opponent', avatar = '🤖', status = 'online', linesCompleted = 0 } = opponent;
  const miniBingo = ['B', 'I', 'N', 'G', 'O'];

  return (
    <div className="opponent-info-card">
      <div className="opponent-profile">
        <div className="opponent-avatar-chip">{avatar}</div>
        <div className="opponent-meta">
          <div className="opponent-name">{name}</div>
          <div className="opponent-status">
            <span className={`status-dot ${status === 'online' ? 'online' : 'offline'}`} />
            {status}
          </div>
        </div>
      </div>

      {/* Mini BINGO letter progress */}
      <div className="opponent-mini-bingo" aria-label="Opponent BINGO progress">
        {miniBingo.map((letter, idx) => (
          <span
            key={letter}
            className={`mini-letter ${idx < linesCompleted ? 'struck' : ''}`}
          >
            {letter}
          </span>
        ))}
      </div>
    </div>
  );
}
