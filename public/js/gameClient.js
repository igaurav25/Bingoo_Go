/**
 * public/js/gameClient.js
 * 
 * Part 2 Full-Featured Bingo Client.
 * - Single-page app router (/ and /r/:code)
 * - Anonymous sessionTokens in localStorage (seat ownership)
 * - Cell-swapping arrange interaction (tap cell A, tap cell B to swap)
 * - Turn countdown synced to server deadline
 * - Screen Wake Lock API (re-acquired on visibilitychange)
 * - Quick emoji reactions & floating popups
 * - Web Share API & WhatsApp invite fallback
 * - QR code scanning modal
 * - Bilingual English / Hindi support
 * - Audio & haptic vibration triggers
 */

import { generateRandomGrid, validateGridArrangement } from '/shared/lineModel.js';
import { AnimationQueue } from './animationQueue.js';
import { RenderOverlay } from './renderOverlay.js';
import { soundManager } from './audio.js';
import { ConfettiCelebration } from './confetti.js';
import { generateQRCodeSVG } from './qrcode.js';
import { t, setLanguage, getLanguage } from './i18n.js';

class BingoApp {
  constructor() {
    this._loadSession();
    this.currentRoom = null;
    this.status = 'home'; // 'home' | 'lobby' | 'arranging' | 'playing' | 'finished'
    this.isLocked = false;
    this.grid = generateRandomGrid();
    this.selectedCellIndex = null; // for cell swapping in arrange mode
    this.markedNumbers = new Set();
    this.completedLines = [];
    this.opponentLinesCount = 0;
    this.serverTimeOffset = 0;
    this.turnTimerInterval = null;
    this.wakeLock = null;
    this.lastReactionSentAt = 0;

    // Subsystems
    this.dom = this._cacheDOM();
    this.animationQueue = new AnimationQueue();
    this.renderOverlay = new RenderOverlay(
      this.dom.lineOverlay,
      this.dom.playerBingoRow,
      null // Opponent mini letters updated separately
    );
    this.confetti = new ConfettiCelebration(this.dom.confettiCanvas);

    this._bindEvents();
    this._applySettings();
    this._connectWebSocket();
    this._handleRoute();
  }

  _loadSession() {
    try {
      this.playerId = localStorage.getItem('bingo_playerId');
      this.sessionToken = localStorage.getItem('bingo_sessionToken');
      this.nickname = localStorage.getItem('bingo_nickname') || 'Player';
      this.avatar = localStorage.getItem('bingo_avatar') || '🦊';
      this.theme = localStorage.getItem('bingo_theme') || 'indigo';
      this.vibrationEnabled = localStorage.getItem('bingo_vibrate') !== 'false';
    } catch {
      this.nickname = 'Player';
      this.avatar = '🦊';
      this.theme = 'indigo';
      this.vibrationEnabled = true;
    }

    if (!this.playerId) {
      this.playerId = `p-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('bingo_playerId', this.playerId);
    }
    if (!this.sessionToken) {
      this.sessionToken = `tok-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
      localStorage.setItem('bingo_sessionToken', this.sessionToken);
    }
  }

