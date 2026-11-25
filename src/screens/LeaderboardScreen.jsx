/**
 * src/screens/LeaderboardScreen.jsx
 *
 * Real Global Rankings & Leaderboard Screen wired to /api/users/leaderboard.
 * Shows honest loading, empty, error, and top-podium + full division list states.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AvatarFrame, CoinIcon } from '../components/SportsGraphics.jsx';

export function LeaderboardScreen({ onBack = null, currentUser = null }) {
  const [activeTab, setActiveTab] = useState('wins');
  const [leaders, setLeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/leaderboard?category=${encodeURIComponent(activeTab)}&limit=20`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load leaderboard');
      }
      setLeaders(Array.isArray(data.leaderboard) ? data.leaderboard : []);
    } catch (err) {
      setError(err.message || 'Unable to fetch rankings.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <section id="screen-leaderboard" className="screen-view">
      <div className="back-nav-bar">
        <button type="button" className="btn-back-nav" onClick={onBack}>
          <span className="back-arrow">←</span> Home
        </button>
        <span className="page-header-badge">Global Rankings</span>
      </div>

      <div className="screen-scrollable sports-home-container">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className={`btn-tactile ${activeTab === 'wins' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('wins')}
            style={{ flex: 1, minHeight: '44px', fontSize: '0.9rem', borderRadius: '12px' }}
          >
            Most Wins
          </button>
          <button
            type="button"
            className={`btn-tactile ${activeTab === 'coins' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('coins')}
            style={{ flex: 1, minHeight: '44px', fontSize: '0.9rem', borderRadius: '12px' }}
          >
            Top Coin Balance
          </button>
        </div>

        {isLoading && (
          <div className="game-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '18px' }}>
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="skeleton-block" style={{ height: '54px' }} />
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="game-card" style={{ textAlign: 'center', padding: '22px' }}>
            <p style={{ color: '#FCA5A5', margin: '0 0 12px' }}>⚠️ {error}</p>
            <button type="button" className="btn-tactile btn-primary" onClick={fetchLeaderboard}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && leaders.length === 0 && (
          <div className="game-card" style={{ textAlign: 'center', padding: '28px' }}>
            <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>🏆</div>
            <h4 style={{ margin: '0 0 6px', color: '#F4F6FA' }}>No Ranked Players Yet</h4>
            <p style={{ margin: 0, color: '#8995A8', fontSize: '0.86rem' }}>
              Complete matches or register a player account to appear in the global division rankings.
            </p>
          </div>
        )}

        {!isLoading && !error && leaders.length > 0 && (
          <>
            {leaders.length >= 3 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                alignItems: 'flex-end',
                margin: '8px 0',
                padding: '10px 0'
              }}>
                {/* 2nd */}
                <div style={{
                  background: 'var(--sports-card-bg)',
                  border: '1px solid rgba(203, 213, 225, 0.3)',
                  borderRadius: '16px',
                  padding: '14px 6px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '1.6rem' }}>🥈</span>
                  <AvatarFrame avatar={leaders[1]?.avatar || '🐻'} level={leaders[1]?.level || 1} rank="Silver" size={44} />
                  <strong style={{ fontSize: '0.84rem', color: '#F4F6FA', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leaders[1]?.username}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#8995A8' }}>{leaders[1]?.wins || 0} Wins</span>
                  <div className="sports-coin-pill" style={{ padding: '4px 8px', fontSize: '0.76rem' }}>
                    <CoinIcon size={14} />
                    <span>{(leaders[1]?.coins || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* 1st */}
                <div style={{
                  background: 'linear-gradient(145deg, #203152 0%, #121D33 100%)',
                  border: '2px solid var(--sports-gold)',
                  borderRadius: '18px',
                  padding: '18px 6px',
                  textAlign: 'center',
                  transform: 'translateY(-10px)',
                  boxShadow: '0 10px 25px rgba(243, 185, 79, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '2.1rem' }}>👑</span>
                  <AvatarFrame avatar={leaders[0]?.avatar || '🦊'} level={leaders[0]?.level || 1} rank="Champion" size={52} />
                  <strong style={{ fontSize: '0.96rem', color: '#FFFFFF', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leaders[0]?.username}
                  </strong>
                  <span style={{ fontSize: '0.76rem', color: '#F3B94F', fontWeight: 800 }}>
                    {leaders[0]?.wins || 0} Wins • {leaders[0]?.winRate || 0}%
                  </span>
                  <div className="sports-coin-pill" style={{ padding: '4px 10px', fontSize: '0.82rem', borderColor: 'var(--sports-gold)' }}>
                    <CoinIcon size={15} />
                    <span>{(leaders[0]?.coins || 0).toLocaleString()}</span>
                  </div>
                </div>

                {/* 3rd */}
                <div style={{
                  background: 'var(--sports-card-bg)',
                  border: '1px solid rgba(217, 119, 6, 0.3)',
                  borderRadius: '16px',
                  padding: '14px 6px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ fontSize: '1.6rem' }}>🥉</span>
                  <AvatarFrame avatar={leaders[2]?.avatar || '🐼'} level={leaders[2]?.level || 1} rank="Bronze" size={44} />
                  <strong style={{ fontSize: '0.84rem', color: '#F4F6FA', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leaders[2]?.username}
                  </strong>
                  <span style={{ fontSize: '0.74rem', color: '#8995A8' }}>{leaders[2]?.wins || 0} Wins</span>
                  <div className="sports-coin-pill" style={{ padding: '4px 8px', fontSize: '0.76rem' }}>
                    <CoinIcon size={14} />
                    <span>{(leaders[2]?.coins || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="game-card">
              <h4 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 900, color: '#F4F6FA' }}>
                Full Division Rankings
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }} className="arena-stagger">
                {leaders.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      borderRadius: '12px',
                      background: p.id === currentUser?.id ? 'rgba(40, 100, 217, 0.2)' : 'rgba(0, 0, 0, 0.25)',
                      border: p.id === currentUser?.id ? '1px solid #438BFF' : '1px solid var(--sports-border)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <span style={{
                        fontWeight: 900,
                        minWidth: '2.5ch',
                        fontSize: '1rem',
                        color: idx === 0 ? '#F3B94F' : idx === 1 ? '#CBD5E1' : idx === 2 ? '#D97706' : '#8995A8'
                      }}>
                        #{idx + 1}
                      </span>
                      <AvatarFrame avatar={p.avatar || '👤'} level={p.level || 1} rank="Player" size={38} />
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: '0.92rem', color: '#F4F6FA', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.username} {p.id === currentUser?.id ? '(You)' : ''}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#8995A8' }}>
                          {p.wins || 0} Wins • {p.winRate || 0}% Win Rate
                        </span>
                      </div>
                    </div>

                    <div className="sports-coin-pill" style={{ padding: '4px 10px', fontSize: '0.84rem', flexShrink: 0 }}>
                      <CoinIcon size={14} />
                      <span>{(p.coins || 0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
