/**
 * src/hooks/useBingoGame.js
 *
 * Central Game State Hook for BINGO 2D.
 * Supports:
 * 1. Authoritative WebSocket multiplayer rooms (Private, Quick Match, Team, Tournament)
 * 2. Local single-player Practice vs AI, Survival (3 lives), and 15s Time Challenge
 * 3. Local Offline Pass & Play
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  generateRandomGrid,
  validateGridArrangement,
  findCompletedLines,
  diffNewLines
} from '../../shared/lineModel.js';
import { soundManager } from '../../public/js/audio.js';

export function useBingoGame({
  initialMode = 'practice',
  roomCode = null,
  socket = null,
  roomState = null,
  currentUser = null,
  turnDuration = 30,
  offlineP1 = 'Player 1',
  offlineP2 = 'Player 2',
  onCoinsUpdate = null,
  onSync = null
} = {}) {
  const isRemote = Boolean(socket && roomCode);
  const myPlayerId = socket?.playerId || currentUser?.id || 'user-player';
  const effectiveTurnSecs = initialMode === 'time-challenge' ? 15 : (Number(turnDuration) || 30);

  // 1. Board state: 25 numbers (1-25)
  const [board, setBoard] = useState(() => {
    const serverGrid = roomState?.match?.myGrid;
    return Array.isArray(serverGrid) && serverGrid.length === 25 ? serverGrid : generateRandomGrid();
  });
  const [isArranged, setIsArranged] = useState(true);
  const [isLocked, setIsLocked] = useState(Boolean(roomState?.players?.find(p => p.id === myPlayerId)?.isBoardLocked));

  // 2. Marking & Lines state
  const [markedNumbers, setMarkedNumbers] = useState(() => new Set(roomState?.match?.calledNumbers || []));
  const [completedLines, setCompletedLines] = useState([]);
  const [newlyStruckLineId, setNewlyStruckLineId] = useState(null);

  // 3. Match progression state
  const [matchStatus, setMatchStatus] = useState(() => {
    if (isRemote && roomState?.status) {
      if (roomState.status === 'playing') return 'playing';
      if (roomState.status === 'finished') return 'finished';
      return 'arranging';
    }
    return 'arranging';
  });
  const [isMyTurn, setIsMyTurn] = useState(true);
  const [turnPlayerName, setTurnPlayerName] = useState(initialMode === 'offline' ? offlineP1 : 'You');
  const [turnSecondsRemaining, setTurnSecondsRemaining] = useState(effectiveTurnSecs);
  const [recentCalls, setRecentCalls] = useState([]);
  const [bingoClaimed, setBingoClaimed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [matchResult, setMatchResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [survivalLives, setSurvivalLives] = useState(3);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [pauseInfo, setPauseInfo] = useState(null);
  const [lastReaction, setLastReaction] = useState(null);

  // 4. Opponent state
  const [opponent, setOpponent] = useState(() => {
    const opp = roomState?.players?.find(p => p.id !== myPlayerId);
    if (opp) {
      return {
        id: opp.id,
        name: opp.name,
        avatar: opp.avatar || '🐻',
        status: opp.isConnected ? 'online' : 'offline',
        linesCompleted: 0,
        level: opp.isBot ? 14 : 15
      };
    }
    if (initialMode === 'offline') {
      return { id: 'p2', name: offlineP2 || 'Player 2', avatar: '🐼', status: 'online', linesCompleted: 0, level: 10 };
    }
    return {
      id: 'bot-practice',
      name: initialMode === 'time-challenge' ? 'Blitz Bot' : initialMode === 'survival' ? 'Survival AI' : 'Practice Bot',
      avatar: '🤖',
      status: 'online',
      linesCompleted: 0,
      level: 14
    };
  });

  const timerRef = useRef(null);
  const isClaimingRef = useRef(false);
  const boardRef = useRef(board);
  const markedRef = useRef(markedNumbers);
  const matchStatusRef = useRef(matchStatus);
  const isMyTurnRef = useRef(isMyTurn);

  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { markedRef.current = markedNumbers; }, [markedNumbers]);
  useEffect(() => { matchStatusRef.current = matchStatus; }, [matchStatus]);
  useEffect(() => { isMyTurnRef.current = isMyTurn; }, [isMyTurn]);

  const bingoLetterCount = useMemo(() => Math.min(5, completedLines.length), [completedLines.length]);

  const isBingoButtonActive = useMemo(() => {
    return completedLines.length >= 5 && !bingoClaimed && matchStatus === 'playing';
  }, [completedLines.length, bingoClaimed, matchStatus]);

  const evaluateLines = useCallback((currentMarks, currentGrid) => {
    const detectedLineIds = findCompletedLines(currentGrid, currentMarks, { includeDiagonals: false });
    setCompletedLines((prevLines) => {
      const existingIds = prevLines.map((l) => l.id);
      const diff = diffNewLines(existingIds, detectedLineIds);
      if (diff.newLines.length > 0) {
        setNewlyStruckLineId(diff.newLines[diff.newLines.length - 1].id);
        soundManager.playLineStroke?.();
        soundManager.playLetterStrike?.();
        if (prevLines.length < 5 && prevLines.length + diff.newLines.length >= 5) {
          setTimeout(() => soundManager.playButtonReady?.(), 180);
        }
        return [...prevLines, ...diff.newLines];
      }
      return prevLines;
    });
  }, []);

  // Sync authoritative server snapshot in Remote Multiplayer mode
  const applyRoomSnapshot = useCallback((room) => {
    if (!room) return;
    const pid = socket?.playerId || currentUser?.id || myPlayerId;
    const me = room.players?.find(p => p.id === pid);
    const opp = room.players?.find(p => p.id !== pid);

    if (opp) {
      const oppMatchPlayer = room.match?.players?.find?.(p => p.id === opp.id) ||
        (room.match?.players && !Array.isArray(room.match.players) ? room.match.players[opp.id] : null);
      setOpponent({
        id: opp.id,
        name: opp.name || 'Opponent',
        avatar: opp.avatar || '🐻',
        status: opp.isConnected ? 'online' : 'paused',
        isBot: Boolean(opp.isBot),
        linesCompleted: oppMatchPlayer?.completedLines?.length ?? oppMatchPlayer?.completedLinesCount ?? 0,
        level: opp.isBot ? 14 : 15
      });
    }

    if (me?.isBoardLocked) setIsLocked(true);

    if (room.isPaused && room.disconnectedPlayerId) {
      setPauseInfo({
        playerId: room.disconnectedPlayerId,
        seconds: room.disconnectGraceSecondsRemaining || 60
      });
    } else {
      setPauseInfo(null);
    }

    if (room.status === 'arranging' || room.status === 'lobby') {
      setMatchStatus('arranging');
      setBingoClaimed(false);
      setIsSubmitting(false);
      setMatchResult(null);
      isClaimingRef.current = false;
      setRematchRequested(Array.isArray(room.rematchRequests) && room.rematchRequests.includes(pid));
      if (room.status === 'lobby' && !me?.isBoardLocked) {
        setIsLocked(false);
      }
    } else if (room.status === 'playing') {
      setMatchStatus('playing');
    } else if (room.status === 'finished') {
      setMatchStatus('finished');
    }

    if (room.match) {
      const grid = room.match.myGrid;
      if (Array.isArray(grid) && grid.length === 25) {
        setBoard(grid);
        setIsArranged(true);
      }

      const called = Array.isArray(room.match.calledNumbers) ? room.match.calledNumbers : [];
      const markSet = new Set(called);
      setMarkedNumbers(markSet);
      setRecentCalls([...called].reverse().slice(0, 8));

      const targetGrid = (Array.isArray(grid) && grid.length === 25) ? grid : boardRef.current;
      const detected = findCompletedLines(targetGrid, markSet, { includeDiagonals: false });
      setCompletedLines(detected.map((id, idx) => ({ id, order: idx })));

      const turnId = room.match.currentTurnPlayerId;
      const mine = turnId === pid;
      setIsMyTurn(mine);
      const turnPlayer = room.players?.find(p => p.id === turnId);
      setTurnPlayerName(mine ? 'You' : (turnPlayer?.name || opp?.name || 'Opponent'));
    }

    if (room.turnDeadline) {
      setTurnSecondsRemaining(Math.max(0, Math.ceil((room.turnDeadline - Date.now()) / 1000)));
    }
  }, [socket, currentUser?.id, myPlayerId]);

  useEffect(() => {
    if (isRemote && roomState) {
      applyRoomSnapshot(roomState);
    }
  }, [isRemote, roomState, applyRoomSnapshot]);

  // Listen to WebSocket gameplay events in Remote Multiplayer mode
  useEffect(() => {
    if (!isRemote || !socket) return;

    const pid = () => socket.playerId || currentUser?.id || myPlayerId;

    const unsubs = [
      socket.on('room_state', (data) => {
        if (data.room && (!roomCode || data.room.code === roomCode)) {
          applyRoomSnapshot(data.room);
        }
      }),
      socket.on('start_arranging', () => {
        setIsLocked(false);
        setMarkedNumbers(new Set());
        setCompletedLines([]);
        setRecentCalls([]);
        setBingoClaimed(false);
        setIsSubmitting(false);
        setMatchResult(null);
        setRematchRequested(false);
        isClaimingRef.current = false;
        setBoard(generateRandomGrid());
        setIsArranged(true);
        setMatchStatus('arranging');
      }),
      socket.on('board_locked', (data) => {
        if (data.playerId === pid()) {
          setIsLocked(true);
          setErrorMessage(null);
        }
      }),
      socket.on('match_started', (data) => {
        setIsLocked(true);
        setMatchStatus('playing');
        setErrorMessage(null);
        const mine = data.currentTurnPlayerId === pid();
        setIsMyTurn(mine);
        setTurnPlayerName(mine ? 'You' : (opponent?.name || 'Opponent'));
        if (data.turnDeadline) {
          setTurnSecondsRemaining(Math.max(1, Math.ceil((data.turnDeadline - Date.now()) / 1000)));
        }
      }),
      socket.on('number_called', (data) => {
        const num = Number(data.number);
        const grid = boardRef.current;
        const nextSet = new Set(Array.isArray(data.calledNumbers) ? data.calledNumbers : [...markedRef.current, num]);
        setMarkedNumbers(nextSet);
        setRecentCalls([...nextSet].reverse().slice(0, 8));
        evaluateLines(nextSet, grid);

        const mine = data.nextTurnPlayerId === pid();
        setIsMyTurn(mine);
        setTurnPlayerName(mine ? 'You' : (opponent?.name || 'Opponent'));
        if (data.turnDeadline) {
          setTurnSecondsRemaining(Math.max(1, Math.ceil((data.turnDeadline - Date.now()) / 1000)));
        } else {
          setTurnSecondsRemaining(roomState?.settings?.turnTimerSeconds || effectiveTurnSecs);
        }
        soundManager.playMark?.();
      }),
      socket.on('bingo_result', (data) => {
        setIsSubmitting(false);
        isClaimingRef.current = false;
        if (data.valid) {
          const iWon = data.winnerId === pid();
          setBingoClaimed(iWon);
          setMatchStatus('finished');
          const coinsAwarded = iWon ? 150 : 25;
          setMatchResult({
            won: iWon,
            winnerId: data.winnerId,
            reason: data.reason || (iWon ? 'Server verified your BINGO!' : 'Opponent completed BINGO first.'),
            coinsAwarded,
            scores: data.scores,
            durationSeconds: data.durationSeconds || 0
          });
          if (iWon && onCoinsUpdate) {
            onCoinsUpdate(coinsAwarded);
          }
          if (iWon) {
            soundManager.playVictory?.();
          } else {
            soundManager.playDefeat?.();
          }
        } else {
          setBingoClaimed(false);
          setErrorMessage(data.reason || 'Invalid BINGO claim — keep playing!');
          soundManager.playError?.();
        }
      }),
      socket.on('rematch_requested', (data) => {
        if (data.playerId === pid()) {
          setRematchRequested(true);
        }
      }),
      socket.on('rematch_started', () => {
        setIsLocked(false);
        setMarkedNumbers(new Set());
        setCompletedLines([]);
        setRecentCalls([]);
        setBingoClaimed(false);
        setIsSubmitting(false);
        setMatchResult(null);
        setRematchRequested(false);
        isClaimingRef.current = false;
        setBoard(generateRandomGrid());
        setMatchStatus('arranging');
      }),
      socket.on('player_disconnected', (data) => {
        setPauseInfo({
          playerId: data.playerId,
          seconds: data.graceSecondsRemaining || 60
        });
      }),
      socket.on('player_reconnected', () => {
        setPauseInfo(null);
      }),
      socket.on('reaction', (data) => {
        setLastReaction({ playerId: data.playerId, emoji: data.emoji, at: Date.now() });
      }),
      socket.on('error', (data) => {
        setIsSubmitting(false);
        isClaimingRef.current = false;
        setErrorMessage(data.message || 'Server reported an error.');
        soundManager.playError?.();
      })
    ];

    // Request latest snapshot cleanly on mount
    socket.send('request_snapshot', { roomCode });

    return () => {
      unsubs.forEach(fn => fn && fn());
    };
  }, [isRemote, socket, roomCode, currentUser?.id, myPlayerId, applyRoomSnapshot, evaluateLines, effectiveTurnSecs, onCoinsUpdate, opponent?.name, roomState?.settings?.turnTimerSeconds]);

  // Board arrangement actions
  const randomArrange = useCallback(() => {
    if (isLocked) return;
    setBoard(generateRandomGrid());
    setIsArranged(true);
    setErrorMessage(null);
    soundManager.playPaperShuffle?.();
  }, [isLocked]);

  const shuffle = useCallback(() => {
    if (isLocked) return;
    setBoard(generateRandomGrid());
    setIsArranged(true);
    setErrorMessage(null);
    soundManager.playPaperShuffle?.();
  }, [isLocked]);

  const clearBoard = useCallback(() => {
    if (isLocked) return;
    setBoard(new Array(25).fill(null));
    setIsArranged(false);
  }, [isLocked]);

  const setCellNumber = useCallback((index, number) => {
    if (isLocked) return;
    if (index < 0 || index >= 25) return;
    if (number < 1 || number > 25) return;

    setBoard((prev) => {
      const next = [...prev];
      const existingIdx = next.indexOf(number);
      if (existingIdx !== -1) {
        next[existingIdx] = next[index];
      }
      next[index] = number;
      const valid = validateGridArrangement(next).valid;
      setIsArranged(valid);
      return next;
    });
  }, [isLocked]);

  // Lock arrangement & start gameplay
  const lockBoard = useCallback(() => {
    const valid = validateGridArrangement(board).valid;
    if (!valid) {
      setErrorMessage('Please place all numbers 1 to 25 on the board before locking.');
      return false;
    }
    setErrorMessage(null);

    if (isRemote && socket) {
      setIsLocked(true);
      socket.send('lock_board', { grid: board });
      return true;
    }

    setIsLocked(true);
    setMatchStatus('playing');
    isClaimingRef.current = false;
    setMarkedNumbers(new Set());
    setCompletedLines([]);
    setRecentCalls([]);
    setBingoClaimed(false);
    setIsSubmitting(false);
    setMatchResult(null);
    setSurvivalLives(3);
    setIsMyTurn(true);
    setTurnPlayerName(initialMode === 'offline' ? offlineP1 : 'You');
    setTurnSecondsRemaining(effectiveTurnSecs);
    return true;
  }, [board, isRemote, socket, initialMode, offlineP1, effectiveTurnSecs]);

  // Mark / Call a number
  const markNumber = useCallback((num) => {
    if (matchStatus !== 'playing') return;
    if (!board.includes(num)) return;
    if (markedNumbers.has(num)) return;

    if (isRemote && socket) {
      if (!isMyTurn) {
        setErrorMessage(`Wait for ${opponent?.name || 'opponent'}'s turn!`);
        return;
      }
      setErrorMessage(null);
      socket.send('call_number', { number: num });
      if (onSync) onSync({ type: 'call_number', number: num });
      return;
    }

    // Local / Practice / Offline Pass & Play mode
    const next = new Set(markedNumbers);
    next.add(num);
    setMarkedNumbers(next);
    setRecentCalls((prev) => [num, ...prev.slice(0, 7)]);
    evaluateLines(next, board);
    soundManager.playMark?.();

    if (onSync) {
      onSync({ type: 'call_number', number: num });
    }

    if (initialMode === 'offline') {
      const nextTurn = !isMyTurn;
      setIsMyTurn(nextTurn);
      setTurnPlayerName(nextTurn ? offlineP1 : offlineP2);
      setTurnSecondsRemaining(effectiveTurnSecs);
    } else if (isMyTurn) {
      setIsMyTurn(false);
      setTurnPlayerName(opponent?.name || 'Practice Bot');
      setTurnSecondsRemaining(effectiveTurnSecs);
    }
  }, [matchStatus, board, markedNumbers, isRemote, socket, isMyTurn, opponent?.name, onSync, evaluateLines, initialMode, offlineP1, offlineP2, effectiveTurnSecs]);

  // Claim BINGO victory
  const claimBingo = useCallback(() => {
    if (
      completedLines.length < 5 ||
      isSubmitting ||
      bingoClaimed ||
      isClaimingRef.current ||
      matchStatus !== 'playing'
    ) {
      return false;
    }

    isClaimingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);
    soundManager.playBingoClaim?.();
    const claimId = `claim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    if (isRemote && socket) {
      socket.send('claim_bingo', { claimId, completedLinesCount: completedLines.length });
      return true;
    }

    setTimeout(() => {
      setBingoClaimed(true);
      setMatchStatus('finished');
      const bonus = initialMode === 'time-challenge' ? 200 : initialMode === 'survival' ? 180 : 100;
      setMatchResult({
        won: true,
        reason: `Completed BINGO with ${completedLines.length} lines!`,
        coinsAwarded: initialMode === 'offline' ? 0 : bonus
      });
      setIsSubmitting(false);
      soundManager.playVictory?.();
      if (initialMode !== 'offline' && onCoinsUpdate) {
        onCoinsUpdate(bonus);
      }
      if (onSync) {
        onSync({ type: 'claim_bingo', claimId, completedLinesCount: completedLines.length });
      }
    }, 150);
    return true;
  }, [completedLines.length, isSubmitting, bingoClaimed, matchStatus, isRemote, socket, initialMode, onCoinsUpdate, onSync]);

  // Rematch action
  const requestRematch = useCallback(() => {
    if (isRemote && socket) {
      setRematchRequested(true);
      socket.send('request_rematch', {});
      return;
    }
    setBoard(generateRandomGrid());
    setIsLocked(false);
    setMarkedNumbers(new Set());
    setCompletedLines([]);
    setRecentCalls([]);
    setBingoClaimed(false);
    setMatchResult(null);
    setMatchStatus('arranging');
    isClaimingRef.current = false;
  }, [isRemote, socket]);

  const sendReaction = useCallback((emoji) => {
    if (isRemote && socket) {
      socket.send('send_reaction', { emoji });
    }
  }, [isRemote, socket]);

  // Turn countdown timer
  useEffect(() => {
    if (matchStatus !== 'playing') return;

    timerRef.current = setInterval(() => {
      setTurnSecondsRemaining((s) => {
        if (s <= 1) {
          if (!isRemote && isMyTurnRef.current) {
            if (initialMode === 'survival') {
              setSurvivalLives((lives) => {
                const nextLives = lives - 1;
                if (nextLives <= 0) {
                  setMatchStatus('finished');
                  setMatchResult({
                    won: false,
                    reason: 'Out of Survival lives! Turn timer expired 3 times.',
                    coinsAwarded: 15
                  });
                }
                return nextLives;
              });
            }
            const remaining = boardRef.current.filter((n) => n !== null && !markedRef.current.has(n));
            if (remaining.length > 0 && matchStatusRef.current === 'playing') {
              const pick = remaining[Math.floor(Math.random() * remaining.length)];
              markNumber(pick);
            }
          }
          return effectiveTurnSecs;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [matchStatus, isRemote, initialMode, effectiveTurnSecs, markNumber]);

  // Local AI Bot turn response when NOT connected to a server room
  useEffect(() => {
    if (isRemote || initialMode === 'offline') return;
    if (matchStatus === 'playing' && !isMyTurn) {
      const timeout = setTimeout(() => {
        const remaining = board.filter((n) => n !== null && !markedNumbers.has(n));
        if (remaining.length > 0) {
          const pick = remaining[Math.floor(Math.random() * remaining.length)];
          const next = new Set(markedNumbers);
          next.add(pick);
          setMarkedNumbers(next);
          setRecentCalls((prev) => [pick, ...prev.slice(0, 7)]);
          evaluateLines(next, board);
          setOpponent((prev) => ({
            ...prev,
            linesCompleted: Math.min(5, Math.floor(next.size / 5))
          }));
          setIsMyTurn(true);
          setTurnPlayerName('You');
          setTurnSecondsRemaining(effectiveTurnSecs);
        }
      }, 950);
      return () => clearTimeout(timeout);
    }
  }, [isRemote, initialMode, matchStatus, isMyTurn, board, markedNumbers, evaluateLines, effectiveTurnSecs]);

  return {
    board,
    isArranged,
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
    bingoClaimed,
    matchResult,
    opponent,
    errorMessage,
    setErrorMessage,
    survivalLives,
    rematchRequested,
    pauseInfo,
    lastReaction,
    setOpponent,
    setIsMyTurn,
    setTurnPlayerName,
    randomArrange,
    shuffle,
    clearBoard,
    setCellNumber,
    lockBoard,
    markNumber,
    claimBingo,
    requestRematch,
    sendReaction,
    setMatchStatus,
    setMatchResult
  };
}
