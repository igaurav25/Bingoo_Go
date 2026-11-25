/**
 * mobile/components/BottomNav.tsx
 * 
 * Native Bottom Navigation Dock.
 * Displays tabs: Home, Modes, Tournaments, Friends, Profile.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Colors from '../theme/colors';

export type TabKey = 'home' | 'modes' | 'tournaments' | 'friends' | 'profile';

export interface BottomNavProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

export function BottomNav({ activeTab, onSelectTab }: BottomNavProps) {
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'modes', label: 'Modes', icon: '⚡' },
    { key: 'tournaments', label: 'Tournaments', icon: '🏆' },
    { key: 'friends', label: 'Friends', icon: '👥' },
    { key: 'profile', label: 'Profile', icon: '🦊' }
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, isActive && styles.activeTabButton]}
            onPress={() => onSelectTab(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, isActive && styles.activeTabLabel]}>{tab.label}</Text>
            {isActive && <View style={styles.activeBar} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 64,
    backgroundColor: Colors.midnightBlue,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 6
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative'
  },
  activeTabButton: {},
  tabIcon: {
    fontSize: 18,
    opacity: 0.6
  },
  activeTabIcon: {
    opacity: 1,
    transform: [{ scale: 1.1 }]
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.slate,
    marginTop: 2
  },
  activeTabLabel: {
    color: Colors.gold,
    fontWeight: '900'
  },
  activeBar: {
    position: 'absolute',
    bottom: 2,
    width: 20,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.gold
  }
});

export default BottomNav;
