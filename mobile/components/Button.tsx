/**
 * mobile/components/Button.tsx
 * 
 * Reusable Tactile Sports Button for React Native.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'gold' | 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon
}: ButtonProps) {
  const getContainerStyle = () => {
    switch (variant) {
      case 'gold':
        return styles.btnGold;
      case 'secondary':
        return styles.btnSecondary;
      case 'outline':
        return styles.btnOutline;
      case 'danger':
        return styles.btnDanger;
      case 'primary':
      default:
        return styles.btnPrimary;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'gold':
        return styles.textGold;
      case 'outline':
        return styles.textOutline;
      default:
        return styles.textLight;
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.sizeSmall;
      case 'large':
        return styles.sizeLarge;
      case 'medium':
      default:
        return styles.sizeMedium;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        getContainerStyle(),
        getSizeStyle(),
        disabled && styles.disabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'gold' ? '#000000' : '#FFFFFF'} size="small" />
      ) : (
        <>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={[styles.baseText, getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Spacing.roundPill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  baseText: {
    fontWeight: '900',
    letterSpacing: 0.2
  },
  sizeSmall: {
    minHeight: 34,
    paddingHorizontal: 12
  },
  sizeMedium: {
    minHeight: 46,
    paddingHorizontal: 18
  },
  sizeLarge: {
    minHeight: 54,
    paddingHorizontal: 24
  },
  btnPrimary: {
    backgroundColor: Colors.royalBlue,
    borderWidth: 1,
    borderColor: Colors.electricBlue
  },
  btnGold: {
    backgroundColor: Colors.gold,
    borderWidth: 1.5,
    borderColor: Colors.goldLight
  },
  btnSecondary: {
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 1,
    borderColor: Colors.border
  },
  btnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.electricBlue
  },
  btnDanger: {
    backgroundColor: Colors.dangerRed,
    borderWidth: 1,
    borderColor: '#F87171'
  },
  textLight: {
    color: Colors.premiumWhite,
    fontSize: 14
  },
  textGold: {
    color: '#000000',
    fontSize: 15
  },
  textOutline: {
    color: Colors.electricBlue,
    fontSize: 14
  },
  icon: {
    fontSize: 16
  },
  disabled: {
    opacity: 0.5
  }
});

export default Button;
