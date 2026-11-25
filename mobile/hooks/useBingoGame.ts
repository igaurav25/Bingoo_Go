/**
 * mobile/hooks/useBingoGame.ts
 *
 * Core Bingo Game Engine Hook for React Native Mobile Application.
 * Supports:
 * - Authoritative server WebSocket gameplay when roomCode is present
 * - Local Practice Bot / Offline Pass-and-Play gameplay when playing offline
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { checkLineCompletion, validateBoardArrangement } from '../../shared/lineModel';
import { generateRandomBoard } from '../../shared/validation';
import { Competitor, MatchResultData, LineStrike } from '../../shared/types';
import { socketService } from '../services/socketService';

export interface UseBingoGameProps {
  initialMode?: string;
  roomCode?: string | null;
  roomState?: any;
  currentUserId?: string;
  onVictory?: (result: MatchResultData) => void;
  onOpponentMove?: (number: number) => void;
}

export function useBingoGame({
  initialMode = 'practice',
  roomCode = null,
  roomState = null,
  currentUserId,
  onVictory,
  onOpponentMove
}: UseBingoGameProps = {}) {
  const isRemote = Boolean(roomCode);
  const myId = currentUserId || socketService.playerId;

  const [board, setBoard] = useState<(number | null)[]>(() => {
    const serverGrid = roomState?.match?.myGrid;
    return Array.isArray(serverGrid) && serverGrid.length === 25 ? serverGrid : generateRandomBoard();
  });
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [markedNumbers, setMarkedNumbers] = useState<Set<number>>(new Set(roomState?.match?.calledNumbers || []));
  const [completedLines, setCompletedLines] = useState<LineStrike[]>([]);
  const [matchStatus, setMatchStatus] = useState<'arranging' | 'playing' | 'finished'>(() =>
    isRemote ? (roomState?.status === 'playing' ? 'playing' : 'arranging') : 'playing'
  );
  const [isMyTurn, setIsMyTurn] = useState<boolean>(true);
  const [turnPlayerName, setTurnPlayerName] = useState<string>('You');
  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState<number>(30);
  const [recentCalls, setRecentCalls] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [bingoClaimed, setBingoClaimed] = useState<boolean>(false);
  const [matchResult, setMatchResult] = useState<MatchResultData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [opponent, setOpponent] = useState<Competitor>(() => {
    const opp = roomState?.players?.find((p: any) => p.id !== myId);
    if (opp) {
      return {
        id: opp.id,
        name: opp.name,
        avatar: opp.avatar || '🐻',
        level: opp.isBot ? 14 : 15,
        rank: opp.isBot ? 'Bot' : 'Challenger',
        online: Boolean(opp.isConnected),
        linesCompleted: 0
      };
    }
    return {
      id: initialMode === 'offline' ? 'offline-p2' : 'bot-practice',
      name: initialMode === 'offline' ? 'Player 2' : 'Practice Bot',
      avatar: initialMode === 'offline' ? '🐼' : '🤖',
      level: 14,
      rank: initialMode === 'offline' ? 'Local' : 'AI',
      online: true,
      linesCompleted: 0
    };
  });

  const timerRef = useRef<any>(null);
  const isClaimingRef = useRef<boolean>(false);
  const boardRef = useRef(board);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  // Apply authoritative room snapshot when playing remotely
  useEffect(() => {
    if (!isRemote || !roomState) return;
    const opp = roomState.players?.find((p: any) => p.id !== myId);
    if (opp) {
      const oppData = roomState.match?.players?.find?.((p: any) => p.id === opp.id);
      setOpponent({
        id: opp.id,
        name: opp.name,
        avatar: opp.avatar || '🐻',
        level: opp.isBot ? 14 : 15,
        rank: 'Challenger',
        online: Boolean(opp.isConnected),
        linesCompleted: oppData?.completedLinesCount || 0
      });
    }
    if (roomState.status === 'playing') setMatchStatus('playing');
    else if (roomState.status === 'finished') setMatchStatus('finished');
    else setMatchStatus('arranging');

    if (roomState.match) {
      if (Array.isArray(roomState.match.myGrid) && roomState.match.myGrid.length === 25) {
        setBoard(roomState.match.myGrid);
      }
      if (Array.isArray(roomState.match.calledNumbers)) {
        const nextSet = new Set<number>(roomState.match.calledNumbers);
        setMarkedNumbers(nextSet);
        setRecentCalls([...roomState.match.calledNumbers].reverse().slice(0, 6));
        const grid = (Array.isArray(roomState.match.myGrid) ? roomState.match.myGrid : boardRef.current) as number[];
        const lines = checkLineCompletion(grid, nextSet);
        if (Array.isArray(lines)) setCompletedLines(lines as any[]);
      }
      const mine = roomState.match.currentTurnPlayerId === myId;
      setIsMyTurn(mine);
      setTurnPlayerName(mine ? 'You' : (opp?.name || 'Opponent'));
    }
  }, [isRemote, roomState, myId]);

  // WebSocket event subscriptions for remote multiplayer matches
  useEffect(() => {
    if (!isRemote) return;
    socketService.connect();

    const unsubs = [
      socketService.on('room_state', (data: any) => {
        const room = data.room;
        if (!room || (roomCode && room.code !== roomCode)) return;
        const opp = room.players?.find((p: any) => p.id !== myId);
        if (opp) {
          setOpponent((prev) => ({ ...prev, id: opp.id, name: opp.name, avatar: opp.avatar || '🐻', online: Boolean(opp.isConnected) }));
        }
        if (room.status === 'playing') setMatchStatus('playing');
        else if (room.status === 'arranging') setMatchStatus('arranging');
      }),
      socketService.on('match_started', (data: any) => {
        setIsLocked(true);
        setMatchStatus('playing');
        setErrorMessage(null);
        const mine = data.currentTurnPlayerId === myId;
        setIsMyTurn(mine);
        setTurnPlayerName(mine ? 'You' : opponent.name);
      }),
      socketService.on('number_called', (data: any) => {
        const called = Array.isArray(data.calledNumbers) ? data.calledNumbers : [data.number];
        const nextSet = new Set<number>(called);
        setMarkedNumbers(nextSet);
        setRecentCalls((prev) => [data.number, ...prev.slice(0, 5)]);
        const lines = checkLineCompletion(boardRef.current as number[], nextSet);
        if (Array.isArray(lines)) setCompletedLines(lines as any[]);
        const mine = data.nextTurnPlayerId === myId;
        setIsMyTurn(mine);
        setTurnPlayerName(mine ? 'You' : opponent.name);
        setTurnSecondsRemaining(30);
      }),
      socketService.on('bingo_result', (data: any) => {
        setIsSubmitting(false);
        isClaimingRef.current = false;
        if (data.valid) {
          const won = data.winnerId === myId;
          setBingoClaimed(won);
          setMatchStatus('finished');
          const res: MatchResultData = {
            won,
            reason: data.reason || (won ? 'Server validated your 5-line BINGO victory!' : 'Opponent completed BINGO first.'),
            coinsAwarded: won ? 150 : 25,
            diamondsAwarded: 0,
            playerScore: completedLines.length,
            opponentScore: won ? 3 : 5,
            linesCompleted: completedLines.length
          };
          setMatchResult(res);
          onVictory && onVictory(res);
        } else {
          setErrorMessage(data.reason || 'Claim rejected — continue playing.');
        }
      }),
      socketService.on('rematch_started', () => {
        setBoard(generateRandomBoard());
        setIsLocked(false);
        setMarkedNumbers(new Set());
        setCompletedLines([]);
        setRecentCalls([]);
        setBingoClaimed(false);
        setMatchResult(null);
        setMatchStatus('arranging');
        isClaimingRef.current = false;
      }),
      socketService.on('error', (data: any) => {
        setIsSubmitting(false);
        isClaimingRef.current = false;
        setErrorMessage(data?.message || 'Server reported an error.');
      })
    ];

    socketService.send('request_snapshot', { roomCode });

    return () => unsubs.forEach((fn) => fn && fn());
  }, [isRemote, roomCode, myId, opponent.name, completedLines.length, onVictory]);

  // Turn countdown timer
  useEffect(() => {
    if (matchStatus !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTurnSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (!isRemote && isMyTurn) {
            autoCallTurn();
          }
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [matchStatus, isRemote, isMyTurn, markedNumbers, board]);

  const autoCallTurn = useCallback(() => {
    const uncalled = board.filter((n): n is number => n !== null && !markedNumbers.has(n));
    if (uncalled.length > 0) {
      const pick = uncalled[Math.floor(Math.random() * uncalled.length)];
      markNumber(pick);
    }
  }, [board, markedNumbers]);

  const randomArrange = useCallback(() => {
    if (isLocked && isRemote) return;
    setBoard(generateRandomBoard());
    setIsLocked(false);
  }, [isLocked, isRemote]);

  const shuffle = useCallback(() => {
    if (isLocked && isRemote) return;
    setBoard((prev) => {
      const valid = prev.filter((n): n is number => n !== null);
      if (valid.length === 25) return generateRandomBoard();
      return prev;
    });
  }, [isLocked, isRemote]);

  const clearBoard = useCallback(() => {
    if (isLocked && isRemote) return;
    setBoard(Array(25).fill(null));
    setIsLocked(false);
  }, [isLocked, isRemote]);

  const setCellNumber = useCallback((index: number, num: number) => {
    setBoard((prev) => {
      const next = [...prev];
      const oldIdx = next.indexOf(num);
      if (oldIdx !== -1) next[oldIdx] = next[index];
      next[index] = num;
      return next;
    });
  }, []);

  const lockBoard = useCallback(() => {
    if (board.includes(null)) return false;
    const check = validateBoardArrangement(board as number[]);
    if (!check.valid) return false;

    if (isRemote) {
      setIsLocked(true);
      socketService.send('lock_board', { grid: board });
      return true;
    }

    setIsLocked(true);
    setMatchStatus('playing');
    isClaimingRef.current = false;
    setBingoClaimed(false);
    setIsSubmitting(false);
    setMatchResult(null);
    return true;
  }, [board, isRemote]);

  const simulateBotTurn = useCallback((lastCalled: number) => {
    if (matchStatus !== 'playing') return;
    setMarkedNumbers((prev) => {
      const uncalled = board.filter((n): n is number => n !== null && !prev.has(n));
      if (uncalled.length === 0) return prev;
      const botPick = uncalled[Math.floor(Math.random() * uncalled.length)];
      const next = new Set(prev);
      next.add(botPick);
      setRecentCalls((rc) => [botPick, ...rc.slice(0, 4)]);
      const lines = checkLineCompletion(board as number[], next);
      if (Array.isArray(lines)) setCompletedLines(lines as any[]);
      setIsMyTurn(true);
      setTurnPlayerName('You');
      setTurnSecondsRemaining(30);
      onOpponentMove && onOpponentMove(botPick);
      return next;
    });
  }, [board, matchStatus, onOpponentMove]);

  const markNumber = useCallback((num: number) => {
    if (matchStatus !== 'playing') return;
    if (markedNumbers.has(num)) return;

    if (isRemote) {
      if (!isMyTurn) {
        setErrorMessage(`Wait for ${opponent.name}'s turn.`);
        return;
      }
      setErrorMessage(null);
      socketService.send('call_number', { number: num });
      return;
    }

    setMarkedNumbers((prev) => {
      const next = new Set(prev);
      next.add(num);
      const lines = checkLineCompletion(board as number[], next);
      if (Array.isArray(lines)) setCompletedLines(lines as any[]);
      return next;
    });

    setRecentCalls((prev) => [num, ...prev.slice(0, 4)]);
    setTurnSecondsRemaining(30);

    setIsMyTurn((prev) => {
      const nextTurn = !prev;
      setTurnPlayerName(nextTurn ? 'You' : opponent.name);
      return nextTurn;
    });

    if (initialMode === 'practice') {
      setTimeout(() => simulateBotTurn(num), 950);
    }
  }, [matchStatus, markedNumbers, isRemote, isMyTurn, opponent.name, board, initialMode, simulateBotTurn]);

  const claimBingo = useCallback(() => {
    if (
      completedLines.length < 5 ||
      isSubmitting ||
      bingoClaimed ||
      isClaimingRef.current ||
      matchStatus !== 'playing'
    ) {
      return;
    }

    isClaimingRef.current = true;
    setIsSubmitting(true);
    const claimId = `claim_mob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (isRemote) {
      socketService.send('claim_bingo', { claimId, completedLinesCount: completedLines.length });
      return;
    }

    setTimeout(() => {
      setBingoClaimed(true);
      setIsSubmitting(false);
      setMatchStatus('finished');
      const result: MatchResultData = {
        won: true,
        reason: 'Completed BINGO with 5 lines!',
        coinsAwarded: initialMode === 'offline' ? 0 : 100,
        diamondsAwarded: 0,
        playerScore: completedLines.length,
        opponentScore: opponent.linesCompleted || 0,
        linesCompleted: completedLines.length
      };
      setMatchResult(result);
      onVictory && onVictory(result);
    }, 250);
  }, [completedLines.length, isSubmitting, bingoClaimed, matchStatus, isRemote, initialMode, opponent.linesCompleted, onVictory]);

  const bingoLetterCount = Math.min(5, completedLines.length);
  const isBingoButtonActive = completedLines.length >= 5 && !bingoClaimed && matchStatus === 'playing';

  return {
    board,
    isLocked,
    markedNumbers,
    completedLines,
    bingoLetterCount,
    isBingoButtonActive,
    isSubmitting,
    bingoClaimed,
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
    setCellNumber,
    lockBoard,
    markNumber,
    claimBingo,
    setMatchStatus,
    setMatchResult,
    setOpponent
  };
}

export default useBingoGame;
