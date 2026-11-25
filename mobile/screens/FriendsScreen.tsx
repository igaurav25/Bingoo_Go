/**
 * mobile/screens/FriendsScreen.tsx
 *
 * Real Players & Online Presence Directory for React Native.
 * Fetches registered/connected users from /api/users/directory and emits live challenges.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Card from '../components/Card';
import AvatarFrame from '../components/AvatarFrame';
import Button from '../components/Button';
import { apiClient } from '../services/apiClient';
import { socketService } from '../services/socketService';

export interface FriendsScreenProps {
  currentUserId?: string;
  currentUserName?: string;
  currentUserAvatar?: string;
  onChallengeFriend?: (friendId: string, friendName: string) => void;
  onBack?: () => void;
}

export function FriendsScreen({
  currentUserId,
  currentUserName = 'Player',
  currentUserAvatar = '🦊',
  onChallengeFriend,
  onBack
}: FriendsScreenProps) {
  const [search, setSearch] = useState<string>('');
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getUserDirectory(currentUserId, search);
      setPlayers(Array.isArray(res?.users) ? res.users : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to fetch players directory.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, search]);

  useEffect(() => {
    loadPlayers();
  }, [loadPlayers]);

  const handleChallenge = (player: any) => {
    socketService.send('send_challenge', {
      fromId: currentUserId || socketService.playerId,
      fromName: currentUserName,
      fromAvatar: currentUserAvatar,
      targetFriendId: player.id
    });
    Alert.alert('Challenge Sent', `Invited ${player.username || player.name} to a 1v1 duel.`);
    onChallengeFriend && onChallengeFriend(player.id, player.username || player.name);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        {onBack && <Button title="←" variant="secondary" size="small" onPress={onBack} />}
        <Text style={styles.title}>Players Directory ({players.length})</Text>
      </View>

      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search registered players..."
          placeholderTextColor={Colors.slate}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.gold} style={{ marginTop: 20 }} />
      ) : error ? (
        <Card style={styles.emptyCard}>
          <Text style={{ color: Colors.dangerRed, marginBottom: 8 }}>{error}</Text>
          <Button title="Retry" variant="primary" size="small" onPress={loadPlayers} />
        </Card>
      ) : players.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Other Online Players Found</Text>
          <Text style={styles.emptyDesc}>
            Create a Private Room from Home and share the 5-character code with a friend.
          </Text>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {players.map((p) => (
            <Card key={p.id} style={styles.friendCard}>
              <View style={styles.friendLeft}>
                <AvatarFrame avatar={p.avatar || '🦊'} level={1} rank="Player" size={40} />
                <View>
                  <Text style={styles.friendName}>{p.username || p.name}</Text>
                  <View style={styles.statusRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: p.online ? Colors.successGreen : Colors.slate }
                      ]}
                    />
                    <Text style={styles.statusText}>{p.online ? 'online' : 'registered'}</Text>
                  </View>
                </View>
              </View>

              <Button
                title="Duel ⚔️"
                variant={p.online ? 'gold' : 'secondary'}
                size="small"
                onPress={() => handleChallenge(p)}
              />
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: Colors.premiumWhite, fontSize: 18, fontWeight: '900' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.midnightBlue,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, color: Colors.premiumWhite, paddingVertical: 10, fontSize: 13 },
  emptyCard: { padding: Spacing.lg, alignItems: 'center', gap: 8 },
  emptyTitle: { color: Colors.premiumWhite, fontSize: 15, fontWeight: '800' },
  emptyDesc: { color: Colors.slate, fontSize: 12, textAlign: 'center' },
  friendCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  friendLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendName: { color: Colors.premiumWhite, fontSize: 14, fontWeight: '800' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: Colors.slate, fontSize: 11 }
});

export default FriendsScreen;
