/**
 * public/js/gameClient.js
 * 
 * Production Client Game Controller for Classic Notebook Bingo.
 * Implements server-authoritative state synchronization, FIFO animation queue,
 * gap detection via monotonic eventSeq, central BINGO claim button management,
 * and accessible announcements.
 */

import { generateRandomGrid } from '/shared/lineModel.js';
import { AnimationQueue } from './animationQueue.js';
import { RenderOverlay } from './renderOverlay.js';
import { soundManager } from './audio.js';

class BingoClient {
  constructor() {
    // Parse query params for matchId and playerId or generate defaults
    const params = new URLSearchParams(window.location.search);
    this.matchId = params.get('match') || 'match-1';
    this.playerId = params.get('player') || `p-${Math.random().toString(36).slice(2, 7)}`;
    this.playerName = params.get('name') || `Player ${this.playerId.slice(0, 4)}`;

    // Authoritative Server Data State
    this.status = 'ARRANGING'; // 'ARRANGING' | 'IN_PROGRESS' | 'FINISHED'
    this.grid = null;          // 25 numbers array
    this.isLocked = false;
    this.markedNumbers = new Set();
    this.completedLines = [];  // server-confirmed completed line IDs
    this.opponentLinesCount = 0;
    this.currentTurnPlayerId = null;
    this.lastEventSeq = 0;
    this.winnerId = null;

    // Local UI / Animation State
    this.isClaimPending = false;
    this.claimDebounceTimer = null;
    this.isHydrated = false;

    // Subsystems
    this.animationQueue = new AnimationQueue();
    this.dom = this._cacheDOM();
    this.renderOverlay = new RenderOverlay(
      this.dom.lineOverlay,
      this.dom.playerBingoWord,
      this.dom.opponentBingoWord
    );

    this._bindEvents();
    this._connectWebSocket();
  }

  _cacheDOM() {
    return {
      roomDisplay: document.getElementById('room-display'),
      muteBtn: document.getElementById('mute-btn'),
      muteIcon: document.getElementById('mute-icon'),
      reconnectBtn: document.getElementById('reconnect-btn'),
      turnBanner: document.getElementById('turn-banner'),
      playerBingoWord: document.getElementById('player-bingo-word'),
      opponentBingoWord: document.getElementById('opponent-bingo-word'),
      playerNameLabel: document.getElementById('player-name-label'),
      opponentNameLabel: document.getElementById('opponent-name-label'),
      bingoClaimBtn: document.getElementById('bingo-claim-btn'),
      bingoBtnText: document.getElementById('bingo-btn-text'),
      gridBoard: document.getElementById('grid-board'),
      lineOverlay: document.getElementById('line-strike-overlay'),
      setupPanel: document.getElementById('setup-panel'),
      setupStatus: document.getElementById('setup-status'),
      shuffleBtn: document.getElementById('shuffle-btn'),
      lockArrangementBtn: document.getElementById('lock-arrangement-btn'),
      toastContainer: document.getElementById('toast-container'),
      announcer: document.getElementById('aria-live-announcer')
    };
  }

