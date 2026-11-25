/**
 * mobile/screens/LeaderboardScreen.tsx
 *
 * Real Global Rankings screen fetched from /api/users/leaderboard.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Card from '../components/Card';
import AvatarFrame from '../components/AvatarFrame';
import Button from '../components/Button';
import { apiClient } from '../services/apiClient';

export function LeaderboardScreen({ currentUserId }: { currentUserId?: string }) {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getLeaderboard(20, 'wins');
      setLeaders(Array.isArray(res?.leaderboard) ? res.leaderboard : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={Colors.gold} size="large" />
        <Text style={styles.emptyText}>Loading global rankings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Global Division Rankings</Text>

      {error ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Retry" variant="primary" size="small" onPress={loadLeaderboard} />
        </Card>
      ) : leaders.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Ranked Players Yet</Text>
          <Text style={styles.emptyText}>
            Complete multiplayer matches or tournaments to climb the live standings.
          </Text>
        </Card>
      ) : (
        <>
          {leaders.length >= 3 && (
            <View style={styles.podiumContainer}>
              <View style={[styles.podiumCol, { height: 130 }]}>
                <Text style={styles.medalIcon}>🥈</Text>
                <AvatarFrame avatar={leaders[1].avatar || '🐻'} level={leaders[1].level || 1} rank="Silver" size={38} />
                <Text style={styles.podiumName} numberOfLines={1}>{leaders[1].username}</Text>
                <Text style={styles.podiumPoints}>{leaders[1].wins || 0} Wins</Text>
              </View>

              <View style={[styles.podiumCol, { height: 155 }]}>
                <Text style={styles.medalIcon}>🥇</Text>
                <AvatarFrame avatar={leaders[0].avatar || '🦊'} level={leaders[0].level || 1} rank="Gold" size={44} />
                <Text style={[styles.podiumName, { color: Colors.gold }]} numberOfLines={1}>{leaders[0].username}</Text>
                <Text style={[styles.podiumPoints, { color: Colors.gold }]}>{leaders[0].wins || 0} Wins</Text>
              </View>

              <View style={[styles.podiumCol, { height: 115 }]}>
                <Text style={styles.medalIcon}>🥉</Text>
                <AvatarFrame avatar={leaders[2].avatar || '🐼'} level={leaders[2].level || 1} rank="Bronze" size={38} />
                <Text style={styles.podiumName} numberOfLines={1}>{leaders[2].username}</Text>
                <Text style={styles.podiumPoints}>{leaders[2].wins || 0} Wins</Text>
              </View>
            </View>
          )}

          <Card style={styles.listCard}>
            <Text style={styles.listHeader}>Division Standings</Text>
            {leaders.map((r, idx) => (
              <View key={r.id || idx} style={styles.rankRow}>
                <Text style={styles.rankNum}>#{idx + 1}</Text>
                <AvatarFrame avatar={r.avatar || '🦊'} level={r.level || 1} rank="Player" size={30} />
                <Text style={styles.rowName} numberOfLines={1}>
                  {r.username} {r.id === currentUserId ? '(You)' : ''}
                </Text>
                <Text style={styles.rowWinRate}>{r.winRate || 0}%</Text>
                <Text style={styles.rowPoints}>{r.coins || 0} 🪙</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  content: { padding: Spacing.md, gap: Spacing.md, paddingBottom: 32 },
  title: { color: Colors.premiumWhite, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  emptyCard: { padding: Spacing.lg, alignItems: 'center', gap: 10 },
  emptyTitle: { color: Colors.premiumWhite, fontSize: 15, fontWeight: '800' },
  emptyText: { color: Colors.slate, fontSize: 12, textAlign: 'center' },
  errorText: { color: Colors.dangerRed, fontSize: 13, fontWeight: '700' },
  podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 10, marginVertical: Spacing.sm },
  podiumCol: { alignItems: 'center', justifyContent: 'flex-end', flex: 1, gap: 4 },
  medalIcon: { fontSize: 22 },
  podiumName: { color: Colors.premiumWhite, fontSize: 12, fontWeight: '800' },
  podiumPoints: { color: Colors.slate, fontSize: 11, fontWeight: '700' },
  listCard: { padding: Spacing.md, gap: 8 },
  listHeader: { color: Colors.gold, fontSize: 13, fontWeight: '900', marginBottom: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  rankNum: { color: Colors.slate, fontSize: 12, fontWeight: '900', width: 28 },
  rowName: { color: Colors.premiumWhite, fontSize: 13, fontWeight: '700', flex: 1 },
  rowWinRate: { color: Colors.successGreen, fontSize: 11, fontWeight: '700' },
  rowPoints: { color: Colors.gold, fontSize: 12, fontWeight: '800' }
});

export default LeaderboardScreen;
