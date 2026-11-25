/**
 * src/screens/ModesHubScreen.jsx
 * 
 * Game Modes Hub for the React BINGO Application.
 * Displays all 13 dedicated game modes with categories,
 * difficulty badges, player count requirements, and direct entry triggers.
 */

import React, { useState } from 'react';
import { ALL_GAME_MODES } from '../constants/gameModes.js';
import { soundManager } from '../../public/js/audio.js';

export { ALL_GAME_MODES };

export function ModesHubScreen({
  onBack = null,
  onSelectMode = null
}) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredModes = ALL_GAME_MODES.filter(m => {
    if (activeFilter === 'all') return true;
    return m.category === activeFilter;
  });

  return (
    <section id="screen-modes-hub" className="screen-view">
      <div className="back-nav-bar">
        <button
          type="button"
          className="btn-back-nav"
          data-back="home"
          onClick={onBack}
        >
          <span className="back-arrow">←</span> Home
        </button>
        <span className="page-header-badge">13 Playable Modes</span>
      </div>

      <div className="screen-scrollable">
        <div className="modes-hub-header">
          <h2 className="modes-hub-title">Game Modes</h2>
          <p className="modes-hub-subtitle">Choose your battle format across 13 dedicated gameplay modes</p>
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '14px' }}>
          {[
            { id: 'all', label: 'All Modes' },
            { id: 'online', label: '⚡ 1v1 Online' },
            { id: 'friends', label: '👥 Friends & Rooms' },
            { id: 'tournaments', label: '🏆 Tournaments' },
            { id: 'solo', label: '🤖 Solo & Arcade' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              className={`select-chip ${activeFilter === f.id ? 'active' : ''}`}
              onClick={() => {
                soundManager.playTap?.();
                setActiveFilter(f.id);
              }}
              style={{ whiteSpace: 'nowrap', padding: '6px 14px', fontSize: '0.8rem', minHeight: '36px' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="all-modes-grid arena-stagger" id="all-modes-grid-container">
          {filteredModes.map(mode => (
            <div
              key={mode.id}
              className="game-mode-card btn-tactile"
              data-mode-target={mode.id}
              onClick={() => {
                soundManager.playTap?.();
                onSelectMode && onSelectMode(mode.id);
              }}
              role="button"
              tabIndex={0}
              style={{ cursor: 'pointer' }}
            >
              <div className="mode-card-top">
                <div className="mode-badge-icon" style={{ background: mode.badgeBg, color: mode.badgeColor }}>
                  {mode.icon}
                </div>
                <span className="mode-req-pill">{mode.reqPill}</span>
              </div>
              <div className="mode-info-block">
                <span className="mode-number-tag">{mode.modeNumber}</span>
                <h3 className="mode-name-title">{mode.title}</h3>
                <p className="mode-short-desc">{mode.desc}</p>
              </div>
              <button
                type="button"
                className="btn-tactile btn-primary btn-sm"
                style={{ width: '100%', marginTop: '6px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMode && onSelectMode(mode.id);
                }}
              >
                Play Mode →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
