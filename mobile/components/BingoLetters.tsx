/**
 * mobile/components/BingoLetters.tsx
 * 
 * Top B — I — N — G — O Word Progression Bar.
 * Distinct 5-color palette matching visual reference:
 * - B: Coral Red (#E6535D)
 * - I: Amber Orange (#F59E0B)
 * - N: Teal Green (#10B981)
 * - G: Electric Blue (#3B82F6)
 * - O: Magenta Purple (#A855F7)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export interface BingoLettersProps {
  completedLinesCount?: number;
}

export function BingoLetters({ completedLinesCount = 0 }: BingoLettersProps) {
  const letters = ['B', 'I', 'N', 'G', 'O'];
  const colors = [
    Colors.columnB,
    Colors.columnI,
    Colors.columnN,
    Colors.columnG,
    Colors.columnO
  ];

  return (
    <View style={styles.container}>
      {letters.map((letter, index) => {
        const isStruck = index < completedLinesCount;
        const letterColor = colors[index];

        return (
          <View
            key={letter}
            style={[
              styles.letterTile,
              {
                borderColor: isStruck ? Colors.gold : letterColor,
                backgroundColor: isStruck ? 'rgba(243, 185, 79, 0.2)' : Colors.secondaryBlue
              }
            ]}
          >
            <Text
              style={[
                styles.letterText,
                { color: isStruck ? Colors.gold : Colors.premiumWhite }
              ]}
            >
              {letter}
            </Text>
            {isStruck && <View style={styles.strikeSlash} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 6,
    width: '100%'
  },
  letterTile: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  letterText: {
    fontSize: 20,
    fontWeight: '900'
  },
  strikeSlash: {
    position: 'absolute',
    width: '110%',
    height: 2.5,
    backgroundColor: Colors.gold,
    transform: [{ rotate: '-45deg' }]
  }
});

export default BingoLetters;
