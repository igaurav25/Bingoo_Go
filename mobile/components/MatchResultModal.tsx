/**
 * mobile/components/MatchResultModal.tsx
 * 
 * Sports Tournament Match Victory / Defeat Result Modal for React Native.
 * Matches visual reference board:
 * - 5 VS 2 Head-to-Head score card (Rohit_23 Lv. 18 vs BingoKing Lv. 17)
 * - Rewards Earned block: +750 Coins, +20 Diamonds
 * - Play Again (Gold) and Back to Home (Royal Blue) buttons
 */

import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import AvatarFrame from './AvatarFrame';
import Button from './Button';

export interface MatchResultModalProps {
  visible: boolean;
  won?: boolean;
  reason?: string;
  playerName?: string;
  playerAvatar?: string;
  playerLevel?: number;
  opponentName?: string;
  opponentAvatar?: string;
  opponentLevel?: number;
  playerScore?: number;
  opponentScore?: number;
  coinsEarned?: number;
  diamondsEarned?: number;
  onRematch?: () => void;
  onHome?: () => void;
}

export function MatchResultModal({
  visible,
  won = true,
  reason,
  playerName = 'You',
  playerAvatar = '🦊',
  playerLevel = 1,
  opponentName = 'Opponent',
  opponentAvatar = '🐯',
  opponentLevel = 14,
  playerScore = 5,
  opponentScore = 2,
  coinsEarned = 150,
  diamondsEarned = 0,
  onRematch,
  onHome
}: MatchResultModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Trophy Header */}
          <Text style={styles.trophyEmoji}>{won ? '🏆' : '💔'}</Text>
          <Text style={[styles.title, { color: won ? Colors.gold : Colors.dangerRed }]}>
            {won ? 'YOU WON!' : 'DEFEAT'}
          </Text>

          {/* Head-to-Head Score Card */}
          <View style={styles.scoreBlock}>
            <View style={styles.competitorCol}>
              <AvatarFrame avatar={playerAvatar} level={playerLevel} rank="Player" size={38} />
              <Text style={styles.playerName} numberOfLines={1}>{playerName}</Text>
              <Text style={styles.playerLevel}>Lv. {playerLevel}</Text>
            </View>

            <View style={styles.centerScore}>
              <Text style={[styles.scoreDigit, { color: won ? Colors.gold : Colors.premiumWhite }]}>
                {playerScore}
              </Text>
              <View style={styles.vsPill}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <Text style={[styles.scoreDigit, { color: won ? Colors.slate : Colors.gold }]}>
                {opponentScore}
              </Text>
            </View>

            <View style={styles.competitorCol}>
              <AvatarFrame avatar={opponentAvatar} level={opponentLevel} rank="Opponent" size={38} />
              <Text style={styles.playerName} numberOfLines={1}>{opponentName}</Text>
              <Text style={styles.opponentLevel}>Lv. {opponentLevel}</Text>
            </View>
          </View>

          {/* Rewards Earned Block */}
          {won && coinsEarned > 0 && (
            <View style={styles.rewardsCard}>
              <Text style={styles.rewardsCaption}>VERIFIED REWARD</Text>
              <View style={styles.rewardsRow}>
                <View style={styles.rewardItem}>
                  <Text style={styles.rewardIcon}>🪙</Text>
                  <Text style={styles.rewardCoins}>+{coinsEarned}</Text>
                </View>
                {diamondsEarned > 0 && (
                  <View style={styles.rewardItem}>
                    <Text style={styles.rewardIcon}>💎</Text>
                    <Text style={styles.rewardDiamonds}>+{diamondsEarned}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <Text style={styles.reasonText}>
            {reason || (won ? 'Server verified your 5-line BINGO victory!' : 'Opponent completed BINGO first.')}
          </Text>

          {/* Action Buttons */}
          <View style={styles.btnCol}>
            <Button
              title="Play Again"
              variant="gold"
              size="medium"
              onPress={onRematch}
            />
            <Button
              title="Back to Home"
              variant="primary"
              size="medium"
              onPress={onHome}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.darkOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg
  },
  card: {
    backgroundColor: Colors.midnightBlue,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Colors.borderGold,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center'
  },
  trophyEmoji: {
    fontSize: 44,
    marginBottom: 4
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1
  },
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderWidth: 1,
    borderColor: Colors.borderHighlight,
    borderRadius: 16,
    padding: 12,
    marginVertical: 12,
    width: '100%'
  },
  competitorCol: {
    alignItems: 'center',
    gap: 2
  },
  playerName: {
    color: Colors.premiumWhite,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2
  },
  playerLevel: {
    color: Colors.gold,
    fontSize: 9,
    fontWeight: '700'
  },
  opponentLevel: {
    color: Colors.slate,
    fontSize: 9,
    fontWeight: '700'
  },
  centerScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  scoreDigit: {
    fontSize: 26,
    fontWeight: '900'
  },
  vsPill: {
    backgroundColor: 'rgba(243, 185, 79, 0.2)',
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  vsText: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '900'
  },
  rewardsCard: {
    backgroundColor: 'rgba(243, 185, 79, 0.1)',
    borderWidth: 1,
    borderColor: Colors.borderGold,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    width: '100%',
    marginBottom: 10
  },
  rewardsCaption: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.slate
  },
  rewardsRow: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 4
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  rewardIcon: {
    fontSize: 16
  },
  rewardCoins: {
    color: Colors.gold,
    fontSize: 14,
    fontWeight: '900'
  },
  rewardDiamonds: {
    color: Colors.cyan,
    fontSize: 14,
    fontWeight: '900'
  },
  reasonText: {
    color: Colors.slate,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14
  },
  btnCol: {
    width: '100%',
    gap: 8
  }
});

export default MatchResultModal;
