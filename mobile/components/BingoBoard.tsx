/**
 * mobile/components/BingoBoard.tsx
 * 
 * 5x5 Bingo Board Grid for React Native Mobile Application.
 * Supports numbers 1-25, center star ★, marked cells, and 3D corner lottery balls.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Colors from '../theme/colors';

export interface BingoBoardProps {
  board: (number | null)[];
  markedNumbers: Set<number>;
  completedLines: any[];
  isArranging?: boolean;
  onCellPress: (num: number | null, index: number) => void;
}

export function BingoBoard({
  board = [],
  markedNumbers = new Set(),
  completedLines = [],
  isArranging = false,
  onCellPress
}: BingoBoardProps) {
  const screenWidth = Dimensions.get('window').width;
  const boardSize = Math.min(screenWidth - 32, 360);
  const cellSize = Math.floor((boardSize - 20) / 5);

  return (
    <View style={[styles.container, { width: boardSize, height: boardSize }]}>
      <View style={styles.grid}>
        {board.map((num, idx) => {
          const isMarked = num !== null && markedNumbers.has(num);
          const isCenter = idx === 12;

          return (
            <TouchableOpacity
              key={idx}
              style={[
                styles.cell,
                { width: cellSize, height: cellSize },
                isMarked && styles.cellMarked
              ]}
              onPress={() => onCellPress(num, idx)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Cell ${idx + 1}, number ${num || 'empty'}`}
            >
              <Text style={[styles.cellText, isMarked && styles.cellTextMarked]}>
                {isCenter && !isMarked ? '★ ' : ''}
                {num || ''}
              </Text>

              {isMarked && (
                <View style={styles.stampDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3D Corner Lottery Balls Decoration */}
      <View style={styles.ballBottomLeft}>
        <View style={[styles.lotteryBall, { backgroundColor: Colors.dangerRed }]}>
          <Text style={styles.ballText}>7</Text>
        </View>
        <View style={[styles.lotteryBall, { backgroundColor: Colors.cyan }]}>
          <Text style={styles.ballText}>7</Text>
        </View>
      </View>

      <View style={styles.ballBottomRight}>
        <View style={[styles.lotteryBall, { backgroundColor: '#6366F1' }]}>
          <Text style={styles.ballText}>19</Text>
        </View>
        <View style={[styles.lotteryBall, { backgroundColor: '#EC4899' }]}>
          <Text style={styles.ballText}>22</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.borderHighlight,
    padding: 8,
    position: 'relative',
    alignSelf: 'center',
    marginVertical: 8
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center'
  },
  cell: {
    backgroundColor: Colors.secondaryBlue,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(67, 139, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  cellMarked: {
    backgroundColor: 'rgba(40, 100, 217, 0.35)',
    borderColor: Colors.electricBlue
  },
  cellText: {
    color: Colors.premiumWhite,
    fontSize: 16,
    fontWeight: '900'
  },
  cellTextMarked: {
    color: Colors.gold
  },
  stampDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.successGreen
  },
  ballBottomLeft: {
    position: 'absolute',
    bottom: -10,
    left: -8,
    flexDirection: 'row',
    gap: 3
  },
  ballBottomRight: {
    position: 'absolute',
    bottom: -10,
    right: -8,
    flexDirection: 'row',
    gap: 3
  },
  lotteryBall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF'
  },
  ballText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900'
  }
});

export default BingoBoard;
