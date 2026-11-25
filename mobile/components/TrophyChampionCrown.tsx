/**
 * mobile/components/TrophyChampionCrown.tsx
 * 
 * Grand Champion Ribbon Banner with Trophy for React Native.
 * Matches visual reference board top right (Knockout Bracket & Playoffs apex).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';

export interface TrophyChampionCrownProps {
  winnerName?: string;
  size?: number;
}

export function TrophyChampionCrown({
  winnerName = 'Champion',
  size = 90
}: TrophyChampionCrownProps) {
  return (
    <View style={styles.container}>
      {/* Radiant Sunburst Glow */}
      <View
        style={[
          styles.glowCircle,
          { width: size * 1.3, height: size * 1.3, borderRadius: (size * 1.3) / 2 }
        ]}
      />

      {/* Trophy */}
      <Text style={{ fontSize: size * 0.65 }}>🏆</Text>

      {/* Champion Ribbon */}
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText}>CHAMPION</Text>
      </View>

      {/* Winner Name Box */}
      <View style={styles.winnerCard}>
        <Text style={styles.winnerText}>{winnerName}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    position: 'relative',
    marginVertical: Spacing.sm
  },
  glowCircle: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(243, 185, 79, 0.25)',
    zIndex: 0
  },
  ribbon: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 16,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: -8,
    zIndex: 2
  },
  ribbonText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2
  },
  winnerCard: {
    backgroundColor: Colors.midnightBlue,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 5,
    marginTop: 4,
    zIndex: 2
  },
  winnerText: {
    color: Colors.premiumWhite,
    fontSize: 14,
    fontWeight: '900'
  }
});

export default TrophyChampionCrown;
