/**
 * mobile/screens/BingoGameScreen.tsx
 * 
 * Complete 5x5 Bingo Competitive Arena Screen for React Native.
 * Matches visual reference board pixel-for-pixel:
 * - Top Competitor HUD: You Lv. 15, ⏱ 00:45, Rival_07 Lv. 17 with 4-bar cellular signal
 * - Dual Circular Progress Gauges: Your Progress 40% (2 Lines) vs Opponent 20% (1 Line)
 * - 5-Color B-I-N-G-O progression bar
 * - 5x5 Grid Board with center star ★, marked cells, and 3D corner lottery balls
 * - Tactile golden BINGO! claim button with line progress pips
 * - MatchResultModal: 5 VS 2 head-to-head score, rewards +750 🪙, +20 💎
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Colors from '../theme/colors';
import Spacing from '../theme/spacing';
import { useBingoGame } from '../hooks/useBingoGame';
import AvatarFrame from '../components/AvatarFrame';
import SignalStrengthBars from '../components/SignalStrengthBars';
import CircularProgressGauge from '../components/CircularProgressGauge';
import BingoLetters from '../components/BingoLetters';
import BingoBoard from '../components/BingoBoard';
import BingoButton from '../components/BingoButton';
import Button from '../components/Button';
import MatchResultModal from '../components/MatchResultModal';
import { apiClient } from '../services/apiClient';

export interface BingoGameScreenProps {
  initialMode?: string;
  roomCode?: string | null;
  roomState?: any;
  currentUser?: { id?: string; username?: string; name?: string; avatar?: string; level?: number };
  tournamentMatch?: any;
  onCoinsUpdate?: (delta: number) => void;
  onExit: () => void;
}

export function BingoGameScreen({
  initialMode = 'practice',
  roomCode = null,
  roomState = null,
  currentUser,
  tournamentMatch = null,
  onCoinsUpdate,
  onExit
}: BingoGameScreenProps) {
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  const {
    board,
    isLocked,
    markedNumbers,
    completedLines,
    bingoLetterCount,
    isBingoButtonActive,
    isSubmitting,
    matchStatus,
    isMyTurn,
    turnPlayerName,
    turnSecondsRemaining,
    recentCalls,
    matchResult,
    opponent,
    errorMessage,
    setErrorMessage,
    randomArrange,
    shuffle,
    clearBoard,
    lockBoard,
    markNumber,
    claimBingo,
    setMatchStatus,
    setOpponent
  } = useBingoGame({
    initialMode,
    roomCode,
    roomState,
    currentUserId: currentUser?.id,
    onVictory: (res) => {
      setShowResultModal(true);
      const earned = res?.coinsAwarded ?? 0;
      if (res?.won && earned > 0 && onCoinsUpdate) {
        onCoinsUpdate(earned);
      }
    }
  });

  // If tournament match passed without active remote room snapshot yet, show opponent label cleanly
  useEffect(() => {
    if (tournamentMatch && !roomState) {
      const opp = tournamentMatch.player2 || (tournamentMatch.slots && tournamentMatch.slots[1]) || { name: 'Tournament Rival', avatar: '🦁' };
      setOpponent({
        id: opp.id || 'rival-tourn',
        name: opp.name || opp.playerName || 'Tournament Rival',
        avatar: opp.avatar || '🦁',
        level: 15,
        rank: 'Challenger',
        online: true,
        linesCompleted: 0
      });
    }
  }, [tournamentMatch, roomState, setOpponent]);

  const formatTimer = (sec: number) => {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m < 10 ? '0' : ''}${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleCellPress = (num: number | null, _index: number) => {
    if (matchStatus === 'playing' && num !== null) {
      markNumber(num);
    }
  };

  const handleRematch = () => {
    setShowResultModal(false);
    randomArrange();
    setMatchStatus(roomCode ? 'arranging' : 'playing');
  };

  const myName = currentUser?.name || currentUser?.username || 'You';
  const myAvatar = currentUser?.avatar || '🦊';
  const myLevel = currentUser?.level || 1;
  const yourLines = completedLines.length;
  const oppLines = opponent?.linesCompleted ?? 0;

  return (
    <View style={styles.container}>
      {/* 1. Top Competitor HUD */}
      <View style={styles.topHud}>
        <View style={styles.playerCol}>
          <AvatarFrame avatar={myAvatar} level={myLevel} rank="Player" size={38} />
          <View>
            <Text style={styles.playerName} numberOfLines={1}>{myName}</Text>
            <Text style={styles.playerLevel}>Lv. {myLevel}</Text>
          </View>
        </View>

        <View style={styles.timerPill}>
          <Text style={styles.timerIcon}>⏱</Text>
          <Text style={styles.timerDigits}>{formatTimer(turnSecondsRemaining)}</Text>
        </View>

        <View style={styles.playerCol}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.playerName} numberOfLines={1}>{opponent.name}</Text>
            <Text style={styles.opponentLevel}>{roomCode ? `Room ${roomCode}` : `Lv. ${opponent.level || 14}`}</Text>
          </View>
          <AvatarFrame avatar={opponent.avatar} level={opponent.level || 14} rank="Opponent" size={38} />
          <SignalStrengthBars bars={4} size={14} color={Colors.successGreen} />
        </View>
      </View>

      {/* Sub-bar with Exit & Turn Indicator */}
      <View style={styles.subBar}>
        <TouchableOpacity style={styles.exitBtn} onPress={onExit}>
          <Text style={styles.exitBtnText}>← Exit</Text>
        </TouchableOpacity>

        <View style={styles.turnIndicator}>
          <Text style={[styles.turnDot, { color: isMyTurn ? Colors.successGreen : Colors.gold }]}>●</Text>
          <Text style={styles.turnText}>
            {matchStatus === 'arranging'
              ? (isLocked ? 'Waiting for opponent lock...' : 'Arrange & Lock Board')
              : (isMyTurn ? 'Your Turn' : `${turnPlayerName}'s Turn`)}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => Alert.alert('How to Play', 'Complete 5 horizontal or vertical lines and press the golden BINGO claim button!')}
        >
          <Text style={styles.helpBtnText}>❓</Text>
        </TouchableOpacity>
      </View>

      {errorMessage && (
        <TouchableOpacity
          style={{ backgroundColor: 'rgba(230,83,93,0.2)', borderColor: Colors.dangerRed, borderWidth: 1, margin: 8, padding: 8, borderRadius: 8 }}
          onPress={() => setErrorMessage(null)}
        >
          <Text style={{ color: '#FCA5A5', fontSize: 12, textAlign: 'center', fontWeight: '700' }}>⚠️ {errorMessage}</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.gaugesRow}>
          <CircularProgressGauge
            percent={Math.min(100, yourLines * 20)}
            label={`${yourLines} ${yourLines === 1 ? 'Line' : 'Lines'}`}
            caption="Your Progress"
            color={Colors.electricBlue}
            size={66}
          />
          <CircularProgressGauge
            percent={Math.min(100, oppLines * 20)}
            label={`${oppLines} ${oppLines === 1 ? 'Line' : 'Lines'}`}
            caption="Opponent"
            color={Colors.purple}
            size={66}
          />
        </View>

        <BingoLetters completedLinesCount={bingoLetterCount} />

        <BingoBoard
          board={board}
          markedNumbers={markedNumbers}
          completedLines={completedLines}
          isArranging={matchStatus === 'arranging' && !isLocked}
          onCellPress={handleCellPress}
        />

        {matchStatus === 'playing' && (
          <BingoButton
            isActive={isBingoButtonActive}
            isSubmitting={isSubmitting}
            completedLinesCount={completedLines.length}
            onPress={claimBingo}
          />
        )}

        {matchStatus === 'arranging' && !isLocked && (
          <View style={styles.controlsRow}>
            <Button title="Auto Arrange" variant="secondary" size="small" onPress={randomArrange} />
            <Button title="Shuffle" variant="secondary" size="small" onPress={shuffle} />
            <Button title="Lock & Play 🔒" variant="gold" size="small" onPress={() => { if (!lockBoard()) Alert.alert('Incomplete', 'Arrange all numbers 1-25 first.'); }} />
          </View>
        )}

        {recentCalls.length > 0 && (
          <View style={styles.recentCallsStrip}>
            <Text style={styles.recentLabel}>Calls:</Text>
            {recentCalls.map((num, idx) => (
              <View key={idx} style={[styles.callChip, idx === 0 && styles.callChipLatest]}>
                <Text style={styles.callChipText}>{num}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <MatchResultModal
        visible={showResultModal}
        won={matchResult?.won ?? true}
        reason={matchResult?.reason}
        playerName={myName}
        playerAvatar={myAvatar}
        playerLevel={myLevel}
        opponentName={opponent.name}
        opponentAvatar={opponent.avatar}
        opponentLevel={opponent.level || 14}
        playerScore={matchResult?.playerScore ?? yourLines}
        opponentScore={matchResult?.opponentScore ?? oppLines}
        coinsEarned={matchResult?.coinsAwarded ?? 0}
        diamondsEarned={matchResult?.diamondsAwarded ?? 0}
        onRematch={handleRematch}
        onHome={onExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background
  },
  topHud: {
    height: 56,
    backgroundColor: Colors.midnightBlue,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md
  },
  playerCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  playerName: {
    color: Colors.premiumWhite,
    fontSize: 12,
    fontWeight: '800'
  },
  playerLevel: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '700'
  },
  opponentLevel: {
    color: Colors.slate,
    fontSize: 10,
    fontWeight: '700'
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(12, 20, 34, 0.85)',
    borderWidth: 1.5,
    borderColor: Colors.borderGold,
    borderRadius: Spacing.roundPill,
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  timerIcon: {
    fontSize: 12
  },
  timerDigits: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '900'
  },
  subBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border
  },
  exitBtn: {
    backgroundColor: Colors.secondaryBlue,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  exitBtnText: {
    color: Colors.slate,
    fontSize: 11,
    fontWeight: '700'
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  turnDot: {
    fontSize: 10
  },
  turnText: {
    color: Colors.premiumWhite,
    fontSize: 12,
    fontWeight: '800'
  },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.secondaryBlue,
    alignItems: 'center',
    justifyContent: 'center'
  },
  helpBtnText: {
    fontSize: 14
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 24,
    alignItems: 'center'
  },
  gaugesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginVertical: 6
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6
  },
  recentCallsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8
  },
  recentLabel: {
    color: Colors.slate,
    fontSize: 11,
    fontWeight: '700'
  },
  callChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.secondaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border
  },
  callChipLatest: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(243, 185, 79, 0.25)'
  },
  callChipText: {
    color: Colors.premiumWhite,
    fontSize: 11,
    fontWeight: '900'
  }
});

export default BingoGameScreen;
