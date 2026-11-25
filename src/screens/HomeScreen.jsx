/**
 * src/screens/HomeScreen.jsx
 *
 * Sports Tournament Home Screen connected to live session identity, real Top Leader API,
 * Quick Join 5-char room input, Private Room creation, Quick Match, and Tournaments.
 */

import React, { useState, useRef, useEffect } from 'react';
import { AvatarFrame, TrophyGraphic, CoinIcon } from '../components/SportsGraphics.jsx';
import { soundManager } from '../../public/js/audio.js';

export function HomeScreen({
  currentUser = null,
  coins = 500,
  dailyClaimed = false,
  onClaimDaily = null,
  onLaunchQuickMatch = null,
  onOpenCreateRoom = null,
  onOpenFriendChallenge = null,
  onOpenModesHub = null,
  onOpenTournaments = null,
  onOpenLeaderboard = null,
  onOpenProfile = null,
  onJoinCode = null
}) {
  const [showJoinCard, setShowJoinCard] = useState(false);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '']);
  const [topLeader, setTopLeader] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [featuredTourn, setFeaturedTourn] = useState(null);
  const [profileStats, setProfileStats] = useState(null);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    fetch('/api/users/leaderboard?limit=1')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.leaderboard) && d.leaderboard.length > 0) {
          setTopLeader(d.leaderboard[0]);
        }
      })
      .catch(() => {});

    fetch('/api/tournaments')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.tournaments) && d.tournaments.length > 0) {
          const priority = d.tournaments.find(t => t.id === 'tourn-champions-hybrid')
            || d.tournaments.find(t => t.status === 'REGISTERING' || t.status === 'IN_PROGRESS' || t.status === 'PLAYOFFS')
            || d.tournaments[0];
          setFeaturedTourn(priority || null);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const uid = currentUser?.id;
    if (!uid) return;
    fetch(`/api/users/profile?id=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user?.stats) {
          setProfileStats(d.user.stats);
        }
      })
      .catch(() => {});

    fetch(`/api/matches/history?userId=${encodeURIComponent(uid)}&limit=3`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.history)) {
          setRecentMatches(d.history);
        }
      })
      .catch(() => {});
  }, [currentUser?.id]);

  const user = currentUser || {
    name: 'Player',
    avatar: '🦊',
    level: 1,
    rank: 'Challenger',
    xp: 0,
    maxXp: 100
  };

  const handleDigitChange = (index, value) => {
    const char = value.slice(-1).toUpperCase().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '');
    const next = [...codeDigits];
    next[index] = char;
    setCodeDigits(next);

    if (char && index < 4 && inputRefs[index + 1].current) {
      soundManager.playTap?.();
      inputRefs[index + 1].current.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0 && inputRefs[index - 1].current) {
      inputRefs[index - 1].current.focus();
    }
    if (e.key === 'Enter') {
      submitCode();
    }
  };

  const submitCode = () => {
    const fullCode = codeDigits.join('').trim().toUpperCase();
    if (fullCode.length === 5) {
      soundManager.playTap?.();
      onJoinCode && onJoinCode(fullCode);
    }
  };

  const xpPercent = Math.min(100, Math.round(((user.xp || 0) / (user.maxXp || 100)) * 100));
  const played = profileStats?.matchesPlayed || 0;
  const wins = profileStats?.matchesWon || 0;
  const losses = Math.max(0, played - wins);
  const winRate = profileStats?.winRate ?? (played > 0 ? Math.round((wins / played) * 100) : 0);

  return (
    <section id="screen-home" className="screen-view">
      <div className="screen-scrollable sports-home-container">
        {/* 1. PLAYER HUD BAR */}
        <div
          className="lobby-player-bar sports-player-hud btn-tactile"
          id="lobby-player-bar"
          onClick={() => {
            soundManager.playTap?.();
            onOpenProfile && onOpenProfile();
          }}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
        >
          <div className="hud-player-left">
            <AvatarFrame
              avatar={user.avatar || '🦊'}
              level={user.level || 1}
              rank={user.rank || 'Challenger'}
              size={54}
            />
            <div className="hud-player-details">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="lobby-player-name hud-player-name" id="lobby-player-name">
                  {user.username || user.name || 'Player'}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.45)',
                  color: '#C4B5FD'
                }}>
                  Lv. {user.level || 1}
                </span>
                <span className="lobby-level-badge" id="lobby-level-badge" style={{ display: 'none' }}>
                  Lv. {user.level || 1}
                </span>
                <div className="lobby-avatar-chip" id="lobby-avatar-chip" style={{ display: 'none' }}>
                  {user.avatar || '🦊'}
                </div>
              </div>
              <div className="hud-rank-badge">
                <span className="lobby-rank-tier">{user.rank || 'Challenger'}</span>
                <span>•</span>
                <span>{user.isGuest ? 'Guest Session (Tap to Sign In)' : `${wins}W - ${losses}L (${winRate}%)`}</span>
              </div>
              <div className="hud-xp-track">
                <div className="hud-xp-fill" style={{ width: `${Math.max(8, xpPercent)}%` }} />
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--sports-electric)', fontWeight: 800, whiteSpace: 'nowrap' }}>
            Passport →
          </div>
        </div>

        <div className="arena-home-grid">
          {/* LEFT / MAIN COLUMN */}
          <div className="arena-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {/* 2. FEATURED ARENA HERO */}
            <div className="sports-featured-banner" style={{
              background: 'linear-gradient(135deg, #1E2958 0%, #111839 58%, #251548 100%)',
              borderColor: 'rgba(139, 92, 246, 0.42)'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 900, color: '#FBBF24', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                  ⚡ LIVE 5×5 MULTIPLAYER BINGO ARENA
                </div>
                <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(1.45rem, 3.8vw, 1.95rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.1 }}>
                  Play Live.<br />Claim 5-Line BINGO.
                </h1>
                <p style={{ margin: '0 0 16px', fontSize: '0.86rem', color: '#CBD5E1', lineHeight: 1.45 }}>
                  Join instant 1v1 duels, private friend rooms, or 5-match IPL League + Playoffs championships.
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    id="btn-hero-play"
                    type="button"
                    className="btn-tactile btn-gold"
                    onClick={() => {
                      soundManager.playTap?.();
                      onLaunchQuickMatch && onLaunchQuickMatch();
                    }}
                    style={{ padding: '11px 24px', fontSize: '0.96rem', fontWeight: 900, minHeight: '46px', borderRadius: '9999px' }}
                  >
                    PLAY BINGO ⚡
                  </button>
                  <button
                    type="button"
                    className="btn-tactile btn-secondary"
                    onClick={() => {
                      soundManager.playTap?.();
                      onOpenTournaments && onOpenTournaments();
                    }}
                    style={{ padding: '10px 18px', fontSize: '0.88rem', fontWeight: 800, minHeight: '46px', borderRadius: '9999px' }}
                  >
                    🏆 IPL Cup
                  </button>
                </div>
              </div>

              <div className="arena-trophy-float" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                <TrophyGraphic size={92} />
                <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#FBBF24', letterSpacing: '0.08em' }}>
                  IPL ARENA
                </span>
              </div>
            </div>

            {/* 3. CORE GAME MODES GRID */}
            <div className="sports-modes-grid modes-grid">
              <div
                className="sports-mode-card mode-quick quick-match btn-tactile"
                id="mode-quick-match"
                onClick={() => {
                  soundManager.playTap?.();
                  onLaunchQuickMatch && onLaunchQuickMatch();
                }}
                role="button"
                tabIndex={0}
              >
                <div className="sports-mode-icon-circle mode-icon-circle">⚡</div>
                <h3 className="sports-mode-title mode-title">Online Match</h3>
                <p className="sports-mode-desc mode-desc">Real-time matchmaking against live contenders.</p>
              </div>

              <div
                className="sports-mode-card mode-create create-room btn-tactile"
                id="mode-create-room"
                onClick={() => {
                  soundManager.playTap?.();
                  onOpenCreateRoom && onOpenCreateRoom();
                }}
                role="button"
                tabIndex={0}
              >
                <div className="sports-mode-icon-circle mode-icon-circle">➕</div>
                <h3 className="sports-mode-title mode-title">Create Room</h3>
                <p className="sports-mode-desc mode-desc">Host private arena with 5-char code &amp; QR.</p>
              </div>

              <div
                className="sports-mode-card mode-join join-room btn-tactile"
                id="mode-join-room"
                onClick={() => {
                  soundManager.playTap?.();
                  setShowJoinCard(prev => !prev);
                }}
                role="button"
                tabIndex={0}
              >
                <div className="sports-mode-icon-circle mode-icon-circle">🔑</div>
                <h3 className="sports-mode-title mode-title">Join Room</h3>
                <p className="sports-mode-desc mode-desc">Enter a 5-character room code from a friend.</p>
              </div>

              <div
                className="sports-mode-card mode-tourn tournament-mode btn-tactile"
                id="mode-tournament"
                onClick={() => {
                  soundManager.playTap?.();
                  onOpenTournaments && onOpenTournaments();
                }}
                role="button"
                tabIndex={0}
              >
                <div className="sports-mode-icon-circle mode-icon-circle">🏆</div>
                <h3 className="sports-mode-title mode-title">Tournaments</h3>
                <p className="sports-mode-desc mode-desc">5-Match IPL League, Points Table &amp; Playoffs.</p>
              </div>
            </div>

            {/* 4. QUICK JOIN CODE INPUT CARD */}
            {showJoinCard && (
              <div id="home-join-card" className="game-card arena-modal-enter" style={{
                borderColor: 'var(--sports-border-highlight)',
                textAlign: 'center'
              }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 900, color: 'var(--sports-white)' }}>
                  Enter Private Room Code
                </h3>
                <p style={{ margin: '0 0 14px', fontSize: '0.84rem', color: 'var(--sports-slate)' }}>
                  Type the 5-character room code shared by your friend.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                  {codeDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={inputRefs[idx]}
                      type="text"
                      className="code-box-input"
                      maxLength={1}
                      id={`code-box-${idx}`}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      autoComplete="off"
                      autoCapitalize="characters"
                      style={{
                        width: '46px',
                        height: '52px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-sports-mono, monospace)',
                        fontSize: '1.5rem',
                        fontWeight: 900,
                        border: '2px solid rgba(96, 165, 250, 0.45)',
                        borderRadius: '12px',
                        background: 'var(--sports-dark-bg)',
                        color: 'var(--sports-white)'
                      }}
                    />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-tactile btn-secondary"
                    id="btn-cancel-join"
                    onClick={() => setShowJoinCard(false)}
                    style={{ flex: 1, minHeight: '44px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-tactile btn-primary"
                    id="btn-join-code"
                    onClick={submitCode}
                    disabled={codeDigits.join('').length < 5}
                    style={{ flex: 1, minHeight: '44px' }}
                  >
                    Join Match ⚡
                  </button>
                </div>
              </div>
            )}

            {/* 5. BROWSE ALL 13 MODES */}
            <button
              id="btn-browse-all-modes"
              type="button"
              className="btn-tactile btn-primary"
              onClick={() => {
                soundManager.playTap?.();
                onOpenModesHub && onOpenModesHub();
              }}
              style={{
                width: '100%',
                minHeight: '50px',
                fontSize: '0.95rem',
                padding: '12px 18px',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(90deg, #2563EB 0%, #7C3AED 100%)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.25rem' }}>🎮</span>
                <span style={{ fontWeight: 800 }}>Explore All 13 Playable Game Modes</span>
              </div>
              <span style={{ fontSize: '1.1rem' }}>➔</span>
            </button>
          </div>

          {/* RIGHT SIDEBAR COLUMN ON DESKTOP / STACKED ON MOBILE */}
          <div className="arena-stagger" style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
            {/* Featured Live IPL Tournament Spotlight */}
            {featuredTourn && (
              <div className="game-card" style={{ borderColor: 'rgba(245, 158, 11, 0.35)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 900, color: '#FBBF24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    🏆 Featured IPL Tournament
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34D399' }}>
                    {featuredTourn.status}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 900, color: 'var(--sports-white)' }}>
                  {featuredTourn.logo || '🏆'} {featuredTourn.name}
                </h3>
                <p style={{ margin: '0 0 12px', fontSize: '0.78rem', color: 'var(--sports-slate)' }}>
                  {(featuredTourn.participants?.length || 0)}/{featuredTourn.maxParticipants || 8} Players • {featuredTourn.matchesPerPlayer || 5} Matches Each • +{featuredTourn.pointsPerWin ?? 2} Pts/Win
                </p>
                <button
                  type="button"
                  className="btn-tactile btn-gold"
                  onClick={() => onOpenTournaments && onOpenTournaments(featuredTourn.id)}
                  style={{ width: '100%', minHeight: '40px', borderRadius: '12px', fontWeight: 900, fontSize: '0.85rem' }}
                >
                  Open Tournament Hub →
                </button>
              </div>
            )}

            {/* Career Stats + Friends Quick Row */}
            <div className="game-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '0.94rem', color: 'var(--sports-white)' }}>📊 Your Career Snapshot</strong>
                <button
                  type="button"
                  onClick={() => onOpenProfile && onOpenProfile()}
                  style={{ background: 'none', border: 'none', color: 'var(--sports-electric)', fontWeight: 800, fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Profile →
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ padding: '8px 4px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.45)' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--sports-slate)', display: 'block' }}>Matches</span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--sports-white)' }}>{played}</strong>
                </div>
                <div style={{ padding: '8px 4px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.12)' }}>
                  <span style={{ fontSize: '0.68rem', color: '#34D399', display: 'block' }}>Wins</span>
                  <strong style={{ fontSize: '1.05rem', color: '#34D399' }}>{wins}</strong>
                </div>
                <div style={{ padding: '8px 4px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)' }}>
                  <span style={{ fontSize: '0.68rem', color: '#FCA5A5', display: 'block' }}>Losses</span>
                  <strong style={{ fontSize: '1.05rem', color: '#FCA5A5' }}>{losses}</strong>
                </div>
                <div style={{ padding: '8px 4px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.12)' }}>
                  <span style={{ fontSize: '0.68rem', color: '#FBBF24', display: 'block' }}>Win %</span>
                  <strong style={{ fontSize: '1.05rem', color: '#FBBF24' }}>{winRate}%</strong>
                </div>
              </div>

              {onOpenFriendChallenge && (
                <button
                  type="button"
                  className="btn-tactile btn-secondary"
                  onClick={() => {
                    soundManager.playTap?.();
                    onOpenFriendChallenge();
                  }}
                  style={{ width: '100%', marginTop: '12px', minHeight: '40px', borderRadius: '12px', fontSize: '0.84rem' }}
                >
                  🤝 Friends &amp; Direct Challenges →
                </button>
              )}
            </div>

            {/* Recent Matches Card */}
            <div className="game-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '0.94rem', color: 'var(--sports-white)' }}>🕒 Recent Matches</strong>
              </div>
              {recentMatches.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--sports-slate)', textAlign: 'center', padding: '10px 6px' }}>
                  No completed matches yet. Start an Online Match or Tournament fixture!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentMatches.slice(0, 3).map((m, i) => (
                    <div key={m.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: '10px', background: 'rgba(15, 23, 42, 0.45)', fontSize: '0.8rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ display: 'block', color: 'var(--sports-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          vs {m.opponentName || 'Opponent'}
                        </strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--sports-slate)' }}>
                          {m.mode || 'BINGO'} • {m.linesCompleted || 0} Lines
                        </span>
                      </div>
                      <span style={{ fontWeight: 900, color: m.result === 'WIN' ? '#34D399' : '#F87171', flexShrink: 0 }}>
                        {m.result || 'DONE'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Daily Coin Reward Card */}
            <div className="reward-quest-card game-card" id="card-daily-reward" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'rgba(245, 158, 11, 0.16)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.35rem'
                }}>
                  🎁
                </div>
                <div>
                  <div style={{ fontWeight: 900, fontSize: '0.94rem', color: 'var(--sports-white)' }}>Daily Supply Drop</div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--sports-slate)' }}>Claim 100 free coins daily</div>
                </div>
              </div>

              <button
                type="button"
                className="btn-tactile btn-primary"
                id="btn-claim-daily"
                disabled={dailyClaimed}
                onClick={onClaimDaily}
                style={{ padding: '8px 16px', fontSize: '0.84rem', borderRadius: '9999px', minHeight: '40px' }}
              >
                {dailyClaimed ? 'Claimed ✓' : 'Claim 100 🪙'}
              </button>
            </div>

            {/* Global Leaderboard Teaser */}
            <div className="game-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 900, fontSize: '0.95rem', color: 'var(--sports-white)' }}>
                  <span>🥇</span>
                  <span>Leaderboard #1</span>
                </div>
                <button
                  type="button"
                  className="text-btn"
                  id="btn-view-all-leaderboard"
                  onClick={() => {
                    soundManager.playTap?.();
                    onOpenLeaderboard && onOpenLeaderboard();
                  }}
                  style={{ fontSize: '0.8rem', color: 'var(--sports-electric)', fontWeight: 800, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Full Rankings ➔
                </button>
              </div>

              {topLeader ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(15, 23, 42, 0.45)',
                  borderRadius: '12px',
                  border: '1px solid rgba(245, 158, 11, 0.25)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <AvatarFrame avatar={topLeader.avatar || '🦊'} level={topLeader.level || 1} rank={topLeader.rankTier || 'Leader'} size={38} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.9rem', color: 'var(--sports-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topLeader.username}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--sports-slate)' }}>
                        {topLeader.wins || 0} Wins • {topLeader.winRate || 0}% Rate
                      </div>
                    </div>
                  </div>
                  <div className="sports-coin-pill" style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                    <CoinIcon size={14} />
                    <span>{(topLeader.coins || 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '10px', textAlign: 'center', color: 'var(--sports-slate)', fontSize: '0.82rem', background: 'rgba(15, 23, 42, 0.35)', borderRadius: '10px' }}>
                  Win matches to claim the #1 global rank!
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
