/**
 * mobile/components/SignalStrengthBars.tsx
 * 
 * 4-Bar Cellular Connection Signal Strength Indicator for React Native.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export interface SignalStrengthBarsProps {
  bars?: number;
  size?: number;
  color?: string;
}

export function SignalStrengthBars({
  bars = 4,
  size = 14,
  color = Colors.successGreen
}: SignalStrengthBarsProps) {
  const barHeights = [0.35, 0.55, 0.75, 1.0];

  return (
    <View style={[styles.container, { height: size, width: size * 1.1 }]}>
      {barHeights.map((h, i) => {
        const isActive = i < bars;
        return (
          <View
            key={i}
            style={[
              styles.bar,
              {
                height: `${h * 100}%`,
                backgroundColor: isActive ? color : 'rgba(255, 255, 255, 0.2)'
              }
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2
  },
  bar: {
    width: 2.5,
    borderRadius: 1
  }
});

export default SignalStrengthBars;