  _bindEvents() {
    this.dom.roomDisplay.textContent = `Room: ${this.matchId} (${this.playerId})`;
    this.dom.playerNameLabel.textContent = `You (${this.playerName})`;

    // Sound toggle
    this.dom.muteBtn.addEventListener('click', () => {
      const isMuted = soundManager.toggleMute();
      this.dom.muteIcon.textContent = isMuted ? '🔇' : '🔊';
      this.showToast(isMuted ? 'Sound muted' : 'Sound unmuted');
    });

    // Manual Re-sync
    this.dom.reconnectBtn.addEventListener('click', () => {
      this.requestSnapshot();
      this.showToast('Syncing match state...');
    });

    // Setup controls
    this.dom.shuffleBtn.addEventListener('click', () => {
      if (this.isLocked) return;
      this.grid = generateRandomGrid();
      this._renderBoardCells();
    });

    this.dom.lockArrangementBtn.addEventListener('click', () => {
      if (this.isLocked || !this.grid) return;
      this._send('set_arrangement', { grid: this.grid });
    });

    // BINGO Claim button
    this.dom.bingoClaimBtn.addEventListener('click', () => {
      this.handleClaimPress();
    });

    // Visibility / Resume handler
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.requestSnapshot();
      }
    });

    // Resize / orientation change handling
    window.addEventListener('resize', () => {
      // SVG viewBox in grid units handles scaling naturally without pixel math
    });
  }

  _connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[BingoClient] Connected to server.');
      this._send('join_match', { playerName: this.playerName });
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleServerMessage(msg);
      } catch (err) {
        console.error('[BingoClient] Parse message error:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[BingoClient] Connection closed. Retrying in 2s...');
      setTimeout(() => this._connectWebSocket(), 2000);
    };

    this.ws.onerror = (err) => {
      console.error('[BingoClient] WebSocket error:', err);
    };
  }

  _send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type,
        matchId: this.matchId,
        playerId: this.playerId,
        payload
      }));
    }
  }

  requestSnapshot() {
    this._send('request_snapshot');
  }

  _handleServerMessage(msg) {
    const { type } = msg;

    switch (type) {
      case 'state_snapshot': {
        this._applySnapshot(msg.snapshot);
        break;
      }

      case 'arrangement_locked': {
        if (msg.playerId === this.playerId) {
          this.isLocked = true;
          this.grid = msg.grid;
          this.dom.setupStatus.textContent = 'Arrangement locked! Waiting for opponent...';
          this.dom.shuffleBtn.disabled = true;
          this.dom.lockArrangementBtn.disabled = true;
          this._renderBoardCells();
          this.announce('Your card arrangement is locked.');
        }
        break;
      }

      case 'player_ready': {
        if (msg.playerId !== this.playerId) {
          this.showToast('Opponent is ready!');
        }
        break;
      }

      case 'match_started': {
        this.status = 'IN_PROGRESS';
        this.currentTurnPlayerId = msg.currentTurnPlayerId;
        this.dom.setupPanel.style.display = 'none';
        this._updateTurnBanner();
        this._renderBoardCells();
        this.showToast('Match started! Make your calls.');
        this.announce('Match started.');
        break;
      }

      case 'number_called': {
        this._handleNumberCalled(msg);
        break;
      }

      case 'lines_completed': {
        this._handleLinesCompleted(msg);
        break;
      }

      case 'bingo_result': {
        this._handleBingoResult(msg);
        break;
      }

      case 'error': {
        this.showToast(msg.message, 'error');
        break;
      }

      default:
        console.log('[BingoClient] Unhandled server message:', msg);
    }
  }

  /**
   * Hydrates state snapshot cleanly without playing past animations.
   * @param {object} snapshot
   */
  _applySnapshot(snapshot) {
    if (!snapshot) return;

    this.status = snapshot.status;
    this.currentTurnPlayerId = snapshot.currentTurnPlayerId;
    this.winnerId = snapshot.winnerId;

    // Check eventSeq gap detection
    if (snapshot.eventSeq > this.lastEventSeq) {
      this.lastEventSeq = snapshot.eventSeq;
    }

    if (snapshot.myState) {
      this.isLocked = snapshot.myState.isLocked;
      if (snapshot.myState.grid) {
        this.grid = snapshot.myState.grid;
      }
      this.markedNumbers = new Set(snapshot.myState.markedNumbers || []);
      this.completedLines = snapshot.myState.completedLines || [];
    }

    if (snapshot.opponentState) {
      this.opponentLinesCount = snapshot.opponentState.linesCompleted || 0;
      if (snapshot.opponentState.name) {
        this.dom.opponentNameLabel.textContent = `Opponent (${snapshot.opponentState.name})`;
      }
    }

    if (!this.grid) {
      this.grid = generateRandomGrid();
    }

    if (this.isLocked || this.status === 'IN_PROGRESS' || this.status === 'FINISHED') {
      this.dom.setupPanel.style.display = 'none';
    }

    this._renderBoardCells();
    this._updateTurnBanner();
    this._updateClaimButtonState();

    // Instant hydration for existing lines and letters
    this.renderOverlay.hydrate(this.completedLines, this.opponentLinesCount);

    // Mark completed line IDs in animation queue so they won't re-animate
    for (const id of this.completedLines) {
      this.animationQueue.markSeen(id);
    }

    this.isHydrated = true;
  }

  _renderBoardCells() {
    this.dom.gridBoard.innerHTML = '';
    if (!this.grid || this.grid.length !== 25) return;

    for (let i = 0; i < 25; i++) {
      const num = this.grid[i];
      const isMarked = this.markedNumbers.has(num);

      const cell = document.createElement('button');
      cell.className = `cell ${isMarked ? 'marked' : ''}`;
      cell.dataset.index = String(i);
      cell.dataset.number = String(num);
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', `Number ${num}${isMarked ? ', marked' : ''}`);

      const numSpan = document.createElement('span');
      numSpan.className = 'cell-number';
      numSpan.textContent = String(num);
      cell.appendChild(numSpan);

      // Non-strike ink stamp circle (Constraint 4)
      const stamp = document.createElement('div');
      stamp.className = 'cell-ink-stamp';
      cell.appendChild(stamp);

      // Cell click handler
      cell.addEventListener('click', () => {
        this.handleCellClick(num);
      });

      this.dom.gridBoard.appendChild(cell);
    }
  }

  handleCellClick(number) {
    if (this.status !== 'IN_PROGRESS') return;
    if (this.currentTurnPlayerId !== this.playerId) {
      this.showToast('Please wait for your turn');
      return;
    }
    if (this.markedNumbers.has(number)) {
      this.showToast(`Number ${number} is already marked`);
      return;
    }

    // Call number to server
    this._send('call_number', { number });
  }

  _handleNumberCalled(msg) {
    const { number, nextTurnPlayerId } = msg;
    this.markedNumbers.add(number);
    this.currentTurnPlayerId = nextTurnPlayerId;

    // Update cell visual in board
    const cell = this.dom.gridBoard.querySelector(`[data-number="${number}"]`);
    if (cell) {
      cell.classList.add('marked');
      cell.setAttribute('aria-label', `Number ${number}, marked`);
    }

    // Sound effect: ink stamp / pencil tap
    soundManager.playMark();
    this._updateTurnBanner();
  }

  _handleLinesCompleted(msg) {
    // Gap detection check
    if (msg.eventSeq && msg.eventSeq > this.lastEventSeq + 1) {
      console.warn(`[BingoClient] Detected event sequence gap (${this.lastEventSeq} -> ${msg.eventSeq}). Requesting snapshot.`);
      this.requestSnapshot();
    }
    if (msg.eventSeq) {
      this.lastEventSeq = msg.eventSeq;
    }

    // Is this event for the local player?
    if (msg.newLines && Array.isArray(msg.newLines)) {
      // Step 8: Choreography - 120ms delay after mark before line stroke starts
      setTimeout(() => {
        for (const lineInfo of msg.newLines) {
          this.animationQueue.enqueue(lineInfo.id, async (isAccelerated) => {
            // Animate line stroke and its letter strike
            await this.renderOverlay.animateLineStrike(lineInfo, isAccelerated);
            this.completedLines.push(lineInfo.id);

            // Announce accessibility update
            const lineName = lineInfo.type === 'row' ? `Row ${lineInfo.index + 1}` : `Column ${lineInfo.index + 1}`;
            const letterText = lineInfo.letter ? ` Letter ${lineInfo.letter} crossed.` : '';
            this.announce(`${lineName} completed.${letterText}`);

            // Update BINGO button state immediately when 5 lines confirmed
            this._updateClaimButtonState();
          });
        }
      }, 120);
    } else if (msg.playerId && msg.playerId !== this.playerId) {
      // Opponent completed lines
      this.opponentLinesCount = msg.linesCompleted;
      this.renderOverlay.syncOpponentLines(this.opponentLinesCount);
    }
  }

  /**
   * Central BINGO Button state management.
   * locked -> ready -> submitting -> accepted / rejected.
   */
  _updateClaimButtonState() {
    const count = this.completedLines.length;

    if (this.isClaimPending) {
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn submitting';
      this.dom.bingoClaimBtn.disabled = true;
      this.dom.bingoBtnText.innerHTML = '<span class="spinner"></span> Verifying...';
      return;
    }

    if (this.winnerId) {
      if (this.winnerId === this.playerId) {
        this.dom.bingoClaimBtn.className = 'bingo-claim-btn accepted';
        this.dom.bingoClaimBtn.disabled = true;
        this.dom.bingoBtnText.textContent = 'VICTORY! BINGO';
      } else {
        this.dom.bingoClaimBtn.className = 'bingo-claim-btn locked';
        this.dom.bingoClaimBtn.disabled = true;
        this.dom.bingoBtnText.textContent = 'MATCH FINISHED';
      }
      return;
    }

    if (count >= 5) {
      // READY State: unlocks immediately, plays ready sound, glowing aura
      const wasLocked = this.dom.bingoClaimBtn.classList.contains('locked');
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn ready';
      this.dom.bingoClaimBtn.disabled = false;
      this.dom.bingoBtnText.textContent = 'CLAIM BINGO!';
      if (wasLocked) {
        soundManager.playButtonReady();
        this.announce('5 lines completed! BINGO button unlocked. Tap to claim victory.');
      }
    } else {
      // LOCKED State: shows count
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn locked';
      this.dom.bingoClaimBtn.disabled = true;
      this.dom.bingoBtnText.textContent = `BINGO (${count}/5)`;
    }
  }

  handleClaimPress() {
    if (this.completedLines.length < 5 || this.isClaimPending || this.status === 'FINISHED') {
      return;
    }

    // Debounce double-taps
    this.isClaimPending = true;
    this._updateClaimButtonState();

    const claimId = `claim-${this.playerId}-${Date.now()}`;
    this._send('claim_bingo', { claimId });

    // Safety timeout: if server response is delayed, restore state
    clearTimeout(this.claimDebounceTimer);
    this.claimDebounceTimer = setTimeout(() => {
      if (this.isClaimPending && !this.winnerId) {
        this.isClaimPending = false;
        this._updateClaimButtonState();
      }
    }, 5000);
  }

  _handleBingoResult(msg) {
    this.isClaimPending = false;
    clearTimeout(this.claimDebounceTimer);

    if (msg.valid) {
      this.status = 'FINISHED';
      this.winnerId = msg.winnerId;
      this._updateClaimButtonState();

      if (msg.winnerId === this.playerId) {
        soundManager.playVictory();
        this.showToast('Congratulations! You won the Bingo match!', 'success');
        this.dom.turnBanner.className = 'turn-banner my-turn';
        this.dom.turnBanner.textContent = '🏆 VICTORY! You completed 5 lines.';
        this.announce('Congratulations! You claimed Bingo and won the match!');
      } else {
        this.showToast('Opponent completed 5 lines and claimed BINGO!', 'error');
        this.dom.turnBanner.className = 'turn-banner opp-turn';
        this.dom.turnBanner.textContent = 'Opponent claimed BINGO! Match ended.';
        this.announce('Opponent claimed Bingo and won the match.');
      }
    } else {
      // Rejected claim
      this.dom.bingoClaimBtn.classList.add('rejected');
      setTimeout(() => {
        this.dom.bingoClaimBtn.classList.remove('rejected');
        this._updateClaimButtonState();
      }, 600);

      this.showToast(msg.reason || 'BINGO not verified. You need 5 completed lines.', 'error');
      this.announce(msg.reason || 'BINGO not verified.');
    }
  }

  _updateTurnBanner() {
    if (this.status === 'FINISHED') return;

    if (this.status !== 'IN_PROGRESS') {
      this.dom.turnBanner.className = 'turn-banner waiting';
      this.dom.turnBanner.textContent = 'Lock your arrangement to begin...';
      return;
    }

    if (this.currentTurnPlayerId === this.playerId) {
      this.dom.turnBanner.className = 'turn-banner my-turn';
      this.dom.turnBanner.textContent = 'Your Turn: Tap an uncalled number!';
    } else {
      this.dom.turnBanner.className = 'turn-banner opp-turn';
      this.dom.turnBanner.textContent = "Opponent's Turn: Waiting for call...";
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'success' ? 'toast-success' : '')}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  announce(text) {
    if (this.dom.announcer) {
      this.dom.announcer.textContent = text;
    }
  }
}

// Bootstrap on DOMContentLoaded
window.addEventListener('DOMContentLoaded', () => {
  window.bingoClient = new BingoClient();
});
