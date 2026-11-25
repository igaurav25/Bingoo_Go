/**
 * mobile/components/AvatarFrame.tsx
 * 
 * Competitive Rank Avatar Frame with Level Pill.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export interface AvatarFrameProps {
  avatar?: string;
  level?: number;
  rank?: string;
  size?: number;
}

export function AvatarFrame({
  avatar = '🦊',
  level = 15,
  rank = 'Diamond Player',
  size = 46
}: AvatarFrameProps) {
  const getBorderColor = () => {
    if (rank.includes('Diamond')) return Colors.electricBlue;
    if (rank.includes('Master') || rank.includes('Gold')) return Colors.gold;
    if (rank.includes('Pro')) return Colors.successGreen;
    return Colors.slate;
  };

  const borderColor = getBorderColor();

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <View
        style={[
          styles.circle,
          {
            borderColor,
            width: size,
            height: size,
            borderRadius: size / 2
          }
        ]}
      >
        <Text style={{ fontSize: size * 0.48 }}>{avatar}</Text>
      </View>

      {/* Level Pill */}
      <View style={[styles.levelPill, { borderColor }]}>
        <Text style={styles.levelText}>Lv.{level}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center'
  },
  circle: {
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  levelPill: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: Colors.midnightBlue,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1
  },
  levelText: {
    color: Colors.premiumWhite,
    fontSize: 9,
    fontWeight: '900'
  }
});

export default AvatarFrame;
