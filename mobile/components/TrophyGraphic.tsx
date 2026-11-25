/**
 * mobile/components/TrophyGraphic.tsx
 * 
 * High-Resolution Golden Sports Trophy for React Native.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export interface TrophyGraphicProps {
  size?: number;
}

export function TrophyGraphic({ size = 54 }: TrophyGraphicProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 0.75 }}>🏆</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default TrophyGraphic;
