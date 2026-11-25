/**
 * src/tournaments/components/PlayerName.jsx
 * 
 * Shared player name component.
 * Rules:
 * - No ellipsis. Names wrap to up to 2 lines (overflow-wrap: anywhere; min-width: 0 on child).
 * - Full name available on tap/focus (title + popup tooltip).
 * - Supports Hindi (Noto Sans Devanagari), long words, 24+ char names, matras never cut.
 * - Eliminated state: muted ink plus continuous strike-through line across name.
 * - Winner state: lit amber edge / gold styling.
 */

import React, { useState } from 'react';

export function PlayerName({
  name = 'TBD',
  seed = null,
  isWinner = false,
  isEliminated = false,
  isCurrentUser = false,
  avatar = null,
  className = '',
  style = {}
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const cleanName = name || 'TBD';

  return (
    <div
      data-name="true"
      className={`tournament-player-name-wrap ${isWinner ? 'is-winner' : ''} ${isEliminated ? 'is-eliminated' : ''} ${isCurrentUser ? 'is-you' : ''} ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: 0,
        position: 'relative',
        ...style
      }}
      title={cleanName}
      tabIndex={0}
      onClick={() => setShowTooltip(prev => !prev)}
      onBlur={() => setShowTooltip(false)}
      role="button"
      aria-label={`Player: ${cleanName}${isWinner ? ', Winner' : ''}${isEliminated ? ', Eliminated' : ''}`}
    >
      {/* Seed pill if provided */}
      {seed !== null && seed !== undefined && (
        <span className="player-seed-pill" aria-label={`Seed ${seed}`}>
          {seed}
        </span>
      )}

      {/* Avatar emoji if provided */}
      {avatar && <span className="player-avatar-icon" aria-hidden="true">{avatar}</span>}

      {/* Name text with 2-line max wrapping, never cut */}
      <span
        className={`player-name-text ${isEliminated ? 'strike-eliminated' : ''}`}
        style={{
          fontFamily: 'var(--font-display)',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          lineHeight: '1.35',
          minWidth: 0,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'visible'
        }}
      >
        {cleanName}
      </span>

      {/* "YOU" badge */}
      {isCurrentUser && (
        <span className="badge-you-pill">YOU</span>
      )}

      {/* Winner checkmark */}
      {isWinner && (
        <span className="winner-check-icon" aria-label="Winner">✓</span>
      )}

      {/* Tap/Focus Tooltip for very long names */}
      {showTooltip && cleanName.length > 15 && (
        <div className="player-name-popover" role="tooltip">
          {cleanName}
        </div>
      )}
    </div>
  );
}
