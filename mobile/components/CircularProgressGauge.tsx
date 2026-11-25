/**
 * mobile/components/CircularProgressGauge.tsx
 * 
 * Native Circular Progress Gauge for React Native.
 * Shows percentage and lines (e.g., 40% 2 Lines, 20% 1 Line).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export interface CircularProgressGaugeProps {
  percent?: number;
  label?: string;
  caption?: string;
  color?: string;
  size?: number;
}

export function CircularProgressGauge({
  percent = 40,
  label = '2 Lines',
  caption = 'Your Progress',
  color = Colors.electricBlue,
  size = 64
}: CircularProgressGaugeProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.captionText}>{caption}</Text>
      <Text style={styles.labelText}>{label}</Text>

      <View
        style={[
          styles.gaugeOuter,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: color
          }
        ]}
      >
        <Text style={[styles.percentText, { color }]}>{percent}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 2
  },
  captionText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.slate,
    textTransform: 'uppercase'
  },
  labelText: {
    fontSize: 12,
    fontWeight: '900',
    color: Colors.premiumWhite
  },
  gaugeOuter: {
    backgroundColor: 'rgba(12, 20, 34, 0.8)',
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  percentText: {
    fontSize: 12,
    fontWeight: '900'
  }
});

export default CircularProgressGauge;
