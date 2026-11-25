/**
 * mobile/screens/GameModesScreen.tsx
 * 
 * Complete 13 Game Modes Selection Screen for React Native.
 * Matches visual reference:
 * - Top header with Back arrow ← and Home button 🏠
 * - 13 Illustrated mode cards with vivid gradient glow icons, titles, taglines, player counts
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import { GAME_MODES } from '../../shared/constants';
import { GameModeInfo } from '../../shared/types';

export interface GameModesScreenProps {
  onSelectMode: (modeId: string) => void;
  onBack: () => void;
  onHome: () => void;
}

export function GameModesScreen({ onSelectMode, onBack, onHome }: GameModesScreenProps) {
  const getModeColor = (index: number) => {
    const palette = [
      Colors.gold,
      Colors.cyan,
      Colors.dangerRed,
      Colors.successGreen,
      Colors.electricBlue,
      Colors.purple,
      '#F59E0B',
      '#6366F1',
      '#EC4899',
      '#14B8A6',
      '#8B5CF6',
      '#F97316',
      Colors.gold
    ];
    return palette[index % palette.length];
  };

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerBtn} onPress={onBack}>
          <Text style={styles.headerBtnText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Select Game Mode</Text>

        <TouchableOpacity style={styles.headerBtn} onPress={onHome}>
          <Text style={styles.headerBtnText}>🏠</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Choose your arena — 13 Competitive Formats</Text>

        <View style={styles.grid}>
          {GAME_MODES.map((mode: GameModeInfo, index: number) => {
            const accentColor = getModeColor(index);

            return (
              <TouchableOpacity
                key={mode.id}
                style={[styles.modeTile, { borderColor: `${accentColor}44` }]}
                onPress={() => onSelectMode(mode.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconCircle, { backgroundColor: `${accentColor}22`, borderColor: accentColor }]}>
                  <Text style={styles.modeEmoji}>{mode.icon}</Text>
                </View>

                <Text style={styles.modeName} numberOfLines={1}>{mode.name}</Text>
                <Text style={styles.modeTagline}>{mode.tagline}</Text>
                <Text style={styles.modePlayers}>{mode.players}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  headerBar: {
    height: 56,
    backgroundColor: Colors.midnightBlue,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerBtnText: {
    color: Colors.premiumWhite,
    fontSize: 16,
    fontWeight: '900'
  },
  headerTitle: {
    color: Colors.premiumWhite,
    fontSize: 16,
    fontWeight: '900'
  },
  content: {
    padding: Spacing.md,
    paddingBottom: 32
  },
  subtitle: {
    color: Colors.slate,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600'
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between'
  },
  modeTile: {
    width: '48%',
    backgroundColor: Colors.cardBg,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    alignItems: 'center'
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8
  },
  modeEmoji: {
    fontSize: 22
  },
  modeName: {
    color: Colors.premiumWhite,
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center'
  },
  modeTagline: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2
  },
  modePlayers: {
    color: Colors.slate,
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2
  }
});

export default GameModesScreen;
