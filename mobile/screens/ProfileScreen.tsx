/**
 * mobile/screens/ProfileScreen.tsx
 *
 * Player Passport screen wired to real /api/users/profile, /api/wallet/transactions,
 * /api/matches/history, /api/health/db, plus login/register/profile editing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Card from '../components/Card';
import AvatarFrame from '../components/AvatarFrame';
import TrophyGraphic from '../components/TrophyGraphic';
import Button from '../components/Button';
import { apiClient } from '../services/apiClient';

export interface ProfileScreenProps {
  currentUser?: any;
  coins?: number;
  onUserUpdated?: (user: any) => void;
  onBack?: () => void;
  onOpenAchievements?: () => void;
}

export function ProfileScreen({ currentUser, coins = 500, onUserUpdated, onBack, onOpenAchievements }: ProfileScreenProps) {
  const [avatar, setAvatar] = useState<string>(currentUser?.avatar || '🦊');
  const [displayName, setDisplayName] = useState<string>(currentUser?.username || currentUser?.name || 'Player');
  const [activeTab, setActiveTab] = useState<'history' | 'ledger'>('history');
  const [stats, setStats] = useState<any>({ matchesPlayed: 0, matchesWon: 0, winRate: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);
  const [matchHistory, setMatchHistory] = useState<any[]>([]);
  const [dbOnline, setDbOnline] = useState<boolean>(false);

  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMode, setAuthMode] = useState<'none' | 'login' | 'register'>('none');

  const avatarOptions = ['🦊', '🐅', '🦁', '👑', '⚡', '🎯', '💎', '🐻'];

  const loadPassport = useCallback(() => {
    const uid = currentUser?.id;
    if (!uid) return;

    apiClient.getUserProfile(uid)
      .then((res) => {
        if (res?.success && res.user) {
          setAvatar(res.user.avatar || '🦊');
          setDisplayName(res.user.profile?.displayName || res.user.username || 'Player');
          if (res.user.stats) setStats(res.user.stats);
        }
      })
      .catch(() => {});

    apiClient.getTransactions(uid, 15)
      .then((res) => {
        if (res?.success && Array.isArray(res.transactions)) setTransactions(res.transactions);
      })
      .catch(() => {});

    apiClient.getMatchHistory(uid, 15)
      .then((res) => {
        if (res?.success && Array.isArray(res.history)) setMatchHistory(res.history);
      })
      .catch(() => {});

    apiClient.getDbHealth()
      .then((res) => setDbOnline(Boolean(res?.connected)))
      .catch(() => setDbOnline(false));
  }, [currentUser?.id]);

  useEffect(() => {
    loadPassport();
  }, [loadPassport]);

  const handleSaveAvatar = async (av: string) => {
    setAvatar(av);
    if (!currentUser?.id) return;
    try {
      await apiClient.updateProfile(currentUser.id, { avatar: av });
      onUserUpdated && onUserUpdated({ ...currentUser, avatar: av });
    } catch {}
  };

  const handleSaveName = async () => {
    const clean = displayName.trim();
    if (!clean || !currentUser?.id) return;
    try {
      await apiClient.updateProfile(currentUser.id, { displayName: clean, avatar });
      onUserUpdated && onUserUpdated({ ...currentUser, name: clean, username: clean });
      Alert.alert('Saved', 'Profile name updated.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update profile.');
    }
  };

  const handleAuth = async () => {
    if (!authUsername.trim() || !authPassword) return;
    try {
      const res = authMode === 'login'
        ? await apiClient.login({ username: authUsername.trim(), password: authPassword })
        : await apiClient.register({ username: authUsername.trim(), password: authPassword, avatar });
      if (res?.success && res.user) {
        if (res.sessionToken) apiClient.setToken(res.sessionToken);
        onUserUpdated && onUserUpdated(res.user);
        setAuthMode('none');
        setAuthPassword('');
        loadPassport();
      }
    } catch (err: any) {
      Alert.alert('Auth Error', err?.message || 'Authentication failed.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card style={styles.identityCard}>
        <AvatarFrame avatar={avatar} level={currentUser?.level || 1} rank={currentUser?.isGuest ? 'Guest' : 'Player'} size={72} />
        <Text style={styles.username}>{displayName}</Text>

        <View style={styles.rankPill}>
          <Text style={styles.rankPillText}>
            🪙 {coins.toLocaleString()} Coins • {dbOnline ? 'DB Online' : 'Fallback Mode'}
          </Text>
        </View>

        <View style={styles.nameEditRow}>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={Colors.slate}
          />
          <Button title="Save" variant="primary" size="small" onPress={handleSaveName} />
        </View>

        <Text style={styles.avatarLabel}>Choose Battle Avatar:</Text>
        <View style={styles.avatarRow}>
          {avatarOptions.map((av) => (
            <TouchableOpacity
              key={av}
              style={[styles.avatarChip, avatar === av && styles.avatarChipSelected]}
              onPress={() => handleSaveAvatar(av)}
            >
              <Text style={{ fontSize: 18 }}>{av}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.authBtnsRow}>
          <Button title="Sign In" variant="secondary" size="small" onPress={() => setAuthMode(authMode === 'login' ? 'none' : 'login')} />
          <Button title="Register Account" variant="primary" size="small" onPress={() => setAuthMode(authMode === 'register' ? 'none' : 'register')} />
        </View>

        {authMode !== 'none' && (
          <View style={styles.authBox}>
            <TextInput style={styles.input} value={authUsername} onChangeText={setAuthUsername} placeholder="Username" placeholderTextColor={Colors.slate} />
            <TextInput style={styles.input} value={authPassword} onChangeText={setAuthPassword} placeholder="Password" secureTextEntry placeholderTextColor={Colors.slate} />
            <Button title={authMode === 'login' ? 'Sign In Now' : 'Create Account'} variant="gold" size="small" onPress={handleAuth} />
          </View>
        )}
      </Card>

      <Card style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Career Match Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statCaption}>Matches</Text>
            <Text style={styles.statNum}>{stats.matchesPlayed || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statCaption}>Wins</Text>
            <Text style={[styles.statNum, { color: Colors.gold }]}>{stats.matchesWon || 0}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statCaption}>Win %</Text>
            <Text style={[styles.statNum, { color: Colors.successGreen }]}>{stats.winRate || 0}%</Text>
          </View>
        </View>
      </Card>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && styles.activeTabBtn]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History ({matchHistory.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'ledger' && styles.activeTabBtn]}
          onPress={() => setActiveTab('ledger')}
        >
          <Text style={[styles.tabText, activeTab === 'ledger' && styles.activeTabText]}>
            Coin Ledger ({transactions.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={onOpenAchievements}
        >
          <Text style={styles.tabText}>Awards</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.ledgerCard}>
        {activeTab === 'history' ? (
          matchHistory.length === 0 ? (
            <Text style={styles.emptyText}>No completed matches recorded yet.</Text>
          ) : (
            matchHistory.map((m, idx) => (
              <View key={m.id || idx} style={styles.txRow}>
                <View>
                  <Text style={styles.txTitle}>vs {m.opponentName || 'Opponent'}</Text>
                  <Text style={styles.txDate}>{m.mode || 'MULTIPLAYER'} • {m.linesCompleted || 0} lines</Text>
                </View>
                <Text style={[styles.txAmount, { color: m.result === 'WIN' ? Colors.successGreen : Colors.dangerRed }]}>
                  {m.result}
                </Text>
              </View>
            ))
          )
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyText}>No coin transactions recorded yet.</Text>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View>
                <Text style={styles.txTitle}>{tx.description || tx.type}</Text>
                <Text style={styles.txDate}>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : 'Recent'}</Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.amount > 0 ? Colors.successGreen : Colors.dangerRed }]}>
                {tx.amount > 0 ? `+${tx.amount}` : tx.amount} 🪙
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },
  identityCard: { alignItems: 'center', padding: Spacing.lg, gap: 8 },
  username: { color: Colors.premiumWhite, fontSize: 20, fontWeight: '900' },
  rankPill: {
    backgroundColor: 'rgba(243, 185, 79, 0.15)',
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: Spacing.roundPill,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  rankPillText: { color: Colors.gold, fontSize: 11, fontWeight: '800' },
  nameEditRow: { flexDirection: 'row', gap: 8, width: '100%', marginTop: 6 },
  input: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.premiumWhite,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13
  },
  avatarLabel: { color: Colors.slate, fontSize: 12, marginTop: 4 },
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  avatarChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.deepNavy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border
  },
  avatarChipSelected: { borderColor: Colors.electricBlue, borderWidth: 2 },
  authBtnsRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  authBox: { width: '100%', gap: 8, marginTop: 8 },
  statsCard: { padding: Spacing.md },
  sectionTitle: { color: Colors.premiumWhite, fontSize: 14, fontWeight: '900', marginBottom: 10 },
  statsGrid: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: Colors.deepNavy, borderRadius: 10, padding: 10, alignItems: 'center' },
  statCaption: { color: Colors.slate, fontSize: 11, fontWeight: '700' },
  statNum: { color: Colors.premiumWhite, fontSize: 18, fontWeight: '900', marginTop: 2 },
  tabsRow: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, backgroundColor: Colors.midnightBlue, paddingVertical: 10, borderRadius: 9999, alignItems: 'center' },
  activeTabBtn: { backgroundColor: Colors.royalBlue },
  tabText: { color: Colors.slate, fontSize: 12, fontWeight: '800' },
  activeTabText: { color: Colors.premiumWhite },
  ledgerCard: { padding: Spacing.md, gap: 8 },
  emptyText: { color: Colors.slate, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  txTitle: { color: Colors.premiumWhite, fontSize: 13, fontWeight: '700' },
  txDate: { color: Colors.slate, fontSize: 11 },
  txAmount: { fontSize: 13, fontWeight: '900' }
});

export default ProfileScreen;
