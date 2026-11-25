/**
 * src/components/PlayerInfo.jsx & OpponentInfo.jsx
 * 
 * Player and Opponent Status Bar Components.
 */

import React from 'react';

export function PlayerInfo({ name = 'You', avatar = '🦊', linesCompleted = 0, level = 12 }) {
  return (
    <div className="player-info-card">
      <div className="player-avatar-chip">{avatar}</div>
      <div className="player-meta">
        <div className="player-name">{name}</div>
        <div className="player-sub">Lv. {level} • {linesCompleted}/5 Lines</div>
      </div>
    </div>
  );
}

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
