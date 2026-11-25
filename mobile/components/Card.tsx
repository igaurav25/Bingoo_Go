/**
 * mobile/components/Card.tsx
 * 
 * Reusable Sports Elevated Container Card.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
  highlighted?: boolean;
}

export function Card({ children, style, elevated = false, highlighted = false }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        elevated && styles.elevated,
        highlighted && styles.highlighted,
        style
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.cardBg,
    borderRadius: Spacing.roundLarge,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md
  },
  elevated: {
    backgroundColor: Colors.cardElevated
  },
  highlighted: {
    borderColor: Colors.borderHighlight
  }
});

export default Card;
