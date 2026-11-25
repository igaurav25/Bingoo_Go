/**
 * src/components/BingoGame.jsx
 *
 * Root Game Component for BINGO 2D.
 * Unites 5x5 board, cell interactions, continuous SVG strike-throughs,
 * authoritative WebSocket synchronization, turn timer, BINGO claims,
 * waiting/pause overlays, tutorial & help modals.
 */

import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useBingoGame } from '../hooks/useBingoGame.js';
import { BingoBoard } from './BingoBoard.jsx';
import { BingoLetters } from './BingoLetters.jsx';
import { BingoButton } from './BingoButton.jsx';
import { GameControls } from './GameControls.jsx';
import { MatchResult } from './MatchResult.jsx';
import { TutorialModal } from './TutorialModal.jsx';
import { GameplayHelpModal } from './GameplayHelpModal.jsx';
import { CircularProgressGauge, SignalStrengthIcon, AvatarFrame } from './SportsGraphics.jsx';
import { soundManager } from '../../public/js/audio.js';

export function BingoGame({
  roomCode = null,
  socket = null,
  roomState = null,
  currentUser = null,
  turnDuration = 30,
  offlineP1 = 'Player 1',
  offlineP2 = 'Player 2',
  initialMode = 'practice',
  tournamentMatch = null,
  onCoinsUpdate = null,
  onNavigateTournament = null,
  onExit = null
}) {
  const [showHelp, setShowHelp] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [countdownStep, setCountdownStep] = useState(null);
  const prevStatusRef = useRef(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('bingo_tutorial_seen');
      if (!seen) setShowTutorial(true);
    } catch {}
  }, []);

  const {
    board,
    isLocked,
    markedNumbers,
    completedLines,
    newlyStruckLineId,
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
    survivalLives,
    rematchRequested,
    pauseInfo,
    lastReaction,
    randomArrange,
    shuffle,
    clearBoard,
    setCellNumber,
    lockBoard,
    markNumber,
    claimBingo,
    requestRematch,
    sendReaction,
    setMatchStatus
  } = useBingoGame({
    initialMode,
    roomCode,
    socket,
    roomState,
    currentUser,
    turnDuration,
    offlineP1,
    offlineP2,
    onCoinsUpdate
  });

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = matchStatus;
    if (prev === 'arranging' && matchStatus === 'playing') {
      const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (reduced) return;
      setCountdownStep('3');
      soundManager.playCountdownBeep?.(false);
      const t1 = setTimeout(() => { setCountdownStep('2'); soundManager.playCountdownBeep?.(false); }, 420);
      const t2 = setTimeout(() => { setCountdownStep('1'); soundManager.playCountdownBeep?.(false); }, 840);
      const t3 = setTimeout(() => { setCountdownStep('GO!'); soundManager.playCountdownBeep?.(true); }, 1260);
      const t4 = setTimeout(() => setCountdownStep(null), 1650);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
  }, [matchStatus]);

  const handleCellClick = useCallback((number, index) => {
    if (matchStatus === 'arranging') {
      if (number === null) {
        const used = new Set(board.filter((n) => n !== null));
        for (let n = 1; n <= 25; n++) {
          if (!used.has(n)) {
            soundManager.playTap?.();
            setCellNumber(index, n);
            break;
          }
        }
      }
    } else if (matchStatus === 'playing') {
      if (number !== null) {
        markNumber(number);
      }
    }
  }, [matchStatus, board, setCellNumber, markNumber]);

  const getContextualGuidance = () => {
    if (pauseInfo) {
      return `⏸️ Opponent disconnected. Waiting up to ${pauseInfo.seconds}s to reconnect...`;
    }
    if (matchStatus === 'arranging') {
      if (isLocked && socket && roomCode) {
        return `🔒 Your board is locked! Waiting for ${opponent?.name || 'opponent'} to lock theirs...`;
      }
      const hasEmpty = board.some(n => n === null);
      if (hasEmpty) {
        return '✏️ Step 1: Tap empty squares to place numbers 1–25, or tap Auto Arrange.';
      }
      return '🔒 Board Complete! Tap "Lock Board & Play" to begin your match.';
    }
    if (matchStatus === 'playing') {
      if (completedLines.length >= 5) {
        return '🔥 5 LINES COMPLETE! Press the golden BINGO button NOW to claim victory!';
      }
      if (isSubmitting) {
        return '⏳ Validating your BINGO claim with the authoritative server...';
      }
      if (isMyTurn) {
        return completedLines.length === 0
          ? '👉 Your turn! Tap any remaining number on your card to call it.'
          : `👉 Your turn! ${completedLines.length}/5 lines completed. Tap your next number!`;
      }
      return `⏳ Waiting for ${opponent?.name || 'opponent'} (${completedLines.length}/5 lines)...`;
    }
    if (matchStatus === 'finished') {
      return matchResult?.won
        ? '🎉 Victory! Server verified your winning claim.'
        : '🏁 Match concluded. Well played!';
    }
    return 'Complete 5 horizontal rows or vertical columns to claim BINGO!';
  };

  const formatTimerDigits = (sec = 30) => {
    const s = Math.max(0, sec);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m < 10 ? '0' : ''}${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const playerDisplayName = initialMode === 'offline'
    ? offlineP1
    : (currentUser?.username || currentUser?.name || 'You');
  const playerAvatar = currentUser?.avatar || '🦊';
  const playerLevel = currentUser?.level || 1;

  const yourLinesCount = completedLines.length || 0;
  const yourPercent = Math.min(100, yourLinesCount * 20);
  const oppLinesCount = opponent?.linesCompleted ?? 0;
  const oppPercent = Math.min(100, oppLinesCount * 20);

  return (
    <div className="bingo-game-container sports-gameplay-root">
      {/* 0. Tournament Match Context Pill (only in real tournament matches) */}
      {tournamentMatch?.tournamentName && (
        <div style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '4px 12px',
          marginBottom: '6px',
          borderRadius: '9999px',
          background: 'rgba(245, 158, 11, 0.14)',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          fontSize: '0.72rem',
          fontWeight: 900,
          color: '#FBBF24'
        }}>
          <span>🏆</span>
          <span>{tournamentMatch.tournamentName}</span>
          <span>•</span>
          <span>{tournamentMatch.roundTitle || 'Official Fixture'}</span>
        </div>
      )}

      {/* 1. Header Bar */}
      <div className="sports-gameplay-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'linear-gradient(180deg, #17243A 0%, #101827 100%)',
        border: '1px solid var(--sports-border, rgba(137, 149, 168, 0.2))',
        borderRadius: '16px',
        marginBottom: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
      }}>
        {/* Left: Player Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <AvatarFrame avatar={playerAvatar} level={playerLevel} rank={currentUser?.rank || 'Challenger'} size={36} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#F4F6FA', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
              {playerDisplayName}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#F3B94F' }}>
              {initialMode === 'survival' ? '❤️'.repeat(Math.max(0, survivalLives)) : `Lv. ${playerLevel}`}
            </span>
          </div>
        </div>

        {/* Center: Clock Pill */}
        <div
          className="sports-game-clock-pill"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(12, 20, 34, 0.85)',
            border: `1.5px solid ${turnSecondsRemaining <= 5 ? '#E6535D' : 'rgba(243, 185, 79, 0.4)'}`,
            borderRadius: '9999px',
            padding: '5px 12px',
            boxShadow: '0 0 12px rgba(243, 185, 79, 0.2)'
          }}
          title={isMyTurn ? 'Your turn timer' : `${turnPlayerName}'s turn timer`}
        >
          <span style={{ fontSize: '0.9rem' }}>⏱</span>
          <span style={{
            fontWeight: 900,
            color: turnSecondsRemaining <= 5 ? '#E6535D' : '#F3B94F',
            fontFamily: 'var(--font-sports-mono, monospace)',
            fontSize: '0.92rem'
          }}>
            {formatTimerDigits(turnSecondsRemaining)}
          </span>
        </div>

        {/* Right: Rival Opponent Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 0 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 900, color: '#F4F6FA', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100px' }}>
              {opponent?.name || 'Opponent'}
            </span>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, color: opponent?.status === 'paused' ? '#F3B94F' : '#8995A8' }}>
              {roomCode ? `Room ${roomCode}` : `Lv. ${opponent?.level || 14}`}
            </span>
          </div>
          <AvatarFrame avatar={opponent?.avatar || '🐻'} level={opponent?.level || 14} rank="Pro" size={36} />
          <SignalStrengthIcon bars={socket ? 4 : 3} size={14} color={opponent?.status === 'paused' ? '#F3B94F' : '#32B879'} />
        </div>
      </div>

      {/* Sub-toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', padding: '0 4px', gap: '8px' }}>
        <button
          type="button"
          className="btn-match-exit"
          onClick={onExit}
          style={{
            background: 'rgba(23, 36, 58, 0.8)',
            border: '1px solid rgba(137, 149, 168, 0.25)',
            color: '#F4F6FA',
            borderRadius: '8px',
            padding: '5px 12px',
            fontSize: '0.78rem',
            fontWeight: 800,
            cursor: 'pointer'
          }}
        >
          ← Exit Match
        </button>

        {lastReaction && Date.now() - lastReaction.at < 4000 && (
          <span style={{ fontSize: '0.9rem', background: 'rgba(243,185,79,0.2)', border: '1px solid #F3B94F', borderRadius: '9999px', padding: '2px 10px' }}>
            {lastReaction.emoji}
          </span>
        )}

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {socket && roomCode && ['🔥', '👏', '😮'].map(emoji => (
            <button
              key={emoji}
              type="button"
              onClick={() => sendReaction(emoji)}
              style={{
                width: '30px',
                height: '30px',
                fontSize: '0.85rem',
                background: 'rgba(23, 36, 58, 0.7)',
                border: '1px solid rgba(137, 149, 168, 0.25)',
                borderRadius: '50%',
                cursor: 'pointer'
              }}
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="icon-btn-round"
            style={{
              width: '32px',
              height: '32px',
              fontSize: '0.9rem',
              background: 'rgba(23, 36, 58, 0.8)',
              border: '1px solid rgba(137, 149, 168, 0.3)',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F4F6FA'
            }}
            onClick={() => setShowTutorial(true)}
            title="Interactive Tutorial"
            aria-label="Interactive Tutorial"
          >
            🎓
          </button>

          <button
            type="button"
            className="icon-btn-round"
            style={{
              width: '32px',
              height: '32px',
              fontSize: '0.9rem',
              background: 'rgba(23, 36, 58, 0.8)',
              border: '1px solid rgba(137, 149, 168, 0.3)',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#F4F6FA'
            }}
            onClick={() => setShowHelp(true)}
            title="Gameplay Help"
            aria-label="Gameplay Help"
          >
            ?
          </button>
        </div>
      </div>

      {/* Inline Error / Alert Toast */}
      {errorMessage && (
        <div
          role="alert"
          className="claim-invalid-shake"
          style={{
            background: 'rgba(230, 83, 93, 0.2)',
            border: '1px solid #E6535D',
            color: '#FCA5A5',
            borderRadius: '10px',
            padding: '6px 12px',
            marginBottom: '6px',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#FCA5A5', cursor: 'pointer', fontWeight: 900 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Turn / Guidance Banner */}
      <div
        className={`guidance-banner ${completedLines.length >= 5 ? 'ready' : (isMyTurn && matchStatus === 'playing' ? 'my-turn' : '')}`}
        style={{
          background: completedLines.length >= 5
            ? 'linear-gradient(90deg, rgba(243, 185, 79, 0.25) 0%, rgba(217, 119, 6, 0.2) 100%)'
            : 'rgba(23, 36, 58, 0.85)',
          border: completedLines.length >= 5
            ? '1px solid #F3B94F'
            : (isMyTurn && matchStatus === 'playing' ? '1px solid rgba(50, 184, 121, 0.5)' : '1px solid rgba(137, 149, 168, 0.2)'),
          borderRadius: '12px',
          padding: '6px 12px',
          marginBottom: '8px',
          textAlign: 'center',
          fontSize: '0.82rem',
          fontWeight: 800,
          color: completedLines.length >= 5 ? '#F3B94F' : '#F4F6FA'
        }}
      >
        {getContextualGuidance()}
      </div>

      {/* 3. Main Arena: Left Gauge | Center Board | Right Gauge */}
      <div className="sports-board-arena-row" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        width: '100%'
      }}>
        <div className="sports-gauge-col sports-gauge-left" style={{ flexShrink: 0 }}>
          <CircularProgressGauge
            percent={yourPercent}
            label={`${yourLinesCount} ${yourLinesCount === 1 ? 'Line' : 'Lines'}`}
            caption="Your Progress"
            color="#32B879"
            size={68}
          />
        </div>

        <div className="sports-board-center-col" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 auto', maxWidth: '380px' }}>
          <BingoLetters completedLinesCount={bingoLetterCount} />

          <BingoBoard
            board={board}
            markedNumbers={markedNumbers}
            completedLines={completedLines}
            newlyStruckLineId={newlyStruckLineId}
            recentCalls={recentCalls}
            isArranging={matchStatus === 'arranging' && !isLocked}
            onCellClick={handleCellClick}
          />
        </div>

        <div className="sports-gauge-col sports-gauge-right" style={{ flexShrink: 0 }}>
          <CircularProgressGauge
            percent={oppPercent}
            label={`${oppLinesCount} ${oppLinesCount === 1 ? 'Line' : 'Lines'}`}
            caption="Opponent"
            color="#A855F7"
            size={68}
          />
        </div>
      </div>

      {/* Claim BINGO Button */}
      {matchStatus === 'playing' && (
        <div style={{ margin: '8px 0' }}>
          <BingoButton
            isActive={isBingoButtonActive}
            isSubmitting={isSubmitting}
            completedLinesCount={completedLines.length}
            onClick={claimBingo}
          />
        </div>
      )}

      {/* Arranging & Playing Controls */}
      <GameControls
        isArranging={matchStatus === 'arranging' && !isLocked}
        onRandomArrange={randomArrange}
        onShuffle={shuffle}
        onClear={clearBoard}
        onLockBoard={lockBoard}
        onExitMatch={onExit}
        onSendReaction={socket && roomCode ? sendReaction : null}
      />

      {/* Match Start Countdown Celebration */}
      {countdownStep && (
        <div className="countdown-overlay" aria-live="polite">
          <div key={countdownStep} className="countdown-number">
            {countdownStep}
          </div>
          <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#CBD5E1', marginTop: '8px', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Match Starting
          </span>
        </div>
      )}

      {/* Recent Calls Strip */}
      {matchStatus === 'playing' && recentCalls.length > 0 && (
        <div className="recent-calls-strip" aria-label="Recent called numbers">
          <span className="calls-label">Calls:</span>
          {recentCalls.map((num, i) => (
            <span key={i} className={`call-chip ${i === 0 ? 'latest' : ''}`}>
              {num}
            </span>
          ))}
        </div>
      )}

      {/* Match Result Victory / Defeat Modal */}
      {matchStatus === 'finished' && matchResult && (
        <MatchResult
          result={matchResult}
          playerName={playerDisplayName}
          playerAvatar={playerAvatar}
          playerLevel={playerLevel}
          opponent={opponent}
          tournamentMatch={tournamentMatch}
          completedLinesCount={completedLines.length}
          rematchRequested={rematchRequested}
          onRematch={requestRematch}
          onReturnHome={onExit}
          onNavigateTournament={onNavigateTournament}
        />
      )}

      <TutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={() => setShowTutorial(false)}
      />

      <GameplayHelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        onReplayTutorial={() => {
          setShowHelp(false);
          setShowTutorial(true);
        }}
        onExitMatch={onExit}
        isPractice={initialMode === 'practice'}
      />
    </div>
  );
}
