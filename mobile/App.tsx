/**
 * mobile/App.tsx
 *
 * Root React Native + Expo Application for Bingoo Goo.
 * - Initializes real player session via /api/auth/me & /api/auth/guest
 * - Supports configurable LAN Server URL persisted in storageService
 * - Handles real WebSocket Private Room Lobby, Quick Match Queue, Challenges & Live Tournament Matches
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, StyleSheet, StatusBar, Modal, Alert } from 'react-native';
import Colors from './theme/colors';
import Header from './components/Header';
import BottomNav, { TabKey } from './components/BottomNav';
import Button from './components/Button';
import Card from './components/Card';
import HomeScreen from './screens/HomeScreen';
import GameModesScreen from './screens/GameModesScreen';
import BingoGameScreen from './screens/BingoGameScreen';
import TournamentScreen from './screens/TournamentScreen';
import FriendsScreen from './screens/FriendsScreen';
import ProfileScreen from './screens/ProfileScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import NotificationsScreen from './screens/NotificationsScreen';
import SettingsScreen from './screens/SettingsScreen';
import AchievementModal from './components/AchievementModal';
import { apiClient } from './services/apiClient';
import { socketService } from './services/socketService';
import { storageService, STORAGE_KEYS } from './services/storageService';

export type ScreenState =
  | 'tab_home'
  | 'tab_modes'
  | 'tab_tournaments'
  | 'tab_friends'
  | 'tab_profile'
  | 'screen_game'
  | 'screen_lobby'
  | 'screen_leaderboard'
  | 'screen_notifications'
  | 'screen_settings';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenState>('tab_home');
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [selectedGameMode, setSelectedGameMode] = useState<string>('practice');
  const [activeTournamentMatch, setActiveTournamentMatch] = useState<any>(null);
  const [showAchievement, setShowAchievement] = useState<boolean>(false);

  // Real user identity & wallet state
  const [currentUser, setCurrentUser] = useState<any>({
    id: '',
    name: 'Player',
    username: 'Player',
    avatar: '🦊',
    level: 1,
    isGuest: true
  });
  const [coins, setCoins] = useState<number>(500);
  const [recentMatches, setRecentMatches] = useState<any[]>([]);
  const [dailyClaimed, setDailyClaimed] = useState<boolean>(false);

  // Live Multiplayer Room / Queue State
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<any>(null);
  const [searchingQueue, setSearchingQueue] = useState<boolean>(false);

  const applyUserSession = useCallback((user: any, token?: string) => {
    if (!user) return;
    if (token) apiClient.setToken(token);
    const normalized = {
      id: user.id,
      username: user.username,
      name: user.profile?.displayName || user.username || 'Player',
      avatar: user.avatar || '🦊',
      level: user.profile?.level || 1,
      isGuest: Boolean(user.isGuest)
    };
    setCurrentUser(normalized);
    if (user.wallet?.balance !== undefined) setCoins(user.wallet.balance);
    socketService.setIdentity({
      playerId: normalized.id,
      name: normalized.name,
      avatar: normalized.avatar
    });
    if (normalized.id) {
      apiClient.getMatchHistory(normalized.id, 5)
        .then((res) => {
          if (res?.success && Array.isArray(res.history)) setRecentMatches(res.history);
        })
        .catch(() => {});
    }
  }, []);

  const bootstrapSession = useCallback(async () => {
    try {
      const savedUrl = await storageService.getItem(STORAGE_KEYS.SERVER_URL);
      if (savedUrl) {
        apiClient.setBaseUrl(savedUrl);
        socketService.setServerHttpUrl(savedUrl);
      }

      const savedToken = await storageService.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (savedToken) {
        apiClient.setToken(savedToken);
        try {
          const me = await apiClient.getMe(savedToken);
          if (me?.success && me.user) {
            applyUserSession(me.user, savedToken);
            socketService.connect();
            return;
          }
        } catch {
          await storageService.removeItem(STORAGE_KEYS.AUTH_TOKEN);
        }
      }

      const guestRes = await apiClient.createGuestSession({ avatar: '🦊' });
      if (guestRes?.success && guestRes.user) {
        if (guestRes.sessionToken) {
          await storageService.setItem(STORAGE_KEYS.AUTH_TOKEN, guestRes.sessionToken);
        }
        applyUserSession(guestRes.user, guestRes.sessionToken);
      }
      socketService.connect();
    } catch {
      socketService.connect();
    }
  }, [applyUserSession]);

  useEffect(() => {
    bootstrapSession();
  }, [bootstrapSession]);

  // Listen to WebSocket Room & Matchmaking Events
  useEffect(() => {
    const unsubs = [
      socketService.on('room_created', (data: any) => {
        setActiveRoomCode(data.code);
        setRoomState(data.room);
        setCurrentScreen('screen_lobby');
      }),
      socketService.on('room_joined', (data: any) => {
        setActiveRoomCode(data.code);
        setRoomState(data.room);
        if (data.room?.status === 'arranging' || data.room?.status === 'playing') {
          setCurrentScreen('screen_game');
        } else {
          setCurrentScreen('screen_lobby');
        }
      }),
      socketService.on('quick_match_found', (data: any) => {
        setSearchingQueue(false);
        setActiveRoomCode(data.code);
        setRoomState(data.room);
        setSelectedGameMode('quick-match');
        setCurrentScreen('screen_game');
      }),
      socketService.on('matchmaking_timeout', (data: any) => {
        setSearchingQueue(false);
        Alert.alert('Queue Timeout', data?.message || 'No online opponent found right now. Try Practice vs AI!');
      }),
      socketService.on('room_state', (data: any) => {
        if (!data?.room) return;
        setRoomState(data.room);
        if (data.room.status === 'arranging' && currentScreen === 'screen_lobby') {
          setCurrentScreen('screen_game');
        }
      }),
      socketService.on('error', (data: any) => {
        if (data?.message) {
          Alert.alert('Notice', data.message);
        }
      })
    ];
    return () => unsubs.forEach((fn) => fn && fn());
  }, [currentScreen]);

  const handleSelectTab = (tab: TabKey) => {
    setActiveTab(tab);
    switch (tab) {
      case 'home': setCurrentScreen('tab_home'); break;
      case 'modes': setCurrentScreen('tab_modes'); break;
      case 'tournaments': setCurrentScreen('tab_tournaments'); break;
      case 'friends': setCurrentScreen('tab_friends'); break;
      case 'profile': setCurrentScreen('tab_profile'); break;
    }
  };

  const handleStartGame = (modeId: string, tournamentMatch?: any) => {
    setSelectedGameMode(modeId);
    setActiveTournamentMatch(tournamentMatch || null);

    if (tournamentMatch?.roomCode) {
      socketService.connect();
      socketService.send('join_room', {
        code: tournamentMatch.roomCode,
        playerId: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      });
      return;
    }

    if (modeId === 'quick-match') {
      setSearchingQueue(true);
      socketService.connect();
      socketService.send('find_quick_match', {
        playerId: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      });
      return;
    }

    if (modeId === 'private-room') {
      socketService.connect();
      socketService.send('create_room', {
        playerId: currentUser.id,
        name: currentUser.name,
        avatar: currentUser.avatar
      });
      return;
    }

    setActiveRoomCode(null);
    setRoomState(null);
    setCurrentScreen('screen_game');
  };

  const handleJoinRoomCode = (code: string) => {
    socketService.connect();
    socketService.send('join_room', {
      code,
      playerId: currentUser.id,
      name: currentUser.name,
      avatar: currentUser.avatar
    });
  };

  const handleExitGame = () => {
    if (activeRoomCode) {
      socketService.send('leave_room', {});
    }
    setActiveRoomCode(null);
    setRoomState(null);
    setActiveTournamentMatch(null);
    setCurrentScreen('tab_home');
    setActiveTab('home');
  };

  const renderActiveScreen = () => {
    switch (currentScreen) {
      case 'screen_lobby': {
        const players = roomState?.players || [];
        const isHost = roomState?.hostPlayerId === currentUser.id;
        return (
          <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Card style={{ padding: 16, alignItems: 'center' }}>
              <Text style={{ color: Colors.slate, fontSize: 12 }}>ROOM CODE</Text>
              <Text style={{ color: Colors.gold, fontSize: 32, fontWeight: '900', letterSpacing: 6 }}>
                {activeRoomCode || '-----'}
              </Text>
            </Card>
            <Card style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: Colors.premiumWhite, fontWeight: '800', fontSize: 15 }}>
                Players ({players.length}/2)
              </Text>
              {players.map((p: any) => (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                  <Text style={{ color: Colors.premiumWhite, fontWeight: '700' }}>
                    {p.avatar} {p.name} {p.isHost ? '👑' : ''}
                  </Text>
                  <Text style={{ color: (p.isReady || p.isHost || p.isBot) ? Colors.successGreen : Colors.gold, fontWeight: '800' }}>
                    {(p.isReady || p.isHost || p.isBot) ? 'Ready' : 'Waiting'}
                  </Text>
                </View>
              ))}
              {isHost && players.length < 2 && (
                <Button title="Add Practice Bot 🤖" variant="secondary" size="small" onPress={() => socketService.send('add_bot', {})} />
              )}
            </Card>
            {isHost ? (
              <Button
                title="Start Game Now 🚀"
                variant="gold"
                size="medium"
                disabled={players.length < 2}
                onPress={() => socketService.send('start_arranging', {})}
              />
            ) : (
              <Button title="Mark Ready ⚡" variant="primary" size="medium" onPress={() => socketService.send('set_ready', { ready: true })} />
            )}
            <Button title="Leave Room" variant="danger" size="small" onPress={handleExitGame} />
          </View>
        );
      }

      case 'screen_game':
        return (
          <BingoGameScreen
            initialMode={selectedGameMode}
            roomCode={activeRoomCode}
            roomState={roomState}
            currentUser={currentUser}
            tournamentMatch={activeTournamentMatch}
            onCoinsUpdate={(delta) => setCoins((c) => c + delta)}
            onExit={handleExitGame}
          />
        );

      case 'tab_modes':
        return (
          <GameModesScreen
            onSelectMode={handleStartGame}
            onBack={() => handleSelectTab('home')}
            onHome={() => handleSelectTab('home')}
          />
        );

      case 'tab_tournaments':
        return (
          <TournamentScreen
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            onPlayMatch={(match) => handleStartGame('knockout-tourn', match)}
            onBack={() => handleSelectTab('home')}
          />
        );

      case 'tab_friends':
        return (
          <FriendsScreen
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            currentUserAvatar={currentUser.avatar}
            onChallengeFriend={() => setCurrentScreen('screen_lobby')}
            onBack={() => handleSelectTab('home')}
          />
        );

      case 'tab_profile':
        return (
          <ProfileScreen
            currentUser={currentUser}
            coins={coins}
            onUserUpdated={(u) => applyUserSession(u)}
            onBack={() => handleSelectTab('home')}
            onOpenAchievements={() => setShowAchievement(true)}
          />
        );

      case 'screen_notifications':
        return (
          <NotificationsScreen
            currentUserId={currentUser.id}
            onBack={() => handleSelectTab('home')}
          />
        );

      case 'screen_settings':
        return (
          <SettingsScreen
            onBack={() => handleSelectTab('home')}
            onServerUrlChanged={() => bootstrapSession()}
            onSignOut={() => {
              storageService.removeItem(STORAGE_KEYS.AUTH_TOKEN).then(() => bootstrapSession());
            }}
          />
        );

      case 'screen_leaderboard':
        return <LeaderboardScreen currentUserId={currentUser.id} />;

      case 'tab_home':
      default:
        return (
          <HomeScreen
            currentUserId={currentUser.id}
            recentMatches={recentMatches}
            dailyClaimed={dailyClaimed}
            onClaimDaily={() => {
              if (dailyClaimed) return;
              socketService.send('claim_daily_reward', { playerId: currentUser.id });
              setDailyClaimed(true);
              setCoins((c) => c + 100);
            }}
            onSelectMode={handleStartGame}
            onJoinRoomByCode={handleJoinRoomCode}
            onOpenTournaments={() => handleSelectTab('tournaments')}
            onOpenFriends={() => handleSelectTab('friends')}
            onViewAllModes={() => handleSelectTab('modes')}
          />
        );
    }
  };

  const isPlayingGame = currentScreen === 'screen_game';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.deepNavy} />

      {!isPlayingGame && (
        <Header
          coins={coins}
          username={currentUser.name}
          level={currentUser.level}
          avatar={currentUser.avatar}
          onOpenNotifications={() => setCurrentScreen('screen_notifications')}
          onOpenSettings={() => setCurrentScreen('screen_settings')}
          onPressProfile={() => handleSelectTab('profile')}
        />
      )}

      <View style={styles.body}>{renderActiveScreen()}</View>

      {!isPlayingGame && (
        <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
      )}

      <Modal visible={searchingQueue} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Card style={{ padding: 24, width: '100%', maxWidth: 320, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 36 }}>⚡</Text>
            <Text style={{ color: Colors.premiumWhite, fontSize: 16, fontWeight: '900' }}>Finding Online Opponent...</Text>
            <Text style={{ color: Colors.slate, fontSize: 12, textAlign: 'center' }}>
              Waiting for another real player in the matchmaking pool.
            </Text>
            <Button
              title="Cancel Search"
              variant="danger"
              size="small"
              onPress={() => {
                socketService.send('cancel_quick_match', {});
                setSearchingQueue(false);
              }}
            />
          </Card>
        </View>
      </Modal>

      <AchievementModal
        visible={showAchievement}
        title="Tournament Champion"
        description="Win a Knockout Tournament"
        rewardCoins={2000}
        onClaim={() => setShowAchievement(false)}
        onClose={() => setShowAchievement(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.deepNavy },
  body: { flex: 1, backgroundColor: Colors.background }
});
