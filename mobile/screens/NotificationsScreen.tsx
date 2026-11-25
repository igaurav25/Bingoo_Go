/**
 * mobile/screens/NotificationsScreen.tsx
 *
 * Real Notifications Center synced with /api/notifications.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Card from '../components/Card';
import { apiClient } from '../services/apiClient';

export function NotificationsScreen({ currentUserId, onBack }: { currentUserId?: string; onBack?: () => void }) {
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    apiClient.getAllNotifications(currentUserId)
      .then((res) => {
        if (res?.success && Array.isArray(res.notifications)) {
          setNotifications(res.notifications);
        }
      })
      .catch(() => {});
  }, [currentUserId]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.markReadText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={styles.markReadText}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <Card style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: Colors.slate, fontSize: 13 }}>No new tournament or duel alerts yet.</Text>
        </Card>
      ) : (
        <View style={{ gap: 8 }}>
          {notifications.map((n, idx) => (
            <Card key={n.id || idx} style={[styles.notifCard, !n.read && styles.notifUnread]}>
              <Text style={styles.notifIcon}>🏆</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>{n.title || 'Update'}</Text>
                <Text style={styles.notifDesc}>{n.message || n.desc}</Text>
              </View>
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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: Colors.premiumWhite, fontSize: 18, fontWeight: '900' },
  markReadText: { color: Colors.electricBlue, fontSize: 12, fontWeight: '800' },
  notifCard: { flexDirection: 'row', gap: 10, padding: Spacing.md, alignItems: 'center' },
  notifUnread: { borderColor: Colors.electricBlue },
  notifIcon: { fontSize: 22 },
  notifTitle: { color: Colors.premiumWhite, fontSize: 13, fontWeight: '800' },
  notifDesc: { color: Colors.slate, fontSize: 12, marginTop: 2 }
});

export default NotificationsScreen;
