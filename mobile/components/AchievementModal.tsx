/**
 * mobile/components/AchievementModal.tsx
 * 
 * Rewards & Achievements Unlock Dialog for React Native.
 * Matches visual reference:
 * - "Achievement Unlocked!" header
 * - Laurel Wreath & Crown Crest
 * - "Tournament Champion" title
 * - "Win a Knockout Tournament" description
 * - "+2,000 Coins" reward pill
 * - "Claim Reward" gold button
 */

import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Button from './Button';

export interface AchievementModalProps {
  visible: boolean;
  title?: string;
  description?: string;
  rewardCoins?: number;
  onClaim: () => void;
  onClose?: () => void;
}

export function AchievementModal({
  visible,
  title = 'Tournament Champion',
  description = 'Win a Knockout Tournament',
  rewardCoins = 2000,
  onClaim,
  onClose
}: AchievementModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {onClose && (
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.headerBadge}>Achievement Unlocked!</Text>

          {/* Laurel Crest Graphic */}
          <View style={styles.crestCircle}>
            <Text style={styles.crestEmoji}>👑</Text>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.description}>{description}</Text>

          {/* Coin Reward Pill */}
          <View style={styles.coinPill}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.coinAmount}>+{rewardCoins.toLocaleString()} Coins</Text>
          </View>

          {/* Claim Button */}
          <Button
            title="Claim Reward"
            variant="gold"
            size="medium"
            onPress={onClaim}
            style={{ width: '100%' }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.darkOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg
  },
  card: {
    backgroundColor: Colors.midnightBlue,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.borderGold,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    position: 'relative'
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 6
  },
  closeText: {
    color: Colors.slate,
    fontSize: 16
  },
  headerBadge: {
    color: Colors.premiumWhite,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 12
  },
  crestCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10
  },
  crestEmoji: {
    fontSize: 40
  },
  title: {
    color: Colors.premiumWhite,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4
  },
  description: {
    color: Colors.slate,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 6
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(243, 185, 79, 0.15)',
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginVertical: 16
  },
  coinIcon: {
    fontSize: 18
  },
  coinAmount: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '900'
  }
});

export default AchievementModal;
