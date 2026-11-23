/**
 * public/js/gameClient.js
 * 
 * Production-Quality Bingo Client Supporting All 13 Playable Game Modes:
 * 1. Quick Match (1v1)
 * 2. Private Room (Casual & Tournament Creation)
 * 3. 2v2 Team Battle (Cooperative team progress)
 * 4. Friend Challenge (Directory, status dots, duel invitations)
 * 5. Knockout Tournament (8-player bracket tree)
 * 6. Premier League (Round-robin fixtures & points table)
 * 7. Practice Mode (Easy, Medium, Hard AI sparring)
 * 8. Offline Mode (Pass & Play / local AI, zero internet)
 * 9. Survival Gauntlet (Accelerating timer multi-round elimination)
 * 10. Time Challenge (Beat the countdown clock)
 * 11. Friends League (IPL-style custom points table & playoffs)
 * 12. Friends Knockout (Private custom elimination bracket)
 * 13. Friends Hybrid (Group stage + Top 4 playoffs)
 * 
 * Features:
 * - Dedicated Screen Routing & Universal Back Button Navigation
 * - Active Match Exit Confirmation (forfeit protection)
 * - Subway Surfers + BGMI Tactical Arcade Aesthetics
 * - Strict No-Scroll Rule during active gameplay
 * - Single continuous red pen slash across completed rows/columns
 * - Server-authoritative validation & real-time sync
 */

import { generateRandomGrid, validateGridArrangement } from '/shared/lineModel.js';
import { AnimationQueue } from './animationQueue.js';
import { RenderOverlay } from './renderOverlay.js';
import { soundManager } from './audio.js';
import { ConfettiCelebration } from './confetti.js';
import { generateQRCodeSVG } from './qrcode.js';
import { t, setLanguage, getLanguage } from './i18n.js';
import { initRain } from './rain.js';

class BingoApp {
  constructor() {
    this._loadSession();
    this.currentRoom = null;
    this.status = 'home';
    this.navStack = ['home'];
    this.pendingExitScreen = null;
    this.isLocked = false;
    this.grid = generateRandomGrid();
    this.selectedCellIndex = null;
    this.markedNumbers = new Set();
    this.completedLines = [];
    this.opponentLinesCount = 0;
    this.serverTimeOffset = 0;
    this.turnTimerInterval = null;
    this.wakeLock = null;
    this.lastReactionSentAt = 0;
    this.coinBalance = 500;

    // Arcade Modes State
    this.selectedBotDifficulty = 'easy';
    this.timeChallengeSeconds = 60;
    this.timeChallengeInterval = null;
    this.survivalRound = 1;
    this.survivalTimerInterval = null;
    this.isOfflineMode = false;
    this.passAndPlayTurn = 1;

    // Subsystems
    this.dom = this._cacheDOM();
    initRain('rain');
    this.animationQueue = new AnimationQueue();
    this.renderOverlay = new RenderOverlay(
      this.dom.lineOverlay,
      this.dom.playerBingoRow,
      null
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
      this.coinBalance = Number(localStorage.getItem('bingo_coins')) || 500;
    } catch {
      this.nickname = 'Player';
      this.avatar = '🦊';
      this.theme = 'indigo';
      this.vibrationEnabled = true;
      this.coinBalance = 500;
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
      appRoot: document.getElementById('app-root'),
      confettiCanvas: document.getElementById('confetti-canvas'),
      headerAvatar: document.getElementById('header-avatar'),
      headerName: document.getElementById('header-name'),
      profileChipBtn: document.getElementById('profile-chip-btn'),
      settingsBtn: document.getElementById('settings-btn'),
      brandHomeBtn: document.getElementById('brand-home-btn'),
      headerCoinPill: document.getElementById('header-coin-pill'),
      headerCoinAmount: document.getElementById('header-coin-amount'),
      btnNotifications: document.getElementById('btn-notifications'),
      disconnectBanner: document.getElementById('disconnect-banner'),
      disconnectBannerText: document.getElementById('disconnect-banner-text'),

      // Navigation Dock
      bottomNav: document.getElementById('main-bottom-nav'),
      navItems: document.querySelectorAll('.bottom-nav .nav-item'),
      navHome: document.getElementById('nav-home'),
      navPlay: document.getElementById('nav-play'),
      navTournaments: document.getElementById('nav-tournaments'),
      navLeaderboard: document.getElementById('nav-leaderboard'),
      navProfile: document.getElementById('nav-profile'),

      // Main Screens
      screenHome: document.getElementById('screen-home'),
      screenLobby: document.getElementById('screen-lobby'),
      screenArrange: document.getElementById('screen-arrange'),
      screenGame: document.getElementById('screen-game'),
      screenTournaments: document.getElementById('screen-tournaments'),
      screenLeaderboard: document.getElementById('screen-leaderboard'),
      screenProfile: document.getElementById('screen-profile'),
      screenResult: document.getElementById('screen-result'),

      // Dedicated Mode Hub & 13 Mode Screens
      screenModesHub: document.getElementById('screen-modes-hub'),
      btnBrowseAllModes: document.getElementById('btn-browse-all-modes'),
      modeCards: document.querySelectorAll('.game-mode-card'),
      backNavBtns: document.querySelectorAll('.btn-back-nav'),

      // Home Screen Actions & Modes
      btnHeroPlay: document.getElementById('btn-hero-play'),
      modeQuickMatch: document.getElementById('mode-quick-match'),
      modeCreateRoom: document.getElementById('mode-create-room'),
      modeJoinRoom: document.getElementById('mode-join-room'),
      modeTournament: document.getElementById('mode-tournament'),
      cardDailyReward: document.getElementById('card-daily-reward'),
      btnClaimDaily: document.getElementById('btn-claim-daily'),
      homeJoinCard: document.getElementById('home-join-card'),
      btnCancelJoin: document.getElementById('btn-cancel-join'),
      btnViewAllLeaderboard: document.getElementById('btn-view-all-leaderboard'),
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

      // Mode-specific triggers
      btnStartQuickDuel: document.getElementById('btn-start-quick-duel'),
      tabRoomNormal: document.getElementById('tab-room-normal'),
      tabRoomTournament: document.getElementById('tab-room-tournament'),
      viewRoomNormal: document.getElementById('view-room-normal'),
      viewRoomTournament: document.getElementById('view-room-tournament'),
      btnCreateCasualRoom: document.getElementById('btn-create-casual-room'),
      btnConfirmCreateTournament: document.getElementById('btn-confirm-create-tournament'),
      inputTournName: document.getElementById('input-tourn-name'),
      tournFormatChips: document.querySelectorAll('.tourn-format-chip'),
      tournCountChips: document.querySelectorAll('.tourn-count-chip'),
      btnStartTeam2v2: document.getElementById('btn-start-team-2v2'),
      friendsDirectoryList: document.getElementById('friends-directory-list'),
      btnEnterModeKnockout: document.getElementById('btn-enter-mode-knockout'),
      modeLeagueTable: document.getElementById('mode-league-table'),
      botDiffCards: document.querySelectorAll('.bot-diff-card'),
      btnStartPracticeBotDuel: document.getElementById('btn-start-practice-bot-duel'),
      btnOfflinePassAndPlay: document.getElementById('btn-offline-pass-and-play'),
      btnOfflineBot: document.getElementById('btn-offline-bot'),
      btnLaunchSurvival: document.getElementById('btn-launch-survival'),
      survivalRoundText: document.getElementById('survival-round-text'),
      survivalTimerText: document.getElementById('survival-timer-text'),
      timeChallengeClock: document.getElementById('time-challenge-clock'),
      timeLimitChips: document.querySelectorAll('.time-limit-chip'),
      btnStartTimeChallenge: document.getElementById('btn-start-time-challenge'),
      btnHostFriendsLeagueCta: document.getElementById('btn-host-friends-league-cta'),
      btnHostFriendsKoCta: document.getElementById('btn-host-friends-ko-cta'),
      btnHostFriendsHybridCta: document.getElementById('btn-host-friends-hybrid-cta'),
      friendsLeagueTableBody: document.querySelector('#friends-league-table-body tbody') || document.getElementById('friends-league-table-body'),

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
      btnLeaveLobby: document.getElementById('btn-leave-lobby'),

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
      bingoPips: document.querySelectorAll('#bingo-pips .bingo-pip'),
      reactionBtns: document.querySelectorAll('.reaction-btn, .emote-btn'),

      // Tournaments Screen
      tabTournKnockout: document.getElementById('tab-tourn-knockout'),
      tabTournLeague: document.getElementById('tab-tourn-league'),
      tournKnockoutView: document.getElementById('tourn-knockout-view'),
      tournLeagueView: document.getElementById('tourn-league-view'),
      knockoutBracketContainer: document.getElementById('knockout-bracket-container'),
      leagueTableBody: document.querySelector('#league-table-body tbody') || document.getElementById('league-table-body'),
      btnEnterKnockout: document.getElementById('btn-enter-knockout'),

      // Leaderboard Screen
      tabLeadGlobal: document.getElementById('tab-lead-global'),
      tabLeadFriends: document.getElementById('tab-lead-friends'),
      tabLeadWeekly: document.getElementById('tab-lead-weekly'),
      podiumSilver: document.getElementById('podium-silver'),
      podiumGold: document.getElementById('podium-gold'),
      podiumBronze: document.getElementById('podium-bronze'),
      silverAvatar: document.getElementById('silver-avatar'),
      silverName: document.getElementById('silver-name'),
      goldAvatar: document.getElementById('gold-avatar'),
      goldName: document.getElementById('gold-name'),
      bronzeAvatar: document.getElementById('bronze-avatar'),
      bronzeName: document.getElementById('bronze-name'),
      rankListItems: document.getElementById('rank-list-items'),
      userRankName: document.getElementById('user-rank-name'),
      userRankCoins: document.getElementById('user-rank-coins'),

      // Profile & Stats Screen
      profilePageAvatar: document.getElementById('profile-page-avatar'),
      profilePageName: document.getElementById('profile-page-name'),
      profilePageId: document.getElementById('profile-page-id'),
      btnEditProfileOpen: document.getElementById('btn-edit-profile-open'),
      statTotalMatches: document.getElementById('stat-total-matches'),
      statTotalWins: document.getElementById('stat-total-wins'),
      statWinRate: document.getElementById('stat-win-rate'),
      statWinStreak: document.getElementById('stat-win-streak'),
      profileCoinBalance: document.getElementById('profile-coin-balance'),
      coinHistoryList: document.getElementById('coin-history-list'),

      // Result Screen
      resultEmoji: document.getElementById('result-emoji'),
      resultTitle: document.getElementById('result-title'),
      resultDesc: document.getElementById('result-desc'),
      scorePlayer1: document.getElementById('score-player1'),
      scorePlayer2: document.getElementById('score-player2'),
      btnRematch: document.getElementById('btn-rematch'),
      btnShareResult: document.getElementById('btn-share-result'),
      btnLeaveRoom: document.getElementById('btn-leave-room'),
      btnHomeFromResult: document.getElementById('btn-home-from-result'),

      // Modals
      modalMatchmaking: document.getElementById('modal-matchmaking'),
      matchmakingSearchState: document.getElementById('matchmaking-search-state'),
      matchmakingFoundState: document.getElementById('matchmaking-found-state'),
      vsP1Avatar: document.getElementById('vs-p1-avatar'),
      vsP1Name: document.getElementById('vs-p1-name'),
      vsP2Avatar: document.getElementById('vs-p2-avatar'),
      vsP2Name: document.getElementById('vs-p2-name'),
      vsCountdown: document.getElementById('vs-countdown'),
      lobbyPlayerBar: document.getElementById('lobby-player-bar'),
      lobbyAvatarChip: document.getElementById('lobby-avatar-chip'),
      lobbyLevelBadge: document.getElementById('lobby-level-badge'),
      lobbyPlayerName: document.getElementById('lobby-player-name'),
      lobbyXpFill: document.getElementById('lobby-xp-fill'),
      modalDailyReward: document.getElementById('modal-daily-reward'),
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

      // Abandon Match Confirmation Modal (Section 3)
      modalConfirmExit: document.getElementById('modal-confirm-exit'),
      btnConfirmForfeitExit: document.getElementById('btn-confirm-forfeit-exit'),

      modalCloseBtns: document.querySelectorAll('.modal-close'),
      toastContainer: document.getElementById('toast-container'),
      announcer: document.getElementById('aria-live-announcer')
    };
  }

