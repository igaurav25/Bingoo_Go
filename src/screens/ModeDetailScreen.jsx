/**
 * src/screens/ModeDetailScreen.jsx
 *
 * Dedicated Mode Screen supporting all 13 Bingo Game Modes:
 * - Quick Match uses real WebSocket matchmaking queue (with Cancel & honest timeout)
 * - Private Room uses real WebSocket create_room / join_room with loading & error states
 * - Friend Challenge loads live directory from /api/users/directory & WebSocket presence
 * - Preserves data-back="modes-hub" back target for navigation audit
 */

import React, { useState, useEffect } from 'react';
import { ALL_GAME_MODES } from './ModesHubScreen.jsx';

export function ModeDetailScreen({
  modeId = 'quick-match',
  currentUser = null,
  socket = null,
  onBack = null,
  onStartMatch = null,
  onCreateRoom = null,
  onJoinRoom = null,
  onLaunchPractice = null,
  onNavigateToTournaments = null
}) {
  const mode = ALL_GAME_MODES.find(m => m.id === modeId) || ALL_GAME_MODES[0];

  const [queueStatus, setQueueStatus] = useState('idle'); // 'idle' | 'searching' | 'found' | 'timeout'
  const [queueMessage, setQueueMessage] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState('tactical');
  const [privateTab, setPrivateTab] = useState('create');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [turnTimerSeconds, setTurnTimerSeconds] = useState(30);
  const [seriesTargetWins, setSeriesTargetWins] = useState(1);
  const [roomBusy, setRoomBusy] = useState(false);
  const [roomError, setRoomError] = useState(null);

  const [offlineP1, setOfflineP1] = useState(currentUser?.name || 'Player 1');
  const [offlineP2, setOfflineP2] = useState('Player 2');
  const [selectedTeam, setSelectedTeam] = useState('blue');

  const [friendSearch, setFriendSearch] = useState('');
  const [playersDirectory, setPlayersDirectory] = useState([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [challengeStatus, setChallengeStatus] = useState(null);

  // Load real registered & online players when viewing Friend Challenge
  useEffect(() => {
    if (mode.id !== 'friend-challenge') return;
    setLoadingDirectory(true);
    const excludeId = currentUser?.id ? encodeURIComponent(currentUser.id) : '';
    fetch(`/api/users/directory?excludeUserId=${excludeId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.users)) {
          setPlayersDirectory(d.users);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDirectory(false));

    if (!socket) return;
    const unsub = socket.on('friends_list_data', (data) => {
      if (Array.isArray(data.friends)) {
        setPlayersDirectory(prev => {
          const map = new Map(prev.map(u => [u.id, u]));
          for (const f of data.friends) {
            map.set(f.id, { ...map.get(f.id), ...f, online: f.status === 'online' || f.isOnline });
          }
          return Array.from(map.values());
        });
      }
    });
    const unsubSent = socket.on('challenge_sent', () => {
      setChallengeStatus('Challenge sent! Waiting for opponent to accept...');
    });
    const unsubErr = socket.on('error', (err) => {
      setChallengeStatus(`⚠️ ${err.message || 'Challenge could not be delivered.'}`);
    });
    socket.send('get_friends_list', { playerId: currentUser?.id });
    return () => {
      unsub();
      unsubSent();
      unsubErr();
    };
  }, [mode.id, currentUser?.id, socket]);

  // Quick Match queue event listeners
  useEffect(() => {
    if (mode.id !== 'quick-match' || !socket) return;

    const unsubQueued = socket.on('quick_match_queued', (data) => {
      setQueueStatus('searching');
      setQueueMessage(`Searching live opponent pool (Queue #${data.position || 1})...`);
    });
    const unsubTimeout = socket.on('matchmaking_timeout', (data) => {
      setQueueStatus('timeout');
      setQueueMessage(data.message || 'No live opponent joined within 25s.');
    });
    const unsubCancel = socket.on('quick_match_cancelled', () => {
      setQueueStatus('idle');
      setQueueMessage('');
    });
    const unsubFound = socket.on('quick_match_found', () => {
      setQueueStatus('found');
    });

    return () => {
      unsubQueued();
      unsubTimeout();
      unsubCancel();
      unsubFound();
      socket.send('cancel_quick_match', {});
    };
  }, [mode.id, socket]);

  const handleStartQuickMatchSearch = async () => {
    setQueueStatus('searching');
    setQueueMessage('Connecting to real-time matchmaking queue...');
    if (socket) {
      await socket.connect();
      socket.send('find_quick_match', {
        playerId: currentUser?.id,
        name: currentUser?.username || currentUser?.name,
        avatar: currentUser?.avatar,
        turnTimerSeconds: 30,
        seriesTargetWins: 1
      });
    } else {
      setQueueStatus('timeout');
      setQueueMessage('WebSocket offline. Launch Practice vs Bot below.');
    }
  };

  const handleCancelQuickMatch = () => {
    socket?.send('cancel_quick_match', {});
    setQueueStatus('idle');
    setQueueMessage('');
  };

  const handleCreatePrivateRoom = async () => {
    setRoomBusy(true);
    setRoomError(null);
    try {
      await onCreateRoom({ turnTimerSeconds, seriesTargetWins });
    } catch (err) {
      setRoomError(err?.message || 'Unable to create private room.');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleJoinPrivateRoom = async () => {
    const clean = roomCodeInput.trim().toUpperCase();
    if (clean.length !== 5) {
      setRoomError('Please enter a complete 5-character room code.');
      return;
    }
    setRoomBusy(true);
    setRoomError(null);
    try {
      await onJoinRoom(clean);
    } catch (err) {
      setRoomError(err?.message || 'Unable to join room.');
    } finally {
      setRoomBusy(false);
    }
  };

  const handleLaunchLocalMode = () => {
    if (mode.category === 'tournaments') {
      onNavigateToTournaments && onNavigateToTournaments();
      return;
    }
    onStartMatch && onStartMatch({
      mode: mode.id,
      initialMode: mode.id,
      title: mode.title,
      aiDifficulty,
      offlineP1,
      offlineP2,
      team: selectedTeam,
      turnDuration: mode.id === 'time-challenge' ? 15 : 30
    });
  };

  const handleSendChallenge = (targetUser) => {
    if (!socket) return;
    setChallengeStatus(`Sending duel invite to ${targetUser.username || targetUser.name}...`);
    socket.send('send_challenge', {
      fromId: currentUser?.id,
      fromName: currentUser?.username || currentUser?.name,
      fromAvatar: currentUser?.avatar,
      targetFriendId: targetUser.id
    });
  };

  return (
    <section id={`screen-mode-${mode.id}`} className="screen-view">
      <div className="back-nav-bar">
        <button
          type="button"
          className="btn-back-nav"
          data-back="modes-hub"
          onClick={onBack}
        >
          <span className="back-arrow">←</span> Modes
        </button>
        <span className="page-header-badge">{mode.modeNumber}</span>
      </div>

      <div className="screen-scrollable sports-home-container">
        <div className="mode-detail-banner" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '2.4rem', width: '54px', height: '54px', borderRadius: '16px', background: mode.badgeBg, color: mode.badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {mode.icon}
            </div>
            <div>
              <span className="mode-req-pill" style={{ display: 'inline-block', marginBottom: '4px' }}>{mode.reqPill}</span>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 800 }}>{mode.title}</h2>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{mode.desc}</p>
            </div>
          </div>
        </div>

        {/* 1. QUICK MATCH (Real WebSocket Queue) */}
        {mode.id === 'quick-match' && (
          <div className="game-card" style={{ textAlign: 'center', padding: '24px 16px' }}>
            <div style={{ position: 'relative', width: '76px', height: '76px', margin: '0 auto 14px' }}>
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'rgba(23, 105, 224, 0.12)', border: '2px solid #438BFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                ⚡
              </div>
              {queueStatus === 'searching' && (
                <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2px dashed #438BFF', animation: 'spin 3s linear infinite' }} />
              )}
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: '1.15rem', fontWeight: 800 }}>
              {queueStatus === 'searching'
                ? 'Searching for Live Player...'
                : queueStatus === 'timeout'
                  ? 'No Live Opponent Found Yet'
                  : '1v1 Live Quick Match'}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 18px' }}>
              {queueMessage || 'Match against another real connected player waiting in queue.'}
            </p>

            {queueStatus === 'searching' ? (
              <button
                type="button"
                className="btn-tactile btn-danger btn-cta"
                onClick={handleCancelQuickMatch}
                style={{ width: '100%', minHeight: '46px' }}
              >
                ✕ Cancel Search
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-tactile btn-primary btn-cta"
                  onClick={handleStartQuickMatchSearch}
                  style={{ width: '100%', fontSize: '1.05rem', minHeight: '48px' }}
                >
                  <span>⚡</span> Find Online Opponent
                </button>
                <button
                  type="button"
                  className="btn-tactile btn-secondary"
                  onClick={() => onLaunchPractice ? onLaunchPractice() : onStartMatch({ mode: 'practice', initialMode: 'practice' })}
                  style={{ width: '100%', minHeight: '42px', fontSize: '0.9rem' }}
                >
                  🤖 Practice vs AI Instead
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. PRIVATE ROOM (Real WebSocket Create / Join) */}
        {mode.id === 'private-room' && (
          <div className="game-card">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`select-chip ${privateTab === 'create' ? 'active' : ''}`}
                onClick={() => { setPrivateTab('create'); setRoomError(null); }}
                style={{ flex: 1, minHeight: '42px' }}
              >
                ➕ Create Room
              </button>
              <button
                type="button"
                className={`select-chip ${privateTab === 'join' ? 'active' : ''}`}
                onClick={() => { setPrivateTab('join'); setRoomError(null); }}
                style={{ flex: 1, minHeight: '42px' }}
              >
                🔑 Join Room
              </button>
            </div>

            {roomError && (
              <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(230, 83, 93, 0.15)', border: '1px solid #E6535D', color: '#FCA5A5', marginBottom: '12px', fontSize: '0.84rem' }}>
                ⚠️ {roomError}
              </div>
            )}

            {privateTab === 'create' ? (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Turn Timer
                    </label>
                    <select
                      value={turnTimerSeconds}
                      onChange={(e) => setTurnTimerSeconds(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#0C1422', color: '#F4F6FA', border: '1px solid var(--border-color)' }}
                    >
                      <option value={0}>Unlimited</option>
                      <option value={20}>20s Fast</option>
                      <option value={30}>30s Standard</option>
                      <option value={45}>45s Relaxed</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Series Format
                    </label>
                    <select
                      value={seriesTargetWins}
                      onChange={(e) => setSeriesTargetWins(Number(e.target.value))}
                      style={{ width: '100%', padding: '10px', borderRadius: '10px', background: '#0C1422', color: '#F4F6FA', border: '1px solid var(--border-color)' }}
                    >
                      <option value={1}>Single Match</option>
                      <option value={2}>Best of 3</option>
                      <option value={3}>Best of 5</option>
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-tactile btn-primary btn-cta"
                  disabled={roomBusy}
                  onClick={handleCreatePrivateRoom}
                  style={{ width: '100%', minHeight: '46px' }}
                >
                  {roomBusy ? '⏳ Creating Room...' : '🚀 Create Private Room'}
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                  Enter 5-Character Room Code (no vowels/0/1/L):
                </label>
                <input
                  type="text"
                  maxLength={5}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. B4K8M"
                  style={{ width: '100%', padding: '12px', fontSize: '1.4rem', textAlign: 'center', fontFamily: 'var(--font-sports-mono, monospace)', fontWeight: 800, borderRadius: '12px', border: '2px solid var(--border-color)', background: '#0C1422', color: '#F4F6FA', marginBottom: '14px', letterSpacing: '4px' }}
                />
                <button
                  type="button"
                  className="btn-tactile btn-primary btn-cta"
                  disabled={roomBusy || roomCodeInput.trim().length !== 5}
                  onClick={handleJoinPrivateRoom}
                  style={{ width: '100%', minHeight: '46px' }}
                >
                  {roomBusy ? '⏳ Joining...' : 'Join Room Now →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. 2v2 TEAM BATTLE */}
        {mode.id === 'team-2v2' && (
          <div className="game-card">
            <h4 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 800 }}>Select Your Team</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <button
                type="button"
                className={`select-chip ${selectedTeam === 'blue' ? 'active' : ''}`}
                onClick={() => setSelectedTeam('blue')}
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ fontSize: '1.8rem' }}>🔵</span>
                <strong>Team Blue</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Shared Line Sync</span>
              </button>
              <button
                type="button"
                className={`select-chip ${selectedTeam === 'orange' ? 'active' : ''}`}
                onClick={() => setSelectedTeam('orange')}
                style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
              >
                <span style={{ fontSize: '1.8rem' }}>🟠</span>
                <strong>Team Orange</strong>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Shared Line Sync</span>
              </button>
            </div>
            <button
              type="button"
              className="btn-tactile btn-mint btn-cta"
              onClick={handleCreatePrivateRoom}
              style={{ width: '100%', minHeight: '46px' }}
            >
              <span>🛡️</span> Create Team Arena Room
            </button>
          </div>
        )}

        {/* 4. FRIEND CHALLENGE (Live Directory, No Mock Players) */}
        {mode.id === 'friend-challenge' && (
          <div className="game-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '8px', flexWrap: 'wrap' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Registered & Online Players</h4>
              <input
                type="text"
                placeholder="🔍 Search player..."
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#0C1422', color: '#F4F6FA', maxWidth: '160px' }}
              />
            </div>

            {challengeStatus && (
              <div style={{ padding: '8px 12px', borderRadius: '10px', background: 'rgba(67, 139, 255, 0.15)', border: '1px solid #438BFF', fontSize: '0.82rem', marginBottom: '10px' }}>
                {challengeStatus}
              </div>
            )}

            {loadingDirectory ? (
              <p style={{ color: '#8995A8', textAlign: 'center', padding: '16px' }}>Loading online players...</p>
            ) : playersDirectory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '18px', background: 'rgba(12, 20, 34, 0.5)', borderRadius: '12px' }}>
                <p style={{ margin: '0 0 12px', color: '#8995A8', fontSize: '0.85rem' }}>
                  No other registered friends are online right now. Create a Private Room and share the 5-character code!
                </p>
                <button type="button" className="btn-tactile btn-primary" onClick={handleCreatePrivateRoom} style={{ minHeight: '42px' }}>
                  ➕ Create Private Room Instead
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {playersDirectory
                  .filter(f => !friendSearch || (f.username || f.name || '').toLowerCase().includes(friendSearch.toLowerCase()))
                  .map(friend => (
                    <div key={friend.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(12, 20, 34, 0.6)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.25rem' }}>{friend.avatar || '🦊'}</span>
                        <div>
                          <strong style={{ fontSize: '0.88rem', display: 'block', color: '#F4F6FA' }}>{friend.username || friend.name}</strong>
                          <span style={{ fontSize: '0.7rem', color: friend.online ? '#32B879' : '#8995A8' }}>
                            ● {friend.online ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-tactile btn-primary btn-sm"
                        onClick={() => handleSendChallenge(friend)}
                      >
                        Challenge ⚔️
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* 7. PRACTICE MODE */}
        {mode.id === 'practice' && (
          <div className="game-card">
            <h4 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 800 }}>AI Bot Difficulty</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {[
                { id: 'casual', label: 'Casual', sub: 'Relaxed' },
                { id: 'tactical', label: 'Tactical', sub: 'Standard' },
                { id: 'grandmaster', label: 'Master', sub: 'Focused' }
              ].map(d => (
                <button
                  key={d.id}
                  type="button"
                  className={`select-chip ${aiDifficulty === d.id ? 'active' : ''}`}
                  onClick={() => setAiDifficulty(d.id)}
                  style={{ padding: '10px 6px', textAlign: 'center' }}
                >
                  <strong style={{ display: 'block', fontSize: '0.85rem' }}>{d.label}</strong>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>{d.sub}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn-tactile btn-primary btn-cta"
              onClick={handleLaunchLocalMode}
              style={{ width: '100%', minHeight: '46px' }}
            >
              <span>🤖</span> Launch Practice Duel
            </button>
          </div>
        )}

        {/* 8. OFFLINE PASS & PLAY */}
        {mode.id === 'offline' && (
          <div className="game-card">
            <h4 style={{ margin: '0 0 10px', fontSize: '1rem', fontWeight: 800 }}>Pass & Play on One Device</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Player 1 Name</label>
                <input
                  type="text"
                  value={offlineP1}
                  onChange={(e) => setOfflineP1(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#0C1422', color: '#F4F6FA' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Player 2 Name</label>
                <input
                  type="text"
                  value={offlineP2}
                  onChange={(e) => setOfflineP2(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', background: '#0C1422', color: '#F4F6FA' }}
                />
              </div>
            </div>
            <button
              type="button"
              className="btn-tactile btn-primary btn-cta"
              onClick={handleLaunchLocalMode}
              style={{ width: '100%', minHeight: '46px' }}
            >
              <span>📱</span> Start Pass & Play Match
            </button>
          </div>
        )}

        {/* 9. SURVIVAL MODE */}
        {mode.id === 'survival' && (
          <div className="game-card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>❤️❤️❤️</div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800 }}>Survival Challenge</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              You start with 3 heart lives. If your turn clock expires before calling, you lose a life!
            </p>
            <button
              type="button"
              className="btn-tactile btn-danger btn-cta"
              onClick={handleLaunchLocalMode}
              style={{ width: '100%', minHeight: '46px' }}
            >
              <span>❤️</span> Begin Survival Run
            </button>
          </div>
        )}

        {/* 10. TIME CHALLENGE */}
        {mode.id === 'time-challenge' && (
          <div className="game-card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>⏱️</div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800 }}>15-Second Blitz</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Lightning turn clock: only 15 seconds per call! Beat the Blitz AI before the timer runs out.
            </p>
            <button
              type="button"
              className="btn-tactile btn-amber btn-cta"
              onClick={handleLaunchLocalMode}
              style={{ width: '100%', minHeight: '46px' }}
            >
              <span>⚡</span> Start Blitz Run
            </button>
          </div>
        )}

        {/* TOURNAMENTS (Modes 5, 6, 11, 12, 13) */}
        {mode.category === 'tournaments' && (
          <div className="game-card" style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '6px' }}>🏆</div>
            <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 800 }}>Official Tournament Arena</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              Enter the competitive tournament section to register, review fixtures, check standings, and play bracket matches!
            </p>
            <button
              type="button"
              className="btn-tactile btn-gold btn-cta"
              onClick={onNavigateToTournaments}
              style={{ width: '100%', minHeight: '46px' }}
            >
              <span>🏆</span> Open Tournament Section →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
