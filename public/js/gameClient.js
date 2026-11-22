/**
 * public/js/gameClient.js
 * 
 * Production Client Game Controller for Bingo.
 * Supports:
 * - 1v1 Matches with continuous slanted pen stroke line cutting
 * - Manual number placement (1-25) & Fisher-Yates random shuffle
 * - Private Room creation, join codes, and waiting lobby
 * - Knockout & League tournament progression & bracket visualizer
 * - Virtual Coin wallet, transaction history, and celebratory confetti
 */

import { generateRandomGrid, validateGridArrangement } from '/shared/lineModel.js';
import { AnimationQueue } from './animationQueue.js';
import { RenderOverlay } from './renderOverlay.js';
import { soundManager } from './audio.js';
import { ConfettiCelebration } from './confetti.js';

class BingoClient {
  constructor() {
    const params = new URLSearchParams(window.location.search);
    this.matchId = params.get('match') || 'match-quick-1';
    this.playerId = params.get('player') || `p-${Math.random().toString(36).slice(2, 7)}`;
    this.playerName = params.get('name') || `Player ${this.playerId.slice(0, 4)}`;

    // Authoritative Match State
    this.status = 'ARRANGING';
    this.grid = Array(25).fill(null);
    this.isLocked = false;
    this.markedNumbers = new Set();
    this.completedLines = [];
    this.opponentLinesCount = 0;
    this.currentTurnPlayerId = null;
    this.lastEventSeq = 0;
    this.winnerId = null;

    // Manual setup tracking
    this.manualNextNumber = 1;

    // Subsystems & UI
    this.animationQueue = new AnimationQueue();
    this.dom = this._cacheDOM();
    this.renderOverlay = new RenderOverlay(
      this.dom.lineOverlay,
      this.dom.playerBingoWord,
      this.dom.opponentBingoWord
    );
    this.confetti = new ConfettiCelebration(this.dom.confettiCanvas);

    // Private Room & Tournament state
    this.currentRoom = null;
    this.currentTournament = null;
    this.wallet = { balance: 500, history: [] };

    this._bindEvents();
    this._connectWebSocket();
    this._initDefaultGrid();
  }

  _cacheDOM() {
    return {
      confettiCanvas: document.getElementById('confetti-canvas'),
      coinDisplay: document.getElementById('coin-balance-display'),
      walletBtn: document.getElementById('wallet-btn'),
      walletModal: document.getElementById('wallet-modal'),
      closeWalletBtn: document.getElementById('close-wallet-btn'),
      modalCoinBalance: document.getElementById('modal-coin-balance'),
      walletHistoryList: document.getElementById('wallet-history-list'),

      muteBtn: document.getElementById('mute-btn'),
      muteIcon: document.getElementById('mute-icon'),
      reconnectBtn: document.getElementById('reconnect-btn'),

      // Tabs
      tabBtns: document.querySelectorAll('.tab-btn'),
      arenaView: document.getElementById('arena-view'),
      roomView: document.getElementById('room-view'),
      tournView: document.getElementById('tournament-view'),

      // Arena
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
      clearGridBtn: document.getElementById('clear-grid-btn'),
      lockArrangementBtn: document.getElementById('lock-arrangement-btn'),

      // Private Room
      createRoomBtn: document.getElementById('create-room-btn'),
      joinRoomBtn: document.getElementById('join-room-btn'),
      joinRoomCodeInput: document.getElementById('join-room-code-input'),
      roomLobbySection: document.getElementById('room-lobby-section'),
      lobbyCodeDisplay: document.getElementById('lobby-code-display'),
      copyRoomCodeBtn: document.getElementById('copy-room-code-btn'),
      lobbyPlayersList: document.getElementById('lobby-players-list'),
      addBotBtn: document.getElementById('add-bot-btn'),
      startRoomMatchBtn: document.getElementById('start-room-match-btn'),

      // Tournament
      tournTabKo: document.getElementById('tourn-tab-ko'),
      tournTabLeague: document.getElementById('tourn-tab-league'),
      startKnockoutBtn: document.getElementById('start-knockout-btn'),
      startLeagueBtn: document.getElementById('start-league-btn'),
      knockoutContainer: document.getElementById('knockout-bracket-container'),
      leagueContainer: document.getElementById('league-container'),
      leaguePointsBody: document.getElementById('league-points-body'),

      toastContainer: document.getElementById('toast-container'),
      announcer: document.getElementById('aria-live-announcer')
    };
  }