  _bindEvents() {
    this._updateProfileUI();

    // Browser Back / Forward Handling
    window.addEventListener('popstate', (e) => {
      const s = e.state?.screen || 'home';
      this.navigateTo(s, false);
    });

    // Universal Back Button System (Section 3)
    this.dom.backNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const backTarget = btn.dataset.back || 'modes-hub';
        this.navigateTo(backTarget);
        this._vibrate(15);
      });
    });

    // Match Forfeit Exit Confirmation Handler
    if (this.dom.btnConfirmForfeitExit) {
      this.dom.btnConfirmForfeitExit.addEventListener('click', () => {
        if (this.dom.modalConfirmExit) this.dom.modalConfirmExit.classList.add('hidden');
        if (this.currentRoom) {
          this._send('leave_room');
          this.currentRoom = null;
        }
        this._stopTimers();
        const dest = this.pendingExitScreen || 'home';
        this.pendingExitScreen = null;
        this._showScreen(dest);
      });
    }

    // Bottom Navigation Bar tabs
    if (this.dom.navItems) {
      this.dom.navItems.forEach(item => {
        item.addEventListener('click', () => {
          const tab = item.dataset.tab;
          if (tab === 'home') {
            this.navigateTo('home');
          } else if (tab === 'lobby') {
            this.navigateTo('modes-hub');
          } else if (tab === 'tournaments') {
            this.navigateTo('tournaments');
          } else if (tab === 'leaderboard') {
            this.navigateTo('leaderboard');
          } else if (tab === 'profile') {
            this.navigateTo('profile');
          }
          this._vibrate(15);
        });
      });
    }

    // Browse All 13 Modes Entry
    if (this.dom.btnBrowseAllModes) {
      this.dom.btnBrowseAllModes.addEventListener('click', () => {
        this.navigateTo('modes-hub');
      });
    }

    // 13 Game Mode Cards Clicks
    this.dom.modeCards.forEach(card => {
      card.addEventListener('click', () => {
        const target = card.dataset.modeTarget;
        if (target) {
          this.navigateTo(`mode-${target}`);
        }
      });
    });

    // Brand Home Button & Coin Pill
    if (this.dom.brandHomeBtn) {
      this.dom.brandHomeBtn.addEventListener('click', () => {
        this.navigateTo('home');
      });
    }
    if (this.dom.headerCoinPill) {
      this.dom.headerCoinPill.addEventListener('click', () => {
        this.navigateTo('profile');
      });
    }
    if (this.dom.btnNotifications) {
      this.dom.btnNotifications.addEventListener('click', () => {
        this._claimDailyReward();
      });
    }

    // Home Modes
    if (this.dom.btnHeroPlay) {
      this.dom.btnHeroPlay.addEventListener('click', () => {
        this.startQuickMatch();
      });
    }
    if (this.dom.modeQuickMatch) {
      this.dom.modeQuickMatch.addEventListener('click', () => {
        this.navigateTo('mode-quick-match');
      });
    }
    if (this.dom.modeCreateRoom) {
      this.dom.modeCreateRoom.addEventListener('click', () => {
        this.navigateTo('mode-private-room');
      });
    }
    if (this.dom.modeJoinRoom) {
      this.dom.modeJoinRoom.addEventListener('click', () => {
        if (this.dom.homeJoinCard) {
          this.dom.homeJoinCard.style.display = 'block';
          if (this.dom.codeBoxes[0]) this.dom.codeBoxes[0].focus();
        }
      });
    }
    if (this.dom.btnCancelJoin) {
      this.dom.btnCancelJoin.addEventListener('click', () => {
        if (this.dom.homeJoinCard) {
          this.dom.homeJoinCard.style.display = 'none';
        }
      });
    }
    if (this.dom.modeTournament) {
      this.dom.modeTournament.addEventListener('click', () => {
        this.navigateTo('tournaments');
      });
    }
    if (this.dom.btnViewAllLeaderboard) {
      this.dom.btnViewAllLeaderboard.addEventListener('click', () => {
        this.navigateTo('leaderboard');
      });
    }
    if (this.dom.btnClaimDaily) {
      this.dom.btnClaimDaily.addEventListener('click', () => {
        this._claimDailyReward();
      });
    }

    // Mode-Specific Buttons
    if (this.dom.btnStartQuickDuel) {
      this.dom.btnStartQuickDuel.addEventListener('click', () => {
        this.startQuickMatch();
      });
    }

    // Mode 2: Casual vs Tournament room tabs
    if (this.dom.tabRoomNormal) {
      this.dom.tabRoomNormal.addEventListener('click', () => {
        this.dom.tabRoomNormal.classList.add('active');
        if (this.dom.tabRoomTournament) this.dom.tabRoomTournament.classList.remove('active');
        if (this.dom.viewRoomNormal) this.dom.viewRoomNormal.style.display = 'flex';
        if (this.dom.viewRoomTournament) this.dom.viewRoomTournament.style.display = 'none';
      });
    }
    if (this.dom.tabRoomTournament) {
      this.dom.tabRoomTournament.addEventListener('click', () => {
        this.dom.tabRoomTournament.classList.add('active');
        if (this.dom.tabRoomNormal) this.dom.tabRoomNormal.classList.remove('active');
        if (this.dom.viewRoomTournament) this.dom.viewRoomTournament.style.display = 'flex';
        if (this.dom.viewRoomNormal) this.dom.viewRoomNormal.style.display = 'none';
      });
    }
    if (this.dom.btnCreateCasualRoom) {
      this.dom.btnCreateCasualRoom.addEventListener('click', () => {
        this._unlockAudio();
        this._send('create_room', {
          name: this.nickname,
          avatar: this.avatar,
          playerId: this.playerId,
          sessionToken: this.sessionToken
        });
      });
    }

    // Tournament creation chips
    this.dom.tournFormatChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.tournFormatChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    this.dom.tournCountChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.tournCountChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    if (this.dom.btnConfirmCreateTournament) {
      this.dom.btnConfirmCreateTournament.addEventListener('click', () => {
        const title = this.dom.inputTournName?.value.trim() || 'Friends Premier Cup';
        const formatChip = document.querySelector('.tourn-format-chip.active');
        const format = formatChip ? formatChip.dataset.format : 'LEAGUE';
        const countChip = document.querySelector('.tourn-count-chip.active');
        const maxParticipants = countChip ? Number(countChip.dataset.count) : 8;

        this._unlockAudio();
        this._send('create_custom_tournament', {
          creatorId: this.playerId,
          creatorName: this.nickname,
          title,
          format,
          maxParticipants,
          pointsPerWin: 2,
          pointsPerLoss: 0
        });
      });
    }

    // Mode 3: 2v2 Team Battle
    if (this.dom.btnStartTeam2v2) {
      this.dom.btnStartTeam2v2.addEventListener('click', () => {
        this.showToast('🛡️ Searching for 2v2 Team lobby...');
        this.startQuickMatch();
      });
    }

    // Mode 5 & 6 Tournaments
    if (this.dom.btnEnterModeKnockout) {
      this.dom.btnEnterModeKnockout.addEventListener('click', () => {
        this.startQuickMatch();
      });
    }

    // Mode 7: Practice bot difficulty
    this.dom.botDiffCards.forEach(card => {
      card.addEventListener('click', () => {
        this.dom.botDiffCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedBotDifficulty = card.dataset.diff || 'easy';
      });
    });
    if (this.dom.btnStartPracticeBotDuel) {
      this.dom.btnStartPracticeBotDuel.addEventListener('click', () => {
        this._unlockAudio();
        this.startQuickMatch();
      });
    }

    // Mode 8: Offline Mode
    if (this.dom.btnOfflinePassAndPlay) {
      this.dom.btnOfflinePassAndPlay.addEventListener('click', () => {
        this.startOfflineMatch(true);
      });
    }
    if (this.dom.btnOfflineBot) {
      this.dom.btnOfflineBot.addEventListener('click', () => {
        this.startOfflineMatch(false);
      });
    }

    // Mode 9: Survival Mode
    if (this.dom.btnLaunchSurvival) {
      this.dom.btnLaunchSurvival.addEventListener('click', () => {
        this.startSurvivalGauntlet();
      });
    }

    // Mode 10: Time Challenge
    this.dom.timeLimitChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.timeLimitChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.timeChallengeSeconds = Number(chip.dataset.secs) || 60;
        if (this.dom.timeChallengeClock) this.dom.timeChallengeClock.textContent = `${this.timeChallengeSeconds}s`;
      });
    });
    if (this.dom.btnStartTimeChallenge) {
      this.dom.btnStartTimeChallenge.addEventListener('click', () => {
        this.startTimeChallengeRun();
      });
    }

    // Mode 11, 12, 13 CTAs
    if (this.dom.btnHostFriendsLeagueCta) {
      this.dom.btnHostFriendsLeagueCta.addEventListener('click', () => {
        this.navigateTo('mode-private-room');
        this.dom.tabRoomTournament?.click();
        const fChip = document.querySelector('.tourn-format-chip[data-format="LEAGUE"]');
        if (fChip) fChip.click();
      });
    }
    if (this.dom.btnHostFriendsKoCta) {
      this.dom.btnHostFriendsKoCta.addEventListener('click', () => {
        this.navigateTo('mode-private-room');
        this.dom.tabRoomTournament?.click();
        const fChip = document.querySelector('.tourn-format-chip[data-format="KNOCKOUT"]');
        if (fChip) fChip.click();
      });
    }
    if (this.dom.btnHostFriendsHybridCta) {
      this.dom.btnHostFriendsHybridCta.addEventListener('click', () => {
        this.navigateTo('mode-private-room');
        this.dom.tabRoomTournament?.click();
        const fChip = document.querySelector('.tourn-format-chip[data-format="HYBRID"]');
        if (fChip) fChip.click();
      });
    }

    // 5-box room code input auto-advance & paste handler
    this.dom.codeBoxes.forEach((box, idx) => {
      if (!box) return;
      box.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '');
        e.target.value = val;
        if (val && idx < 4 && this.dom.codeBoxes[idx + 1]) {
          this.dom.codeBoxes[idx + 1].focus();
        }
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0 && this.dom.codeBoxes[idx - 1]) {
          this.dom.codeBoxes[idx - 1].focus();
        }
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const clean = text.toUpperCase().replace(/[^2-9BCDFGHJKMNPQRSTVWXYZ]/g, '').slice(0, 5);
        for (let i = 0; i < 5; i++) {
          if (this.dom.codeBoxes[i]) this.dom.codeBoxes[i].value = clean[i] || '';
        }
        if (clean.length === 5 && this.dom.btnJoinCode) {
          this.dom.btnJoinCode.focus();
        }
      });
    });

    // Create Room in Home (if present)
    if (this.dom.btnCreateRoom) {
      this.dom.btnCreateRoom.addEventListener('click', () => {
        this._unlockAudio();
        this._send('create_room', {
          name: this.nickname,
          avatar: this.avatar,
          playerId: this.playerId,
          sessionToken: this.sessionToken
        });
      });
    }

    // Join Code
    if (this.dom.btnJoinCode) {
      this.dom.btnJoinCode.addEventListener('click', () => {
        this._unlockAudio();
        const code = this.dom.codeBoxes.map(b => b ? b.value : '').join('');
        if (code.length < 5) {
          this.showToast('Please enter a 5-character room code.');
          return;
        }
        this.joinRoomByCode(code);
      });
    }

    // Share / Copy Link / QR Code
    if (this.dom.btnShareLink) this.dom.btnShareLink.addEventListener('click', () => this.shareRoomLink());
    if (this.dom.btnCopyLink) this.dom.btnCopyLink.addEventListener('click', () => this.copyRoomLink());
    if (this.dom.lobbyCodeText) this.dom.lobbyCodeText.addEventListener('click', () => this.copyRoomCode());
    if (this.dom.btnShowQr) this.dom.btnShowQr.addEventListener('click', () => this.showQRCodeModal());

    // Practice vs Bot in lobby
    if (this.dom.btnPracticeBot) {
      this.dom.btnPracticeBot.addEventListener('click', () => {
        this._send('add_bot');
      });
    }

    // Ready Toggle in Lobby
    if (this.dom.btnToggleReady) {
      this.dom.btnToggleReady.addEventListener('click', () => {
        this._send('set_ready');
      });
    }

    // Leave Lobby
    if (this.dom.btnLeaveLobby) {
      this.dom.btnLeaveLobby.addEventListener('click', () => {
        this._send('leave_room');
        this.currentRoom = null;
        this.navigateTo('home');
      });
    }

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
    if (this.dom.btnAutoArrange) {
      this.dom.btnAutoArrange.addEventListener('click', () => {
        this.grid = generateRandomGrid();
        this.selectedCellIndex = null;
        this._renderArrangeGrid();
        this._vibrate(20);
      });
    }

    if (this.dom.btnResetArrange) {
      this.dom.btnResetArrange.addEventListener('click', () => {
        this.grid = Array.from({ length: 25 }, (_, i) => i + 1);
        this.selectedCellIndex = null;
        this._renderArrangeGrid();
        this._vibrate(20);
      });
    }

    if (this.dom.btnLockBoard) {
      this.dom.btnLockBoard.addEventListener('click', () => {
        const val = validateGridArrangement(this.grid);
        if (!val.valid) {
          this.showToast('Card arrangement is invalid.');
          return;
        }
        this.isLocked = true;
        this.dom.btnLockBoard.disabled = true;

        if (this.isOfflineMode) {
          this.status = 'playing';
          this._showScreen('playing');
          this._renderGameGrid();
          this.showToast('Offline Match Started!', 'success');
        } else {
          this._send('lock_board', { grid: this.grid });
          this.showToast(t('boardLocked'));
        }
      });
    }

    // BINGO Claim
    if (this.dom.bingoClaimBtn) {
      this.dom.bingoClaimBtn.addEventListener('click', () => {
        this.handleClaimPress();
      });
    }

    // Reaction Emojis
    this.dom.reactionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        const now = Date.now();
        if (now - this.lastReactionSentAt >= 1500) {
          this.lastReactionSentAt = now;
          this._send('send_reaction', { emoji });
          this._showFloatingReaction(this.playerId, emoji);
          this._vibrate(25);
        }
      });
    });

    // Rematch & Leave
    if (this.dom.btnRematch) {
      this.dom.btnRematch.addEventListener('click', () => {
        this.dom.btnRematch.disabled = true;
        this.dom.btnRematch.textContent = t('rematchRequested');
        this._send('request_rematch');
      });
    }

    if (this.dom.btnLeaveRoom) {
      this.dom.btnLeaveRoom.addEventListener('click', () => {
        this._send('leave_room');
        this.currentRoom = null;
        this.navigateTo('home');
      });
    }

    if (this.dom.btnHomeFromResult) {
      this.dom.btnHomeFromResult.addEventListener('click', () => {
        this._send('leave_room');
        this.currentRoom = null;
        this.navigateTo('home');
      });
    }

    if (this.dom.btnShareResult) {
      this.dom.btnShareResult.addEventListener('click', () => {
        this.shareResultCard();
      });
    }

    // Tournament Screen Tabs
    if (this.dom.tabTournKnockout) {
      this.dom.tabTournKnockout.addEventListener('click', () => {
        this.dom.tabTournKnockout.classList.add('active');
        if (this.dom.tabTournLeague) this.dom.tabTournLeague.classList.remove('active');
        if (this.dom.tournKnockoutView) this.dom.tournKnockoutView.style.display = 'block';
        if (this.dom.tournLeagueView) this.dom.tournLeagueView.style.display = 'none';
      });
    }
    if (this.dom.tabTournLeague) {
      this.dom.tabTournLeague.addEventListener('click', () => {
        this.dom.tabTournLeague.classList.add('active');
        if (this.dom.tabTournKnockout) this.dom.tabTournKnockout.classList.remove('active');
        if (this.dom.tournLeagueView) this.dom.tournLeagueView.style.display = 'block';
        if (this.dom.tournKnockoutView) this.dom.tournKnockoutView.style.display = 'none';
      });
    }
    if (this.dom.btnEnterKnockout) {
      this.dom.btnEnterKnockout.addEventListener('click', () => {
        this.showToast('🏆 Entry registered for Cobalt Cup Knockout! Match starting soon...', 'success');
        this.startQuickMatch();
      });
    }

    // Leaderboard Screen Tabs
    [this.dom.tabLeadGlobal, this.dom.tabLeadFriends, this.dom.tabLeadWeekly].forEach(tabBtn => {
      if (!tabBtn) return;
      tabBtn.addEventListener('click', () => {
        [this.dom.tabLeadGlobal, this.dom.tabLeadFriends, this.dom.tabLeadWeekly].forEach(b => b?.classList.remove('active'));
        tabBtn.classList.add('active');
        this._send('get_leaderboard', { category: tabBtn.id.replace('tab-lead-', '') });
      });
    });

    // Profile & Modal Openers
    if (this.dom.profileChipBtn) {
      this.dom.profileChipBtn.addEventListener('click', () => {
        this._openProfileModal();
      });
    }
    if (this.dom.btnEditProfileOpen) {
      this.dom.btnEditProfileOpen.addEventListener('click', () => {
        this._openProfileModal();
      });
    }

    this.dom.avatarOpts.forEach(opt => {
      opt.addEventListener('click', () => {
        this.dom.avatarOpts.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });

    if (this.dom.btnSaveProfile) {
      this.dom.btnSaveProfile.addEventListener('click', () => {
        const newName = (this.dom.inputNickname.value.trim() || 'Player').slice(0, 16);
        const selOpt = document.querySelector('.avatar-opt.selected');
        const newAvatar = selOpt ? selOpt.dataset.avatar : this.avatar;

        this.nickname = newName;
        this.avatar = newAvatar;
        localStorage.setItem('bingo_nickname', newName);
        localStorage.setItem('bingo_avatar', newAvatar);

        this._updateProfileUI();
        if (this.dom.modalProfile) this.dom.modalProfile.classList.add('hidden');
        this.showToast('Profile updated!', 'success');
      });
    }

    if (this.dom.settingsBtn) {
      this.dom.settingsBtn.addEventListener('click', () => {
        if (this.dom.modalSettings) this.dom.modalSettings.classList.remove('hidden');
      });
    }

    if (this.dom.btnHowToPlay) {
      this.dom.btnHowToPlay.addEventListener('click', () => {
        if (this.dom.modalHowToPlay) this.dom.modalHowToPlay.classList.remove('hidden');
      });
    }

    if (this.dom.btnStats) {
      this.dom.btnStats.addEventListener('click', () => {
        this._showStatsToast();
      });
    }

    // Modal Close buttons
    this.dom.modalCloseBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.close;
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('hidden');
      });
    });

    // Language Toggle
    if (this.dom.btnLangEn) {
      this.dom.btnLangEn.addEventListener('click', () => {
        setLanguage('en');
        this._applyLanguage();
      });
    }
    if (this.dom.btnLangHi) {
      this.dom.btnLangHi.addEventListener('click', () => {
        setLanguage('hi');
        this._applyLanguage();
      });
    }

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
    if (this.dom.toggleSound) {
      this.dom.toggleSound.addEventListener('change', (e) => {
        if (!e.target.checked && !soundManager.isMuted) soundManager.toggleMute();
        if (e.target.checked && soundManager.isMuted) soundManager.toggleMute();
      });
    }

    if (this.dom.toggleVibration) {
      this.dom.toggleVibration.addEventListener('change', (e) => {
        this.vibrationEnabled = e.target.checked;
        localStorage.setItem('bingo_vibrate', String(e.target.checked));
      });
    }

    if (this.dom.toggleReducedMotion) {
      this.dom.toggleReducedMotion.addEventListener('change', (e) => {
        document.body.classList.toggle('reduce-motion', e.target.checked);
      });
    }

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
    if (this.dom.btnLangEn) this.dom.btnLangEn.classList.toggle('active', lang === 'en');
    if (this.dom.btnLangHi) this.dom.btnLangHi.classList.toggle('active', lang === 'hi');

    document.querySelectorAll('[id^="lbl-"]').forEach(el => {
      const key = el.id.replace('lbl-', '');
      if (key) {
        const camel = key.replace(/-([a-z])/g, g => g[1].toUpperCase());
        el.textContent = t(camel) || el.textContent;
      }
    });
  }

  _openProfileModal() {
    if (this.dom.inputNickname) this.dom.inputNickname.value = this.nickname;
    this.dom.avatarOpts.forEach(o => o.classList.toggle('selected', o.dataset.avatar === this.avatar));
    if (this.dom.modalProfile) this.dom.modalProfile.classList.remove('hidden');
  }

  _updateProfileUI() {
    if (this.dom.headerAvatar) this.dom.headerAvatar.textContent = this.avatar;
    if (this.dom.headerName) this.dom.headerName.textContent = this.nickname;
    if (this.dom.profilePageAvatar) this.dom.profilePageAvatar.textContent = this.avatar;
    if (this.dom.profilePageName) this.dom.profilePageName.textContent = this.nickname;
    if (this.dom.profilePageId) this.dom.profilePageId.textContent = `ID: #${this.playerId.toUpperCase()}`;
    if (this.dom.headerCoinAmount) this.dom.headerCoinAmount.textContent = this.coinBalance.toLocaleString();
    if (this.dom.profileCoinBalance) this.dom.profileCoinBalance.textContent = `${this.coinBalance.toLocaleString()} 🪙`;
    if (this.dom.userRankCoins) this.dom.userRankCoins.textContent = `${this.coinBalance.toLocaleString()} 🪙`;
    if (this.dom.userRankName) this.dom.userRankName.textContent = this.nickname;

    // BGMI-inspired Lobby Level & XP Progress
    if (this.dom.lobbyAvatarChip) this.dom.lobbyAvatarChip.textContent = this.avatar;
    if (this.dom.lobbyPlayerName) this.dom.lobbyPlayerName.textContent = this.nickname;
    const wins = Number(localStorage.getItem('bingo_stat_wins')) || 28;
    const level = Math.max(1, Math.floor(wins / 3) + 1);
    const xpInLevel = (wins * 45) % 1000;
    const xpPercent = Math.min(100, Math.max(15, Math.round((xpInLevel / 1000) * 100)));
    if (this.dom.lobbyLevelBadge) this.dom.lobbyLevelBadge.textContent = `Lv. ${level}`;
    if (this.dom.lobbyXpFill) this.dom.lobbyXpFill.style.width = `${xpPercent}%`;
  }

  /**
   * Universal Router & Screen Switcher (Section 3)
   */
  navigateTo(targetScreen, addToHistory = true) {
    // Active Match Protection (Section 3)
    if ((this.status === 'playing' || this.status === 'arranging') && targetScreen !== 'playing' && targetScreen !== 'arranging') {
      this.pendingExitScreen = targetScreen;
      if (this.dom.modalConfirmExit) {
        this.dom.modalConfirmExit.classList.remove('hidden');
      }
      return;
    }

    if (addToHistory) {
      this.navStack.push(targetScreen);
      let routePath = '/';
      if (targetScreen === 'modes-hub') routePath = '/modes';
      else if (targetScreen.startsWith('mode-')) routePath = `/modes/${targetScreen.replace('mode-', '')}`;
      else if (targetScreen !== 'home') routePath = `/${targetScreen}`;
      window.history.pushState({ screen: targetScreen }, '', routePath);
    }

    this._showScreen(targetScreen);
  }

  _showScreen(screenName) {
    this.status = screenName;
    const isGameplay = screenName === 'arranging' || screenName === 'playing';

    // Strict No-Scroll Rule (Section 8, 16): lock container height to 100dvh and hide bottom dock
    if (this.dom.appRoot) {
      this.dom.appRoot.classList.toggle('gameplay-active', isGameplay);
    }
    if (this.dom.bottomNav) {
      this.dom.bottomNav.style.display = isGameplay ? 'none' : 'flex';
    }

    // Hide all screen views cleanly
    document.querySelectorAll('.screen-view').forEach(s => s.classList.add('hidden'));

    // Show target screen
    const targetEl = document.getElementById(`screen-${screenName}`) || document.getElementById(`screen-mode-${screenName.replace('mode-', '')}`);
    if (targetEl) {
      targetEl.classList.remove('hidden');
    }

    // Update bottom nav active state
    let activeNavTab = null;
    if (screenName === 'home') activeNavTab = 'home';
    else if (screenName === 'lobby' || screenName === 'modes-hub' || screenName.startsWith('mode-')) activeNavTab = 'lobby';
    else if (screenName === 'tournaments') activeNavTab = 'tournaments';
    else if (screenName === 'leaderboard') activeNavTab = 'leaderboard';
    else if (screenName === 'profile') activeNavTab = 'profile';

    if (this.dom.navItems) {
      this.dom.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.tab === activeNavTab);
      });
    }

    // Refresh remote data when entering views
    if (screenName === 'tournaments' || screenName === 'mode-knockout' || screenName === 'mode-league') {
      this._send('get_tournaments');
    } else if (screenName === 'leaderboard') {
      this._send('get_leaderboard', { category: 'global' });
    } else if (screenName === 'profile') {
      this._send('get_wallet', { playerId: this.playerId });
      this._renderProfileStats();
    } else if (screenName === 'mode-friend-challenge') {
      this._send('get_friends_list', { playerId: this.playerId });
    }
  }

  _handleRoute() {
    const path = window.location.pathname;
    const matchRoom = path.match(/^\/r\/([A-Za-z0-9]+)/);
    if (matchRoom && matchRoom[1]) {
      const code = matchRoom[1].toUpperCase();
      this.joinRoomByCode(code);
    } else if (path.startsWith('/modes/')) {
      const modeKey = path.replace('/modes/', '');
      this.navigateTo(`mode-${modeKey}`, false);
    } else if (path === '/modes') {
      this.navigateTo('modes-hub', false);
    } else {
      this.navigateTo('home', false);
    }
  }

  _connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Bingo] WebSocket connected.');
      this._send('ping');
      this._send('get_wallet', { playerId: this.playerId });
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

  startQuickMatch() {
    this._unlockAudio();
    this.isOfflineMode = false;
    if (this.dom.matchmakingSearchState) this.dom.matchmakingSearchState.style.display = 'flex';
    if (this.dom.matchmakingFoundState) this.dom.matchmakingFoundState.style.display = 'none';
    if (this.dom.modalMatchmaking) {
      this.dom.modalMatchmaking.classList.remove('hidden');
    }
    this._send('create_room', {
      name: this.nickname,
      avatar: this.avatar,
      playerId: this.playerId,
      sessionToken: this.sessionToken
    });

    clearTimeout(this._quickMatchBotTimeout);
    this._quickMatchBotTimeout = setTimeout(() => {
      if (this.currentRoom && this.currentRoom.players.length === 1 && this.status === 'lobby') {
        this._showMatchFoundVS('🤖 Bot_Racer');
        setTimeout(() => {
          this._send('add_bot');
        }, 1200);
      }
    }, 2000);
  }

  _showMatchFoundVS(oppName = 'Opponent') {
    if (this.dom.matchmakingSearchState) this.dom.matchmakingSearchState.style.display = 'none';
    if (this.dom.matchmakingFoundState) {
      this.dom.matchmakingFoundState.style.display = 'flex';
      if (this.dom.vsP1Avatar) this.dom.vsP1Avatar.textContent = this.avatar;
      if (this.dom.vsP1Name) this.dom.vsP1Name.textContent = this.nickname;
      if (this.dom.vsP2Avatar) this.dom.vsP2Avatar.textContent = oppName.includes('Bot') ? '🤖' : '🐻';
      if (this.dom.vsP2Name) this.dom.vsP2Name.textContent = oppName;

      let count = 3;
      if (this.dom.vsCountdown) this.dom.vsCountdown.textContent = String(count);
      const timer = setInterval(() => {
        count--;
        if (this.dom.vsCountdown) this.dom.vsCountdown.textContent = String(count);
        if (count <= 0) {
          clearInterval(timer);
          if (this.dom.modalMatchmaking) this.dom.modalMatchmaking.classList.add('hidden');
        }
      }, 400);
    }
  }

  joinRoomByCode(code) {
    this._unlockAudio();
    this.isOfflineMode = false;
    this._send('join_room', {
      code,
      name: this.nickname,
      avatar: this.avatar,
      playerId: this.playerId,
      sessionToken: this.sessionToken
    });
  }

  _claimDailyReward() {
    this._unlockAudio();
    this._send('claim_daily_reward', { playerId: this.playerId });
  }

  /**
   * Offline Mode (Mode 8)
   */
  startOfflineMatch(isPassAndPlay = false) {
    this._unlockAudio();
    this.isOfflineMode = true;
    this.passAndPlayTurn = 1;
    this.currentRoom = {
      code: 'LOCAL',
      players: [
        { id: this.playerId, name: isPassAndPlay ? 'Player 1' : this.nickname, avatar: this.avatar },
        { id: 'p2-local', name: isPassAndPlay ? 'Player 2' : '🤖 Local Bot', avatar: isPassAndPlay ? '🐻' : '🤖' }
      ],
      match: { currentTurnPlayerId: this.playerId }
    };

    this.grid = generateRandomGrid();
    this.markedNumbers.clear();
    this.completedLines = [];
    this.renderOverlay.clear();
    this._showScreen('arranging');
    this._renderArrangeGrid();
    this.showToast(isPassAndPlay ? 'Pass & Play: Player 1 arrange card' : 'Offline Match vs Local AI', 'info');
  }

  /**
   * Survival Gauntlet (Mode 9)
   */
  startSurvivalGauntlet() {
    this._unlockAudio();
    this.isOfflineMode = true;
    this.survivalRound = 1;
    let seconds = 60;

    this.grid = generateRandomGrid();
    this.markedNumbers.clear();
    this.completedLines = [];
    this.renderOverlay.clear();
    this._showScreen('playing');
    this._renderGameGrid();

    if (this.dom.survivalRoundText) this.dom.survivalRoundText.textContent = `Round 1`;
    if (this.dom.survivalTimerText) this.dom.survivalTimerText.textContent = `${seconds}s`;

    clearInterval(this.survivalTimerInterval);
    this.survivalTimerInterval = setInterval(() => {
      seconds--;
      if (this.dom.survivalTimerText) this.dom.survivalTimerText.textContent = `${seconds}s`;
      if (seconds <= 0) {
        clearInterval(this.survivalTimerInterval);
        this.showToast('Time expired! Gauntlet over.', 'error');
        this.navigateTo('modes-hub');
      }
    }, 1000);
  }

  /**
   * Time Challenge Speed Run (Mode 10)
   */
  startTimeChallengeRun() {
    this._unlockAudio();
    this.isOfflineMode = true;
    let seconds = this.timeChallengeSeconds || 60;

    this.grid = generateRandomGrid();
    this.markedNumbers.clear();
    this.completedLines = [];
    this.renderOverlay.clear();
    this._showScreen('playing');
    this._renderGameGrid();

    clearInterval(this.timeChallengeInterval);
    this.timeChallengeInterval = setInterval(() => {
      seconds--;
      if (this.dom.timeChallengeClock) this.dom.timeChallengeClock.textContent = `${seconds}s`;
      if (seconds <= 0) {
        clearInterval(this.timeChallengeInterval);
        this.showToast(`Time's up! Lines Completed: ${this.completedLines.length}`, 'success');
        this.navigateTo('mode-time-challenge');
      }
    }, 1000);
  }

  _stopTimers() {
    clearInterval(this.turnTimerInterval);
    clearInterval(this.survivalTimerInterval);
    clearInterval(this.timeChallengeInterval);
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
        window.history.pushState({ screen: 'lobby' }, '', `/r/${msg.code}`);
        this._renderLobby(msg.room);

        const other = msg.room.players.find(p => p.id !== this.playerId);
        if (other && this.dom.modalMatchmaking && !this.dom.modalMatchmaking.classList.contains('hidden')) {
          this._showMatchFoundVS(other.name);
        } else if (!this._quickMatchBotTimeout && this.dom.modalMatchmaking) {
          this.dom.modalMatchmaking.classList.add('hidden');
        }

        this._showScreen('lobby');
        break;
      }

      case 'room_state': {
        this.currentRoom = msg.room;
        this._syncRoomState(msg.room);
        break;
      }

      case 'start_arranging': {
        if (this.dom.modalMatchmaking) {
          this.dom.modalMatchmaking.classList.add('hidden');
        }
        this.isLocked = false;
        if (this.dom.btnLockBoard) this.dom.btnLockBoard.disabled = false;
        this.selectedCellIndex = null;
        this._renderArrangeGrid();
        this._showScreen('arranging');
        break;
      }

      case 'board_locked': {
        if (msg.playerId === this.playerId) {
          this.isLocked = true;
          if (this.dom.btnLockBoard) this.dom.btnLockBoard.disabled = true;
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
        this.showToast('Match started! Both boards locked.', 'success');
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

      case 'wallet_data': {
        this.coinBalance = msg.balance || 500;
        localStorage.setItem('bingo_coins', String(this.coinBalance));
        this._updateWalletUI(msg.balance, msg.history);
        break;
      }

      case 'daily_reward_claimed': {
        this.coinBalance = msg.balance;
        localStorage.setItem('bingo_coins', String(this.coinBalance));
        this._updateWalletUI(msg.balance);
        if (this.dom.modalDailyReward) {
          this.dom.modalDailyReward.classList.remove('hidden');
        }
        soundManager.playVictory();
        this.confetti.burst(80);
        this._vibrate([80, 50, 80]);
        break;
      }

      case 'tournaments_data': {
        this._renderTournaments(msg);
        break;
      }

      case 'leaderboard_data': {
        this._renderLeaderboard(msg);
        break;
      }

      case 'friends_list_data': {
        this._renderFriendsDirectory(msg.friends);
        break;
      }

      case 'challenge_sent': {
        this.showToast('Challenge invitation sent! Waiting for response...', 'info');
        break;
      }

      case 'challenge_accepted': {
        this.showToast(`⚔️ Challenge Accepted by ${msg.opponentName}! Entering arena...`, 'success');
        this.joinRoomByCode(msg.roomCode);
        break;
      }

      case 'custom_tournament_created':
      case 'tournament_updated': {
        this.showToast(`🏆 Tournament Updated: ${msg.tournament.name}`, 'success');
        this._renderTournamentSnapshot(msg.tournament);
        break;
      }

      case 'player_disconnected': {
        this.dom.disconnectBanner.style.display = 'flex';
        this.dom.disconnectBannerText.textContent = t('friendDisconnected', { seconds: msg.graceSecondsRemaining || 60 });
        if (this.dom.opponentConnDot) this.dom.opponentConnDot.classList.add('disconnected');
        break;
      }

      case 'player_reconnected': {
        this.dom.disconnectBanner.style.display = 'none';
        if (this.dom.opponentConnDot) this.dom.opponentConnDot.classList.remove('disconnected');
        this.showToast('Friend reconnected!', 'success');
        break;
      }

      case 'rematch_started': {
        this.isLocked = false;
        if (this.dom.btnRematch) {
          this.dom.btnRematch.disabled = false;
          this.dom.btnRematch.textContent = t('rematch');
        }
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
    if (this.dom.lobbyCodeText) this.dom.lobbyCodeText.textContent = room.code;
    const isHost = room.hostPlayerId === this.playerId;

    const p1 = room.players[0];
    const p2 = room.players[1];

    if (p1 && this.dom.seat1Avatar) {
      this.dom.seat1Avatar.textContent = p1.avatar;
      this.dom.seat1Name.textContent = p1.id === this.playerId ? `${p1.name} (${t('host')})` : p1.name;
      this.dom.seat1Status.className = `seat-status-pill ${p1.isReady ? 'ready' : 'waiting'}`;
      this.dom.seat1Status.textContent = p1.isReady ? t('ready') : t('notReady');
    }

    if (p2 && this.dom.seat2Avatar) {
      this.dom.seat2Avatar.textContent = p2.avatar;
      this.dom.seat2Name.textContent = p2.id === this.playerId ? `${p2.name} (${t('guest')})` : p2.name;
      this.dom.seat2Status.className = `seat-status-pill ${p2.isReady ? 'ready' : 'waiting'}`;
      this.dom.seat2Status.textContent = p2.isReady ? t('ready') : t('notReady');
      if (this.dom.btnPracticeBot) this.dom.btnPracticeBot.style.display = 'none';
    } else if (this.dom.seat2Avatar) {
      this.dom.seat2Avatar.textContent = '⏳';
      this.dom.seat2Name.textContent = t('waitingForFriend');
      this.dom.seat2Status.className = 'seat-status-pill waiting';
      this.dom.seat2Status.textContent = '...';
      if (this.dom.btnPracticeBot) this.dom.btnPracticeBot.style.display = isHost ? 'block' : 'none';
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
      const other = room.players.find(p => p.id !== this.playerId);
      if (other && this.dom.modalMatchmaking && !this.dom.modalMatchmaking.classList.contains('hidden') && this.dom.matchmakingSearchState?.style.display !== 'none') {
        this._showMatchFoundVS(other.name);
      }
    } else if (this.status === 'arranging') {
      const other = room.players.find(p => p.id !== this.playerId);
      if (other && other.isBoardLocked && this.dom.friendArrangeBadge) {
        this.dom.friendArrangeBadge.className = 'seat-status-pill ready';
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

  _renderArrangeGrid() {
    if (!this.dom.arrangeGridBoard) return;
    this.dom.arrangeGridBoard.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const num = this.grid[i];
      const cell = document.createElement('button');
      cell.className = `number-tile board-cell-btn cell ${this.selectedCellIndex === i ? 'selected' : ''}`;
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
      this.selectedCellIndex = index;
      soundManager.playMark();
      this._renderArrangeGrid();
    } else if (this.selectedCellIndex === index) {
      this.selectedCellIndex = null;
      this._renderArrangeGrid();
    } else {
      const a = this.selectedCellIndex;
      const b = index;
      [this.grid[a], this.grid[b]] = [this.grid[b], this.grid[a]];
      this.selectedCellIndex = null;
      soundManager.playLineStroke(150);
      this._renderArrangeGrid();
    }
  }

  _renderGameGrid() {
    if (!this.dom.gameGridBoard) return;
    this.dom.gameGridBoard.innerHTML = '';
    const other = this.currentRoom?.players.find(p => p.id !== this.playerId);
    if (other) {
      if (this.dom.gameOppAvatar) this.dom.gameOppAvatar.textContent = other.avatar || '🐻';
      if (this.dom.gameOppName) this.dom.gameOppName.textContent = other.name || 'Friend';
    }

    for (let i = 0; i < 25; i++) {
      const num = this.grid[i];
      const isMarked = this.markedNumbers.has(num);

      const cell = document.createElement('button');
      cell.className = `number-tile board-cell-btn cell c ${isMarked ? 'marked m' : ''}`;
      cell.dataset.number = String(num);
      cell.dataset.n = String(num);
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

    if (this.isOfflineMode) {
      // Local offline play
      if (this.markedNumbers.has(num)) return;
      this.markedNumbers.add(num);
      const cell = this.dom.gameGridBoard.querySelector(`[data-number="${num}"]`);
      if (cell) cell.classList.add('marked', 'm');
      soundManager.playMark();
      this._vibrate(40);
      this._checkLocalCompletedLines();
      return;
    }

    if (this.currentRoom?.match?.currentTurnPlayerId !== this.playerId) {
      this.showToast(t('friendTurn', { name: this.dom.gameOppName?.textContent || 'Friend' }));
      return;
    }
    if (this.markedNumbers.has(num)) {
      this.showToast(`Number ${num} is already called.`);
      return;
    }

    this._send('call_number', { number: num });
  }

  _checkLocalCompletedLines() {
    // Check local 5x5 lines
    const lineDefs = [
      // Rows
      ...Array.from({ length: 5 }, (_, r) => ({ id: `row-${r}`, type: 'ROW', index: r, nums: Array.from({ length: 5 }, (_, c) => this.grid[r * 5 + c]) })),
      // Cols
      ...Array.from({ length: 5 }, (_, c) => ({ id: `col-${c}`, type: 'COL', index: c, nums: Array.from({ length: 5 }, (_, r) => this.grid[r * 5 + c]) }))
    ];

    const completed = lineDefs.filter(l => l.nums.every(n => this.markedNumbers.has(n)));
    const newLines = completed.filter(l => !this.completedLines.includes(l.id));

    if (newLines.length > 0) {
      for (const line of newLines) {
        const order = this.completedLines.length + 1;
        const letter = order <= 5 ? 'BINGO'[order - 1] : null;
        const lineInfo = { id: line.id, type: line.type, index: line.index, order, letter };
        this.animationQueue.enqueue(line.id, async (isAccelerated) => {
          await this.renderOverlay.animateLineStrike(lineInfo, isAccelerated);
          this.completedLines.push(line.id);
          this._vibrate([60, 40, 60]);
          this._updateClaimButtonState();
        });
      }
    }
  }

  _handleNumberCalled(msg) {
    const { number, nextTurnPlayerId, isAutoPicked } = msg;
    this.markedNumbers.add(number);

    if (this.dom.gameGridBoard) {
      const cell = this.dom.gameGridBoard.querySelector(`[data-number="${number}"]`);
      if (cell) {
        cell.classList.add('marked', 'm');
      }
    }

    if (this.dom.calledNumbersStrip) {
      const badge = document.createElement('span');
      badge.className = 'call-chip';
      badge.textContent = String(number);
      if (isAutoPicked) badge.title = 'Auto-picked by timer';
      this.dom.calledNumbersStrip.appendChild(badge);
      if (this.dom.calledNumbersStrip.children.length > 6) {
        this.dom.calledNumbersStrip.firstElementChild.remove();
      }
    }

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
    if (!this.dom.opponentMiniBingo) return;
    const letters = this.dom.opponentMiniBingo.querySelectorAll('.opp-mini-letter, .mini-letter, .mw');
    letters.forEach((el, idx) => {
      el.classList.toggle('struck', idx < count);
      el.classList.toggle('s', idx < count);
    });
  }

  _updateTurnBanner(turnPlayerId) {
    const isMyTurn = turnPlayerId === this.playerId;
    if (this.dom.turnIndicatorPill) {
      this.dom.turnIndicatorPill.className = `turn-badge ${isMyTurn ? 'my-turn' : 'friend-turn'}`;
    }
    if (this.dom.turnText) {
      this.dom.turnText.textContent = isMyTurn ? t('yourTurn') : t('friendTurn', { name: this.dom.gameOppName?.textContent || 'Friend' });
    }
  }

  _startTurnCountdown(deadline) {
    clearInterval(this.turnTimerInterval);
    if (!deadline) {
      if (this.dom.turnClockDisplay) this.dom.turnClockDisplay.style.display = 'none';
      return;
    }

    if (this.dom.turnClockDisplay) this.dom.turnClockDisplay.style.display = 'block';
    const update = () => {
      const now = Date.now() + this.serverTimeOffset;
      const rem = Math.max(0, Math.ceil((deadline - now) / 1000));
      if (this.dom.turnClockSeconds) this.dom.turnClockSeconds.textContent = String(rem);
      if (rem <= 0) {
        clearInterval(this.turnTimerInterval);
      }
    };
    update();
    this.turnTimerInterval = setInterval(update, 500);
  }

  _updateClaimButtonState() {
    const count = this.completedLines.length;
    const pips = document.querySelectorAll('#bingo-pips .bingo-pip, .pips i');
    pips.forEach((p, idx) => {
      p.classList.toggle('active', idx < count);
      p.classList.toggle('f', idx < count);
    });

    if (count >= 5) {
      const wasLocked = this.dom.bingoClaimBtn.classList.contains('locked');
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn active ready on';
      this.dom.bingoClaimBtn.disabled = false;
      if (this.dom.bingoBtnText) this.dom.bingoBtnText.textContent = 'BINGO!';
      if (wasLocked) {
        soundManager.playButtonReady();
        this._vibrate([80, 50, 120]);
      }
    } else {
      this.dom.bingoClaimBtn.className = 'bingo-claim-btn locked';
      this.dom.bingoClaimBtn.disabled = true;
      if (this.dom.bingoBtnText) this.dom.bingoBtnText.textContent = 'BINGO';
    }
  }

  handleClaimPress() {
    if (this.completedLines.length < 5) return;

    if (this.isOfflineMode) {
      // Local offline win
      soundManager.playVictory();
      this.confetti.burst(120);
      this._showScreen('finished');
      return;
    }

    this.dom.bingoClaimBtn.className = 'bingo-claim-btn submitting';
    this.dom.bingoClaimBtn.disabled = true;
    if (this.dom.bingoBtnText) this.dom.bingoBtnText.textContent = 'VERIFYING...';
    this._send('claim_bingo', { claimId: `claim-${Date.now()}` });
  }

  _handleBingoResult(msg) {
    this._stopTimers();
    if (this.wakeLock) {
      try { this.wakeLock.release(); } catch {}
    }

    if (msg.valid) {
      const isWinner = msg.winnerId === this.playerId;
      if (this.dom.resultEmoji) this.dom.resultEmoji.textContent = isWinner ? '🏆' : '👏';
      if (this.dom.resultTitle) this.dom.resultTitle.textContent = isWinner ? t('victory') : t('defeat');
      if (this.dom.resultDesc) this.dom.resultDesc.textContent = isWinner ? t('youWon') : t('friendWon', { name: this.dom.gameOppName?.textContent || 'Friend' });

      if (msg.scores) {
        const other = this.currentRoom?.players.find(p => p.id !== this.playerId);
        if (this.dom.scorePlayer1) this.dom.scorePlayer1.textContent = `You: ${msg.scores[this.playerId] || 0}`;
        if (this.dom.scorePlayer2) this.dom.scorePlayer2.textContent = `${other?.name || 'Friend'}: ${msg.scores[other?.id] || 0}`;
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
      const wins = (Number(localStorage.getItem('bingo_stat_wins')) || 28) + 1;
      const matches = (Number(localStorage.getItem('bingo_stat_matches')) || 42) + 1;
      localStorage.setItem('bingo_stat_wins', String(wins));
      localStorage.setItem('bingo_stat_matches', String(matches));
    } catch {}
  }

  _showStatsToast() {
    try {
      const wins = localStorage.getItem('bingo_stat_wins') || '28';
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

  _renderFriendsDirectory(friends = []) {
    if (!this.dom.friendsDirectoryList) return;
    this.dom.friendsDirectoryList.innerHTML = '';

    friends.forEach(f => {
      const card = document.createElement('div');
      card.className = 'friend-item-card';
      card.innerHTML = `
        <div class="friend-item-meta">
          <div class="friend-avatar-box">
            ${f.avatar}
            <span class="friend-status-dot ${f.status}"></span>
          </div>
          <div>
            <div class="friend-name-text">${f.name}</div>
            <div class="friend-rank-sub">${f.status === 'online' ? '🟢 Online' : (f.status === 'in_game' ? '🟠 In Game' : '⚪ Offline')} • ${f.rank || 'Gold'}</div>
          </div>
        </div>
        <button class="btn-tactile btn-primary btn-sm btn-challenge-friend" data-friend-id="${f.id}" ${f.status === 'offline' ? 'disabled' : ''}>
          <span>⚔️</span> Challenge
        </button>
      `;

      const challengeBtn = card.querySelector('.btn-challenge-friend');
      challengeBtn.addEventListener('click', () => {
        this._send('send_challenge', {
          fromId: this.playerId,
          fromName: this.nickname,
          fromAvatar: this.avatar,
          targetFriendId: f.id
        });
        challengeBtn.disabled = true;
        challengeBtn.textContent = 'Sent...';
      });

      this.dom.friendsDirectoryList.appendChild(card);
    });
  }

  _renderTournaments(data) {
    if (!data) return;
    const { knockout, league } = data;

    // Knockout Bracket
    if (knockout && this.dom.knockoutBracketContainer) {
      this.dom.knockoutBracketContainer.innerHTML = '';
      knockout.rounds.forEach(round => {
        const roundCol = document.createElement('div');
        roundCol.className = 'bracket-round-column';

        const title = document.createElement('div');
        title.className = 'bracket-round-header';
        title.textContent = round.name;
        roundCol.appendChild(title);

        round.matches.forEach(m => {
          const card = document.createElement('div');
          card.className = 'bracket-match-card';

          const p1Div = document.createElement('div');
          p1Div.className = `match-player-row ${m.p1.winner ? 'winner' : ''}`;
          p1Div.innerHTML = `<span>${m.p1.name}</span><span class="match-score">${m.p1.score}</span>`;

          const p2Div = document.createElement('div');
          p2Div.className = `match-player-row ${m.p2.winner ? 'winner' : ''}`;
          p2Div.innerHTML = `<span>${m.p2.name}</span><span class="match-score">${m.p2.score}</span>`;

          card.appendChild(p1Div);
          card.appendChild(p2Div);
          roundCol.appendChild(card);
        });

        this.dom.knockoutBracketContainer.appendChild(roundCol);
      });
    }

    // League Table
    if (league && this.dom.leagueTableBody) {
      const tbody = this.dom.leagueTableBody.querySelector('tbody') || this.dom.leagueTableBody;
      tbody.innerHTML = '';
      league.standings.forEach(row => {
        const tr = document.createElement('tr');
        if (row.name === 'You' || row.rank <= 3) {
          tr.className = row.rank <= 3 ? 'top-tier' : 'user-row';
        }
        tr.innerHTML = `
          <td><strong>${row.rank}</strong></td>
          <td><span style="margin-right:6px;">${row.avatar}</span>${row.name}</td>
          <td>${row.mp}</td>
          <td>${row.w}</td>
          <td>${row.l}</td>
          <td><strong>${row.pts}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }

    // Also render Mode 6 Table
    if (league && this.dom.modeLeagueTable) {
      const tbody = this.dom.modeLeagueTable.querySelector('tbody') || this.dom.modeLeagueTable;
      tbody.innerHTML = '';
      league.standings.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${row.rank}</strong></td>
          <td><span style="margin-right:6px;">${row.avatar}</span>${row.name}</td>
          <td>${row.mp}</td>
          <td>${row.w}</td>
          <td>${row.l}</td>
          <td><strong>${row.pts}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  _renderTournamentSnapshot(tourn) {
    if (!tourn) return;
    // Update Friends League table if present
    if (tourn.pointsTable && this.dom.friendsLeagueTableBody) {
      const tbody = this.dom.friendsLeagueTableBody.querySelector('tbody') || this.dom.friendsLeagueTableBody;
      tbody.innerHTML = '';
      tourn.pointsTable.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>#${idx + 1}</strong></td>
          <td>${row.name}</td>
          <td>${row.played}</td>
          <td>${row.won}</td>
          <td>${row.lost}</td>
          <td><strong>${row.points}</strong></td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  _renderLeaderboard(data) {
    if (!data) return;
    const { top3, ranks, userRank } = data;

    // Podium (Gold, Silver, Bronze)
    if (top3 && top3.length >= 3) {
      const pGold = top3[0];
      const pSilver = top3[1];
      const pBronze = top3[2];

      if (this.dom.goldAvatar) this.dom.goldAvatar.textContent = pGold.avatar;
      if (this.dom.goldName) this.dom.goldName.textContent = pGold.name;
      const goldBadge = this.dom.podiumGold?.querySelector('.podium-badge');
      if (goldBadge) goldBadge.textContent = `1st • ${pGold.coins.toLocaleString()} 🪙`;

      if (this.dom.silverAvatar) this.dom.silverAvatar.textContent = pSilver.avatar;
      if (this.dom.silverName) this.dom.silverName.textContent = pSilver.name;
      const silverBadge = this.dom.podiumSilver?.querySelector('.podium-badge');
      if (silverBadge) silverBadge.textContent = `2nd • ${pSilver.coins.toLocaleString()} 🪙`;

      if (this.dom.bronzeAvatar) this.dom.bronzeAvatar.textContent = pBronze.avatar;
      if (this.dom.bronzeName) this.dom.bronzeName.textContent = pBronze.name;
      const bronzeBadge = this.dom.podiumBronze?.querySelector('.podium-badge');
      if (bronzeBadge) bronzeBadge.textContent = `3rd • ${pBronze.coins.toLocaleString()} 🪙`;
    }

    // List ranks #4..#10
    if (ranks && this.dom.rankListItems) {
      this.dom.rankListItems.innerHTML = '';
      ranks.forEach(r => {
        const row = document.createElement('div');
        row.className = 'rank-list-item';
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="rank-pos">#${r.rank}</span>
            <span style="font-size:1.4rem;">${r.avatar}</span>
            <div>
              <div style="font-family:var(--font-display); font-weight:800; font-size:0.9rem;">${r.name}</div>
              <div style="font-size:0.75rem; color:var(--text-secondary);">${r.wins} Wins • ${r.winRate}</div>
            </div>
          </div>
          <span style="font-family:var(--font-display); font-weight:800; color:var(--gold-dark);">${r.coins.toLocaleString()} 🪙</span>
        `;
        this.dom.rankListItems.appendChild(row);
      });
    }

    // User rank bar
    if (userRank) {
      if (this.dom.userRankName) this.dom.userRankName.textContent = this.nickname;
      if (this.dom.userRankCoins) this.dom.userRankCoins.textContent = `${userRank.coins.toLocaleString()} 🪙`;
    }
  }

  _updateWalletUI(balance, history = []) {
    if (this.dom.headerCoinAmount) {
      this.dom.headerCoinAmount.textContent = balance.toLocaleString();
    }
    if (this.dom.profileCoinBalance) {
      this.dom.profileCoinBalance.textContent = `${balance.toLocaleString()} 🪙`;
    }
    if (this.dom.userRankCoins) {
      this.dom.userRankCoins.textContent = `${balance.toLocaleString()} 🪙`;
    }

    if (this.dom.coinHistoryList && history.length > 0) {
      this.dom.coinHistoryList.innerHTML = '';
      history.slice(0, 10).forEach(tx => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '8px 12px';
        item.style.background = 'var(--bg-subtle)';
        item.style.borderRadius = '10px';

        const isPositive = tx.amount > 0;
        const color = isPositive ? 'var(--mint-green)' : 'var(--coral-red)';
        const sign = isPositive ? '+' : '';

        item.innerHTML = `
          <div>
            <div style="font-weight:700; font-size:0.85rem;">${tx.description || tx.type}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">${new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div style="font-family:var(--font-display); font-weight:800; color:${color}; font-size:0.95rem;">
            ${sign}${tx.amount} 🪙
          </div>
        `;
        this.dom.coinHistoryList.appendChild(item);
      });
    }
  }

  _renderProfileStats() {
    if (this.dom.profilePageAvatar) this.dom.profilePageAvatar.textContent = this.avatar;
    if (this.dom.profilePageName) this.dom.profilePageName.textContent = this.nickname;
    if (this.dom.profilePageId) this.dom.profilePageId.textContent = `ID: #${this.playerId.toUpperCase()}`;

    const wins = Number(localStorage.getItem('bingo_stat_wins')) || 28;
    const matches = Number(localStorage.getItem('bingo_stat_matches')) || 42;
    const rate = Math.round((wins / (matches || 1)) * 100);

    if (this.dom.statTotalMatches) this.dom.statTotalMatches.textContent = String(matches);
    if (this.dom.statTotalWins) this.dom.statTotalWins.textContent = String(wins);
    if (this.dom.statWinRate) this.dom.statWinRate.textContent = `${rate}%`;
    if (this.dom.statWinStreak) this.dom.statWinStreak.textContent = `🔥 3`;
  }

  shareRoomLink() {
    if (!this.currentRoom) return;
    const url = `${window.location.origin}/r/${this.currentRoom.code}`;
    const text = `Join my Bingo game! Tap to play: ${url}`;

    if (navigator.share) {
      navigator.share({ title: 'Bingo', text, url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  }

  copyRoomLink() {
    if (!this.currentRoom) return;
    const url = `${window.location.origin}/r/${this.currentRoom.code}`;
    navigator.clipboard?.writeText(url);
    this.showToast(t('linkCopied'), 'success');
  }

  copyRoomCode() {
    if (!this.currentRoom) return;
    navigator.clipboard?.writeText(this.currentRoom.code);
    this.showToast(t('codeCopied'), 'success');
  }

  showQRCodeModal() {
    if (!this.currentRoom) return;
    const url = `${window.location.origin}/r/${this.currentRoom.code}`;
    if (this.dom.qrContainer) {
      this.dom.qrContainer.innerHTML = '';
      const svg = generateQRCodeSVG(url, 210);
      this.dom.qrContainer.appendChild(svg);
    }
    if (this.dom.modalQr) this.dom.modalQr.classList.remove('hidden');
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
    if (!this.dom.toastContainer) return;
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
