/**
 * src/tournaments/components/RoundTabs.jsx
 * 
 * Round Selector for mobile and scroller for desktop/tablet.
 * Rules:
 * - Tabs: Round 1, Quarterfinals, Semifinals, Final.
 * - Scrollable with CSS scroll-snap on narrow screens.
 * - Stored in ?round= URL parameter.
 * - Includes a "My Path" shortcut button to highlight the current user's journey.
 */

import React from 'react';

export function RoundTabs({
  rounds = [],
  activeRoundKey,
  onSelectRound,
  onToggleMyPath = null,
  isMyPathActive = false,
  hasMyPath = false
}) {
  if (!rounds || rounds.length === 0) return null;

  return (
    <div className="tournament-round-tabs-container">
      <div
        className="round-tabs-scroller"
        role="tablist"
        aria-label="Tournament rounds"
      >
        {rounds.map((round) => {
          const isSelected = round.key === activeRoundKey;
          return (
            <button
              key={round.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`round-tab-btn ${isSelected ? 'active' : ''}`}
              onClick={() => onSelectRound(round.key)}
            >
              <span className="round-tab-title">{round.title}</span>
              <span className="round-tab-count">({round.matches.length})</span>
            </button>
          );
        })}
      </div>

      {hasMyPath && onToggleMyPath && (
        <button
          type="button"
          className={`btn-my-path-toggle ${isMyPathActive ? 'active' : ''}`}
          onClick={onToggleMyPath}
          aria-pressed={isMyPathActive}
          title="Highlight my matches in the bracket"
        >
          <span>🎯</span>
          <span>My Path</span>
        </button>
      )}
    </div>
  );
}
