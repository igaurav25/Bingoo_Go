/**
 * mobile/components/BingoButton.tsx
 * 
 * Central Tactile Golden BINGO Claim Button for React Native.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';

export interface BingoButtonProps {
  isActive: boolean;
  isSubmitting?: boolean;
  completedLinesCount?: number;
  onPress: () => void;
}

export function BingoButton({
  isActive,
  isSubmitting = false,
  completedLinesCount = 0,
  onPress
}: BingoButtonProps) {
  const pips = [0, 1, 2, 3, 4];
  const count = Math.min(5, Math.max(0, completedLinesCount));

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          isActive ? styles.buttonActive : styles.buttonLocked
        ]}
        onPress={onPress}
        disabled={!isActive || isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Claim Bingo Victory"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#000000" size="small" />
        ) : (
          <Text style={styles.buttonText}>BINGO!</Text>
        )}

        {/* Progress Pips */}
        <View style={styles.pipsRow}>
          {pips.map((pip) => (
            <View
              key={pip}
              style={[
                styles.pip,
                pip < count ? styles.pipFilled : styles.pipEmpty
              ]}
            />
          ))}
        </View>
      </TouchableOpacity>

      {/* Subtitle status info */}
      <Text style={styles.helpText}>
        {isSubmitting
          ? '⏳ Server checking your 5-line win...'
          : isActive
          ? '⚡ 5 Lines Complete! Tap BINGO to Claim Win!'
          : `🔒 ${count}/5 lines complete • Complete 5 lines to unlock`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: Spacing.sm,
    width: '100%'
  },
  button: {
    width: '85%',
    maxWidth: 320,
    minHeight: 52,
    borderRadius: Spacing.roundPill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20
  },
  buttonActive: {
    backgroundColor: Colors.gold,
    borderWidth: 2,
    borderColor: Colors.goldLight
  },
  buttonLocked: {
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 1.5,
    borderColor: Colors.border,
    opacity: 0.65
  },
  buttonText: {
    color: '#000000',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.5
  },
  pipsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 3
  },
  pip: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  pipFilled: {
    backgroundColor: '#000000'
  },
  pipEmpty: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)'
  },
  helpText: {
    fontSize: 11,
    color: Colors.slate,
    marginTop: 6,
    fontWeight: '600'
  }
});

export default BingoButton;
