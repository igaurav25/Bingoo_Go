/**
 * src/components/BottomNav.jsx
 * 
 * Global Sports Bottom Navigation Dock for the React BINGO Application.
 * Navigates across Home, Modes, Tournaments, Leaderboard, and Profile.
 * Automatically hidden during active gameplay.
 */

import React from 'react';
import { soundManager } from '../../public/js/audio.js';

export function BottomNav({
  activeScreen = 'home',
  onNavigate = null,
  isGameplayActive = false
}) {
  if (isGameplayActive) {
    return null;
  }

  const items = [
    { id: 'home', icon: '🏠', label: 'Arena' },
    { id: 'modes', icon: '🎮', label: 'Modes' },
    { id: 'tournaments', icon: '🏆', label: 'IPL Cup' },
    { id: 'leaderboard', icon: '📊', label: 'Rankings' },
    { id: 'profile', icon: '👤', label: 'Profile' }
  ];

  return (
    <nav
      className="bottom-nav-bar sports-bottom-nav responsive-nav-rail"
      id="bottom-nav"
      role="navigation"
      aria-label="Main Navigation"
    >
      {items.map((item) => {
        const isActive = activeScreen === item.id || (item.id === 'modes' && (activeScreen === 'modes-hub' || activeScreen === 'mode-detail'));
        return (
          <button
            key={item.id}
            type="button"
            className={`nav-tab-btn sports-nav-item btn-tactile ${isActive ? 'active' : ''}`}
            data-tab={item.id}
            onClick={() => {
              soundManager.playTap?.();
              onNavigate && onNavigate(item.id);
            }}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <div className="nav-icon-wrap">
              <span className="nav-icon">{item.icon}</span>
            </div>
            <span className="nav-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
