/**
 * src/screens/ProfileScreen.jsx
 *
 * Player Passport & Account Management Screen.
 * - Real session data from /api/users/profile, /api/wallet/transactions, /api/matches/history
 * - Honest database/connectivity status indicator from /api/health/db
 * - Account sign-in / registration / avatar & display-name persistence
 * - Zero fake hardcoded stats or fake transaction history
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AvatarFrame, TrophyGraphic, CoinIcon } from '../components/SportsGraphics.jsx';

export function ProfileScreen({
  currentUser = null,
  coins = 500,
  onUpdateProfile = null,
  onLogin = null,
  onRegister = null,
  onBack = null
}) {
  const [profileData, setProfileData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [tournamentHistory, setTournamentHistory] = useState([]);
  const [dbHealth, setDbHealth] = useState(null);
  const [activeTab, setActiveTab] = useState('history');

  const [displayNameInput, setDisplayNameInput] = useState(currentUser?.username || currentUser?.name || '');
  const [authMode, setAuthMode] = useState('none'); // 'none' | 'login' | 'register'
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const avatars = ['🦊', '🦁', '⚡', '👑', '🛡️', '🎯', '🐅', '💎'];

  const loadPassportData = useCallback(() => {
    const uid = currentUser?.id;
    if (!uid) return;

    fetch(`/api/users/profile?id=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          setProfileData(d.user);
          setDisplayNameInput(d.user.profile?.displayName || d.user.username || '');
        }
      })
      .catch(() => {});

    fetch(`/api/wallet/transactions?userId=${encodeURIComponent(uid)}&limit=15`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.transactions)) {
          setTransactions(d.transactions);
        }
      })
      .catch(() => {});

    fetch(`/api/matches/history?userId=${encodeURIComponent(uid)}&limit=15`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.history)) {
          setMatchHistory(d.history);
        }
      })
      .catch(() => {});

    fetch(`/api/tournaments/history?userId=${encodeURIComponent(uid)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.history)) {
          setTournamentHistory(d.history);
        }
      })
      .catch(() => {});

    fetch('/api/health/db')
      .then(r => r.json())
      .then(d => setDbHealth(d))
      .catch(() => setDbHealth({ connected: false, status: 'offline_fallback' }));
  }, [currentUser?.id]);

  useEffect(() => {
    loadPassportData();
  }, [loadPassportData]);

  const userName = profileData?.profile?.displayName || currentUser?.username || currentUser?.name || 'Player';
  const userAvatar = profileData?.avatar || currentUser?.avatar || '🦊';
  const userLevel = profileData?.profile?.level || currentUser?.level || 1;
  const stats = profileData?.stats || { matchesPlayed: 0, matchesWon: 0, winRate: 0 };
  const matchesPlayed = stats.matchesPlayed || 0;
  const matchesWon = stats.matchesWon || 0;
  const matchesLost = Math.max(0, matchesPlayed - matchesWon);
  const winRate = stats.winRate ?? (matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : 0);
  const championWins = tournamentHistory.filter(t => t.champion?.id === currentUser?.id).length;
  const earnedAchievements = [
    { id: 'first-match', icon: '🎯', title: 'Arena Debut', desc: 'Complete 1 Bingo match', unlocked: matchesPlayed >= 1 },
    { id: 'first-win', icon: '⚡', title: 'First Victory', desc: 'Win your first verified Bingo match', unlocked: matchesWon >= 1 },
    { id: 'streak-5', icon: '🔥', title: 'Season Contender', desc: 'Play 5 competitive matches', unlocked: matchesPlayed >= 5 },
    { id: 'tourn-champ', icon: '👑', title: 'IPL Champion', desc: 'Win an official tournament trophy', unlocked: championWins >= 1 }
  ];

  const handleSaveName = async () => {
    const trimmed = displayNameInput.trim();
    if (!trimmed) return;
    setBusy(true);
    setStatusFeedback(null);
    try {
      await onUpdateProfile?.({ displayName: trimmed, avatar: userAvatar });
      setStatusFeedback('✓ Profile name updated.');
      loadPassportData();
    } catch (err) {
      setStatusFeedback(`⚠️ ${err?.message || 'Could not update profile.'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleSelectAvatar = async (av) => {
    setBusy(true);
    setStatusFeedback(null);
    try {
      await onUpdateProfile?.({ avatar: av });
      setStatusFeedback('✓ Avatar updated.');
      loadPassportData();
    } catch (err) {
      setStatusFeedback(`⚠️ ${err?.message || 'Could not save avatar.'}`);
    } finally {
      setBusy(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatusFeedback(null);
    try {
      if (authMode === 'login') {
        await onLogin?.({ username: authUsername.trim(), password: authPassword });
        setStatusFeedback('✓ Signed in successfully!');
      } else if (authMode === 'register') {
        await onRegister?.({ username: authUsername.trim(), email: authEmail.trim() || undefined, password: authPassword, avatar: userAvatar });
        setStatusFeedback('✓ Registered & signed in!');
      }
      setAuthMode('none');
      setAuthPassword('');
      loadPassportData();
    } catch (err) {
      setStatusFeedback(`⚠️ ${err?.message || 'Authentication failed.'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="screen-profile" className="screen-view">
      <div className="back-nav-bar">
        <button type="button" className="btn-back-nav" onClick={onBack}>
          <span className="back-arrow">←</span> Home
        </button>
        <span className="page-header-badge">Player Passport</span>
      </div>

      <div className="screen-scrollable sports-home-container">
        {statusFeedback && (
          <div className="game-card" style={{ padding: '10px 14px', borderColor: statusFeedback.startsWith('⚠️') ? '#E6535D' : '#32B879', color: statusFeedback.startsWith('⚠️') ? '#FCA5A5' : '#86EFAC' }}>
            {statusFeedback}
          </div>
        )}

        {/* 1. PROFILE IDENTITY CARD */}
        <div className="game-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <AvatarFrame
            avatar={userAvatar}
            level={userLevel}
            rank={currentUser?.isGuest ? 'Guest' : 'Registered'}
            size={80}
          />

          <div>
            <h3 style={{ margin: '4px 0 2px', fontSize: '1.35rem', fontWeight: 900, color: '#F4F6FA' }}>
              {userName}
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#8995A8', fontWeight: 700 }}>
              Lv. {userLevel} • 🪙 {(profileData?.wallet?.balance ?? coins).toLocaleString()} Coins
            </span>
          </div>

          {/* Display Name Editor */}
          <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '340px' }}>
            <input
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="Display name"
              style={{ flex: 1, padding: '8px 12px', borderRadius: '10px', background: '#0C1422', color: '#F4F6FA', border: '1px solid var(--sports-border)' }}
            />
            <button type="button" className="btn-tactile btn-primary" disabled={busy} onClick={handleSaveName} style={{ padding: '8px 14px' }}>
              Save
            </button>
          </div>

          {/* Avatar Selector */}
          <div style={{ width: '100%' }}>
            <span style={{ fontSize: '0.78rem', color: '#8995A8', display: 'block', marginBottom: '8px' }}>
              Choose Battle Avatar:
            </span>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {avatars.map(av => (
                <button
                  key={av}
                  type="button"
                  onClick={() => handleSelectAvatar(av)}
                  style={{
                    fontSize: '1.35rem',
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: userAvatar === av ? '2px solid #438BFF' : '1px solid var(--sports-border)',
                    background: userAvatar === av ? 'rgba(40, 100, 217, 0.25)' : 'rgba(0, 0, 0, 0.25)',
                    cursor: 'pointer'
                  }}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Account Actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', width: '100%', paddingTop: '6px' }}>
            <button type="button" className="btn-tactile btn-secondary" onClick={() => setAuthMode(authMode === 'login' ? 'none' : 'login')} style={{ minHeight: '38px', padding: '6px 14px', fontSize: '0.84rem' }}>
              🔑 Sign In
            </button>
            <button type="button" className="btn-tactile btn-primary" onClick={() => setAuthMode(authMode === 'register' ? 'none' : 'register')} style={{ minHeight: '38px', padding: '6px 14px', fontSize: '0.84rem' }}>
              ➕ Register Account
            </button>
          </div>

          {authMode !== 'none' && (
            <form onSubmit={handleAuthSubmit} style={{ width: '100%', maxWidth: '340px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', textAlign: 'left' }}>
              <input
                type="text"
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="Username"
                style={{ padding: '9px 12px', borderRadius: '10px', background: '#0C1422', color: '#F4F6FA', border: '1px solid var(--sports-border)' }}
              />
              {authMode === 'register' && (
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email (optional)"
                  style={{ padding: '9px 12px', borderRadius: '10px', background: '#0C1422', color: '#F4F6FA', border: '1px solid var(--sports-border)' }}
                />
              )}
              <input
                type="password"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                style={{ padding: '9px 12px', borderRadius: '10px', background: '#0C1422', color: '#F4F6FA', border: '1px solid var(--sports-border)' }}
              />
              <button type="submit" disabled={busy} className="btn-tactile btn-mint" style={{ minHeight: '42px' }}>
                {busy ? 'Please wait...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          )}
        </div>

        {/* 2. REAL CAREER STATISTICS GRID */}
        <div className="game-card">
          <h4 style={{ margin: '0 0 14px', fontSize: '1.05rem', fontWeight: 900, color: 'var(--sports-white)' }}>
            Career Match Statistics
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px' }}>
            <div style={{ padding: '14px 8px', background: 'rgba(15, 23, 42, 0.45)', borderRadius: '12px', border: '1px solid var(--sports-border)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--sports-slate)', textTransform: 'uppercase', fontWeight: 700 }}>Matches</span>
              <strong style={{ display: 'block', fontSize: '1.35rem', fontWeight: 900, color: 'var(--sports-white)', marginTop: '2px' }}>
                {matchesPlayed}
              </strong>
            </div>

            <div style={{ padding: '14px 8px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#34D399', textTransform: 'uppercase', fontWeight: 700 }}>Wins</span>
              <strong style={{ display: 'block', fontSize: '1.35rem', fontWeight: 900, color: '#34D399', marginTop: '2px' }}>
                {matchesWon}
              </strong>
            </div>

            <div style={{ padding: '14px 8px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#FCA5A5', textTransform: 'uppercase', fontWeight: 700 }}>Losses</span>
              <strong style={{ display: 'block', fontSize: '1.35rem', fontWeight: 900, color: '#FCA5A5', marginTop: '2px' }}>
                {matchesLost}
              </strong>
            </div>

            <div style={{ padding: '14px 8px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)', textAlign: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#FBBF24', textTransform: 'uppercase', fontWeight: 700 }}>Win %</span>
              <strong style={{ display: 'block', fontSize: '1.35rem', fontWeight: 900, color: '#FBBF24', marginTop: '2px' }}>
                {winRate}%
              </strong>
            </div>
          </div>
        </div>

        {/* 2B. VERIFIED ACHIEVEMENTS */}
        <div className="game-card">
          <h4 style={{ margin: '0 0 12px', fontSize: '1.05rem', fontWeight: 900, color: 'var(--sports-white)' }}>
            🏅 Achievements ({earnedAchievements.filter(a => a.unlocked).length}/{earnedAchievements.length})
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
            {earnedAchievements.map(ach => (
              <div
                key={ach.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  background: ach.unlocked ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 23, 42, 0.35)',
                  border: `1px solid ${ach.unlocked ? 'rgba(245, 158, 11, 0.45)' : 'var(--sports-border)'}`,
                  opacity: ach.unlocked ? 1 : 0.65
                }}
              >
                <span style={{ fontSize: '1.45rem' }}>{ach.unlocked ? ach.icon : '🔒'}</span>
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: '0.84rem', color: 'var(--sports-white)' }}>{ach.title}</strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--sports-slate)' }}>{ach.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. SYSTEM & DATABASE HEALTH CARD (Honest status) */}
        <div className="game-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrophyGraphic size={36} />
            <div>
              <strong style={{ display: 'block', fontSize: '0.9rem', color: '#F4F6FA' }}>Backend & Persistence Status</strong>
              <span style={{ fontSize: '0.76rem', color: '#8995A8' }}>
                {dbHealth?.connected
                  ? 'PostgreSQL + Prisma Connected'
                  : 'Offline Fallback Active (PostgreSQL Offline)'}
              </span>
            </div>
          </div>
          <span style={{
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.74rem',
            fontWeight: 800,
            background: dbHealth?.connected ? 'rgba(50, 184, 121, 0.15)' : 'rgba(243, 185, 79, 0.15)',
            border: `1px solid ${dbHealth?.connected ? '#32B879' : '#F3B94F'}`,
            color: dbHealth?.connected ? '#32B879' : '#F3B94F'
          }}>
            {dbHealth?.connected ? '● DB Online' : '● Fallback Mode'}
          </span>
        </div>

        {/* 4. REAL HISTORY / TOURNAMENTS / TRANSACTIONS TABS */}
        <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-tactile"
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              minWidth: '110px',
              minHeight: '40px',
              borderRadius: '9999px',
              border: activeTab === 'history' ? '1px solid #60A5FA' : '1px solid var(--sports-border)',
              background: activeTab === 'history' ? 'var(--sports-royal)' : 'rgba(23, 36, 58, 0.6)',
              color: '#F8FAFC',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Matches ({matchHistory.length})
          </button>
          <button
            type="button"
            className="btn-tactile"
            onClick={() => setActiveTab('tournaments')}
            style={{
              flex: 1,
              minWidth: '110px',
              minHeight: '40px',
              borderRadius: '9999px',
              border: activeTab === 'tournaments' ? '1px solid #60A5FA' : '1px solid var(--sports-border)',
              background: activeTab === 'tournaments' ? 'var(--sports-royal)' : 'rgba(23, 36, 58, 0.6)',
              color: '#F8FAFC',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Tournaments ({tournamentHistory.length})
          </button>
          <button
            type="button"
            className="btn-tactile"
            onClick={() => setActiveTab('transactions')}
            style={{
              flex: 1,
              minWidth: '110px',
              minHeight: '40px',
              borderRadius: '9999px',
              border: activeTab === 'transactions' ? '1px solid #60A5FA' : '1px solid var(--sports-border)',
              background: activeTab === 'transactions' ? 'var(--sports-royal)' : 'rgba(23, 36, 58, 0.6)',
              color: '#F8FAFC',
              fontWeight: 800,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Coin Ledger ({transactions.length})
          </button>
        </div>

        <div className="game-card">
          {activeTab === 'history' ? (
            matchHistory.length === 0 ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--sports-slate)', fontSize: '0.86rem' }}>
                No completed matches recorded yet for this player.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {matchHistory.map((m, idx) => (
                  <div key={m.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.45)', borderRadius: '10px' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--sports-white)' }}>
                        {m.result === 'WIN' ? '🏆 Victory' : 'Match'} vs {m.opponentName || 'Opponent'}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--sports-slate)' }}>
                        {m.mode || 'MULTIPLAYER'} • {m.linesCompleted || 0} lines
                      </span>
                    </div>
                    <strong style={{ color: m.result === 'WIN' ? '#34D399' : '#F87171', fontSize: '0.85rem' }}>
                      {m.result || 'COMPLETED'}
                    </strong>
                  </div>
                ))}
              </div>
            )
          ) : activeTab === 'tournaments' ? (
            tournamentHistory.length === 0 ? (
              <p style={{ margin: 0, textAlign: 'center', color: 'var(--sports-slate)', fontSize: '0.86rem' }}>
                No completed tournaments in archive yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {tournamentHistory.map((t, idx) => (
                  <div key={t.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(15, 23, 42, 0.45)', borderRadius: '10px' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.88rem', color: 'var(--sports-white)' }}>
                        {t.logo || '🏆'} {t.name}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#FBBF24' }}>
                        👑 Champion: {t.champion?.name || 'Verified Winner'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.76rem', color: '#34D399', fontWeight: 800 }}>
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : transactions.length === 0 ? (
            <p style={{ margin: 0, textAlign: 'center', color: '#8995A8', fontSize: '0.86rem' }}>
              No coin transactions recorded yet.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {transactions.map(tx => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'rgba(0, 0, 0, 0.25)',
                    borderRadius: '10px'
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '0.88rem', color: '#F4F6FA', display: 'block' }}>
                      {tx.description || tx.type}
                    </strong>
                    <span style={{ fontSize: '0.72rem', color: '#8995A8' }}>
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleString() : 'Recent'}
                    </span>
                  </div>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 900,
                    fontSize: '0.9rem',
                    color: tx.amount > 0 ? '#32B879' : '#E6535D'
                  }}>
                    <CoinIcon size={15} />
                    <span>{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
