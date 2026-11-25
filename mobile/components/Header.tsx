/**
 * mobile/components/Header.tsx
 * 
 * Native Top Sports Header Bar.
 * Recreated with pixel-fidelity from the visual reference board:
 * - BING-25 Crown & Ball Logo
 * - Player Avatar & Level (Player123 Lv. 15)
 * - Gold Coin Vault Pill (12,450 🪙)
 * - Notification Bell with Pulse Dot
 * - Settings Gear
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../theme/colors';
import Typography from '../theme/typography';
import Spacing from '../theme/spacing';

export interface HeaderProps {
  coins?: number;
  username?: string;
  level?: number;
  avatar?: string;
  onOpenNotifications?: () => void;
  onOpenSettings?: () => void;
  onPressProfile?: () => void;
}

export function Header({
  coins = 500,
  username = 'Player',
  level = 1,
  avatar = '🦊',
  onOpenNotifications,
  onOpenSettings,
  onPressProfile
}: HeaderProps) {
  return (
    <View style={styles.container}>
      {/* Brand Identity / Player Profile */}
      <TouchableOpacity
        style={styles.playerGroup}
        onPress={onPressProfile}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="View player profile"
      >
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>{avatar}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{level}</Text>
          </View>
        </View>
        <View style={styles.nameCol}>
          <Text style={styles.usernameText} numberOfLines={1}>{username}</Text>
          <Text style={styles.rankText}>Lv. {level} • Pro</Text>
        </View>
      </TouchableOpacity>

      {/* Header Actions */}
      <View style={styles.actionsGroup}>
        {/* Coin Vault Pill */}
        <View style={styles.coinPill}>
          <Text style={styles.coinAmount}>{coins.toLocaleString()}</Text>
          <Text style={styles.coinIcon}>🪙</Text>
        </View>

        {/* Notifications Icon Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onOpenNotifications}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Text style={styles.iconText}>🔔</Text>
          <View style={styles.pulseDot} />
        </TouchableOpacity>

        {/* Settings Icon Button */}
        <TouchableOpacity
          style={styles.iconButton}
          onPress={onOpenSettings}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Text style={styles.iconText}>⚙️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 60,
    backgroundColor: Colors.midnightBlue,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    zIndex: 50
  },
  playerGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 1.5,
    borderColor: Colors.electricBlue,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  avatarEmoji: {
    fontSize: 20
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.gold,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  levelText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000'
  },
  nameCol: {
    justifyContent: 'center'
  },
  usernameText: {
    color: Colors.premiumWhite,
    fontSize: 13,
    fontWeight: '800'
  },
  rankText: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '700'
  },
  actionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(12, 20, 34, 0.7)',
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: Spacing.roundPill,
    paddingHorizontal: 12,
    paddingVertical: 5
  },
  coinAmount: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '900'
  },
  coinIcon: {
    fontSize: 14
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  iconText: {
    fontSize: 16
  },
  pulseDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.dangerRed
  }
});

export default Header;
