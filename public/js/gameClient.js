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

import { generateRandomGrid, validateGridArrangement, findCompletedLines } from '/shared/lineModel.js';
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

    // Arcade & Playable Modes State
    this.selectedBotDifficulty = 'easy';
    this.timeChallengeSeconds = 60;
    this.timeChallengeInterval = null;
    this.survivalRound = 1;
    this.survivalTimerInterval = null;
    this.isOfflineMode = false;
    this.isPassAndPlay = false;
    this.isPracticeBotMode = false;
    this.isTeam2v2 = false;
    this.isTournamentMatchMode = false;
    this.currentTournamentType = null;
    this.passAndPlayCurrentPlayer = 1;
    this.passAndPlayGrid1 = null;
    this.passAndPlayGrid2 = null;
    this.passAndPlayLines1 = [];
    this.passAndPlayLines2 = [];
    this.botGrid = null;
    this.botCompletedLines = [];
    this.botDifficulty = 'easy';
    this.botThinkingTimer = null;
    this.isMyTurn = true;

    // Tournament Progress State
    this.knockoutRoundIndex = 0;
    this.leagueFixtureIndex = 0;
    this.friendsLeagueFixtureIndex = 0;
    this.friendsKoRoundIndex = 0;
    this.friendsHybridFixtureIndex = 0;
    this.friendsHybridStage = 'LEAGUE';

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
    this._initDefaultModeData();
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

      // Navigation Dock & Frame
      mainHeader: document.getElementById('main-header'),
      appRoot: document.getElementById('app-root'),
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
      btnPlayModeKoMatch: document.getElementById('btn-play-mode-ko-match'),
      modeKoFixtureText: document.getElementById('mode-ko-fixture-text'),
      knockoutModeBracket: document.getElementById('knockout-mode-bracket'),
      modeLeagueTable: document.getElementById('mode-league-table'),
      btnPlayLeagueMatch: document.getElementById('btn-play-league-match'),
      leagueCurrentFixtureText: document.getElementById('league-current-fixture-text'),
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
      btnCreateFriendsLeague: document.getElementById('btn-create-friends-league'),
      btnPlayFriendsLeagueMatch: document.getElementById('btn-play-friends-league-match'),
      friendsLeagueFixtureText: document.getElementById('friends-league-fixture-text'),
      friendsLeagueSizeChips: document.querySelectorAll('.friends-league-size-chip'),
      friendsLeaguePtsChips: document.querySelectorAll('.friends-league-pts-chip'),
      btnCreateFriendsKnockout: document.getElementById('btn-create-friends-knockout'),
      btnPlayFriendsKoMatch: document.getElementById('btn-play-friends-ko-match'),
      friendsKoRoundText: document.getElementById('friends-ko-round-text'),
      friendsKoSizeChips: document.querySelectorAll('.friends-ko-size-chip'),
      friendsKnockoutBracket: document.getElementById('friends-knockout-bracket'),
      btnCreateFriendsHybrid: document.getElementById('btn-create-friends-hybrid'),
      btnPlayFriendsHybridMatch: document.getElementById('btn-play-friends-hybrid-match'),
      friendsHybridFixtureText: document.getElementById('friends-hybrid-fixture-text'),
      friendsHybridStageLabel: document.getElementById('friends-hybrid-stage-label'),
      friendsHybridTable: document.getElementById('friends-hybrid-table'),
      friendsHybridSizeChips: document.querySelectorAll('.friends-hybrid-size-chip'),

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
      btnGameplayExit: document.getElementById('btn-gameplay-exit'),
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

      // Pass & Play Modal
      modalPassPhone: document.getElementById('modal-pass-phone'),
      passPhoneTitle: document.getElementById('pass-phone-title'),
      passPhoneDesc: document.getElementById('pass-phone-desc'),
      btnPassPhoneReady: document.getElementById('btn-pass-phone-ready'),

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
        this.isOfflineMode = false;
        this.isPracticeBotMode = false;
        this.isTournamentMatchMode = false;
        this.isPassAndPlay = false;
        this.isTeam2v2 = false;
        this._stopTimers();
        clearTimeout(this.botThinkingTimer);
        const dest = this.pendingExitScreen || 'modes-hub';
        this.pendingExitScreen = null;
        this.showToast('Match forfeited.');
        this._showScreen(dest);
      });
    }

    // Active Gameplay Exit Button Handler
    if (this.dom.btnGameplayExit) {
      this.dom.btnGameplayExit.addEventListener('click', () => {
        if (this.status === 'playing' || this.status === 'arranging') {
          this.pendingExitScreen = 'modes-hub';
          if (this.dom.modalConfirmExit) {
            this.dom.modalConfirmExit.classList.remove('hidden');
          }
        } else {
          this.navigateTo('modes-hub');
        }
      });
    }

    // Pass & Play Modal Action
    if (this.dom.btnPassPhoneReady) {
      this.dom.btnPassPhoneReady.addEventListener('click', () => {
        this.onPassPhoneReady();
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
        this.startTeam2v2Match();
      });
    }

    // Mode 5: Cobalt Cup Knockout
    if (this.dom.btnEnterModeKnockout) {
      this.dom.btnEnterModeKnockout.addEventListener('click', () => {
        if (this.coinBalance >= 100) {
          this.coinBalance -= 100;
          this._updateWalletUI(this.coinBalance);
          this.showToast('100 🪙 entry paid! Knockout bracket ready.', 'success');
        }
        this.playKnockoutRoundMatch();
      });
    }
    if (this.dom.btnPlayModeKoMatch) {
      this.dom.btnPlayModeKoMatch.addEventListener('click', () => {
        this.playKnockoutRoundMatch();
      });
    }

    // Mode 6: Premier League Fixtures
    if (this.dom.btnPlayLeagueMatch) {
      this.dom.btnPlayLeagueMatch.addEventListener('click', () => {
        this.playLeagueFixtureMatch();
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
        this.startPracticeBotMatch(this.selectedBotDifficulty || 'easy');
      });
    }

    // Mode 8: Offline Mode
    if (this.dom.btnOfflinePassAndPlay) {
      this.dom.btnOfflinePassAndPlay.addEventListener('click', () => {
        this.startPassAndPlayMatch();
      });
    }
    if (this.dom.btnOfflineBot) {
      this.dom.btnOfflineBot.addEventListener('click', () => {
        this.startPracticeBotMatch('medium');
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

    // Mode 11: Friends League (IPL)
    this.dom.friendsLeagueSizeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.friendsLeagueSizeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    this.dom.friendsLeaguePtsChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.friendsLeaguePtsChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    if (this.dom.btnCreateFriendsLeague) {
      this.dom.btnCreateFriendsLeague.addEventListener('click', () => {
        this.createFriendsLeague();
      });
    }
    if (this.dom.btnPlayFriendsLeagueMatch) {
      this.dom.btnPlayFriendsLeagueMatch.addEventListener('click', () => {
        this.playFriendsLeagueMatch();
      });
    }
    if (this.dom.btnHostFriendsLeagueCta) {
      this.dom.btnHostFriendsLeagueCta.addEventListener('click', () => {
        this.createFriendsLeague();
      });
    }

    // Mode 12: Friends Knockout
    this.dom.friendsKoSizeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.friendsKoSizeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    if (this.dom.btnCreateFriendsKnockout) {
      this.dom.btnCreateFriendsKnockout.addEventListener('click', () => {
        this.createFriendsKnockout();
      });
    }
    if (this.dom.btnPlayFriendsKoMatch) {
      this.dom.btnPlayFriendsKoMatch.addEventListener('click', () => {
        this.playFriendsKoMatch();
      });
    }
    if (this.dom.btnHostFriendsKoCta) {
      this.dom.btnHostFriendsKoCta.addEventListener('click', () => {
        this.createFriendsKnockout();
      });
    }

    // Mode 13: Friends Hybrid
    this.dom.friendsHybridSizeChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.friendsHybridSizeChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });
    if (this.dom.btnCreateFriendsHybrid) {
      this.dom.btnCreateFriendsHybrid.addEventListener('click', () => {
        this.createFriendsHybrid();
      });
    }
    if (this.dom.btnPlayFriendsHybridMatch) {
      this.dom.btnPlayFriendsHybridMatch.addEventListener('click', () => {
        this.playFriendsHybridMatch();
      });
    }
    if (this.dom.btnHostFriendsHybridCta) {
      this.dom.btnHostFriendsHybridCta.addEventListener('click', () => {
        this.createFriendsHybrid();
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
          if (this.isPassAndPlay) {
            if (this.passAndPlayCurrentPlayer === 1) {
              this.passAndPlayGrid1 = [...this.grid];
              if (this.dom.passPhoneTitle) this.dom.passPhoneTitle.textContent = 'Pass Phone to Player 2';
              if (this.dom.passPhoneDesc) this.dom.passPhoneDesc.textContent = 'Player 1 locked board! Pass device to Player 2 to arrange their 5x5 board.';
              if (this.dom.modalPassPhone) this.dom.modalPassPhone.classList.remove('hidden');
              return;
            } else {
              this.passAndPlayGrid2 = [...this.grid];
              this.passAndPlayCurrentPlayer = 1;
              this.grid = [...this.passAndPlayGrid1];
              this.status = 'playing';
              this._showScreen('playing');
              this._renderGameGrid();
              this._updateTurnBannerLocal(true, 'Player 1');
              this.showToast('Pass & Play Started! Player 1 turn', 'success');
              return;
            }
          }

          this.status = 'playing';
          this._showScreen('playing');
          this._renderGameGrid();
          this._updateTurnBannerLocal(true);
          this.showToast('Match Started! Your turn to call.', 'success');
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
        if (this.isOfflineMode) {
          if (this.isPassAndPlay) {
            this.startPassAndPlayMatch();
          } else if (this.isPracticeBotMode) {
            this.startPracticeBotMatch(this.selectedBotDifficulty || 'easy');
          } else if (this.isTournamentMatchMode) {
            if (this.currentTournamentType === 'KNOCKOUT') this.playKnockoutRoundMatch();
            else if (this.currentTournamentType === 'LEAGUE') this.playLeagueFixtureMatch();
            else if (this.currentTournamentType === 'FRIENDS_LEAGUE') this.playFriendsLeagueMatch();
            else if (this.currentTournamentType === 'FRIENDS_KNOCKOUT') this.playFriendsKoMatch();
            else if (this.currentTournamentType === 'FRIENDS_HYBRID') this.playFriendsHybridMatch();
            else this.startPracticeBotMatch('medium');
          } else if (this.isTeam2v2) {
            this.startTeam2v2Match();
          } else {
            this.startPracticeBotMatch('medium');
          }
          return;
        }
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
    const isGameplay = screenName === 'arranging' || screenName === 'playing' || screenName === 'arrange' || screenName === 'game';

    // Strict No-Scroll Rule: lock container height to 100dvh, hide main app header and bottom dock
    if (this.dom.appRoot) {
      this.dom.appRoot.classList.toggle('gameplay-active', isGameplay);
    }
    if (this.dom.bottomNav) {
      this.dom.bottomNav.style.display = isGameplay ? 'none' : 'flex';
    }
    if (this.dom.mainHeader) {
      this.dom.mainHeader.style.display = isGameplay ? 'none' : 'flex';
    }

    // Hide all screen views cleanly
    document.querySelectorAll('.screen-view').forEach(s => s.classList.add('hidden'));

    // Show target screen
    let targetEl = document.getElementById(`screen-${screenName}`);
    if (!targetEl) {
      if (screenName === 'arranging' || screenName === 'arrange') targetEl = document.getElementById('screen-arrange');
      else if (screenName === 'playing' || screenName === 'game') targetEl = document.getElementById('screen-game');
      else if (screenName === 'finished' || screenName === 'result') targetEl = document.getElementById('screen-result');
      else if (screenName.startsWith('mode-')) targetEl = document.getElementById(`screen-mode-${screenName.replace('mode-', '')}`);
    }
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
   * Helper: initializes local match state and navigates to board arrangement
   */
  _setupLocalMatch(opponentName, opponentAvatar, modeTitle) {
    this._unlockAudio();
    this.isOfflineMode = true;
    this.markedNumbers.clear();
    this.completedLines = [];
    this.renderOverlay.clear();
    this.isMyTurn = true;
    this.botCompletedLines = [];
    this.botGrid = generateRandomGrid();
    this.grid = generateRandomGrid();
    this.selectedCellIndex = null;
    this.isLocked = false;

    if (this.dom.gameOppName) this.dom.gameOppName.textContent = opponentName;
    if (this.dom.gameOppAvatar) this.dom.gameOppAvatar.textContent = opponentAvatar;
    if (this.dom.opponentConnDot) this.dom.opponentConnDot.className = 'conn-dot';
    this._updateOpponentMiniBingo(0);
    this._updateClaimButtonState();
    if (this.dom.calledNumbersStrip) {
      this.dom.calledNumbersStrip.innerHTML = '<span style="font-size:0.75rem; font-weight:800; color:var(--text-secondary); margin-right:2px;">Calls:</span>';
    }

    this._showScreen('arranging');
    this._renderArrangeGrid();
    if (this.dom.btnLockBoard) this.dom.btnLockBoard.disabled = false;
    this.showToast(`${modeTitle}: Arrange your board & lock`, 'info');
  }

  /**
   * AI Bot turn calculation heuristic
   */
  _chooseBotMove(difficulty = 'easy') {
    const uncalled = [];
    for (let i = 1; i <= 25; i++) {
      if (!this.markedNumbers.has(i)) uncalled.push(i);
    }
    if (uncalled.length === 0) return 1;

    if (difficulty === 'easy' || !this.botGrid) {
      return uncalled[Math.floor(Math.random() * uncalled.length)];
    }

    const scores = new Map();
    uncalled.forEach(n => scores.set(n, 1));

    // Rows
    for (let r = 0; r < 5; r++) {
      const row = this.botGrid.slice(r * 5, (r + 1) * 5);
      const markedCount = row.filter(n => this.markedNumbers.has(n)).length;
      const weight = difficulty === 'hard' ? Math.pow(3, markedCount) : Math.pow(2, markedCount);
      row.forEach(n => {
        if (!this.markedNumbers.has(n)) {
          scores.set(n, (scores.get(n) || 0) + weight);
        }
      });
    }

    // Cols
    for (let c = 0; c < 5; c++) {
      const col = [this.botGrid[c], this.botGrid[c + 5], this.botGrid[c + 10], this.botGrid[c + 15], this.botGrid[c + 20]];
      const markedCount = col.filter(n => this.markedNumbers.has(n)).length;
      const weight = difficulty === 'hard' ? Math.pow(3, markedCount) : Math.pow(2, markedCount);
      col.forEach(n => {
        if (!this.markedNumbers.has(n)) {
          scores.set(n, (scores.get(n) || 0) + weight);
        }
      });
    }

    let bestNum = uncalled[0];
    let maxScore = -1;
    for (const [num, score] of scores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        bestNum = num;
      }
    }
    return bestNum;
  }

  /**
   * Applies called number to local match boards
   */
  _applyLocalNumber(num, caller) {
    this.markedNumbers.add(num);

    // Update player's board tile
    if (this.dom.gameGridBoard) {
      const cell = this.dom.gameGridBoard.querySelector(`[data-number="${num}"]`);
      if (cell) cell.classList.add('marked', 'm');
    }

    // Add to recent calls strip
    if (this.dom.calledNumbersStrip) {
      const chip = document.createElement('span');
      chip.className = 'call-chip';
      chip.textContent = String(num);
      if (caller === 'bot') chip.style.background = 'var(--coral-light)';
      this.dom.calledNumbersStrip.appendChild(chip);
      if (this.dom.calledNumbersStrip.children.length > 7) {
        this.dom.calledNumbersStrip.children[1]?.remove();
      }
    }

    soundManager.playMark();
    this._vibrate(40);

    // Check Player completed lines
    this._checkLocalCompletedLines();

    // Check Bot completed lines
    if (this.botGrid) {
      const botLines = findCompletedLines(this.botGrid, this.markedNumbers);
      this.botCompletedLines = botLines;
      this._updateOpponentMiniBingo(botLines.length);
    }
  }

  _updateTurnBannerLocal(isMyTurn, oppName = 'Opponent') {
    if (this.dom.turnIndicatorPill) {
      this.dom.turnIndicatorPill.className = `turn-badge ${isMyTurn ? 'my-turn' : 'friend-turn'}`;
    }
    if (this.dom.turnText) {
      this.dom.turnText.textContent = isMyTurn ? (t('yourTurn') || 'Your turn') : `${oppName} thinking...`;
    }
  }

  /**
   * Pass & Play Call Handler
   */
  _handlePassAndPlayCall(num) {
    this.markedNumbers.add(num);
    soundManager.playMark();
    this._vibrate(40);

    const cell = this.dom.gameGridBoard?.querySelector(`[data-number="${num}"]`);
    if (cell) cell.classList.add('marked', 'm');

    if (this.dom.calledNumbersStrip) {
      const chip = document.createElement('span');
      chip.className = 'call-chip';
      chip.textContent = String(num);
      this.dom.calledNumbersStrip.appendChild(chip);
      if (this.dom.calledNumbersStrip.children.length > 7) {
        this.dom.calledNumbersStrip.children[1]?.remove();
      }
    }

    const currGrid = this.passAndPlayCurrentPlayer === 1 ? this.passAndPlayGrid1 : this.passAndPlayGrid2;
    const completed = findCompletedLines(currGrid, this.markedNumbers);
    if (this.passAndPlayCurrentPlayer === 1) {
      this.passAndPlayLines1 = completed;
    } else {
      this.passAndPlayLines2 = completed;
    }

    this._checkLocalCompletedLines();

    if (completed.length >= 5) {
      return;
    }

    const nextPlayer = this.passAndPlayCurrentPlayer === 1 ? 2 : 1;
    setTimeout(() => {
      if (this.status !== 'playing') return;
      if (this.dom.passPhoneTitle) this.dom.passPhoneTitle.textContent = `Pass Phone to Player ${nextPlayer}`;
      if (this.dom.passPhoneDesc) this.dom.passPhoneDesc.textContent = `Player ${this.passAndPlayCurrentPlayer} called ${num}. Hand phone over to Player ${nextPlayer}.`;
      if (this.dom.modalPassPhone) this.dom.modalPassPhone.classList.remove('hidden');
    }, 600);
  }

  /**
   * Pass & Play device handoff continuation
   */
  onPassPhoneReady() {
    if (this.dom.modalPassPhone) this.dom.modalPassPhone.classList.add('hidden');

    if (this.status === 'arranging') {
      this.passAndPlayCurrentPlayer = 2;
      this.grid = generateRandomGrid();
      this.selectedCellIndex = null;
      this.isLocked = false;
      if (this.dom.btnLockBoard) this.dom.btnLockBoard.disabled = false;
      this._renderArrangeGrid();
      this.showToast('Player 2: Arrange your board & lock');
      return;
    }

    this.passAndPlayCurrentPlayer = this.passAndPlayCurrentPlayer === 1 ? 2 : 1;
    this.grid = this.passAndPlayCurrentPlayer === 1 ? this.passAndPlayGrid1 : this.passAndPlayGrid2;
    this.completedLines = this.passAndPlayCurrentPlayer === 1 ? [...this.passAndPlayLines1] : [...this.passAndPlayLines2];

    if (this.dom.gameOppName) this.dom.gameOppName.textContent = this.passAndPlayCurrentPlayer === 1 ? 'Player 2' : 'Player 1';
    if (this.dom.gameOppAvatar) this.dom.gameOppAvatar.textContent = this.passAndPlayCurrentPlayer === 1 ? '🐻' : '🦊';
    const oppLines = this.passAndPlayCurrentPlayer === 1 ? this.passAndPlayLines2.length : this.passAndPlayLines1.length;
    this._updateOpponentMiniBingo(oppLines);

    this.renderOverlay.clear();
    this._renderGameGrid();

    for (let i = 0; i < this.completedLines.length; i++) {
      const lineId = this.completedLines[i];
      const isRow = lineId.startsWith('r');
      const idx = Number(lineId.replace(/[^\d]/g, ''));
      const lineInfo = {
        id: lineId,
        type: isRow ? 'ROW' : 'COL',
        index: idx,
        order: i + 1,
        letter: 'BINGO'[i]
      };
      this.renderOverlay.animateLineStrike(lineInfo, true);
    }

    this._updateTurnBannerLocal(true, `Player ${this.passAndPlayCurrentPlayer}`);
    this._updateClaimButtonState();
  }

  /**
   * Mode 3: 2v2 Team Battle
   */
  startTeam2v2Match() {
    this.isTeam2v2 = true;
    this.isTournamentMatchMode = false;
    this.isPracticeBotMode = false;
    this.isPassAndPlay = false;
    this.botDifficulty = 'medium';
    this._setupLocalMatch('Team Orange (🐻+🐱)', '🐻', '2v2 Team Battle');
  }

  /**
   * Mode 4: Friend Challenge 1v1 Duel
   */
  startFriendDuel(friend) {
    this._unlockAudio();
    this._showMatchFoundVS(friend.name);
    setTimeout(() => {
      this.isTournamentMatchMode = false;
      this.isPracticeBotMode = true;
      this.isPassAndPlay = false;
      this.isTeam2v2 = false;
      this.botDifficulty = 'medium';
      this._setupLocalMatch(`${friend.name} (${friend.rank || 'Gold'})`, friend.avatar, `Duel vs ${friend.name}`);
    }, 1400);
  }

  /**
   * Mode 5: Cobalt Cup Knockout Tournament
   */
  playKnockoutRoundMatch() {
    const rounds = ['Quarterfinal', 'Semifinal', 'Grand Final'];
    const opps = [
      { name: 'QuantumBingo', avatar: '⚡' },
      { name: 'CyberNeon', avatar: '🦊' },
      { name: 'AstroViper', avatar: '👑' }
    ];
    const rIdx = Math.min(this.knockoutRoundIndex, 2);
    const opp = opps[rIdx];

    this.isTournamentMatchMode = true;
    this.currentTournamentType = 'KNOCKOUT';
    this.isPracticeBotMode = false;
    this.isPassAndPlay = false;
    this.botDifficulty = rIdx === 0 ? 'easy' : (rIdx === 1 ? 'medium' : 'hard');

    this._setupLocalMatch(`${opp.name} (${opp.avatar})`, opp.avatar, `Knockout ${rounds[rIdx]}`);
  }

  /**
   * Mode 6: Premier Bingo League
   */
  playLeagueFixtureMatch() {
    const opps = [
      { name: 'CyberNeon', avatar: '🦊' },
      { name: 'PixelStriker', avatar: '🎮' },
      { name: 'QuantumBingo', avatar: '⚡' },
      { name: 'AstroViper', avatar: '🚀' },
      { name: 'ThunderBolt', avatar: '⚡' },
      { name: 'ShadowRacer', avatar: '🥷' },
      { name: 'ViperKing', avatar: '👑' }
    ];
    const opp = opps[this.leagueFixtureIndex % opps.length];
    this.isTournamentMatchMode = true;
    this.currentTournamentType = 'LEAGUE';
    this.isPracticeBotMode = false;
    this.isPassAndPlay = false;
    this.botDifficulty = 'medium';

    this._setupLocalMatch(`${opp.name} (${opp.avatar})`, opp.avatar, `Premier League Match ${this.leagueFixtureIndex + 1}`);
  }

  /**
   * Mode 7: Practice vs Bot
   */
  startPracticeBotMatch(difficulty = 'easy') {
    this.isPracticeBotMode = true;
    this.isTournamentMatchMode = false;
    this.isPassAndPlay = false;
    this.isTeam2v2 = false;
    this.botDifficulty = difficulty;

    this._setupLocalMatch(`AI Bot (${difficulty.toUpperCase()})`, '🤖', `Practice Bot (${difficulty.toUpperCase()})`);
  }

  /**
   * Mode 8: Pass & Play
   */
  startPassAndPlayMatch() {
    this._unlockAudio();
    this.isOfflineMode = true;
    this.isPassAndPlay = true;
    this.isPracticeBotMode = false;
    this.isTournamentMatchMode = false;
    this.isTeam2v2 = false;
    this.passAndPlayCurrentPlayer = 1;
    this.passAndPlayGrid1 = null;
    this.passAndPlayGrid2 = null;
    this.passAndPlayLines1 = [];
    this.passAndPlayLines2 = [];
    this.markedNumbers.clear();
    this.completedLines = [];
    this.renderOverlay.clear();

    this.grid = generateRandomGrid();
    this.selectedCellIndex = null;
    this.isLocked = false;
    this._showScreen('arranging');
    this._renderArrangeGrid();
    if (this.dom.btnLockBoard) this.dom.btnLockBoard.disabled = false;
    this.showToast('Player 1: Arrange your board & lock', 'info');
  }

  /**
   * Mode 11: Friends IPL League
   */
  createFriendsLeague() {
    this.friendsLeagueFixtureIndex = 0;
    this.showToast('Friends IPL League created! Fixtures generated.', 'success');
    if (this.dom.friendsLeagueFixtureText) {
      this.dom.friendsLeagueFixtureText.textContent = 'Fixture 1: You vs CyberNeon';
    }
  }

  playFriendsLeagueMatch() {
    const opps = ['CyberNeon', 'PixelStriker', 'QuantumBingo', 'AstroViper'];
    const opp = opps[this.friendsLeagueFixtureIndex % opps.length];
    this.isTournamentMatchMode = true;
    this.currentTournamentType = 'FRIENDS_LEAGUE';
    this.botDifficulty = 'medium';
    this._setupLocalMatch(`${opp} (Friend)`, '👥', `Friends League Match ${this.friendsLeagueFixtureIndex + 1}`);
  }

  /**
   * Mode 12: Friends Elimination Cup
   */
  createFriendsKnockout() {
    this.friendsKoRoundIndex = 0;
    this.showToast('Friends Knockout bracket initialized!', 'success');
    if (this.dom.friendsKoRoundText) {
      this.dom.friendsKoRoundText.textContent = 'Quarterfinal: You vs AstroViper';
    }
  }

  playFriendsKoMatch() {
    const opps = ['AstroViper', 'ShadowRacer', 'QuantumBingo'];
    const opp = opps[Math.min(this.friendsKoRoundIndex, 2)];
    this.isTournamentMatchMode = true;
    this.currentTournamentType = 'FRIENDS_KNOCKOUT';
    this.botDifficulty = 'medium';
    this._setupLocalMatch(`${opp} (Friend)`, '🏆', `Friends Bracket Round ${this.friendsKoRoundIndex + 1}`);
  }

  /**
   * Mode 13: Friends Hybrid Tournament
   */
  createFriendsHybrid() {
    this.friendsHybridFixtureIndex = 0;
    this.friendsHybridStage = 'LEAGUE';
    this.showToast('Friends Hybrid Tournament launched! Stage 1: League Stage', 'success');
  }

  playFriendsHybridMatch() {
    const opps = ['ShadowRacer', 'ThunderBolt', 'PixelStriker', 'ViperKing'];
    const opp = opps[this.friendsHybridFixtureIndex % opps.length];
    this.isTournamentMatchMode = true;
    this.currentTournamentType = 'FRIENDS_HYBRID';
    this.botDifficulty = 'medium';
    this._setupLocalMatch(`${opp} (Hybrid)`, '🌟', `Hybrid Match ${this.friendsHybridFixtureIndex + 1}`);
  }

  _updateKnockoutBracketProgress(roundIndex) {
    const bracketContainers = [this.dom.knockoutModeBracket, this.dom.knockoutBracketContainer, this.dom.friendsKnockoutBracket];
    bracketContainers.forEach(container => {
      if (!container) return;
      const qfWin = container.querySelector('.bracket-round-column:first-child .match-player-row:first-child');
      if (qfWin) qfWin.classList.add('winner');
      if (roundIndex >= 1) {
        const sfWin = container.querySelector('.bracket-round-column:nth-child(2) .match-player-row:first-child');
        if (sfWin) sfWin.classList.add('winner');
      }
      if (roundIndex >= 2) {
        const finWin = container.querySelector('.bracket-round-column:nth-child(3) .match-player-row:first-child');
        if (finWin) finWin.classList.add('winner');
      }
    });
  }

  _updateLeagueTableOnWin() {
    if (!this.leagueStandings) return;
    const userRow = this.leagueStandings.find(r => r.name === 'You');
    if (userRow) {
      userRow.mp += 1;
      userRow.w += 1;
      userRow.pts += 2;
    }
    this.leagueStandings.sort((a, b) => b.pts - a.pts);
    this.leagueStandings.forEach((r, idx) => r.rank = idx + 1);

    this._renderLeagueTableData(this.dom.leagueTableBody, this.leagueStandings);
    this._renderLeagueTableData(this.dom.modeLeagueTable, this.leagueStandings);

    const opps = ['CyberNeon', 'PixelStriker', 'QuantumBingo', 'AstroViper', 'ThunderBolt', 'ShadowRacer', 'ViperKing'];
    const nextOpp = opps[this.leagueFixtureIndex % opps.length];
    if (this.dom.leagueCurrentFixtureText) {
      this.dom.leagueCurrentFixtureText.textContent = `Fixture ${this.leagueFixtureIndex + 1}: You vs ${nextOpp}`;
    }
  }

  _updateFriendsLeagueTableOnWin() {
    if (this.dom.friendsLeagueTableBody) {
      const tbody = this.dom.friendsLeagueTableBody.querySelector('tbody') || this.dom.friendsLeagueTableBody;
      const firstRow = tbody.querySelector('tr:first-child');
      if (firstRow) {
        const ptsCell = firstRow.querySelector('td:last-child');
        if (ptsCell) {
          const currentPts = Number(ptsCell.textContent.replace(/[^\d]/g, '')) || 0;
          ptsCell.innerHTML = `<strong>${currentPts + 2}</strong>`;
        }
      }
    }
    const opps = ['CyberNeon', 'PixelStriker', 'QuantumBingo', 'AstroViper'];
    const nextOpp = opps[this.friendsLeagueFixtureIndex % opps.length];
    if (this.dom.friendsLeagueFixtureText) {
      this.dom.friendsLeagueFixtureText.textContent = `Fixture ${this.friendsLeagueFixtureIndex + 1}: You vs ${nextOpp}`;
    }
  }

  _renderKnockoutBracketData(container, rounds) {
    if (!container || !rounds) return;
    container.innerHTML = '';
    rounds.forEach(round => {
      const col = document.createElement('div');
      col.className = 'bracket-round-column';

      const header = document.createElement('div');
      header.className = 'bracket-round-header';
      header.textContent = round.name;
      col.appendChild(header);

      round.matches.forEach(m => {
        const card = document.createElement('div');
        card.className = 'bracket-match-card';
        card.innerHTML = `
          <div class="match-player-row ${m.p1.winner ? 'winner' : ''}">
            <span>${m.p1.name}</span>
            <span class="match-score">${m.p1.score}</span>
          </div>
          <div class="match-player-row ${m.p2.winner ? 'winner' : ''}">
            <span>${m.p2.name}</span>
            <span class="match-score">${m.p2.score}</span>
          </div>
        `;
        col.appendChild(card);
      });
      container.appendChild(col);
    });
  }

  _renderLeagueTableData(tableEl, standings) {
    if (!tableEl || !standings) return;
    const tbody = tableEl.querySelector('tbody') || tableEl;
    tbody.innerHTML = '';
    standings.forEach(row => {
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

  _initDefaultModeData() {
    this.friendsList = [
      { id: 'f-1', name: 'Alex_Pro', avatar: '⚡', status: 'online', rank: 'Diamond' },
      { id: 'f-2', name: 'Rohit_99', avatar: '🦊', status: 'online', rank: 'Gold' },
      { id: 'f-3', name: 'LuckyStar', avatar: '⭐', status: 'in_game', rank: 'Platinum' },
      { id: 'f-4', name: 'GameViper', avatar: '🐍', status: 'offline', rank: 'Silver' }
    ];
    this._renderFriendsDirectory(this.friendsList);

    this.knockoutRounds = [
      {
        name: 'Quarterfinals',
        matches: [
          { p1: { name: 'You', score: 0 }, p2: { name: 'QuantumBingo', score: 0 } },
          { p1: { name: 'CyberNeon', score: 0 }, p2: { name: 'PixelStriker', score: 0 } },
          { p1: { name: 'AstroViper', score: 0 }, p2: { name: 'ThunderBolt', score: 0 } },
          { p1: { name: 'ShadowRacer', score: 0 }, p2: { name: 'ViperKing', score: 0 } }
        ]
      },
      {
        name: 'Semifinals',
        matches: [
          { p1: { name: 'TBD', score: '-' }, p2: { name: 'TBD', score: '-' } },
          { p1: { name: 'TBD', score: '-' }, p2: { name: 'TBD', score: '-' } }
        ]
      },
      {
        name: 'Grand Final',
        matches: [
          { p1: { name: 'TBD', score: '-' }, p2: { name: 'TBD', score: '-' } }
        ]
      }
    ];
    this._renderKnockoutBracketData(this.dom.knockoutBracketContainer, this.knockoutRounds);
    this._renderKnockoutBracketData(this.dom.knockoutModeBracket, this.knockoutRounds);
    this._renderKnockoutBracketData(this.dom.friendsKnockoutBracket, this.knockoutRounds);

    this.leagueStandings = [
      { rank: 1, avatar: '⚡', name: 'CyberNeon', mp: 1, w: 1, l: 0, pts: 2 },
      { rank: 2, avatar: '🦊', name: 'You', mp: 0, w: 0, l: 0, pts: 0 },
      { rank: 3, avatar: '🎮', name: 'PixelStriker', mp: 1, w: 0, l: 1, pts: 0 },
      { rank: 4, avatar: '🚀', name: 'AstroViper', mp: 0, w: 0, l: 0, pts: 0 },
      { rank: 5, avatar: '🥷', name: 'ShadowRacer', mp: 0, w: 0, l: 0, pts: 0 },
      { rank: 6, avatar: '👑', name: 'ViperKing', mp: 0, w: 0, l: 0, pts: 0 }
    ];
    this._renderLeagueTableData(this.dom.leagueTableBody, this.leagueStandings);
    this._renderLeagueTableData(this.dom.modeLeagueTable, this.leagueStandings);
    this._renderLeagueTableData(this.dom.friendsLeagueTableBody, this.leagueStandings);
    this._renderLeagueTableData(this.dom.friendsHybridTable, this.leagueStandings);
  }

  /**
   * Offline Mode (Mode 8)
   */
  startOfflineMatch(isPassAndPlay = false) {
    if (isPassAndPlay) {
      this.startPassAndPlayMatch();
    } else {
      this.startPracticeBotMatch('medium');
    }
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
      if (this.markedNumbers.has(num)) {
        this.showToast(`Number ${num} is already called.`);
        return;
      }

      if (this.isPassAndPlay) {
        this._handlePassAndPlayCall(num);
        return;
      }

      if (!this.isMyTurn) {
        this.showToast('Opponent is thinking...');
        return;
      }

      // Player calls number
      this._applyLocalNumber(num, 'player');

      if (this.completedLines.length >= 5) {
        // Player completed 5 lines! BINGO button ready
        return;
      }

      // Switch turn to Bot / Teammate
      this.isMyTurn = false;
      this._updateTurnBannerLocal(false, this.dom.gameOppName?.textContent || 'Opponent');

      clearTimeout(this.botThinkingTimer);
      const delay = this.botDifficulty === 'hard' ? 800 : (this.botDifficulty === 'medium' ? 1200 : 1600);
      this.botThinkingTimer = setTimeout(() => {
        if (this.status !== 'playing') return;
        const botNum = this._chooseBotMove(this.botDifficulty);
        this._applyLocalNumber(botNum, 'bot');

        // Check if Bot reached 5 lines
        if (this.botCompletedLines.length >= 5) {
          soundManager.playLineStroke(120);
          this._stopTimers();
          if (this.dom.resultEmoji) this.dom.resultEmoji.textContent = '👏';
          if (this.dom.resultTitle) this.dom.resultTitle.textContent = t('defeat') || 'Defeat';
          if (this.dom.resultDesc) this.dom.resultDesc.textContent = `${this.dom.gameOppName?.textContent || 'Opponent'} called BINGO first!`;
          this._showScreen('finished');
          return;
        }

        // Switch turn back to player
        this.isMyTurn = true;
        this._updateTurnBannerLocal(true);
      }, delay);

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
      soundManager.playVictory();
      this.confetti.burst(120);
      this._stopTimers();
      clearTimeout(this.botThinkingTimer);

      if (this.dom.resultEmoji) this.dom.resultEmoji.textContent = '🏆';
      if (this.dom.resultTitle) this.dom.resultTitle.textContent = t('victory') || 'Victory!';

      if (this.isPassAndPlay) {
        if (this.dom.resultDesc) this.dom.resultDesc.textContent = `Player ${this.passAndPlayCurrentPlayer} completed 5 B-I-N-G-O lines first!`;
      } else if (this.isPracticeBotMode) {
        if (this.dom.resultDesc) this.dom.resultDesc.textContent = `You defeated the AI Bot (${this.botDifficulty.toUpperCase()})!`;
        this.coinBalance += 50;
        this._updateWalletUI(this.coinBalance);
        this._saveLocalWin();
      } else if (this.isTournamentMatchMode) {
        this._handleTournamentMatchVictory();
      } else if (this.isTeam2v2) {
        if (this.dom.resultDesc) this.dom.resultDesc.textContent = 'Team Blue completed 5 B-I-N-G-O lines! Champions!';
        this.coinBalance += 150;
        this._updateWalletUI(this.coinBalance);
        this._saveLocalWin();
      } else {
        if (this.dom.resultDesc) this.dom.resultDesc.textContent = '5 Lines Completed Authority Verified.';
        this.coinBalance += 100;
        this._updateWalletUI(this.coinBalance);
        this._saveLocalWin();
      }

      this._showScreen('finished');
      return;
    }

    this.dom.bingoClaimBtn.className = 'bingo-claim-btn submitting';
    this.dom.bingoClaimBtn.disabled = true;
    if (this.dom.bingoBtnText) this.dom.bingoBtnText.textContent = 'VERIFYING...';
    this._send('claim_bingo', { claimId: `claim-${Date.now()}` });
  }

  _handleTournamentMatchVictory() {
    this._saveLocalWin();

    if (this.currentTournamentType === 'KNOCKOUT') {
      this.knockoutRoundIndex++;
      if (this.knockoutRoundIndex >= 3) {
        this.coinBalance += 2500;
        this._updateWalletUI(this.coinBalance);
        this.knockoutRoundIndex = 0;
        if (this.dom.resultTitle) this.dom.resultTitle.textContent = '🏆 TOURNAMENT CHAMPION!';
        if (this.dom.resultDesc) this.dom.resultDesc.textContent = 'You conquered the Cobalt Cup! +2,500 Coins Awarded!';
        if (this.dom.modeKoFixtureText) this.dom.modeKoFixtureText.textContent = 'Quarterfinal: You vs QuantumBingo';
      } else {
        const nextRound = this.knockoutRoundIndex === 1 ? 'Semifinal' : 'Grand Final';
        const nextOpp = this.knockoutRoundIndex === 1 ? 'CyberNeon' : 'AstroViper';
        if (this.dom.modeKoFixtureText) {
          this.dom.modeKoFixtureText.textContent = `${nextRound}: You vs ${nextOpp}`;
        }
        if (this.dom.resultTitle) this.dom.resultTitle.textContent = `${this.knockoutRoundIndex === 1 ? 'Quarterfinal' : 'Semifinal'} Won!`;
        if (this.dom.resultDesc) this.dom.resultDesc.textContent = `Advanced to ${nextRound}! Keep your streak alive!`;
        this.coinBalance += 200;
        this._updateWalletUI(this.coinBalance);
      }
      this._updateKnockoutBracketProgress(this.knockoutRoundIndex);
    } else if (this.currentTournamentType === 'LEAGUE') {
      this.leagueFixtureIndex++;
      this.coinBalance += 100;
      this._updateWalletUI(this.coinBalance);
      this._updateLeagueTableOnWin();
      if (this.dom.resultTitle) this.dom.resultTitle.textContent = 'League Match Won!';
      if (this.dom.resultDesc) this.dom.resultDesc.textContent = '+2 Points earned in Premier League standings!';
    } else if (this.currentTournamentType === 'FRIENDS_LEAGUE') {
      this.friendsLeagueFixtureIndex++;
      this._updateFriendsLeagueTableOnWin();
      if (this.dom.resultTitle) this.dom.resultTitle.textContent = 'Friends League Match Won!';
      if (this.dom.resultDesc) this.dom.resultDesc.textContent = '+Points earned on your Friends IPL table!';
    } else if (this.currentTournamentType === 'FRIENDS_KNOCKOUT') {
      this.friendsKoRoundIndex++;
      if (this.dom.resultTitle) this.dom.resultTitle.textContent = 'Bracket Match Won!';
      if (this.dom.resultDesc) this.dom.resultDesc.textContent = 'Eliminated opponent and advanced to next round!';
    } else if (this.currentTournamentType === 'FRIENDS_HYBRID') {
      this.friendsHybridFixtureIndex++;
      if (this.dom.resultTitle) this.dom.resultTitle.textContent = 'Hybrid Match Won!';
      if (this.dom.resultDesc) this.dom.resultDesc.textContent = 'Match recorded on Hybrid Tournament standings!';
    }
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
        challengeBtn.textContent = 'Dueling...';
        this.startFriendDuel(f);
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
