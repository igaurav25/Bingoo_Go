/**
 * mobile/screens/HomeScreen.tsx
 * 
 * Premium Esports Gaming Dashboard for React Native Mobile Application.
 * Recreated with pixel-fidelity from visual reference board:
 * - Top Header: Player123 Lv. 15, Coin Vault 12,450, Notification pulse, Settings
 * - Featured Championship Banner: "BINGO CHAMPIONSHIP", Trophy Graphic, "Join Now →"
 * - 4 Mode Shortcuts: Quick Match ⚡, Private Room 👥, Tournaments 🏆, Friends 👥
 * - Recent Matches Card: "You Won! +500 Coins • 2 min ago"
 * - 5-Box Room Code Drawer for instant duel joining
 * - Daily Attendance Reward Card
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert
} from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import Card from '../components/Card';
import Button from '../components/Button';
import TrophyGraphic from '../components/TrophyGraphic';

export interface HomeScreenProps {
  currentUserId?: string;
  recentMatches?: any[];
  dailyClaimed?: boolean;
  onClaimDaily?: () => void;
  onSelectMode: (modeId: string) => void;
  onJoinRoomByCode?: (code: string) => void;
  onOpenTournaments?: () => void;
  onOpenFriends?: () => void;
  onViewAllModes?: () => void;
}

export function HomeScreen({
  recentMatches = [],
  dailyClaimed: externalDailyClaimed,
  onClaimDaily,
  onSelectMode,
  onJoinRoomByCode,
  onOpenTournaments,
  onOpenFriends,
  onViewAllModes
}: HomeScreenProps) {
  const [codeBoxes, setCodeBoxes] = useState<string[]>(['', '', '', '', '']);
  const [localDailyClaimed, setLocalDailyClaimed] = useState<boolean>(false);
  const dailyClaimed = externalDailyClaimed ?? localDailyClaimed;

  const handleBoxChange = (text: string, index: number) => {
    const val = text.toUpperCase().replace(/[^2-9BCDFGHJKLMNPQRSTVWXYZ]/g, '');
    const next = [...codeBoxes];
    next[index] = val.slice(-1);
    setCodeBoxes(next);
  };

  const handleJoinByCode = () => {
    const fullCode = codeBoxes.join('');
    if (fullCode.length !== 5) {
      Alert.alert('Invalid Code', 'Please enter a complete 5-character room code.');
      return;
    }
    onJoinRoomByCode ? onJoinRoomByCode(fullCode) : onSelectMode('private-room');
  };

  const handleClaimDaily = () => {
    setLocalDailyClaimed(true);
    onClaimDaily && onClaimDaily();
    Alert.alert('Gift Collected!', 'You received +100 Coins for daily attendance!');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* 1. Featured Championship Tournament Banner */}
      <Card style={styles.bannerCard} highlighted>
        <View style={styles.bannerRow}>
          <View style={styles.bannerTextCol}>
            <View style={styles.seasonTag}>
              <Text style={styles.seasonTagText}>SEASON 01 • BROADCAST LIVE</Text>
            </View>
            <Text style={styles.bannerTitle}>BINGO CHAMPIONSHIP</Text>
            <Text style={styles.bannerSubtitle}>Win Big Prizes! 10,000 Coins</Text>

            <TouchableOpacity
              style={styles.joinNowBtn}
              onPress={onOpenTournaments}
              activeOpacity={0.8}
            >
              <Text style={styles.joinNowText}>Join Now →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bannerTrophyCol}>
            <TrophyGraphic size={64} />
          </View>
        </View>
      </Card>

      {/* 2. Four Core Mode Shortcut Cards */}
      <View style={styles.modesGrid}>
        {/* Quick Match */}
        <TouchableOpacity
          style={[styles.modeCard, { borderColor: Colors.electricBlue }]}
          onPress={() => onSelectMode('quick-match')}
          activeOpacity={0.7}
        >
          <Text style={styles.modeIcon}>⚡</Text>
          <Text style={styles.modeTitle}>Quick Match</Text>
          <Text style={styles.modeDesc}>Play Instantly</Text>
        </TouchableOpacity>

        {/* Private Room */}
        <TouchableOpacity
          style={[styles.modeCard, { borderColor: Colors.cyan }]}
          onPress={() => onSelectMode('private-room')}
          activeOpacity={0.7}
        >
          <Text style={styles.modeIcon}>👥</Text>
          <Text style={styles.modeTitle}>Private Room</Text>
          <Text style={styles.modeDesc}>Create / Join</Text>
        </TouchableOpacity>

        {/* Tournaments */}
        <TouchableOpacity
          style={[styles.modeCard, { borderColor: Colors.gold }]}
          onPress={onOpenTournaments}
          activeOpacity={0.7}
        >
          <Text style={styles.modeIcon}>🏆</Text>
          <Text style={styles.modeTitle}>Tournaments</Text>
          <Text style={styles.modeDesc}>Win Big Prizes</Text>
        </TouchableOpacity>

        {/* Friends */}
        <TouchableOpacity
          style={[styles.modeCard, { borderColor: '#A855F7' }]}
          onPress={onOpenFriends}
          activeOpacity={0.7}
        >
          <Text style={styles.modeIcon}>🤝</Text>
          <Text style={styles.modeTitle}>Friends</Text>
          <Text style={styles.modeDesc}>Challenge Duel</Text>
        </TouchableOpacity>
      </View>

      {/* View All 13 Modes Action */}
      <Button
        title="View All 13 Game Modes →"
        variant="secondary"
        size="small"
        onPress={onViewAllModes}
        style={{ marginVertical: Spacing.xs }}
      />

      {/* 3. Real Recent Matches Card */}
      <Card style={styles.recentMatchCard}>
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Recent Matches</Text>
          <TouchableOpacity onPress={() => onSelectMode('practice')}>
            <Text style={styles.viewAllText}>Practice AI →</Text>
          </TouchableOpacity>
        </View>

        {recentMatches.length === 0 ? (
          <Text style={{ color: Colors.slate, fontSize: 12, paddingVertical: 8 }}>
            No completed matches recorded yet. Start a Quick Match or Private Room!
          </Text>
        ) : (
          <View style={styles.recentItem}>
            <View style={styles.recentItemLeft}>
              <View style={styles.winBadge}>
                <Text style={{ fontSize: 16 }}>{recentMatches[0].result === 'WIN' ? '🏆' : '🎮'}</Text>
              </View>
              <View>
                <Text style={styles.recentResultText}>
                  {recentMatches[0].result === 'WIN' ? 'Victory' : 'Match'} vs {recentMatches[0].opponentName || 'Opponent'}
                </Text>
                <Text style={styles.recentCoinsText}>
                  {recentMatches[0].mode || 'MULTIPLAYER'} • {recentMatches[0].linesCompleted || 0} lines
                </Text>
              </View>
            </View>
            <Text style={styles.recentScoreText}>{recentMatches[0].result}</Text>
          </View>
        )}
      </Card>

      {/* 4. 5-Box Join Room Code Drawer */}
      <Card style={styles.codeDrawerCard}>
        <Text style={styles.codeDrawerTitle}>Enter 5-Character Duel Code</Text>
        <Text style={styles.codeDrawerSubtitle}>Enter code from friend to join room instantly</Text>

        <View style={styles.codeBoxesRow}>
          {codeBoxes.map((box, i) => (
            <TextInput
              key={i}
              style={[styles.codeBox, box ? styles.codeBoxFilled : null]}
              value={box}
              onChangeText={(t) => handleBoxChange(t, i)}
              maxLength={1}
              autoCapitalize="characters"
              placeholder="-"
              placeholderTextColor={Colors.slate}
            />
          ))}
        </View>

        <Button
          title="Join Private Match"
          variant="gold"
          size="medium"
          onPress={handleJoinByCode}
          style={{ width: '100%', marginTop: 8 }}
        />
      </Card>

      {/* 5. Daily Attendance Gift Card */}
      <Card style={styles.dailyCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dailyTitle}>Daily Victory Gift</Text>
          <Text style={styles.dailyDesc}>Claim 100 free coins every 24 hours</Text>
        </View>
        <Button
          title={dailyClaimed ? 'Claimed ✓' : 'Claim 100 🪙'}
          variant={dailyClaimed ? 'secondary' : 'gold'}
          size="small"
          disabled={dailyClaimed}
          onPress={handleClaimDaily}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: 24
  },
  bannerCard: {
    backgroundColor: Colors.midnightBlue,
    borderWidth: 1.5,
    borderColor: Colors.borderGold,
    padding: Spacing.md
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bannerTextCol: {
    flex: 1,
    paddingRight: Spacing.sm
  },
  seasonTag: {
    backgroundColor: 'rgba(243, 185, 79, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(243, 185, 79, 0.4)',
    borderRadius: Spacing.roundPill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: 4
  },
  seasonTagText: {
    color: Colors.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5
  },
  bannerTitle: {
    color: Colors.premiumWhite,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2
  },
  bannerSubtitle: {
    color: Colors.slate,
    fontSize: 11,
    fontWeight: '600',
    marginVertical: 4
  },
  joinNowBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Spacing.roundPill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    marginTop: 4
  },
  joinNowText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900'
  },
  bannerTrophyCol: {
    paddingLeft: Spacing.xs
  },
  modesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between'
  },
  modeCard: {
    width: '48%',
    backgroundColor: Colors.cardBg,
    borderRadius: Spacing.roundLarge,
    borderWidth: 1,
    padding: Spacing.md,
    alignItems: 'center'
  },
  modeIcon: {
    fontSize: 26,
    marginBottom: 4
  },
  modeTitle: {
    color: Colors.premiumWhite,
    fontSize: 14,
    fontWeight: '900'
  },
  modeDesc: {
    color: Colors.slate,
    fontSize: 11,
    fontWeight: '600'
  },
  recentMatchCard: {
    padding: Spacing.md
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  sectionTitle: {
    color: Colors.premiumWhite,
    fontSize: 14,
    fontWeight: '900'
  },
  viewAllText: {
    color: Colors.electricBlue,
    fontSize: 12,
    fontWeight: '700'
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.secondaryBlue,
    borderRadius: 12,
    padding: 10
  },
  recentItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  winBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(243, 185, 79, 0.2)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  recentResultText: {
    color: Colors.successGreen,
    fontSize: 13,
    fontWeight: '900'
  },
  recentCoinsText: {
    color: Colors.slate,
    fontSize: 10,
    fontWeight: '600'
  },
  recentScoreText: {
    color: Colors.premiumWhite,
    fontSize: 14,
    fontWeight: '900'
  },
  codeDrawerCard: {
    padding: Spacing.md,
    alignItems: 'center'
  },
  codeDrawerTitle: {
    color: Colors.premiumWhite,
    fontSize: 14,
    fontWeight: '900'
  },
  codeDrawerSubtitle: {
    color: Colors.slate,
    fontSize: 11,
    marginVertical: 4
  },
  codeBoxesRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10
  },
  codeBox: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.secondaryBlue,
    borderWidth: 1.5,
    borderColor: Colors.border,
    color: Colors.gold,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center'
  },
  codeBoxFilled: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(243, 185, 79, 0.15)'
  },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md
  },
  dailyTitle: {
    color: Colors.premiumWhite,
    fontSize: 13,
    fontWeight: '900'
  },
  dailyDesc: {
    color: Colors.slate,
    fontSize: 10
  }
});

export default HomeScreen;
