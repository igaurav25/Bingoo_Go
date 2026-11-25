/**
 * src/App.jsx
 *
 * Master React Application Component for Bingoo Goo.
 * - Real guest/account session initialization via socketClient (/api/auth/guest, /api/auth/me)
 * - Persistent WebSocket room create/join/lobby/arranging/gameplay/rematch flows
 * - Real Quick Match matchmaking queue & Friend Challenge notifications
 * - Authoritative Tournament Match launch (POST /api/tournaments/:id/matches/:matchId/start -> join_room)
 * - Full URL routing + reload recovery on /, /r/:code, /modes/*, /tournaments/*, /leaderboard, /profile, /game
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.jsx';
import { BottomNav } from './components/BottomNav.jsx';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { ModesHubScreen } from './screens/ModesHubScreen.jsx';
import { ModeDetailScreen } from './screens/ModeDetailScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { LeaderboardScreen } from './screens/LeaderboardScreen.jsx';
import { ProfileScreen } from './screens/ProfileScreen.jsx';
import { BingoGame } from './components/BingoGame.jsx';
import { TournamentRouter } from './tournaments/TournamentRouter.jsx';
import {
  SettingsModal,
  HowToPlayModal,
  DailyRewardModal,
  ExitConfirmModal
} from './components/Modals.jsx';

import { socketClient } from './services/socketClient.js';
import { soundManager } from '../public/js/audio.js';
import { ConfettiCelebration } from '../public/js/confetti.js';
import { initRain, setGraphicsQuality, getGraphicsQuality } from '../public/js/rain.js';

export function App() {
  const [screen, setScreen] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p.startsWith('/tournaments')) return 'tournaments';
      if (p.startsWith('/modes')) return 'modes-hub';
      if (p.startsWith('/leaderboard')) return 'leaderboard';
      if (p.startsWith('/profile')) return 'profile';
      if (p.startsWith('/r/')) return 'lobby';
      if (p === '/game') return 'game';
    }
    return 'home';
  });

  const [selectedModeId, setSelectedModeId] = useState('quick-match');
  const [activeRoomCode, setActiveRoomCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
      return match ? match[1].toUpperCase() : '';
    }
    return '';
  });

  // Authoritative Session & Wallet State
  const [currentUser, setCurrentUser] = useState({
    id: null,
    name: 'Player',
    username: 'Player',
    avatar: '🦊',
    level: 1,
    rank: 'Challenger',
    xp: 0,
    maxXp: 100,
    isGuest: true
  });
  const [coins, setCoins] = useState(500);
  const [dailyClaimed, setDailyClaimed] = useState(() => {
    try {
      return localStorage.getItem('bingo_daily_claimed') === new Date().toDateString();
    } catch {
      return false;
    }
  });

  // Live Multiplayer Room State
  const [roomState, setRoomState] = useState(null);
  const [lobbyError, setLobbyError] = useState(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [globalAlert, setGlobalAlert] = useState(null);

  // Match Config for <BingoGame />
  const [matchConfig, setMatchConfig] = useState({
    initialMode: 'practice',
    roomCode: null,
    turnDuration: 30
  });

  // Modals & Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showDailyModal, setShowDailyModal] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundManager.isMuted);
  const [musicEnabled, setMusicEnabled] = useState(() => soundManager.musicEnabled);
  const [volume, setVolume] = useState(() => soundManager.volume);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('bingo_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [vibration, setVibration] = useState(() => soundManager.vibrationEnabled);
  const [quality, setQuality] = useState(() => getGraphicsQuality());
  const [confetti, setConfetti] = useState(null);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem('bingo_theme', theme);
      } catch {}
    }
  }, [theme]);

  useEffect(() => {
    const unsubConn = socketClient.on('connected', () => setWsConnected(true));
    const unsubDisc = socketClient.on('disconnected', () => setWsConnected(false));
    if (socketClient.ws && socketClient.ws.readyState === 1) {
      setWsConnected(true);
    }
    return () => {
      unsubConn();
      unsubDisc();
    };
  }, []);

  const navigateTo = useCallback((newScreen, path = null) => {
    setScreen(newScreen);
    if (typeof window !== 'undefined') {
      const targetPath = path || (
        newScreen === 'home' ? '/' :
        newScreen === 'modes-hub' ? '/modes' :
        newScreen === 'tournaments' ? '/tournaments' :
        newScreen === 'leaderboard' ? '/leaderboard' :
        newScreen === 'profile' ? '/profile' :
        newScreen === 'game' ? '/game' :
        newScreen === 'lobby' && activeRoomCode ? `/r/${activeRoomCode}` : '/'
      );
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ screen: newScreen }, '', targetPath);
      }
    }
  }, [activeRoomCode]);

  const applyUserRecord = useCallback((u) => {
    if (!u) return;
    const mapped = {
      id: u.id,
      username: u.username,
      name: u.profile?.displayName || u.username || 'Player',
      avatar: u.avatar || '🦊',
      level: u.profile?.level || 1,
      xp: u.profile?.currentXp || 0,
      maxXp: 100,
      rank: u.isGuest ? 'Challenger' : 'Competitor',
      isGuest: Boolean(u.isGuest)
    };
    setCurrentUser(mapped);
    if (u.wallet?.balance !== undefined) {
      setCoins(u.wallet.balance);
    }
    socketClient.setIdentity(mapped);
  }, []);

  // Initialize graphics, server auth session, and WebSocket connection on boot
  useEffect(() => {
    if (typeof document !== 'undefined') {
      initRain('rain');
      const cvs = document.getElementById('confetti-canvas');
      if (cvs) setConfetti(new ConfettiCelebration(cvs));
    }

    let cancelled = false;
    (async () => {
      const sessionUser = await socketClient.ensureSession();
      if (cancelled) return;
      if (sessionUser) {
        applyUserRecord(sessionUser);
      }
      await socketClient.connect();

      // If browser booted directly on /r/:code, auto-join room
      if (typeof window !== 'undefined') {
        const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9_-]+)$/);
        if (m) {
          const urlCode = m[1].toUpperCase();
          const saved = socketClient.getRoomSession();
          setActiveRoomCode(urlCode);
          setIsJoiningRoom(true);
          socketClient.send('join_room', {
            code: urlCode,
            playerId: sessionUser?.id || saved?.playerId,
            sessionToken: saved?.code === urlCode ? saved?.sessionToken : undefined,
            name: sessionUser?.profile?.displayName || sessionUser?.username || 'Guest',
            avatar: sessionUser?.avatar || '🦊'
          });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [applyUserRecord]);

  // Subscribe to core WebSocket room & matchmaking events
  useEffect(() => {
    const unsubs = [
      socketClient.on('room_created', (data) => {
        setLobbyError(null);
        setIsJoiningRoom(false);
        setActiveRoomCode(data.code);
        setRoomState(data.room);
        navigateTo('lobby', `/r/${data.code}`);
      }),
      socketClient.on('room_joined', (data) => {
        setLobbyError(null);
        setIsJoiningRoom(false);
        setActiveRoomCode(data.code);
        setRoomState(data.room);
        if (data.room?.status === 'arranging' || data.room?.status === 'playing') {
          setMatchConfig(prev => ({
            ...prev,
            initialMode: prev.initialMode === 'tournament' ? 'tournament' : 'room',
            roomCode: data.code
          }));
          navigateTo('game', '/game');
        } else {
          navigateTo('lobby', `/r/${data.code}`);
        }
      }),
      socketClient.on('quick_match_found', (data) => {
        setLobbyError(null);
        setActiveRoomCode(data.code);
        setRoomState(data.room);
        setMatchConfig({
          initialMode: 'quick-match',
          roomCode: data.code,
          turnDuration: data.room?.settings?.turnTimerSeconds || 30
        });
        soundManager.playPaperShuffle?.();
        navigateTo('game', '/game');
      }),
      socketClient.on('room_state', (data) => {
        if (!data.room) return;
        setRoomState(data.room);
        if (data.room.status === 'arranging' && screen === 'lobby') {
          setMatchConfig(prev => ({
            ...prev,
            initialMode: prev.initialMode === 'tournament' ? 'tournament' : 'room',
            roomCode: data.room.code,
            turnDuration: data.room.settings?.turnTimerSeconds || 30
          }));
          navigateTo('game', '/game');
        }
      }),
      socketClient.on('start_arranging', () => {
        if (screen === 'lobby') {
          setMatchConfig(prev => ({
            ...prev,
            initialMode: prev.initialMode === 'tournament' ? 'tournament' : 'room',
            roomCode: roomState?.code || activeRoomCode
          }));
          navigateTo('game', '/game');
        }
      }),
      socketClient.on('challenge_received', (data) => {
        if (data.challenge) setIncomingChallenge(data.challenge);
      }),
      socketClient.on('challenge_accepted', (data) => {
        setIncomingChallenge(null);
        if (data.roomCode) {
          setActiveRoomCode(data.roomCode);
          socketClient.send('join_room', {
            code: data.roomCode,
            playerId: currentUser.id,
            name: currentUser.name,
            avatar: currentUser.avatar
          });
        }
      }),
      socketClient.on('error', (data) => {
        setIsJoiningRoom(false);
        if (screen === 'lobby') {
          setLobbyError(data.message || 'Room error occurred.');
        } else if (screen !== 'game') {
          setGlobalAlert(data.message || 'Action could not be completed.');
          setTimeout(() => setGlobalAlert(null), 5000);
        }
      })
    ];

    return () => unsubs.forEach(fn => fn && fn());
  }, [screen, activeRoomCode, roomState?.code, currentUser.id, currentUser.name, currentUser.avatar, navigateTo]);

  // Browser back/forward sync
  useEffect(() => {
    const handlePop = () => {
      const p = window.location.pathname;
      if (p.startsWith('/tournaments')) setScreen('tournaments');
      else if (p.startsWith('/modes')) setScreen('modes-hub');
      else if (p.startsWith('/leaderboard')) setScreen('leaderboard');
      else if (p.startsWith('/profile')) setScreen('profile');
      else if (p.startsWith('/r/')) setScreen('lobby');
      else if (p === '/game') setScreen('game');
      else setScreen('home');
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  const handleCreatePrivateRoom = useCallback((settings = {}) => {
    return new Promise((resolve, reject) => {
      socketClient.connect().then((ok) => {
        if (!ok) {
          reject(new Error('WebSocket server unreachable.'));
          return;
        }
        const timer = setTimeout(() => {
          unsub();
          reject(new Error('Timed out waiting for server room creation.'));
        }, 6000);
        const unsub = socketClient.on('room_created', (data) => {
          clearTimeout(timer);
          unsub();
          resolve(data);
        });
        socketClient.send('create_room', {
          playerId: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          settings
        });
      });
    });
  }, [currentUser.id, currentUser.name, currentUser.avatar]);

  const handleJoinRoomByCode = useCallback((code) => {
    const clean = String(code || '').trim().toUpperCase();
    return new Promise((resolve, reject) => {
      setLobbyError(null);
      setIsJoiningRoom(true);
      socketClient.connect().then((ok) => {
        if (!ok) {
          setIsJoiningRoom(false);
          reject(new Error('WebSocket server unreachable.'));
          return;
        }
        const saved = socketClient.getRoomSession();
        const timer = setTimeout(() => {
          unsubOk();
          unsubErr();
          setIsJoiningRoom(false);
          reject(new Error('Timed out joining room.'));
        }, 6000);
        const unsubOk = socketClient.on('room_joined', (data) => {
          clearTimeout(timer);
          unsubOk();
          unsubErr();
          resolve(data);
        });
        const unsubErr = socketClient.on('error', (err) => {
          clearTimeout(timer);
          unsubOk();
          unsubErr();
          reject(new Error(err.message || 'Unable to join room.'));
        });
        socketClient.send('join_room', {
          code: clean,
          playerId: currentUser.id,
          sessionToken: saved?.code === clean ? saved?.sessionToken : undefined,
          name: currentUser.name,
          avatar: currentUser.avatar
        });
      });
    });
  }, [currentUser.id, currentUser.name, currentUser.avatar]);

  // Authoritative Tournament Match Launch: always obtains backend roomCode first!
  const handlePlayTournamentMatch = useCallback(async (match) => {
    const tId = match?.tournamentId;
    const mId = match?.id || match?.matchId;
    if (!tId || !mId) {
      setGlobalAlert('Missing tournament fixture identifiers.');
      return;
    }

    try {
      const data = await socketClient.apiFetch(`/api/tournaments/${encodeURIComponent(tId)}/matches/${encodeURIComponent(mId)}/start`, {
        method: 'POST',
        body: { playerId: currentUser.id }
      });

      if (!data.success || !data.roomCode) {
        throw new Error(data.error || 'Server refused to initialize tournament match room.');
      }

      setMatchConfig({
        initialMode: 'tournament',
        roomCode: data.roomCode,
        matchId: mId,
        tournamentId: tId,
        tournamentName: match.tournamentName || data.tournament?.name,
        roundTitle: match.roundTitle || match.round || 'Fixture'
      });

      await handleJoinRoomByCode(data.roomCode);
    } catch (err) {
      setGlobalAlert(`Tournament Match Start Failed: ${err.message}`);
      setTimeout(() => setGlobalAlert(null), 5000);
    }
  }, [currentUser.id, handleJoinRoomByCode]);

  const handleClaimDaily = useCallback(() => {
    if (dailyClaimed) return;
    socketClient.send('claim_daily_reward', { playerId: currentUser.id });
    setCoins(prev => prev + 100);
    setDailyClaimed(true);
    try {
      localStorage.setItem('bingo_daily_claimed', new Date().toDateString());
    } catch {}
    soundManager.playVictory?.();
    if (confetti) confetti.burst(60);
    setShowDailyModal(false);
  }, [dailyClaimed, confetti, currentUser.id]);

  const handleStartLocalMatch = useCallback((config = {}) => {
    setRoomState(null);
    setMatchConfig({
      initialMode: config.initialMode || config.mode || 'practice',
      roomCode: null,
      turnDuration: config.turnDuration || 30,
      offlineP1: config.offlineP1 || currentUser.name,
      offlineP2: config.offlineP2 || 'Player 2'
    });
    soundManager.playPaperShuffle?.();
    navigateTo('game', '/game');
  }, [navigateTo, currentUser.name]);

  const handleLeaveActiveMatchOrRoom = useCallback(() => {
    if (roomState?.code || activeRoomCode) {
      socketClient.send('leave_room', {});
      socketClient.saveRoomSession(null);
    }
    setRoomState(null);
    setActiveRoomCode('');
    setLobbyError(null);
    navigateTo('home', '/');
  }, [roomState?.code, activeRoomCode, navigateTo]);

  const handleUpdateProfile = useCallback(async ({ displayName, avatar }) => {
    if (!currentUser.id) return;
    await socketClient.apiFetch('/api/users/profile', {
      method: 'PUT',
      body: { userId: currentUser.id, displayName, avatar }
    });
    setCurrentUser(prev => {
      const updated = {
        ...prev,
        ...(displayName ? { name: displayName } : {}),
        ...(avatar ? { avatar } : {})
      };
      socketClient.saveAuthSession(socketClient.getAuthToken(), { ...updated, username: updated.username || updated.name });
      return updated;
    });
  }, [currentUser.id]);

  const isGameplay = screen === 'game';

  return (
    <div className={`app-container ${isGameplay ? 'gameplay-active' : ''}`} id="app-root">
      <Header
        coins={coins}
        currentUser={currentUser}
        wsConnected={wsConnected}
        isMuted={isMuted}
        unreadNotifications={dailyClaimed ? 0 : 1}
        onToggleMute={() => setIsMuted(soundManager.toggleMute())}
        onNavigateHome={() => navigateTo('home', '/')}
        onNavigateProfile={() => navigateTo('profile', '/profile')}
        onOpenNotifications={() => setShowDailyModal(true)}
        onOpenHowToPlay={() => setShowHowToPlay(true)}
        onOpenSettings={() => setShowSettings(true)}
        isGameplayActive={isGameplay}
      />

      {globalAlert && !isGameplay && (
        <div role="alert" style={{
          margin: '8px 16px 0',
          padding: '10px 14px',
          background: 'rgba(230, 83, 93, 0.2)',
          border: '1px solid #E6535D',
          borderRadius: '12px',
          color: '#FCA5A5',
          fontSize: '0.85rem',
          fontWeight: 700,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>⚠️ {globalAlert}</span>
          <button type="button" onClick={() => setGlobalAlert(null)} style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontWeight: 900 }}>✕</button>
        </div>
      )}

      {incomingChallenge && (
        <div role="dialog" style={{
          margin: '8px 16px 0',
          padding: '12px 14px',
          background: 'rgba(59, 130, 246, 0.22)',
          border: '1.5px solid #60A5FA',
          borderRadius: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <span style={{ color: 'var(--sports-white)', fontWeight: 800, fontSize: '0.88rem' }}>
            ⚔️ {incomingChallenge.fromAvatar || '🦊'} <strong>{incomingChallenge.fromName}</strong> challenged you to a Bingo Duel!
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-tactile btn-mint"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              onClick={() => socketClient.send('respond_challenge', {
                challengeId: incomingChallenge.id,
                playerId: currentUser.id,
                name: currentUser.name,
                avatar: currentUser.avatar,
                accept: true
              })}
            >
              Accept
            </button>
            <button
              type="button"
              className="btn-tactile btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.82rem' }}
              onClick={() => {
                socketClient.send('respond_challenge', { challengeId: incomingChallenge.id, accept: false });
                setIncomingChallenge(null);
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}

      <div className="arena-shell-body">
        <div className="arena-main-stage">
          <div key={`${screen}:${selectedModeId}:${activeRoomCode}`} className="arena-screen-enter">
            {screen === 'home' && (
              <HomeScreen
                currentUser={currentUser}
                coins={coins}
                dailyClaimed={dailyClaimed}
                onClaimDaily={handleClaimDaily}
                onLaunchQuickMatch={() => {
                  setSelectedModeId('quick-match');
                  navigateTo('mode-detail', '/modes/quick-match');
                }}
                onOpenCreateRoom={() => {
                  setSelectedModeId('private-room');
                  navigateTo('mode-detail', '/modes/private-room');
                }}
                onOpenFriendChallenge={() => {
                  setSelectedModeId('friend-challenge');
                  navigateTo('mode-detail', '/modes/friend-challenge');
                }}
                onOpenModesHub={() => navigateTo('modes-hub', '/modes')}
                onOpenTournaments={(tournId = null) => navigateTo('tournaments', tournId ? `/tournaments/${tournId}` : '/tournaments')}
                onOpenLeaderboard={() => navigateTo('leaderboard', '/leaderboard')}
                onOpenProfile={() => navigateTo('profile', '/profile')}
                onJoinCode={(code) => {
                  handleJoinRoomByCode(code).catch((err) => {
                    setLobbyError(err.message);
                    setActiveRoomCode(code);
                    navigateTo('lobby', `/r/${code}`);
                  });
                }}
              />
            )}

            {screen === 'modes-hub' && (
              <ModesHubScreen
                onBack={() => navigateTo('home', '/')}
                onSelectMode={(id) => {
                  setSelectedModeId(id);
                  navigateTo('mode-detail', `/modes/${id}`);
                }}
              />
            )}

            {screen === 'mode-detail' && (
              <ModeDetailScreen
                modeId={selectedModeId}
                currentUser={currentUser}
                socket={socketClient}
                onBack={() => navigateTo('modes-hub', '/modes')}
                onStartMatch={handleStartLocalMatch}
                onCreateRoom={handleCreatePrivateRoom}
                onJoinRoom={handleJoinRoomByCode}
                onLaunchPractice={() => handleStartLocalMatch({ initialMode: 'practice' })}
                onNavigateToTournaments={() => navigateTo('tournaments', '/tournaments')}
              />
            )}

            {screen === 'lobby' && (
              <LobbyScreen
                roomCode={activeRoomCode}
                roomState={roomState}
                currentUser={currentUser}
                lobbyError={lobbyError}
                isJoining={isJoiningRoom}
                onToggleReady={(ready) => socketClient.send('set_ready', { ready })}
                onAddBot={() => socketClient.send('add_bot', {})}
                onUpdateSettings={(settings) => socketClient.send('update_settings', settings)}
                onStartGame={() => socketClient.send('start_arranging', {})}
                onLeave={handleLeaveActiveMatchOrRoom}
              />
            )}

            {screen === 'game' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <BingoGame
                  initialMode={matchConfig.initialMode || 'practice'}
                  roomCode={matchConfig.roomCode}
                  socket={matchConfig.roomCode ? socketClient : null}
                  roomState={roomState}
                  currentUser={currentUser}
                  turnDuration={matchConfig.turnDuration || 30}
                  offlineP1={matchConfig.offlineP1 || currentUser.name}
                  offlineP2={matchConfig.offlineP2 || 'Player 2'}
                  tournamentMatch={matchConfig.initialMode === 'tournament' ? matchConfig : null}
                  onCoinsUpdate={(delta) => setCoins(prev => prev + delta)}
                  onNavigateTournament={(path) => {
                    handleLeaveActiveMatchOrRoom();
                    navigateTo('tournaments', path || '/tournaments');
                  }}
                  onExit={() => setShowExitConfirm(true)}
                />
              </div>
            )}

            {screen === 'tournaments' && (
              <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <TournamentRouter
                  initialPath={typeof window !== 'undefined' ? window.location.pathname : '/tournaments'}
                  currentUserId={currentUser.id}
                  currentUserName={currentUser.name}
                  currentUser={currentUser}
                  coins={coins}
                  onNavigateHome={() => navigateTo('home', '/')}
                  onNavigateProfile={() => navigateTo('profile', '/profile')}
                  onPlayMatch={handlePlayTournamentMatch}
                  onExit={() => navigateTo('home', '/')}
                />
              </div>
            )}

            {screen === 'leaderboard' && (
              <LeaderboardScreen
                currentUser={currentUser}
                onBack={() => navigateTo('home', '/')}
              />
            )}

            {screen === 'profile' && (
              <ProfileScreen
                currentUser={currentUser}
                coins={coins}
                onUpdateProfile={handleUpdateProfile}
                onLogin={async (creds) => {
                  const res = await socketClient.login(creds);
                  if (res.user) applyUserRecord(res.user);
                  return res;
                }}
                onRegister={async (creds) => {
                  const res = await socketClient.register(creds);
                  if (res.user) applyUserRecord(res.user);
                  return res;
                }}
                onBack={() => navigateTo('home', '/')}
              />
            )}
          </div>
        </div>

        <BottomNav
          activeScreen={screen}
          onNavigate={(target) => {
            if (target === 'home') navigateTo('home', '/');
            else if (target === 'modes') navigateTo('modes-hub', '/modes');
            else if (target === 'tournaments') navigateTo('tournaments', '/tournaments');
            else if (target === 'leaderboard') navigateTo('leaderboard', '/leaderboard');
            else if (target === 'profile') navigateTo('profile', '/profile');
          }}
          isGameplayActive={isGameplay}
        />
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(soundManager.toggleMute())}
        musicEnabled={musicEnabled}
        onToggleMusic={() => setMusicEnabled(soundManager.toggleMusic())}
        volume={volume}
        onChangeVolume={(v) => setVolume(soundManager.setVolume(v))}
        theme={theme}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
        vibration={vibration}
        onToggleVibration={() => {
          const next = !vibration;
          soundManager.setVibration(next);
          setVibration(next);
        }}
        quality={quality}
        onSetQuality={(q) => {
          setGraphicsQuality(q);
          setQuality(q);
        }}
      />

      <HowToPlayModal isOpen={showHowToPlay} onClose={() => setShowHowToPlay(false)} />

      <DailyRewardModal
        isOpen={showDailyModal}
        onClose={() => setShowDailyModal(false)}
        claimed={dailyClaimed}
        onClaim={handleClaimDaily}
      />

      <ExitConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirmExit={() => {
          setShowExitConfirm(false);
          soundManager.playError?.();
          handleLeaveActiveMatchOrRoom();
        }}
      />
    </div>
  );
}