  _cacheDOM() {
    return {
      confettiCanvas: document.getElementById('confetti-canvas'),
      headerAvatar: document.getElementById('header-avatar'),
      headerName: document.getElementById('header-name'),
      profileChipBtn: document.getElementById('profile-chip-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      disconnectBanner: document.getElementById('disconnect-banner'),
      disconnectBannerText: document.getElementById('disconnect-banner-text'),

      // Screens
      screenHome: document.getElementById('screen-home'),
      screenLobby: document.getElementById('screen-lobby'),
      screenArrange: document.getElementById('screen-arrange'),
      screenGame: document.getElementById('screen-game'),
      screenResult: document.getElementById('screen-result'),

      // Home
      btnCreateRoom: document.getElementById('btn-create-room'),
      codeBoxes: [
        document.getElementById('code-box-0'),
        document.getElementById('code-box-1'),
        document.getElementById('code-box-2'),
        document.getElementById('code-box-3'),
        document.getElementById('code-box-4')
      ],
      btnJoinCode: document.getElementById('btn-join-code'),
      btnHowToPlay: document.getElementById('btn-how-to-play'),
      btnStats: document.getElementById('btn-stats'),

      // Lobby
      lobbyCodeText: document.getElementById('lobby-code-text'),
      btnShareLink: document.getElementById('btn-share-link'),
      btnCopyLink: document.getElementById('btn-copy-link'),
      btnShowQr: document.getElementById('btn-show-qr'),
      seat1Avatar: document.getElementById('seat1-avatar'),
      seat1Name: document.getElementById('seat1-name'),
      seat1Status: document.getElementById('seat1-status'),
      seat2Avatar: document.getElementById('seat2-avatar'),
      seat2Name: document.getElementById('seat2-name'),
      seat2Status: document.getElementById('seat2-status'),
      timerChips: document.querySelectorAll('.timer-chip[data-time]'),
      btnPracticeBot: document.getElementById('btn-practice-bot'),
      btnToggleReady: document.getElementById('btn-toggle-ready'),

      // Arrange
      arrangeGridBoard: document.getElementById('arrange-grid-board'),
      friendArrangeBadge: document.getElementById('friend-arrange-badge'),
      btnAutoArrange: document.getElementById('btn-auto-arrange'),
      btnResetArrange: document.getElementById('btn-reset-arrange'),
      btnLockBoard: document.getElementById('btn-lock-board'),

      // Game
      gameOppAvatar: document.getElementById('game-opp-avatar'),
      gameOppName: document.getElementById('game-opp-name'),
      opponentConnDot: document.getElementById('opponent-conn-dot'),
      opponentMiniBingo: document.getElementById('opponent-mini-bingo'),
      turnIndicatorPill: document.getElementById('turn-indicator-pill'),
      turnDot: document.getElementById('turn-dot'),
      turnText: document.getElementById('turn-text'),
      turnClockDisplay: document.getElementById('turn-clock-display'),
      turnClockSeconds: document.getElementById('turn-clock-seconds'),
      calledNumbersStrip: document.getElementById('called-numbers-strip'),
      playerBingoRow: document.getElementById('player-bingo-row'),
      gameGridBoard: document.getElementById('game-grid-board'),
      lineOverlay: document.getElementById('line-strike-overlay'),
      bingoClaimBtn: document.getElementById('bingo-claim-btn'),
      bingoBtnText: document.getElementById('bingo-btn-text'),
      reactionBtns: document.querySelectorAll('.reaction-btn'),

      // Result
      resultEmoji: document.getElementById('result-emoji'),
      resultTitle: document.getElementById('result-title'),
      resultDesc: document.getElementById('result-desc'),
      scorePlayer1: document.getElementById('score-player1'),
      scorePlayer2: document.getElementById('score-player2'),
      btnRematch: document.getElementById('btn-rematch'),
      btnShareResult: document.getElementById('btn-share-result'),
      btnLeaveRoom: document.getElementById('btn-leave-room'),

      // Modals
      modalProfile: document.getElementById('modal-profile'),
      inputNickname: document.getElementById('input-nickname'),
      avatarOpts: document.querySelectorAll('.avatar-opt'),
      btnSaveProfile: document.getElementById('btn-save-profile'),

      modalSettings: document.getElementById('modal-settings'),
      btnLangEn: document.getElementById('btn-lang-en'),
      btnLangHi: document.getElementById('btn-lang-hi'),
      themeChips: document.querySelectorAll('.timer-chip[data-theme-val]'),
      toggleSound: document.getElementById('toggle-sound'),
      toggleVibration: document.getElementById('toggle-vibration'),
      toggleReducedMotion: document.getElementById('toggle-reduced-motion'),

      modalHowToPlay: document.getElementById('modal-how-to-play'),
      modalQr: document.getElementById('modal-qr'),
      qrContainer: document.getElementById('qr-container'),

      modalCloseBtns: document.querySelectorAll('.modal-close'),
      toastContainer: document.getElementById('toast-container'),
      announcer: document.getElementById('aria-live-announcer')
    };
  }

  _bindEvents() {
    this._updateProfileUI();

    // 5-box room code input auto-advance & paste handler
    this.dom.codeBoxes.forEach((box, idx) => {
      box.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '');
        e.target.value = val;
        if (val && idx < 4) {
          this.dom.codeBoxes[idx + 1].focus();
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          this.dom.codeBoxes[idx - 1].focus();
        }
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const clean = text.toUpperCase().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '').slice(0, 5);
        for (let i = 0; i < 5; i++) {
          this.dom.codeBoxes[i].value = clean[i] || '';
        }
        if (clean.length === 5) {
          this.dom.btnJoinCode.focus();
        }
      });
    });

    // Create Room
    this.dom.btnCreateRoom.addEventListener('click', () => {
      this._unlockAudio();
      this._send('create_room', {
        name: this.nickname,
        avatar: this.avatar,
        playerId: this.playerId,
        sessionToken: this.sessionToken
      });
    });

    // Join Code
    this.dom.btnJoinCode.addEventListener('click', () => {
      this._unlockAudio();
      const code = this.dom.codeBoxes.map(b => b.value).join('');
      if (code.length < 5) {
        this.showToast('Please enter a 5-character room code.');
        return;
      }
      this.joinRoomByCode(code);
    });

    // Share / Copy Link / QR Code
    this.dom.btnShareLink.addEventListener('click', () => this.shareRoomLink());
    this.dom.btnCopyLink.addEventListener('click', () => this.copyRoomLink());
    this.dom.lobbyCodeText.addEventListener('click', () => this.copyRoomCode());
    this.dom.btnShowQr.addEventListener('click', () => this.showQRCodeModal());

    // Practice vs Bot
    this.dom.btnPracticeBot.addEventListener('click', () => {
      this._send('add_bot');
    });

    // Ready Toggle in Lobby
    this.dom.btnToggleReady.addEventListener('click', () => {
      this._send('set_ready');
    });

    // Turn Timer Host options
    this.dom.timerChips.forEach(chip => {
      chip.addEventListener('click', () => {
        if (this.currentRoom && this.currentRoom.hostPlayerId === this.playerId) {
          this.dom.timerChips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
          const secs = Number(chip.dataset.time) || 0;
          this._send('update_settings', { turnTimerSeconds: secs });
        }
      });
    });

    // Arrange Screen Actions
    this.dom.btnAutoArrange.addEventListener('click', () => {
      this.grid = generateRandomGrid();
      this.selectedCellIndex = null;
      this._renderArrangeGrid();
      this._vibrate(20);
    });

    this.dom.btnResetArrange.addEventListener('click', () => {
      this.grid = Array.from({ length: 25 }, (_, i) => i + 1);
      this.selectedCellIndex = null;
      this._renderArrangeGrid();
      this._vibrate(20);
    });

    this.dom.btnLockBoard.addEventListener('click', () => {
      const val = validateGridArrangement(this.grid);
      if (!val.valid) {
        this.showToast('Card arrangement is invalid.');
        return;
      }
      this.isLocked = true;
      this.dom.btnLockBoard.disabled = true;
      this._send('lock_board', { grid: this.grid });
      this.showToast(t('boardLocked'));
    });

    // BINGO Claim
    this.dom.bingoClaimBtn.addEventListener('click', () => {
      this.handleClaimPress();
    });

    // Reaction Emojis
    this.dom.reactionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        const now = Date.now();
        if (now - this.lastReactionSentAt >= 2000) {
          this.lastReactionSentAt = now;
          this._send('send_reaction', { emoji });
          this._showFloatingReaction(this.playerId, emoji);
          this._vibrate(25);
        }
      });
    });

    // Rematch & Leave
    this.dom.btnRematch.addEventListener('click', () => {
      this.dom.btnRematch.disabled = true;
      this.dom.btnRematch.textContent = t('rematchRequested');
      this._send('request_rematch');
    });

    this.dom.btnLeaveRoom.addEventListener('click', () => {
      this._send('leave_room');
      window.history.pushState({}, '', '/');
      this._showScreen('home');
    });

    this.dom.btnShareResult.addEventListener('click', () => {
      this.shareResultCard();
    });

    // Profile & Modal Openers
    this.dom.profileChipBtn.addEventListener('click', () => {
      this.dom.inputNickname.value = this.nickname;
      this.dom.avatarOpts.forEach(o => o.classList.toggle('selected', o.dataset.avatar === this.avatar));
      this.dom.modalProfile.classList.remove('hidden');
    });

    this.dom.avatarOpts.forEach(opt => {
      opt.addEventListener('click', () => {
        this.dom.avatarOpts.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    this.dom.btnSaveProfile.addEventListener('click', () => {
      const newName = (this.dom.inputNickname.value.trim() || 'Player').slice(0, 16);
      const selOpt = document.querySelector('.avatar-opt.selected');
      const newAvatar = selOpt ? selOpt.dataset.avatar : this.avatar;

      this.nickname = newName;
      this.avatar = newAvatar;
      localStorage.setItem('bingo_nickname', newName);
      localStorage.setItem('bingo_avatar', newAvatar);

      this._updateProfileUI();
      this.dom.modalProfile.classList.add('hidden');
      this.showToast('Profile updated!');
    });

    this.dom.settingsBtn.addEventListener('click', () => {
      this.dom.modalSettings.classList.remove('hidden');
    });

    this.dom.btnHowToPlay.addEventListener('click', () => {
      this.dom.modalHowToPlay.classList.remove('hidden');
    });

    this.dom.btnStats.addEventListener('click', () => {
      this._showStatsToast();
    });

    // Modal Close
    this.dom.modalCloseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
      });
    });

    // Language Toggle
    this.dom.btnLangEn.addEventListener('click', () => {
      setLanguage('en');
      this._applyLanguage();
    });
    this.dom.btnLangHi.addEventListener('click', () => {
      setLanguage('hi');
      this._applyLanguage();
    });

    // Background Themes
    this.dom.themeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.themeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const th = chip.dataset.themeVal;
        this.theme = th;
        document.body.dataset.theme = th;
        localStorage.setItem('bingo_theme', th);
      });
    });

    // Toggles
    this.dom.toggleSound.addEventListener('change', (e) => {
      if (!e.target.checked && !soundManager.isMuted) soundManager.toggleMute();
      if (e.target.checked && soundManager.isMuted) soundManager.toggleMute();
    });

    this.dom.toggleVibration.addEventListener('change', (e) => {
      this.vibrationEnabled = e.target.checked;
      localStorage.setItem('bingo_vibrate', String(e.target.checked));
    });

    this.dom.toggleReducedMotion.addEventListener('change', (e) => {
      document.body.classList.toggle('reduce-motion', e.target.checked);
    });

    // Visibility & Resume Reconnect
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this._acquireWakeLock();
        if (this.currentRoom) {
          this._send('request_snapshot');
        }
      }
    });

    window.addEventListener('pageshow', () => {
      if (this.currentRoom) {
        this._send('request_snapshot');
      }
    });
  }

  _unlockAudio() {
    soundManager._initCtx();
  }

  _vibrate(pattern = 40) {
    if (this.vibrationEnabled && navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch {}
    }
  }

  async _acquireWakeLock() {
    if ('wakeLock' in navigator && this.status === 'playing') {
      try {
        this.wakeLock = await navigator.wakeLock.request('screen');
      } catch {}
    }
  }

  _applySettings() {
    document.body.dataset.theme = this.theme;
    this.dom.themeChips.forEach(c => {
      c.classList.toggle('active', c.dataset.themeVal === this.theme);
    });
    this._applyLanguage();
  }

  _applyLanguage() {
    const lang = getLanguage();
    this.dom.btnLangEn.classList.toggle('active', lang === 'en');
    this.dom.btnLangHi.classList.toggle('active', lang === 'hi');

    document.querySelectorAll('[id^="lbl-"]').forEach(el => {
      const key = el.id.replace('lbl-', '');
      if (key) {
        const camel = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
        el.textContent = t(camel) || el.textContent;
      }
    });
  }

  _updateProfileUI() {
    this.dom.headerAvatar.textContent = this.avatar;
    this.dom.headerName.textContent = this.nickname;
  }

  _showScreen(screenName) {
    this.status = screenName;
    this.dom.screenHome.classList.toggle('hidden', screenName !== 'home');
    this.dom.screenLobby.classList.toggle('hidden', screenName !== 'lobby');
    this.dom.screenArrange.classList.toggle('hidden', screenName !== 'arranging');
    this.dom.screenGame.classList.toggle('hidden', screenName !== 'playing');
    this.dom.screenResult.classList.toggle('hidden', screenName !== 'finished');
  }

  _handleRoute() {
    const path = window.location.pathname;
    const match = path.match(/^\/r\/([A-Za-z0-9]+)/);
    if (match && match[1]) {
      const code = match[1].toUpperCase();
      this.joinRoomByCode(code);
    } else {
      this._showScreen('home');
    }
  }

  _connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Bingo] WebSocket connected.');
      this._send('ping');
      if (this.currentRoom) {
        this.joinRoomByCode(this.currentRoom.code);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleServerMessage(msg);
      } catch (err) {
        console.error('[Bingo] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('[Bingo] WebSocket disconnected. Auto-reconnecting...');
      setTimeout(() => this._connectWebSocket(), 1800);
    };

    // Heartbeat
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this._send('ping');
      }
    }, 15000);
  }

  _send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  joinRoomByCode(code) {
    this._unlockAudio();
    this._send('join_room', {
      code,
      name: this.nickname,
      avatar: this.avatar,
      playerId: this.playerId,
      sessionToken: this.sessionToken
    });
  }

  _handleServerMessage(msg) {
    const { type } = msg;

    switch (type) {
      case 'pong': {
        if (msg.time) {
          this.serverTimeOffset = msg.time - Date.now();
        }
        break;
      }

      case 'tab_conflict': {
        this.dom.disconnectBanner.style.display = 'flex';
        this.dom.disconnectBannerText.textContent = t('openedInAnotherTab');
        this.showToast(t('openedInAnotherTab'), 'error');
        break;
      }

      case 'room_created':
      case 'room_joined': {
        this.currentRoom = msg.room;
        window.history.pushState({}, '', `/r/${msg.code}`);
        this._renderLobby(msg.room);
        this._showScreen('lobby');
        break;
      }

      case 'room_state': {
        this.currentRoom = msg.room;
        this._syncRoomState(msg.room);
        break;
      }

      case 'start_arranging': {
        this.isLocked = false;
        this.dom.btnLockBoard.disabled = false;
        this.selectedCellIndex = null;
        this._renderArrangeGrid();
        this._showScreen('arranging');
        break;
      }

      case 'board_locked': {
        if (msg.playerId === this.playerId) {
          this.isLocked = true;
          this.dom.btnLockBoard.disabled = true;
        }
        break;
      }

      case 'match_started': {
        this.status = 'playing';
        this._acquireWakeLock();
        this._showScreen('playing');
        this._renderGameGrid();
        this._updateTurnBanner(msg.currentTurnPlayerId);
        this._startTurnCountdown(msg.turnDeadline);
        this.showToast('Match started! Both boards locked.');
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

      case 'reaction': {
        this._showFloatingReaction(msg.playerId, msg.emoji);
        break;
      }

      case 'player_disconnected': {
        this.dom.disconnectBanner.style.display = 'flex';
        this.dom.disconnectBannerText.textContent = t('friendDisconnected', { seconds: msg.graceSecondsRemaining || 60 });
        this.dom.opponentConnDot.classList.add('disconnected');
        break;
      }

      case 'player_reconnected': {
        this.dom.disconnectBanner.style.display = 'none';
        this.dom.opponentConnDot.classList.remove('disconnected');
        this.showToast('Friend reconnected!', 'success');
        break;
      }

      case 'rematch_started': {
        this.isLocked = false;
        this.dom.btnRematch.disabled = false;
        this.dom.btnRematch.textContent = t('rematch');
        this.markedNumbers.clear();
        this.completedLines = [];
        this.renderOverlay.clear();
        this._showScreen('arranging');
        this._renderArrangeGrid();
        break;
      }

      case 'error': {
        this.showToast(msg.message, 'error');
        if (msg.code === 'ROOM_NOT_FOUND') {
          window.history.pushState({}, '', '/');
          this._showScreen('home');
        }
        break;
      }
    }
  }

  _renderLobby(room) {
    this.dom.lobbyCodeText.textContent = room.code;
    const isHost = room.hostPlayerId === this.playerId;

    const p1 = room.players[0];
    const p2 = room.players[1];

    if (p1) {
      this.dom.seat1Avatar.textContent = p1.avatar;
      this.dom.seat1Name.textContent = p1.id === this.playerId ? `${p1.name} (${t('host')})` : p1.name;
      this.dom.seat1Status.className = `status-badge ${p1.isReady ? 'status-ready' : 'status-waiting'}`;
      this.dom.seat1Status.textContent = p1.isReady ? t('ready') : t('notReady');
    }

    if (p2) {
      this.dom.seat2Avatar.textContent = p2.avatar;
      this.dom.seat2Name.textContent = p2.id === this.playerId ? `${p2.name} (${t('guest')})` : p2.name;
      this.dom.seat2Status.className = `status-badge ${p2.isReady ? 'status-ready' : 'status-waiting'}`;
      this.dom.seat2Status.textContent = p2.isReady ? t('ready') : t('notReady');
      this.dom.btnPracticeBot.style.display = 'none';
    } else {
      this.dom.seat2Avatar.textContent = '⏳';
      this.dom.seat2Name.textContent = t('waitingForFriend');
      this.dom.seat2Status.className = 'status-badge status-waiting';
      this.dom.seat2Status.textContent = '...';
      this.dom.btnPracticeBot.style.display = isHost ? 'block' : 'none';
    }
  }

  _syncRoomState(room) {
    if (room.isPaused) {
      this.dom.disconnectBanner.style.display = 'flex';
      this.dom.disconnectBannerText.textContent = t('friendDisconnected', {
        seconds: room.disconnectGraceSecondsRemaining || 60
      });
    } else {
      this.dom.disconnectBanner.style.display = 'none';
    }

    if (this.status === 'lobby') {
      this._renderLobby(room);
    } else if (this.status === 'arranging') {
      const other = room.players.find(p => p.id !== this.playerId);
      if (other && other.isBoardLocked) {
        this.dom.friendArrangeBadge.className = 'status-badge status-ready';
        this.dom.friendArrangeBadge.textContent = t('friendReady');
      }
    } else if (this.status === 'playing' && room.match) {
      this._updateTurnBanner(room.match.currentTurnPlayerId);
      this._startTurnCountdown(room.turnDeadline);
      if (room.match.opponentState) {
        this.opponentLinesCount = room.match.opponentState.linesCompleted || 0;
        this._updateOpponentMiniBingo(this.opponentLinesCount);
      }
    }
  }

  /**
   * Cell Swapping Arrange Grid Interaction (P0):
   * Tap cell A (highlights), tap cell B to swap numbers!
   */
  _renderArrangeGrid() {
    this.dom.arrangeGridBoard.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const num = this.grid[i];
      const cell = document.createElement('button');
      cell.className = `cell ${this.selectedCellIndex === i ? 'selected' : ''}`;
      cell.textContent = String(num);

      cell.addEventListener('click', () => {
        if (this.isLocked) return;
        this._handleCellSwapTap(i);
      });

      this.dom.arrangeGridBoard.appendChild(cell);
    }
  }

  _handleCellSwapTap(index) {
    this._vibrate(30);
    if (this.selectedCellIndex === null) {
      // First cell selected
      this.selectedCellIndex = index;
      soundManager.playMark();
      this._renderArrangeGrid();
    } else if (this.selectedCellIndex === index) {
      // Deselect
      this.selectedCellIndex = null;
      this._renderArrangeGrid();
    } else {
      // Second cell tapped: swap numbers!
      const a = this.selectedCellIndex;
      const b = index;
      [this.grid[a], this.grid[b]] = [this.grid[b], this.grid[a]];
      this.selectedCellIndex = null;
      soundManager.playLineStroke(150);
      this._renderArrangeGrid();
    }
  }

  _renderGameGrid() {
    this.dom.gameGridBoard.innerHTML = '';
    const other = this.currentRoom?.players.find(p => p.id !== this.playerId);
    if (other) {
      this.dom.gameOppAvatar.textContent = other.avatar;
      this.dom.gameOppName.textContent = other.name;
    }

    for (let i = 0; i < 25; i++) {
      const num = this.grid[i];
      const isMarked = this.markedNumbers.has(num);

      const cell = document.createElement('button');
      cell.className = `cell ${isMarked ? 'marked' : ''}`;
      cell.dataset.number = String(num);
      cell.textContent = String(num);

      const stamp = document.createElement('div');
      stamp.className = 'cell-ink-stamp';
      cell.appendChild(stamp);

      cell.addEventListener('click', () => {
        this.handleCellCall(num);
      });

      this.dom.gameGridBoard.appendChild(cell);
    }
  }

  handleCellCall(num) {
    if (this.status !== 'playing') return;
    if (this.currentRoom?.match?.currentTurnPlayerId !== this.playerId) {
      this.showToast(t('friendTurn', { name: this.dom.gameOppName.textContent }));
      return;
    }
    if (this.markedNumbers.has(num)) {
      this.showToast(`Number ${num} is already called.`);
      return;
    }

    this._send('call_number', { number: num });
  }

  _handleNumberCalled(msg) {
    const { number, nextTurnPlayerId, isAutoPicked } = msg;
    this.markedNumbers.add(number);

    // Update cell
    const cell = this.dom.gameGridBoard.querySelector(`[data-number="${number}"]`);
    if (cell) {
      cell.classList.add('marked');
    }

    // Append to called numbers strip
    const badge = document.createElement('div');
    badge.className = 'called-num-badge';
    badge.textContent = String(number);
    if (isAutoPicked) badge.title = 'Auto-picked by timer';
    this.dom.calledNumbersStrip.appendChild(badge);

    soundManager.playMark();
    this._vibrate(40);

    if (this.currentRoom && this.currentRoom.match) {
      this.currentRoom.match.currentTurnPlayerId = nextTurnPlayerId;
    }
    this._updateTurnBanner(nextTurnPlayerId);
    this._startTurnCountdown(msg.turnDeadline);
  }

  _handleLinesCompleted(msg) {
    if (msg.newLines && Array.isArray(msg.newLines)) {
      setTimeout(() => {
        for (const lineInfo of msg.newLines) {
          this.animationQueue.enqueue(lineInfo.id, async (isAccelerated) => {
            await this.renderOverlay.animateLineStrike(lineInfo, isAccelerated);
            this.completedLines.push(lineInfo.id);
            this._vibrate([60, 40, 60]);
            this._updateClaimButtonState();
          });
        }
      }, 120);
    } else if (msg.playerId && msg.playerId !== this.playerId) {
      this.opponentLinesCount = msg.linesCompleted;
      this._updateOpponentMiniBingo(this.opponentLinesCount);
    }
  }

  _updateOpponentMiniBingo(count) {
    const letters = this.dom.opponentMiniBingo.querySelectorAll('.mini-letter');
    letters.forEach((el, idx) => {
      el.classList.toggle('struck', idx < count);
    });
  }

  _updateTurnBanner(turnPlayerId) {
    const isMyTurn = turnPlayerId === this.playerId;
    this.dom.turnIndicatorPill.className = `turn-pill ${isMyTurn ? 'my-turn' : 'friend-turn'}`;
    this.dom.turnText.textContent = isMyTurn ? t('yourTurn') : t('friendTurn', { name: this.dom.gameOppName.textContent });
  }

  _startTurnCountdown(deadline) {
    clearInterval(this.turnTimerInterval);
    if (!deadline) {
      this.dom.turnClockDisplay.style.display = 'none';
      return;
    }

    this.dom.turnClockDisplay.style.display = 'block';
    const update = () => {
      const now = Date.now() + this.serverTimeOffset;
      const rem = Math.max(0, Math.ceil((deadline - now) / 1000));
      this.dom.turnClockSeconds.textContent = String(rem);
      if (rem <= 0) {
        clearInterval(this.turnTimerInterval);
      }
    };
    update();
    this.turnTimerInterval = setInterval(update, 500);
  }

  _updateClaimButtonState() {
    const count = this.completedLines.length;
    if (count >= 5) {
      const wasLocked = this.dom.bingoClaimBtn.classList.contains('locked');
      this.dom.bingoClaimBtn.className = 'bingo-center-btn ready';
      this.dom.bingoClaimBtn.disabled = false;
      this.dom.bingoBtnText.textContent = t('claimBingo');
      if (wasLocked) {
        soundManager.playButtonReady();
        this._vibrate([80, 50, 120]);
      }
    } else {
      this.dom.bingoClaimBtn.className = 'bingo-center-btn locked';
      this.dom.bingoClaimBtn.disabled = true;
      this.dom.bingoBtnText.textContent = `BINGO (${count}/5)`;
    }
  }

  handleClaimPress() {
    if (this.completedLines.length < 5) return;
    this.dom.bingoClaimBtn.className = 'bingo-center-btn submitting';
    this.dom.bingoClaimBtn.disabled = true;
    this.dom.bingoBtnText.textContent = 'VERIFYING...';
    this._send('claim_bingo', { claimId: `claim-${Date.now()}` });
  }

  _handleBingoResult(msg) {
    clearInterval(this.turnTimerInterval);
    if (this.wakeLock) {
      try { this.wakeLock.release(); } catch {}
    }

    if (msg.valid) {
      const isWinner = msg.winnerId === this.playerId;
      this.dom.resultEmoji.textContent = isWinner ? '🏆' : '👏';
      this.dom.resultTitle.textContent = isWinner ? t('victory') : t('defeat');
      this.dom.resultDesc.textContent = isWinner ? t('youWon') : t('friendWon', { name: this.dom.gameOppName.textContent });

      if (msg.scores) {
        const other = this.currentRoom?.players.find(p => p.id !== this.playerId);
        this.dom.scorePlayer1.textContent = `You: ${msg.scores[this.playerId] || 0}`;
        this.dom.scorePlayer2.textContent = `${other?.name || 'Friend'}: ${msg.scores[other?.id] || 0}`;
      }

      if (isWinner) {
        soundManager.playVictory();
        this.confetti.burst(120);
        this._vibrate([100, 50, 100, 50, 200]);
        this._saveLocalWin();
      }

      this._showScreen('finished');
    } else {
      this.showToast(msg.reason || 'BINGO not verified.', 'error');
      this._updateClaimButtonState();
    }
  }

  _saveLocalWin() {
    try {
      const wins = (Number(localStorage.getItem('bingo_stat_wins')) || 0) + 1;
      localStorage.setItem('bingo_stat_wins', String(wins));
    } catch {}
  }

  _showStatsToast() {
    try {
      const wins = localStorage.getItem('bingo_stat_wins') || '0';
      this.showToast(`🏆 Total Wins: ${wins}`);
    } catch {}
  }

  _showFloatingReaction(playerId, emoji) {
    const floater = document.createElement('div');
    floater.className = 'floating-reaction';
    floater.textContent = emoji;
    floater.style.left = `${Math.random() * 50 + 25}%`;
    floater.style.top = '65%';
    document.body.appendChild(floater);
    setTimeout(() => floater.remove(), 1800);
  }

  shareRoomLink() {
    if (!this.currentRoom) return;
    const url = `${window.location.origin}/r/${this.currentRoom.code}`;
    const text = `Join my Bingo game! Tap to play: ${url}`;

    if (navigator.share) {
      navigator.share({ title: 'Bingo', text, url }).catch(() => {});
    } else {
      // WhatsApp fallback
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  copyRoomLink() {
    if (!this.currentRoom) return;
    const url = `${window.location.origin}/r/${this.currentRoom.code}`;
    navigator.clipboard?.writeText(url);
    this.showToast(t('linkCopied'));
  }

  copyRoomCode() {
    if (!this.currentRoom) return;
    navigator.clipboard?.writeText(this.currentRoom.code);
    this.showToast(t('codeCopied'));
  }

  showQRCodeModal() {
    if (!this.currentRoom) return;
    const url = `${window.location.origin}/r/${this.currentRoom.code}`;
    this.dom.qrContainer.innerHTML = '';
    const svg = generateQRCodeSVG(url, 210);
    this.dom.qrContainer.appendChild(svg);
    this.dom.modalQr.classList.remove('hidden');
  }

  shareResultCard() {
    const text = `I just played Bingo! Room: ${this.currentRoom?.code || ''}. Play on: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'Bingo Game Result', text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'success' ? 'toast-success' : '')}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.bingoApp = new BingoApp();
});
