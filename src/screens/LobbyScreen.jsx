/**
 * src/screens/LobbyScreen.jsx
 *
 * Authoritative Multiplayer Room Lobby.
 * - Live 5-character room code, offline SVG QR code, copy & Web Share link
 * - Live player slots & connection/ready status from server room snapshot
 * - Host turn-timer / series settings, Add Practice Bot, Ready toggle & Start Game CTA
 * - Clear error state & recovery when room is missing, full, or already started
 */

import React, { useState } from 'react';
import { QRCodeSVG } from '../components/QRCodeSVG.jsx';
import { AvatarFrame } from '../components/SportsGraphics.jsx';
import { soundManager } from '../../public/js/audio.js';

export function LobbyScreen({
  roomCode = '',
  roomState = null,
  currentUser = null,
  lobbyError = null,
  isJoining = false,
  onToggleReady = null,
  onAddBot = null,
  onUpdateSettings = null,
  onStartGame = null,
  onLeave = null
}) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const code = roomState?.code || roomCode;
  const players = Array.isArray(roomState?.players) ? roomState.players : [];
  const me = players.find(p => p.id === currentUser?.id) || players.find(p => p.isHost) || null;
  const isHost = Boolean(
    roomState ? (roomState.hostPlayerId === currentUser?.id || me?.isHost) : false
  );
  const myReady = Boolean(me?.isReady);
  const shareUrl = typeof window !== 'undefined' && code ? `${window.location.origin}/r/${code}` : '';

  const allGuestsReady = players.every(p => p.isHost || p.isBot || p.isReady);
  const canStart = isHost && players.length >= 2 && allGuestsReady;

  const startHint = !roomState
    ? 'Connecting to room...'
    : players.length < 2
      ? 'Share room code, link, or QR — or add Practice Bot to fill Seat 2'
      : !allGuestsReady
        ? 'Waiting for Seat 2 challenger to mark Ready'
        : 'Both players ready — launch 5×5 Bingo arena!';

  const handleCopy = () => {
    if (!code) return;
    soundManager.playTap?.();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    soundManager.playTap?.();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).catch(() => {});
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShare = () => {
    if (!shareUrl) return;
    soundManager.playTap?.();
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: 'Join my Bingo match!',
        text: `Join my Bingoo Goo room! Code: ${code}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  return (
    <section id="screen-lobby" className="screen-view">
      <div className="back-nav-bar">
        <button type="button" className="btn-back-nav" onClick={onLeave}>
          <span className="back-arrow">←</span> Leave Room
        </button>
        <span className="page-header-badge">Room Lobby {code ? `• ${code}` : ''}</span>
      </div>

      <div className="screen-scrollable sports-home-container">
        {lobbyError ? (
          <div className="game-card" style={{ textAlign: 'center', padding: '24px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', color: '#FCA5A5' }}>Unable to Enter Room</h3>
            <p style={{ margin: '0 0 18px', color: '#8995A8', fontSize: '0.9rem' }}>{lobbyError}</p>
            <button type="button" className="btn-tactile btn-primary" onClick={onLeave} style={{ minHeight: '44px', padding: '10px 22px' }}>
              ← Back to Home
            </button>
          </div>
        ) : (
          <>
            {/* Room Code + Offline SVG QR Invite Card */}
            <div className="game-card" style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800 }}>
                5-Character Room Code
              </span>
              <div style={{
                fontFamily: 'var(--font-sports-mono, var(--font-display))',
                fontSize: '2.4rem',
                fontWeight: 900,
                color: '#F3B94F',
                margin: '4px 0 12px',
                letterSpacing: '5px'
              }}>
                {code || '-----'}
              </div>

              {shareUrl && (
                <div style={{ marginBottom: '14px' }}>
                  <QRCodeSVG value={shareUrl} size={136} label="Offline QR • Scan to Join" />
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-tactile btn-secondary"
                  onClick={handleCopy}
                  disabled={!code}
                  style={{ padding: '8px 14px', fontSize: '0.84rem', minHeight: '42px' }}
                >
                  {copied ? '✓ Code Copied' : '📋 Copy Code'}
                </button>
                <button
                  type="button"
                  className="btn-tactile btn-secondary"
                  onClick={handleCopyLink}
                  disabled={!shareUrl}
                  style={{ padding: '8px 14px', fontSize: '0.84rem', minHeight: '42px' }}
                >
                  {copiedLink ? '✓ Link Copied' : '🔗 Copy Link'}
                </button>
                <button
                  type="button"
                  className="btn-tactile btn-primary"
                  onClick={handleShare}
                  disabled={!code}
                  style={{ padding: '8px 16px', fontSize: '0.84rem', minHeight: '42px' }}
                >
                  <span>📤</span> Share
                </button>
              </div>
            </div>

            {/* Players VS Seat Grid */}
            <div className="game-card arena-stagger">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, color: 'var(--sports-white)' }}>
                  Arena Seats ({players.length}/2)
                </h4>
                {isJoining ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--sports-electric)', fontWeight: 800 }}>Connecting...</span>
                ) : (
                  <span style={{ fontSize: '0.74rem', color: '#34D399', fontWeight: 800 }}>● Live Room Sync</span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {players.map(p => {
                  const ready = p.isReady || p.isHost || p.isBot;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'rgba(15, 23, 42, 0.55)',
                        border: `1.5px solid ${ready ? 'rgba(16, 185, 129, 0.4)' : 'var(--sports-border)'}`,
                        borderRadius: '14px',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                        <AvatarFrame avatar={p.avatar || '🦊'} level={1} rank={p.isHost ? 'Host' : 'Player'} size={42} />
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ fontSize: '0.92rem', display: 'block', color: 'var(--sports-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name} {p.id === currentUser?.id ? '(You)' : ''}
                          </strong>
                          <span style={{ fontSize: '0.72rem', color: p.isHost ? '#FBBF24' : 'var(--sports-slate)' }}>
                            {p.isHost ? '👑 Host' : p.isBot ? '🤖 Practice AI' : '🎮 Challenger'} • {p.isConnected ? '🟢 Online' : '🟠 Syncing'}
                          </span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.74rem',
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        background: ready ? 'rgba(16, 185, 129, 0.16)' : 'rgba(245, 158, 11, 0.15)',
                        color: ready ? '#34D399' : '#FBBF24',
                        fontWeight: 800,
                        flexShrink: 0
                      }}>
                        {ready ? '✓ Ready' : '⏳ Waiting'}
                      </span>
                    </div>
                  );
                })}

                {players.length < 2 && (
                  <div style={{
                    padding: '14px',
                    borderRadius: '14px',
                    border: '1.5px dashed rgba(96, 165, 250, 0.35)',
                    background: 'rgba(15, 23, 42, 0.3)',
                    textAlign: 'center',
                    color: 'var(--sports-slate)',
                    fontSize: '0.84rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    <span>Open Seat 2 — waiting for code <strong style={{ color: '#FBBF24' }}>{code}</strong></span>
                    {isHost && onAddBot && (
                      <div>
                        <button
                          type="button"
                          className="btn-tactile btn-secondary"
                          onClick={() => {
                            soundManager.playTap?.();
                            onAddBot();
                          }}
                          style={{ padding: '7px 14px', fontSize: '0.82rem', minHeight: '38px' }}
                        >
                          🤖 Add Practice Bot
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Room Settings (Host editable) */}
            {roomState?.settings && (
              <div className="game-card">
                <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: 800 }}>Room Match Rules</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#8995A8', marginBottom: '4px' }}>
                      Turn Timer
                    </label>
                    <select
                      disabled={!isHost}
                      value={roomState.settings.turnTimerSeconds || 0}
                      onChange={(e) => onUpdateSettings && onUpdateSettings({ turnTimerSeconds: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: '#0C1422',
                        color: '#F4F6FA',
                        border: '1px solid rgba(137, 149, 168, 0.3)'
                      }}
                    >
                      <option value={0}>No Limit</option>
                      <option value={20}>20 Seconds</option>
                      <option value={30}>30 Seconds</option>
                      <option value={45}>45 Seconds</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#8995A8', marginBottom: '4px' }}>
                      Series Format
                    </label>
                    <select
                      disabled={!isHost}
                      value={roomState.settings.seriesTargetWins || 1}
                      onChange={(e) => onUpdateSettings && onUpdateSettings({ seriesTargetWins: Number(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        background: '#0C1422',
                        color: '#F4F6FA',
                        border: '1px solid rgba(137, 149, 168, 0.3)'
                      }}
                    >
                      <option value={1}>Single Match</option>
                      <option value={2}>Best of 3</option>
                      <option value={3}>Best of 5</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Primary Lobby Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
              <p style={{ margin: 0, textAlign: 'center', fontSize: '0.8rem', color: canStart ? '#32B879' : '#8995A8', fontWeight: 700 }}>
                {startHint}
              </p>

              {isHost ? (
                <button
                  type="button"
                  className="btn-tactile btn-primary btn-cta"
                  disabled={!canStart}
                  onClick={onStartGame}
                  style={{ width: '100%', minHeight: '48px', fontSize: '1.05rem', opacity: canStart ? 1 : 0.55 }}
                >
                  <span>🚀</span> Start Game Now
                </button>
              ) : (
                <button
                  type="button"
                  className={`btn-tactile ${myReady ? 'btn-secondary' : 'btn-mint'} btn-cta`}
                  onClick={() => onToggleReady && onToggleReady(!myReady)}
                  style={{ width: '100%', minHeight: '48px', fontSize: '1.05rem' }}
                >
                  {myReady ? '✓ Ready (Tap to Cancel)' : '⚡ Mark Yourself Ready'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