  _bindEvents() {
    this.dom.playerNameLabel.textContent = `You (${this.playerName})`;

    // Tab Switching
    this.dom.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        this.dom.arenaView.classList.toggle('hidden', tab !== 'arena');
        this.dom.roomView.classList.toggle('hidden', tab !== 'room');
        this.dom.tournView.classList.toggle('hidden', tab !== 'tournament');
      });
    });

    // Sound toggle
    this.dom.muteBtn.addEventListener('click', () => {
      const isMuted = soundManager.toggleMute();
      this.dom.muteIcon.textContent = isMuted ? '🔇' : '🔊';
      this.showToast(isMuted ? 'Sound muted' : 'Sound unmuted');
    });

    // Reconnect / Sync
    this.dom.reconnectBtn.addEventListener('click', () => {
      this.requestSnapshot();
      this._send('get_wallet');
      this.showToast('Synchronizing state...');
    });

    // Wallet Modal
    this.dom.walletBtn.addEventListener('click', () => {
      this._renderWalletModal();
      this.dom.walletModal.classList.remove('hidden');
    });
    this.dom.closeWalletBtn.addEventListener('click', () => {
      this.dom.walletModal.classList.add('hidden');
    });

    // Setup: Quick Shuffle
    this.dom.shuffleBtn.addEventListener('click', () => {
      if (this.isLocked) return;
      this.grid = generateRandomGrid();
      this._renderBoardCells();
      this._updateSetupStatus();
    });

    // Setup: Clear Grid
    this.dom.clearGridBtn.addEventListener('click', () => {
      if (this.isLocked) return;
      this.grid = Array(25).fill(null);
      this.manualNextNumber = 1;
      this._renderBoardCells();
      this._updateSetupStatus();
    });

    // Setup: Lock & Ready
    this.dom.lockArrangementBtn.addEventListener('click', () => {
      if (this.isLocked) return;
      const val = validateGridArrangement(this.grid);
      if (!val.valid) {
        this.showToast(val.error || 'Please fill all 25 numbers first', 'error');
        return;
      }
      this._send('set_arrangement', { grid: this.grid });
    });

    // BINGO Claim button
    this.dom.bingoClaimBtn.addEventListener('click', () => {
      this.handleClaimPress();
    });

    // Private Room: Create Room
    this.dom.createRoomBtn.addEventListener('click', () => {
      this._send('create_private_room', { playerName: this.playerName });
    });

    // Private Room: Join Room
    this.dom.joinRoomBtn.addEventListener('click', () => {
      const code = this.dom.joinRoomCodeInput.value.trim().toUpperCase();
      if (!code) {
        this.showToast('Please enter a room code', 'error');
        return;
      }
      this._send('join_private_room', { roomCode: code, playerName: this.playerName });
    });

    // Copy room code
    this.dom.copyRoomCodeBtn.addEventListener('click', () => {
      if (this.currentRoom) {
        navigator.clipboard?.writeText(this.currentRoom.code);
        this.showToast(`Room code ${this.currentRoom.code} copied!`);
      }
    });

    // Add bot to room
    this.dom.addBotBtn.addEventListener('click', () => {
      if (this.currentRoom) {
        this._send('add_room_bot', { roomCode: this.currentRoom.code });
      }
    });

    // Start private room match
    this.dom.startRoomMatchBtn.addEventListener('click', () => {
      if (this.currentRoom) {
        this._send('start_private_match', { roomCode: this.currentRoom.code });
      }
    });

    // Tournament Start buttons
    this.dom.startKnockoutBtn.addEventListener('click', () => {
      this._send('create_tournament', {
        tournamentType: 'KNOCKOUT',
        tournamentName: 'Neon Championship',
        playerName: this.playerName
      });
    });

    this.dom.startLeagueBtn.addEventListener('click', () => {
      this._send('create_tournament', {
        tournamentType: 'LEAGUE',
        tournamentName: 'Premier Bingo League',
        playerName: this.playerName
      });
    });

    this.dom.tournTabKo.addEventListener('click', () => {
      this.dom.knockoutContainer.style.display = 'flex';
      this.dom.leagueContainer.style.display = 'none';
      this.dom.tournTabKo.classList.add('btn-primary');
      this.dom.tournTabKo.classList.remove('btn-secondary');
      this.dom.tournTabLeague.classList.add('btn-secondary');
      this.dom.tournTabLeague.classList.remove('btn-primary');
    });

    this.dom.tournTabLeague.addEventListener('click', () => {
      this.dom.knockoutContainer.style.display = 'none';
      this.dom.leagueContainer.style.display = 'block';
      this.dom.tournTabLeague.classList.add('btn-primary');
      this.dom.tournTabLeague.classList.remove('btn-secondary');
      this.dom.tournTabKo.classList.add('btn-secondary');
      this.dom.tournTabKo.classList.remove('btn-primary');
    });
  }

  _initDefaultGrid() {
    this.grid = generateRandomGrid();
    this._renderBoardCells();
    this._updateSetupStatus();
  }

  _connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[BingoClient] Connected.');
      this._send('join_match', { playerName: this.playerName });
      this._send('get_wallet');
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
      console.warn('[BingoClient] Connection lost. Reconnecting in 2s...');
      setTimeout(() => this._connectWebSocket(), 2000);
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

      case 'wallet_update': {
        this.wallet = msg.wallet;
        this.dom.coinDisplay.textContent = String(msg.wallet.balance);
        this.dom.modalCoinBalance.textContent = String(msg.wallet.balance);
        this._renderWalletModal();
        break;
      }

      case 'private_room_created':
      case 'private_room_updated': {
        this.currentRoom = msg.room;
        this._renderRoomLobby(msg.room);
        break;
      }

      case 'private_match_started': {
        this.matchId = msg.matchId;
        this.showToast(`Match started in Room ${msg.roomCode}!`, 'success');
        // Switch to arena view
        this.dom.tabBtns[0].click();
        this._send('join_match', { playerName: this.playerName });
        break;
      }

      case 'tournament_created': {
        this.currentTournament = msg.tournament;
        this._renderTournament(msg.tournament);
        this.showToast(`${msg.tournament.name} created!`, 'success');
        // Start immediately
        this._send('start_tournament', { tournamentId: msg.tournament.id });
        break;
      }

      case 'tournament_updated': {
        this.currentTournament = msg.tournament;
        this._renderTournament(msg.tournament);
        break;
      }

      case 'arrangement_locked': {
        if (msg.playerId === this.playerId) {
          this.isLocked = true;
          this.grid = msg.grid;
          this.dom.setupStatus.textContent = 'Arrangement locked! Waiting for opponent...';
          this.dom.shuffleBtn.disabled = true;
          this.dom.clearGridBtn.disabled = true;
          this.dom.lockArrangementBtn.disabled = true;
          this._renderBoardCells();
          this.announce('Your grid is locked.');
        }
        break;
      }

      case 'match_started': {
        this.status = 'IN_PROGRESS';
        this.currentTurnPlayerId = msg.currentTurnPlayerId;
        this.dom.setupPanel.style.display = 'none';
        this._updateTurnBanner();
        this._renderBoardCells();
        this.showToast('Match started! Tap an uncalled number on your turn.');
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
    }
  }

  _renderRoomLobby(room) {
    this.dom.roomLobbySection.style.display = 'flex';
    this.dom.lobbyCodeDisplay.textContent = room.code;
    this.dom.lobbyPlayersList.innerHTML = '';

    room.players.forEach(p => {
      const row = document.createElement('div');
      row.className = 'player-item';
      row.innerHTML = `
        <span style="font-weight:700;">${p.name} ${p.isBot ? '🤖' : ''}</span>
        <div>
          ${p.isHost ? '<span class="badge badge-host">HOST</span>' : ''}
          <span class="badge badge-ready">READY</span>
        </div>
      `;
      this.dom.lobbyPlayersList.appendChild(row);
    });

    const isHost = room.hostId === this.playerId;
    this.dom.addBotBtn.style.display = isHost && room.playerCount < 2 ? 'block' : 'none';
    this.dom.startRoomMatchBtn.style.display = isHost ? 'block' : 'none';
    this.dom.startRoomMatchBtn.disabled = room.playerCount < 2;
  }

  _renderTournament(tourn) {
    if (tourn.type === 'KNOCKOUT') {
      this.dom.tournTabKo.click();
      this.dom.knockoutContainer.innerHTML = '';

      tourn.knockoutMatches.forEach(m => {
        const card = document.createElement('div');
        card.className = 'bracket-match glass-panel';
        const p1Name = m.player1 ? m.player1.name : 'TBD';
        const p2Name = m.player2 ? m.player2.name : 'TBD';
        const winText = m.winner ? `🏆 Winner: ${m.winner.name}` : `Status: ${m.status}`;

        card.innerHTML = `
          <div class="bracket-round-title">${m.round}</div>
          <div class="bracket-versus">
            <span>${p1Name}</span>
            <span style="color:var(--text-muted);">vs</span>
            <span>${p2Name}</span>
          </div>
          <div style="font-size:0.8rem; color:var(--electric-blue); font-weight:700;">${winText}</div>
        `;
        this.dom.knockoutContainer.appendChild(card);
      });

      if (tourn.champion) {
        const champCard = document.createElement('div');
        champCard.className = 'bracket-match glass-panel';
        champCard.style.border = '1px solid var(--gold-yellow)';
        champCard.innerHTML = `
          <div class="bracket-round-title" style="color:var(--gold-yellow);">👑 Tournament Champion</div>
          <div style="font-size:1.2rem; font-weight:900; color:#ffffff;">${tourn.champion.name}</div>
          <div style="color:var(--gold-yellow); font-weight:800;">Prize: 🪙 500 Virtual Coins</div>
        `;
        this.dom.knockoutContainer.appendChild(champCard);
      }
    } else {
      // League
      this.dom.tournTabLeague.click();
      this.dom.leaguePointsBody.innerHTML = '';

      tourn.pointsTable.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight:800; color:var(--gold-yellow);">#${idx + 1}</td>
          <td style="font-weight:700;">${row.name}</td>
          <td>${row.played}</td>
          <td style="color:#2b9348;">${row.won}</td>
          <td style="color:#d90429;">${row.lost}</td>
          <td style="font-weight:900; color:var(--electric-blue);">${row.points}</td>
        `;
        this.dom.leaguePointsBody.appendChild(tr);
      });
    }
  }

  _renderWalletModal() {
    this.dom.walletHistoryList.innerHTML = '';
    if (!this.wallet.history || this.wallet.history.length === 0) {
      this.dom.walletHistoryList.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:10px;">No transactions yet</div>';
      return;
    }

    this.wallet.history.forEach(tx => {
      const item = document.createElement('div');
      item.className = 'tx-item';
      item.innerHTML = `
        <div>
          <div style="font-weight:700;">${tx.description}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">${new Date(tx.timestamp).toLocaleTimeString()}</div>
        </div>
        <div class="tx-amount">+${tx.amount} 🪙</div>
      `;
      this.dom.walletHistoryList.appendChild(item);
    });
  }

  _updateSetupStatus() {
    if (this.isLocked) return;
    const filledCount = this.grid.filter(n => Number.isInteger(n)).length;
    const val = validateGridArrangement(this.grid);

    if (val.valid) {
      this.dom.setupStatus.textContent = 'All 25 numbers placed! Ready to lock.';
      this.dom.lockArrangementBtn.disabled = false;
    } else {
      this.dom.setupStatus.textContent = `Manual arrangement: placed ${filledCount}/25. Next: ${this.manualNextNumber}.`;
      this.dom.lockArrangementBtn.disabled = true;
    }
  }

  _applySnapshot(snapshot) {
    if (!snapshot) return;

    this.status = snapshot.status;
    this.currentTurnPlayerId = snapshot.currentTurnPlayerId;
    this.winnerId = snapshot.winnerId;

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

    if (this.isLocked || this.status === 'IN_PROGRESS' || this.status === 'FINISHED') {
      this.dom.setupPanel.style.display = 'none';
    }

    this._renderBoardCells();
    this._updateTurnBanner();
    this._updateClaimButtonState();
    this.renderOverlay.hydrate(this.completedLines, this.opponentLinesCount);

    for (const id of this.completedLines) {
      this.animationQueue.markSeen(id);
    }
  }

  _renderBoardCells() {
    this.dom.gridBoard.innerHTML = '';
    if (!this.grid) return;

    for (let i = 0; i < 25; i++) {
      const num = this.grid[i];
      const isMarked = num && this.markedNumbers.has(num);

      const cell = document.createElement('button');
      cell.className = `cell ${isMarked ? 'marked' : ''}`;
      cell.dataset.index = String(i);

      if (num !== null) {
        cell.dataset.number = String(num);
        cell.setAttribute('aria-label', `Number ${num}${isMarked ? ', marked' : ''}`);

        const numSpan = document.createElement('span');
        numSpan.className = 'cell-number';
        numSpan.textContent = String(num);
        cell.appendChild(numSpan);

        // Non-strike ink stamp circle (Constraint 4)
        const stamp = document.createElement('div');
        stamp.className = 'cell-ink-stamp';
        cell.appendChild(stamp);
      } else {
        cell.setAttribute('aria-label', `Empty cell ${i + 1}`);
      }

      cell.addEventListener('click', () => {
        if (this.status === 'ARRANGING' && !this.isLocked) {
          this.handleManualPlacement(i);
        } else if (this.status === 'IN_PROGRESS') {
          if (num !== null) this.handleCellClick(num);
        }
      });

      this.dom.gridBoard.appendChild(cell);
    }
  }

  handleManualPlacement(cellIndex) {
    if (this.grid[cellIndex] !== null) {
      // Cell already has a number
      return;
    }

    // Find smallest unplaced number in 1..25
    const placedSet = new Set(this.grid.filter(n => n !== null));
    let nextNum = 1;
    while (placedSet.has(nextNum) && nextNum <= 25) {
      nextNum++;
    }

    if (nextNum <= 25) {
      this.grid[cellIndex] = nextNum;
      this.manualNextNumber = nextNum + 1;
      this._renderBoardCells();
      this._updateSetupStatus();
      soundManager.playMark();
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

    this._send('call_number', { number });
  }

  _handleNumberCalled(msg) {
    const { number, nextTurnPlayerId } = msg;
    this.markedNumbers.add(number);
    this.currentTurnPlayerId = nextTurnPlayerId;

    const cell = this.dom.gridBoard.querySelector(`[data-number="${number}"]`);
    if (cell) {
      cell.classList.add('marked');
      cell.setAttribute('aria-label', `Number ${number}, marked`);
    }

    soundManager.playMark();
    this._updateTurnBanner();
  }

  _handleLinesCompleted(msg) {
    if (msg.eventSeq) {
      this.lastEventSeq = msg.eventSeq;
    }

    if (msg.newLines && Array.isArray(msg.newLines)) {
      setTimeout(() => {
        for (const lineInfo of msg.newLines) {
          this.animationQueue.enqueue(lineInfo.id, async (isAccelerated) => {
            await this.renderOverlay.animateLineStrike(lineInfo, isAccelerated);
            this.completedLines.push(lineInfo.id);

            const lineName = lineInfo.type === 'row' ? `Row ${lineInfo.index + 1}` : `Column ${lineInfo.index + 1}`;
            const letterText = lineInfo.letter ? ` Letter ${lineInfo.letter} crossed.` : '';
            this.announce(`${lineName} completed.${letterText}`);

            this._updateClaimButtonState();
          });
        }
      }, 120);
    } else if (msg.playerId && msg.playerId !== this.playerId) {
      this.opponentLinesCount = msg.linesCompleted;
      this.renderOverlay.syncOpponentLines(this.opponentLinesCount);
    }
  }

  _updateClaimButtonState() {
    const count = this.completedLines.length;

    if (this.isClaimPending) {
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn submitting';
      this.dom.bingoClaimBtn.disabled = true;
      this.dom.bingoBtnText.innerHTML = '<span class="spinner"></span> Verifying BINGO...';
      return;
    }

    if (this.winnerId) {
      if (this.winnerId === this.playerId) {
        this.dom.bingoClaimBtn.className = 'bingo-claim-btn accepted';
        this.dom.bingoClaimBtn.disabled = true;
        this.dom.bingoBtnText.textContent = '🏆 VICTORY! BINGO';
      } else {
        this.dom.bingoClaimBtn.className = 'bingo-claim-btn locked';
        this.dom.bingoClaimBtn.disabled = true;
        this.dom.bingoBtnText.textContent = 'MATCH FINISHED';
      }
      return;
    }

    if (count >= 5) {
      const wasLocked = this.dom.bingoClaimBtn.classList.contains('locked');
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn ready';
      this.dom.bingoClaimBtn.disabled = false;
      this.dom.bingoBtnText.textContent = 'CLAIM BINGO! ⚡';
      if (wasLocked) {
        soundManager.playButtonReady();
        this.announce('5 lines completed! Claim BINGO button is ready.');
      }
    } else {
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn locked';
      this.dom.bingoClaimBtn.disabled = true;
      this.dom.bingoBtnText.textContent = `BINGO (${count}/5)`;
    }
  }

  handleClaimPress() {
    if (this.completedLines.length < 5 || this.isClaimPending || this.status === 'FINISHED') {
      return;
    }

    this.isClaimPending = true;
    this._updateClaimButtonState();

    const claimId = `claim-${this.playerId}-${Date.now()}`;
    this._send('claim_bingo', { claimId });

    setTimeout(() => {
      if (this.isClaimPending && !this.winnerId) {
        this.isClaimPending = false;
        this._updateClaimButtonState();
      }
    }, 5000);
  }

  _handleBingoResult(msg) {
    this.isClaimPending = false;

    if (msg.valid) {
      this.status = 'FINISHED';
      this.winnerId = msg.winnerId;
      this._updateClaimButtonState();

      if (msg.winnerId === this.playerId) {
        soundManager.playVictory();
        this.confetti.burst(140);
        this.showToast('🏆 Victory! You claimed BINGO (+150 Coins)', 'success');
        this.dom.turnBanner.className = 'turn-banner my-turn';
        this.dom.turnBanner.textContent = '🏆 CHAMPION! You completed 5 lines.';
      } else {
        this.showToast('Opponent completed 5 lines and claimed BINGO!', 'error');
        this.dom.turnBanner.className = 'turn-banner opp-turn';
        this.dom.turnBanner.textContent = 'Opponent claimed BINGO! Match ended.';
      }
    } else {
      this.dom.bingoClaimBtn.classList.add('rejected');
      setTimeout(() => {
        this.dom.bingoClaimBtn.classList.remove('rejected');
        this._updateClaimButtonState();
      }, 500);

      this.showToast(msg.reason || 'BINGO not verified. You need 5 completed lines.', 'error');
    }
  }

  _updateTurnBanner() {
    if (this.status === 'FINISHED') return;

    if (this.status !== 'IN_PROGRESS') {
      this.dom.turnBanner.className = 'turn-banner waiting';
      this.dom.turnBanner.textContent = 'Lock your 5x5 numbers to begin match...';
      return;
    }

    if (this.currentTurnPlayerId === this.playerId) {
      this.dom.turnBanner.className = 'turn-banner my-turn';
      this.dom.turnBanner.textContent = 'Your Turn: Call an uncalled number!';
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

window.addEventListener('DOMContentLoaded', () => {
  window.bingoClient = new BingoClient();
});
