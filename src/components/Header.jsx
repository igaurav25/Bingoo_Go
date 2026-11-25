/**
 * src/components/Header.jsx
 * 
 * Global Sports App Header for the React BINGO Application.
 * Displays official sports shield crest, animated coin wallet pill,
 * notification bell (daily reward shortcut), how-to-play, and settings.
 */

import React from 'react';
import { BingoSportsLogo, CoinIcon } from './SportsGraphics.jsx';
import { soundManager } from '../../public/js/audio.js';

export function Header({
  coins = 500,
  currentUser = null,
  wsConnected = true,
  isMuted = false,
  unreadNotifications = 0,
  onToggleMute = null,
  onNavigateHome = null,
  onNavigateProfile = null,
  onOpenNotifications = null,
  onOpenHowToPlay = null,
  onOpenSettings = null,
  isGameplayActive = false
}) {
  if (isGameplayActive) {
    // Hidden during gameplay to enforce strict no-scroll 100dvh board view
    return null;
  }

  return (
    <header className="main-app-header sports-top-header" id="main-header" role="banner">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          className="brand-badge sports-header-brand"
          id="brand-home-btn"
          title="Home"
          onClick={() => {
            soundManager.playTap?.();
            onNavigateHome && onNavigateHome();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigateHome && onNavigateHome(); }}
          style={{ cursor: 'pointer' }}
        >
          <BingoSportsLogo size={36} showText={true} />
        </div>

        <span
          className="hide-on-mobile"
          title={wsConnected ? 'Multiplayer WebSocket Connected' : 'Reconnecting to server'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: wsConnected ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.16)',
            border: `1px solid ${wsConnected ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
            color: wsConnected ? '#34D399' : '#FBBF24'
          }}
        >
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: wsConnected ? '#10B981' : '#F59E0B'
          }} />
          {wsConnected ? 'Arena Live' : 'Reconnecting'}
        </span>
      </div>

      <div className="header-right-group sports-header-actions">
        {/* Coin Wallet Balance Pill */}
        <div
          className="coin-pill sports-coin-pill"
          id="header-coin-pill"
          title="Coin Balance & Rewards"
          onClick={() => {
            soundManager.playTap?.();
            onOpenNotifications && onOpenNotifications();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onOpenNotifications && onOpenNotifications(); }}
          style={{ cursor: 'pointer' }}
        >
          <CoinIcon size={18} />
          <span id="header-coin-amount">{coins.toLocaleString()}</span>
        </div>

        {/* Quick Sound Mute Toggle */}
        {onToggleMute && (
          <button
            type="button"
            className="icon-btn-round sports-icon-btn hide-on-mobile"
            id="btn-header-sound"
            aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            onClick={onToggleMute}
          >
            <span>{isMuted ? '🔇' : '🔊'}</span>
          </button>
        )}

        {/* Notification Bell Button */}
        <button
          type="button"
          className="icon-btn-round sports-icon-btn"
          id="btn-notifications"
          aria-label="Notifications"
          title="Daily Rewards & Quests"
          onClick={() => {
            soundManager.playTap?.();
            onOpenNotifications && onOpenNotifications();
          }}
        >
          <span>🔔</span>
          {unreadNotifications > 0 ? (
            <span className="tourn-notif-badge" style={{
              position: 'absolute',
              top: '-3px',
              right: '-3px',
              background: '#EC4899',
              color: '#fff',
              fontSize: '0.62rem',
              fontWeight: 900,
              minWidth: '16px',
              height: '16px',
              borderRadius: '9999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px'
            }}>
              {unreadNotifications}
            </span>
          ) : (
            <span className="sports-pulse-dot" />
          )}
        </button>

        {/* How To Play Button */}
        <button
          type="button"
          className="icon-btn-round sports-icon-btn"
          id="btn-how-to-play"
          aria-label="How to Play"
          title="How to Play"
          onClick={() => {
            soundManager.playTap?.();
            onOpenHowToPlay && onOpenHowToPlay();
          }}
        >
          <span>📖</span>
        </button>

        {/* Settings Button */}
        <button
          type="button"
          className="icon-btn-round sports-icon-btn"
          id="settings-btn"
          aria-label="Settings"
          title="Game Settings"
          onClick={() => {
            soundManager.playTap?.();
            onOpenSettings && onOpenSettings();
          }}
        >
          <span>⚙️</span>
        </button>

        {/* Quick Player Avatar Pill */}
        {currentUser && onNavigateProfile && (
          <button
            type="button"
            className="tourn-header-profile-pill hide-on-mobile"
            onClick={() => {
              soundManager.playTap?.();
              onNavigateProfile();
            }}
            title="Player Passport"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px 4px 6px',
              borderRadius: '9999px',
              background: 'var(--sports-midnight)',
              border: '1px solid var(--sports-border)',
              color: 'var(--sports-white)',
              fontWeight: 800,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <span style={{ fontSize: '1.05rem' }}>{currentUser.avatar || '🦊'}</span>
            <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.username || currentUser.name || 'Player'}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
