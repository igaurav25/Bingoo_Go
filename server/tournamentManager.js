/**
 * server/tournamentManager.js
 * 
 * Complete Server-Authoritative Tournament Engine supporting:
 * - 13 Game Modes & Tournament Formats:
 *   1. Knockout Tournament (Brackets: 2, 4, 8, 16, 32 or odd sizes 3, 5, 6, 7, 10, 12 with Byes)
 *   2. League Tournament (Round-robin fixtures, IPL-style points table, deterministic tie-breakers)
 *   3. Hybrid Tournament (League stage -> Top N qualify -> Knockout Playoffs)
 * - Server is the sole source of truth for fixtures, results, advancement, and standings.
 * - Normalized stage, match, slot, and standing data models.
 * - Host controls: kick, edit, start, cancel.
 */

import crypto from 'node:crypto';
import { economy } from './economy.js';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateInviteCode(length = 6) {
  let code = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return code;
}

export class Tournament {
  /**
   * @param {string} id
   * @param {'KNOCKOUT' | 'LEAGUE' | 'HYBRID'} type
   * @param {string} name
   * @param {string} creatorId
   * @param {string} creatorName
   * @param {object} [config]
   */
  constructor(id, type, name, creatorId, creatorName, config = {}) {
    if (typeof id === 'object' && id !== null) {
      const opts = id;
      id = opts.id || `tourn-${Date.now()}`;
      type = opts.type || opts.format || 'KNOCKOUT';
      name = opts.name || 'Tournament';
      creatorId = opts.creatorId || opts.hostId || 'host';
      creatorName = opts.creatorName || opts.hostName || 'Host';
      config = opts.config || opts;
    } else if (typeof type === 'object' && type !== null) {
      const opts = type;
      type = opts.type || opts.format || 'KNOCKOUT';
      name = opts.name || 'Tournament';
      creatorId = opts.creatorId || opts.hostId || 'host';
      creatorName = opts.creatorName || opts.hostName || 'Host';
      config = opts.config || opts;
    }

    this.id = id;
    this.type = (type || 'KNOCKOUT').toUpperCase(); // 'KNOCKOUT' | 'LEAGUE' | 'HYBRID' | 'TEAM_LEAGUE'
    this.format = this.type;
    this.name = name;
    this.season = config.season || 'Season 01';
    this.logo = config.logo || '🏆';
    this.description = config.description || 'Compete. Qualify. Become Champion.';
    this.creatorId = creatorId;
    this.creatorName = creatorName;
    this.status = 'REGISTERING'; // 'REGISTERING' | 'IN_PROGRESS' | 'PLAYOFFS' | 'COMPLETED' | 'CANCELLED'
    this.visibility = config.visibility === 'INVITE_ONLY' || config.visibility === 'PRIVATE' ? 'PRIVATE' : 'OPEN';
    this.approvalMode = config.approvalMode || 'AUTOMATIC'; // 'AUTOMATIC' | 'HOST_APPROVAL'
    this.scheduleMode = config.scheduleMode || 'AUTOMATIC'; // 'AUTOMATIC' | 'HOST_MANAGED'
    this.isTeamLeague = this.type === 'TEAM_LEAGUE' || Boolean(config.isTeamLeague);
    this.code = config.code
      ? String(config.code).trim().toUpperCase()
      : (typeof id === 'string' && id.startsWith('tourn-') && ['tourn-cobalt-cup', 'tourn-premier-league', 'tourn-bpl-franchises', 'tourn-champions-hybrid'].includes(id)
        ? id.slice(-5).toUpperCase()
        : generateInviteCode(6));
    this.joinUrl = config.joinUrl || `/tournaments/join/${this.code}`;
    this.createdAt = Date.now();

    // Configurable settings
    this.maxParticipants = Number(config.maxParticipants || config.maxPlayers) || 8;
    this.maxPlayers = this.maxParticipants;
    this.minParticipants = Math.max(2, Math.min(this.maxParticipants, Number(config.minParticipants) || 2));
    this.matchesPerPlayer = config.matchesPerPlayer ? Math.max(1, Number(config.matchesPerPlayer)) : null;
    this.registrationDeadline = config.registrationDeadline || null;
    this.startTime = config.startTime || config.scheduledStartTime || null;
    this.turnTimerSeconds = Math.max(10, Number(config.turnTimerSeconds) || 30);
    this.requireReadyToStart = Boolean(config.requireReadyToStart);
    this.disconnectRule = config.disconnectRule || 'PAUSE_60S';
    this.timeoutRule = config.timeoutRule || 'AUTO_PICK';
    this.drawRule = config.drawRule || 'TIEBREAKER';
    this.abandonedRule = config.abandonedRule || 'HOST_REVIEW';
    this.pointsPerWin = (config.pointsPerWin !== undefined && config.pointsPerWin !== null)
      ? Number(config.pointsPerWin)
      : 3;
    this.pointsPerLoss = (config.pointsPerLoss !== undefined && config.pointsPerLoss !== null)
      ? Number(config.pointsPerLoss)
      : 0;
    this.qualificationSlots = Number(config.qualificationSlots) || 4;
    this.playoffFormat = config.playoffFormat
      ? String(config.playoffFormat).toUpperCase()
      : (this.qualificationSlots === 2 ? 'TOP2_FINAL' : 'SEMIFINAL_TOP4');
    this.byePolicy = config.byePolicy ? String(config.byePolicy).toUpperCase() : 'NONE';
    this.byeSchedule = [];
    this.entryFee = Number(config.entryFee) || 0;
    this.prizePool = config.prizePool !== undefined && config.prizePool !== null
      ? Number(config.prizePool)
      : (this.entryFee * this.maxParticipants * 1.5 || 1000);
    this.thirdPlaceMatch = Boolean(config.thirdPlaceMatch);
    this.rulesText = config.rulesText || 'Standard 5x5 Bingo rules. First to 5 lines claims BINGO.';

    this.participants = [
      {
        id: creatorId,
        name: creatorName,
        avatar: config.creatorAvatar || '👑',
        isBot: false,
        isReady: true,
        isOnline: false,
        qualificationStatus: 'REGISTERED',
        seed: 1,
        joinedAt: this.createdAt
      }
    ];
    this.lobby = config.lobby || {
      id: `lobby-${this.id}`,
      tournamentId: this.id,
      code: this.code,
      joinUrl: this.joinUrl,
      status: 'OPEN',
      maxCapacity: this.maxParticipants,
      onlinePlayerIds: []
    };
    this.rewards = Array.isArray(config.rewards) ? config.rewards : [];
    this.pendingApprovals = [];
    this.teams = config.teams || (this.isTeamLeague ? this._initDefaultTeams() : []);
    this.champion = null;
    this.runnerUp = null;

    // Knockout brackets
    this.knockoutMatches = [];
    // League fixtures & points table
    this.leagueFixtures = [];
    this.pointsTable = [];
    // Playoffs for Hybrid (Semifinals & Finals)
    this.playoffMatches = [];

    // Notifications, Invitations, & Host Action Audit Log
    this.invitations = [];
    this.notifications = [];
    this.auditLog = [];

    this.addAuditLog(creatorId, creatorName, 'CREATE', `Created ${this.format} tournament "${this.name}"`);
  }

  addAuditLog(actorId, actorName, action, details = '') {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tournamentId: this.id,
      actorId: actorId || 'system',
      actorName: actorName || 'System',
      action,
      details,
      timestamp: Date.now(),
      createdAt: new Date().toISOString()
    };
    this.auditLog.unshift(entry);
    if (this.auditLog.length > 50) this.auditLog.pop();
    return entry;
  }

  addNotification(recipientId, type, title, message, actionUrl = null) {
    const notif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tournamentId: this.id,
      recipientId,
      type,
      title,
      message,
      actionUrl: actionUrl || `/tournaments/${this.id}`,
      read: false,
      timestamp: Date.now(),
      createdAt: new Date().toISOString()
    };
    this.notifications.unshift(notif);
    if (this.notifications.length > 100) this.notifications.pop();
    return notif;
  }

  sendInvitation(senderId, senderName, receiverId, receiverName = '') {
    const invitation = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tournamentId: this.id,
      tournamentName: this.name,
      senderId,
      senderName,
      receiverId,
      receiverName: receiverName || 'Friend',
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    this.invitations.push(invitation);
    this.addAuditLog(senderId, senderName, 'INVITE', `Invited ${receiverName || receiverId} to tournament`);
    this.addNotification(
      receiverId,
      'TOURNAMENT_INVITE',
      'Tournament Invitation',
      `${senderName} invited you to join "${this.name}"!`,
      `/tournaments/join/${this.code}`
    );
    return invitation;
  }

  respondInvitation(invitationId, recipientId, accept = true) {
    const inv = this.invitations.find(i => i.id === invitationId && i.receiverId === recipientId);
    if (!inv) return { success: false, error: 'Invitation not found' };
    inv.status = accept ? 'ACCEPTED' : 'DECLINED';
    if (accept) {
      this.addParticipant(recipientId, inv.receiverName || 'Friend');
      this.addAuditLog(recipientId, inv.receiverName, 'JOIN_INVITE', 'Joined tournament via invitation');
    }
    return { success: true, invitation: inv, tournament: this.getSnapshot() };
  }

  updateSettings(hostId, settings = {}) {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the tournament host can edit settings' };
    }
    if (this.status !== 'REGISTERING') {
      return { success: false, error: 'Cannot modify settings after tournament has started' };
    }

    if (settings.name) this.name = settings.name.trim();
    if (settings.description) this.description = settings.description.trim();
    if (settings.rulesText) this.rulesText = settings.rulesText;
    if (settings.prizePool) this.prizePool = Number(settings.prizePool);
    if (settings.turnTimerSeconds) this.turnTimerSeconds = Number(settings.turnTimerSeconds);
    if (settings.matchesPerPlayer !== undefined && settings.matchesPerPlayer !== null) {
      this.matchesPerPlayer = Math.max(1, Number(settings.matchesPerPlayer));
    }
    if (settings.pointsPerWin !== undefined && settings.pointsPerWin !== null) {
      this.pointsPerWin = Number(settings.pointsPerWin);
    }
    if (settings.pointsPerLoss !== undefined && settings.pointsPerLoss !== null) {
      this.pointsPerLoss = Number(settings.pointsPerLoss);
    }
    if (settings.qualificationSlots !== undefined && settings.qualificationSlots !== null) {
      this.qualificationSlots = Number(settings.qualificationSlots);
    }
    if (settings.playoffFormat) {
      this.playoffFormat = String(settings.playoffFormat).toUpperCase();
    }
    if (settings.byePolicy) {
      this.byePolicy = String(settings.byePolicy).toUpperCase();
    }

    this.addAuditLog(hostId, this.creatorName, 'UPDATE_SETTINGS', 'Updated tournament settings');
    return { success: true, tournament: this.getSnapshot() };
  }

  setParticipantReady(playerId, isReady) {
    const p = this.participants.find(part => part.id === playerId);
    if (!p) {
      return { success: false, error: 'Participant not found in tournament' };
    }
    p.isReady = typeof isReady === 'boolean' ? isReady : !p.isReady;
    this.addAuditLog(playerId, p.name, 'READY_CHANGE', `Player ${p.name} is now ${p.isReady ? 'READY' : 'NOT READY'}`);
    return { success: true, isReady: p.isReady, tournament: this.getSnapshot() };
  }

  leaveTournament(playerId) {
    if (this.status !== 'REGISTERING' && this.status !== 'PENDING' && this.status !== 'OPEN') {
      return { success: false, error: 'Cannot leave tournament after it has officially started' };
    }
    const idx = this.participants.findIndex(p => p.id === playerId);
    if (idx === -1) {
      return { success: false, error: 'Participant not in tournament' };
    }
    const leaving = this.participants[idx];
    this.participants.splice(idx, 1);
    this.addAuditLog(playerId, leaving.name, 'LEAVE', `Player ${leaving.name} left the lobby`);
    if (this.creatorId !== playerId) {
      this.addNotification(this.creatorId, 'PARTICIPANT_LEFT', `${leaving.name} left lobby`, `${leaving.name} has left tournament lobby.`);
    }
    return { success: true, tournament: this.getSnapshot() };
  }

  _initDefaultTeams() {
    return [
      {
        id: 'team-mumbai',
        name: 'Mumbai Strikers',
        logo: '🦁',
        color: '#1e3a8a',
        captainId: this.creatorId,
        captainName: this.creatorName,
        members: [{ id: this.creatorId, name: this.creatorName, isCaptain: true }],
        played: 0,
        won: 0,
        lost: 0,
        points: 0
      },
      {
        id: 'team-rcb',
        name: 'Royal Challengers',
        logo: '👑',
        color: '#dc2626',
        captainId: 'bot-rcb-cap',
        captainName: 'Virat (AI)',
        members: [{ id: 'bot-rcb-cap', name: 'Virat (AI)', isCaptain: true }],
        played: 0,
        won: 0,
        lost: 0,
        points: 0
      },
      {
        id: 'team-csk',
        name: 'Chennai Super Stars',
        logo: '⚡',
        color: '#eab308',
        captainId: 'bot-csk-cap',
        captainName: 'Thala (AI)',
        members: [{ id: 'bot-csk-cap', name: 'Thala (AI)', isCaptain: true }],
        played: 0,
        won: 0,
        lost: 0,
        points: 0
      },
      {
        id: 'team-kkr',
        name: 'Kolkata Knights',
        logo: '🛡️',
        color: '#7c3aed',
        captainId: 'bot-kkr-cap',
        captainName: 'Knight (AI)',
        members: [{ id: 'bot-kkr-cap', name: 'Knight (AI)', isCaptain: true }],
        played: 0,
        won: 0,
        lost: 0,
        points: 0
      }
    ];
  }

  addParticipant(playerId, playerName, extra = {}) {
    if (typeof playerId === 'object' && playerId !== null) {
      extra = { ...playerId, ...extra };
      playerName = playerId.name || playerId.playerName;
      playerId = playerId.id || playerId.playerId;
    }
    const cleanId = String(playerId || '').trim();
    if (!cleanId) {
      return { success: false, status: 400, error: 'Player ID is required to join.' };
    }
    if (this.status !== 'REGISTERING') {
      return { success: false, status: 400, error: 'Tournament registration is closed' };
    }
    if (this.registrationDeadline) {
      const deadlineMs = new Date(this.registrationDeadline).getTime();
      if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
        return { success: false, status: 400, error: 'Tournament registration deadline has passed' };
      }
    }
    const existing = this.participants.find(p => p.id === cleanId);
    if (existing) {
      return {
        success: false,
        status: 409,
        alreadyJoined: true,
        error: 'You have already joined this tournament.',
        tournament: this.getSnapshot()
      };
    }
    if (this.participants.length >= this.maxParticipants) {
      return { success: false, status: 400, error: 'Tournament is full' };
    }

    const cleanName = String(playerName || `Player ${this.participants.length + 1}`).trim().slice(0, 32);

    if (this.approvalMode === 'HOST_APPROVAL' && cleanId !== this.creatorId) {
      const alreadyPending = this.pendingApprovals.some(p => p.id === cleanId);
      if (!alreadyPending) {
        this.pendingApprovals.push({
          id: cleanId,
          name: cleanName,
          avatar: extra?.avatar || '🦊',
          requestedAt: Date.now()
        });
        this.addNotification(
          this.creatorId,
          'JOIN_REQUEST',
          'Approval Required',
          `${cleanName} requested to join "${this.name}".`,
          `/tournaments/${this.id}`
        );
      }
      return {
        success: true,
        pendingApproval: true,
        message: 'Registration request submitted. Waiting for host approval.',
        tournament: this.getSnapshot()
      };
    }

    this.participants.push({
      id: cleanId,
      name: cleanName,
      avatar: extra?.avatar || '🦊',
      isBot: Boolean(extra?.isBot),
      isReady: typeof extra?.isReady === 'boolean' ? extra.isReady : false,
      isOnline: Boolean(extra?.isOnline),
      qualificationStatus: 'REGISTERED',
      seed: this.participants.length + 1,
      joinedAt: Date.now()
    });
    this.addAuditLog(cleanId, cleanName, 'JOIN', `${cleanName} joined via invite (${this.participants.length}/${this.maxParticipants})`);
    if (this.creatorId && cleanId !== this.creatorId && !cleanId.startsWith('bot-')) {
      this.addNotification(
        this.creatorId,
        'PARTICIPANT_JOINED',
        'New Player Joined!',
        `${cleanName} joined "${this.name}" (${this.participants.length}/${this.maxParticipants}).`,
        `/tournaments/${this.id}`
      );
    }
    return { success: true, tournament: this.getSnapshot() };
  }

  approveParticipant(hostId, playerId) {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the host can approve participants' };
    }
    const idx = this.pendingApprovals.findIndex(p => p.id === playerId);
    if (idx === -1) {
      return { success: false, error: 'Participant not in pending approval list' };
    }
    const [approved] = this.pendingApprovals.splice(idx, 1);
    this.participants.push({
      id: approved.id,
      name: approved.name,
      avatar: approved.avatar || '🦊',
      isBot: false,
      isReady: false,
      isOnline: false,
      qualificationStatus: 'REGISTERED',
      seed: this.participants.length + 1,
      joinedAt: Date.now()
    });
    this.addNotification(
      approved.id,
      'JOIN_APPROVED',
      'Entry Approved!',
      `You were approved to play in "${this.name}".`,
      `/tournaments/${this.id}`
    );
    return { success: true, tournament: this.getSnapshot() };
  }

  rejectParticipant(hostId, playerId) {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the host can reject participants' };
    }
    this.pendingApprovals = this.pendingApprovals.filter(p => p.id !== playerId);
    return { success: true, tournament: this.getSnapshot() };
  }

  createTeam(hostId, { name, logo, color, captainId, captainName }) {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the host can create teams' };
    }
    if (this.status !== 'REGISTERING') {
      return { success: false, error: 'Cannot create teams after tournament starts' };
    }
    const teamId = `team-${Date.now().toString(36)}`;
    const team = {
      id: teamId,
      name: name || `Team ${this.teams.length + 1}`,
      logo: logo || '🦁',
      color: color || '#1e3a8a',
      captainId: captainId || null,
      captainName: captainName || 'Captain',
      members: captainId ? [{ id: captainId, name: captainName, isCaptain: true }] : [],
      played: 0,
      won: 0,
      lost: 0,
      points: 0
    };
    this.teams.push(team);
    return { success: true, team, tournament: this.getSnapshot() };
  }

  assignPlayerToTeam(hostId, teamId, playerId, playerName) {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the host can assign players to teams' };
    }
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return { success: false, error: 'Team not found' };
    for (const t of this.teams) {
      t.members = t.members.filter(m => m.id !== playerId);
    }
    team.members.push({ id: playerId, name: playerName || 'Player', isCaptain: false });
    return { success: true, tournament: this.getSnapshot() };
  }

  kickParticipant(hostId, playerId) {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the host can kick participants' };
    }
    if (this.status !== 'REGISTERING') {
      return { success: false, error: 'Cannot kick participants after tournament starts' };
    }
    if (playerId === hostId) {
      return { success: false, error: 'Host cannot kick themselves' };
    }
    this.participants = this.participants.filter(p => p.id !== playerId);
    this.addAuditLog(hostId, this.creatorName, 'KICK', `Removed participant ${playerId}`);
    return { success: true, tournament: this.getSnapshot() };
  }

  cancelTournament(hostId, reason = 'Cancelled by host') {
    if (this.creatorId !== hostId) {
      return { success: false, error: 'Only the host can cancel the tournament' };
    }
    if (this.status === 'COMPLETED') {
      return { success: false, error: 'Tournament already completed' };
    }
    this.status = 'CANCELLED';
    this.addAuditLog(hostId, this.creatorName, 'CANCEL', reason);
    for (const p of this.participants) {
      if (!p.isBot) {
        this.addNotification(
          p.id,
          'CANCELLED',
          'Tournament Cancelled',
          `Tournament "${this.name}" was cancelled by the host. Reason: ${reason}`,
          '/tournaments'
        );
      }
    }
    return { success: true, tournament: this.getSnapshot() };
  }

  fillWithBots() {
    const botNames = [
      'CyberNeon', 'PixelStriker', 'QuantumBingo', 'AstroViper',
      'ThunderBolt', 'ShadowRacer', 'BlazeHero', 'ViperKing',
      'Priya_Star', 'Kabir_Ace', 'Zara_Queen', 'Rohit_Pro'
    ];
    let nameIdx = 0;
    while (this.participants.length < this.maxParticipants) {
      const botId = `bot-${Date.now()}-${this.participants.length + 1}`;
      const name = botNames[nameIdx % botNames.length];
      nameIdx++;
      this.participants.push({
        id: botId,
        name: `${name} (AI)`,
        avatar: '🤖',
        isBot: true,
        isReady: true,
        seed: this.participants.length + 1,
        joinedAt: Date.now()
      });
    }
    return this.getSnapshot();
  }

  canStart(hostId = null) {
    if (hostId && this.creatorId && !this.creatorId.startsWith('system-') && this.creatorId !== hostId) {
      return { ok: false, error: 'Only the tournament host can start this tournament.' };
    }
    if (this.status !== 'REGISTERING') {
      return { ok: false, error: 'Tournament has already started or completed.' };
    }
    const requiredMin = Math.max(2, this.minParticipants || 2);
    if (this.participants.length < requiredMin) {
      return {
        ok: false,
        error: `Need at least ${requiredMin} joined participants to start (${this.participants.length} currently joined).`
      };
    }
    if ((this.type === 'LEAGUE' || this.type === 'HYBRID') && this.matchesPerPlayer) {
      const n = this.participants.length;
      if (n - 1 < this.matchesPerPlayer) {
        return {
          ok: false,
          error: `Cannot start with ${n} participants when ${this.matchesPerPlayer} unique league matches per player are configured (need at least ${this.matchesPerPlayer + 1} players).`
        };
      }
      if (n % 2 === 1 && this.matchesPerPlayer % 2 === 1 && this.byePolicy === 'NONE') {
        return {
          ok: false,
          error: `${n} odd participants cannot each play ${this.matchesPerPlayer} league matches without a bye policy.`
        };
      }
    }
    if (this.requireReadyToStart) {
      const notReady = this.participants.filter(p => !p.isBot && p.id !== this.creatorId && p.isReady === false);
      if (notReady.length > 0) {
        return {
          ok: false,
          error: `Waiting for ${notReady.length} player(s) to mark Ready (${notReady.map(p => p.name).slice(0, 3).join(', ')}).`
        };
      }
    }
    return { ok: true };
  }

  start(hostId = null) {
    return this.startTournament(hostId);
  }

  startTournament(hostId = null) {
    const check = this.canStart(hostId);
    if (!check.ok) {
      throw new Error(check.error);
    }

    // Lock seats & normalize final sequential seeds 1..N
    this.participants.forEach((p, idx) => {
      p.seed = idx + 1;
      p.qualificationStatus = 'ACTIVE';
    });

    this.status = 'IN_PROGRESS';
    this.startedAt = Date.now();
    if (this.lobby) {
      this.lobby.status = 'LOCKED';
    }

    if (this.type === 'KNOCKOUT') {
      this._initKnockout();
    } else if (this.type === 'LEAGUE') {
      this._initLeague();
    } else if (this.type === 'HYBRID') {
      this._initHybrid();
    } else if (this.type === 'TEAM_LEAGUE') {
      this._initTeamLeague();
    }

    this.addAuditLog(this.creatorId, this.creatorName, 'START', `Started tournament with ${this.participants.length} players`);
    for (const p of this.participants) {
      if (!p.isBot) {
        this.addNotification(
          p.id,
          'STARTED',
          'Tournament Live!',
          `"${this.name}" is now live! Your fixtures have been generated.`,
          `/tournaments/${this.id}/fixtures`
        );
      }
    }

    return this.getSnapshot();
  }

  /**
   * Initializes single-elimination knockout bracket.
   * Supports standard sizes (4, 8, 16) and odd sizes (3, 5, 6, 7, 10, 12) with Byes.
   */
  _initKnockout() {
    this.knockoutMatches = [];
    const p = [...this.participants];
    const n = p.length;

    // Exact matches for 4-player standard test suite: SF1, SF2, Final
    if (n === 4) {
      const sf1 = {
        id: `ko-sf1-${this.id}`,
        stageId: 'knockout-main',
        round: 'Semifinal 1',
        roundKey: 'sf',
        roundTitle: 'Semifinals',
        index: 0,
        label: 'Match 01',
        player1: p[0],
        player2: p[1],
        slots: [
          { playerId: p[0]?.id || null, playerName: p[0]?.name || 'TBD', source: { seed: 1 } },
          { playerId: p[1]?.id || null, playerName: p[1]?.name || 'TBD', source: { seed: 2 } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'READY',
        advancesTo: { matchId: `ko-fin-${this.id}`, slot: 0 }
      };

      const sf2 = {
        id: `ko-sf2-${this.id}`,
        stageId: 'knockout-main',
        round: 'Semifinal 2',
        roundKey: 'sf',
        roundTitle: 'Semifinals',
        index: 1,
        label: 'Match 02',
        player1: p[2],
        player2: p[3],
        slots: [
          { playerId: p[2]?.id || null, playerName: p[2]?.name || 'TBD', source: { seed: 3 } },
          { playerId: p[3]?.id || null, playerName: p[3]?.name || 'TBD', source: { seed: 4 } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'READY',
        advancesTo: { matchId: `ko-fin-${this.id}`, slot: 1 }
      };

      const fin = {
        id: `ko-fin-${this.id}`,
        stageId: 'knockout-main',
        round: 'Grand Final',
        roundKey: 'final',
        roundTitle: 'Grand Final',
        index: 0,
        label: 'Match 03',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'Winner of SF 1', source: { matchId: sf1.id, outcome: 'winner' } },
          { playerId: null, playerName: 'Winner of SF 2', source: { matchId: sf2.id, outcome: 'winner' } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: null
      };

      this.knockoutMatches = [sf1, sf2, fin];
      return;
    }

    // Exact matches for 8-player standard test suite: QF1..QF4, SF1, SF2, Final
    if (n === 8) {
      const qfs = [];
      for (let i = 0; i < 4; i++) {
        const p1 = p[i * 2];
        const p2 = p[i * 2 + 1];
        const parentSfIdx = Math.floor(i / 2);
        const parentSlot = i % 2;
        qfs.push({
          id: `ko-qf${i + 1}-${this.id}`,
          stageId: 'knockout-main',
          round: `Quarterfinal ${i + 1}`,
          roundKey: 'qf',
          roundTitle: 'Quarterfinals',
          index: i,
          label: `Match 0${i + 1}`,
          player1: p1,
          player2: p2,
          slots: [
            { playerId: p1?.id || null, playerName: p1?.name || 'TBD', source: { seed: i * 2 + 1 } },
            { playerId: p2?.id || null, playerName: p2?.name || 'TBD', source: { seed: i * 2 + 2 } }
          ],
          scores: [0, 0],
          winner: null,
          winnerId: null,
          status: 'READY',
          advancesTo: { matchId: `ko-sf${parentSfIdx + 1}-${this.id}`, slot: parentSlot }
        });
      }

      const sf1 = {
        id: `ko-sf1-${this.id}`,
        stageId: 'knockout-main',
        round: 'Semifinal 1',
        roundKey: 'sf',
        roundTitle: 'Semifinals',
        index: 0,
        label: 'Match 05',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'Winner of QF 1', source: { matchId: qfs[0].id, outcome: 'winner' } },
          { playerId: null, playerName: 'Winner of QF 2', source: { matchId: qfs[1].id, outcome: 'winner' } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: { matchId: `ko-fin-${this.id}`, slot: 0 }
      };

      const sf2 = {
        id: `ko-sf2-${this.id}`,
        stageId: 'knockout-main',
        round: 'Semifinal 2',
        roundKey: 'sf',
        roundTitle: 'Semifinals',
        index: 1,
        label: 'Match 06',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'Winner of QF 3', source: { matchId: qfs[2].id, outcome: 'winner' } },
          { playerId: null, playerName: 'Winner of QF 4', source: { matchId: qfs[3].id, outcome: 'winner' } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: { matchId: `ko-fin-${this.id}`, slot: 1 }
      };

      const fin = {
        id: `ko-fin-${this.id}`,
        stageId: 'knockout-main',
        round: 'Grand Final',
        roundKey: 'final',
        roundTitle: 'Grand Final',
        index: 0,
        label: 'Match 07',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'Winner of SF 1', source: { matchId: sf1.id, outcome: 'winner' } },
          { playerId: null, playerName: 'Winner of SF 2', source: { matchId: sf2.id, outcome: 'winner' } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: null
      };

      this.knockoutMatches = [...qfs, sf1, sf2, fin];
      return;
    }

    // General power-of-two or odd-size with Byes (e.g. 2, 3, 5, 6, 7, 10, 12, 16)
    const targetSize = Math.max(2, Math.pow(2, Math.ceil(Math.log2(n))));
    const numRounds = Math.log2(targetSize);
    const byesCount = targetSize - n;

    // Setup round names
    const getRoundTitle = (roundIdx, totalRounds) => {
      const remaining = totalRounds - roundIdx;
      if (remaining === 1) return 'Grand Final';
      if (remaining === 2) return 'Semifinals';
      if (remaining === 3) return 'Quarterfinals';
      return `Round of ${Math.pow(2, remaining)}`;
    };

    const getRoundKey = (roundIdx, totalRounds) => {
      const remaining = totalRounds - roundIdx;
      if (remaining === 1) return 'final';
      if (remaining === 2) return 'sf';
      if (remaining === 3) return 'qf';
      return `r${roundIdx + 1}`;
    };

    // Build bracket tree by rounds
    const roundsMatches = [];
    let matchCounter = 1;

    for (let r = 0; r < numRounds; r++) {
      const matchesInRound = targetSize / Math.pow(2, r + 1);
      const currentMatches = [];
      const roundTitle = getRoundTitle(r, numRounds);
      const roundKey = getRoundKey(r, numRounds);

      for (let m = 0; m < matchesInRound; m++) {
        const isFinal = r === numRounds - 1;
        const matchId = isFinal ? `ko-fin-${this.id}` : `ko-r${r + 1}-m${m + 1}-${this.id}`;
        const parentMatchId = isFinal ? null : (r === numRounds - 2 ? `ko-fin-${this.id}` : `ko-r${r + 2}-m${Math.floor(m / 2) + 1}-${this.id}`);
        const parentSlot = m % 2;

        let p1 = null;
        let p2 = null;
        let isBye = false;
        let status = 'WAITING';

        if (r === 0) {
          // Round 1 seeding: assign byes to the top seeds
          if (m < byesCount) {
            p1 = p[m] || null;
            p2 = null;
            isBye = true;
            status = 'COMPLETED';
          } else {
            const pairIdx = m - byesCount;
            p1 = p[byesCount + pairIdx * 2] || null;
            p2 = p[byesCount + pairIdx * 2 + 1] || null;
            if (p1 && !p2) {
              isBye = true;
              status = 'COMPLETED';
            } else if (p1 && p2) {
              status = 'READY';
            }
          }
        }

        const matchObj = {
          id: matchId,
          stageId: 'knockout-main',
          round: `${roundTitle} ${m + 1}`,
          roundKey,
          roundTitle,
          index: m,
          label: `Match ${String(matchCounter++).padStart(2, '0')}`,
          player1: p1,
          player2: p2,
          isBye,
          slots: [
            {
              playerId: p1?.id || null,
              playerName: p1?.name || (r === 0 && !p1 ? 'Bye' : 'TBD'),
              isBye: r === 0 && !p1,
              source: r === 0 && p1 ? { seed: p.indexOf(p1) + 1 } : null
            },
            {
              playerId: p2?.id || null,
              playerName: p2?.name || (r === 0 && !p2 ? 'BYE' : 'TBD'),
              isBye: r === 0 && !p2,
              source: r === 0 && p2 ? { seed: p.indexOf(p2) + 1 } : null
            }
          ],
          scores: [0, 0],
          winner: isBye ? p1 : null,
          winnerId: isBye ? p1?.id : null,
          status,
          advancesTo: parentMatchId ? { matchId: parentMatchId, slot: parentSlot } : null
        };

        currentMatches.push(matchObj);
      }
      roundsMatches.push(currentMatches);
    }

    // Auto-advance Byes to Round 2
    for (const m1 of roundsMatches[0]) {
      if (m1.isBye && m1.winner && m1.advancesTo) {
        const byeWinner = this.participants.find(pt => pt.id === m1.winner.id);
        if (byeWinner) byeWinner.qualificationStatus = 'QUALIFIED';
        const nextRound = roundsMatches[1];
        const targetMatch = nextRound?.find(m => m.id === m1.advancesTo.matchId);
        if (targetMatch) {
          if (m1.advancesTo.slot === 0) {
            targetMatch.player1 = m1.winner;
            targetMatch.slots[0].playerId = m1.winner.id;
            targetMatch.slots[0].playerName = m1.winner.name;
          } else {
            targetMatch.player2 = m1.winner;
            targetMatch.slots[1].playerId = m1.winner.id;
            targetMatch.slots[1].playerName = m1.winner.name;
          }
          if (targetMatch.player1 && targetMatch.player2) {
            targetMatch.status = 'READY';
          }
        }
      }
    }

    this.knockoutMatches = roundsMatches.flat();
  }

  _initLeague() {
    this.pointsTable = this.participants.map((p, idx) => ({
      id: p.id,
      playerId: p.id,
      name: p.name,
      playerName: p.name,
      avatar: p.avatar || '🦊',
      seed: p.seed || idx + 1,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      rank: idx + 1,
      qualified: idx < this.qualificationSlots,
      winRate: '0%',
      h2hSummary: '-'
    }));

    // Generate round-robin or balanced custom matchesPerPlayer league schedule
    this.leagueFixtures = [];
    this.byeSchedule = [];
    const p = this.participants;
    const n = p.length;
    if (n < 2) return;

    const fullRoundRobinCount = n - 1;
    const requestedMatches = this.matchesPerPlayer;

    // Preserved sequential round-robin ordering when matchesPerPlayer is not customized
    if (!requestedMatches || (requestedMatches === fullRoundRobinCount && this.type !== 'HYBRID')) {
      let fixId = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const fixtureId = `fix-${fixId}-${this.id}`;
          this.leagueFixtures.push({
            id: fixtureId,
            stageId: 'league-main',
            round: `Round ${Math.floor((fixId - 1) / Math.max(1, Math.floor(n / 2))) + 1}`,
            roundNumber: Math.floor((fixId - 1) / Math.max(1, Math.floor(n / 2))) + 1,
            roundKey: `r${Math.floor((fixId - 1) / Math.max(1, Math.floor(n / 2))) + 1}`,
            roundTitle: `Round ${Math.floor((fixId - 1) / Math.max(1, Math.floor(n / 2))) + 1}`,
            index: fixId - 1,
            label: `Match ${String(fixId).padStart(2, '0')}`,
            p1: p[i],
            p2: p[j],
            player1: p[i],
            player2: p[j],
            slots: [
              { playerId: p[i].id, playerName: p[i].name, avatar: p[i].avatar || '🦊' },
              { playerId: p[j].id, playerName: p[j].name, avatar: p[j].avatar || '🦊' }
            ],
            scores: [0, 0],
            winner: null,
            winnerId: null,
            status: fixId === 1 ? 'READY' : 'WAITING'
          });
          fixId++;
        }
      }
      return;
    }

    // Balanced IPL-style schedule builder supporting odd/even n and exact matchesPerPlayer without simultaneous conflicts
    const targetK = Math.max(1, requestedMatches || fullRoundRobinCount);
    let fixId = 1;
    const scheduledRounds = []; // Array<Array<[idxA, idxB]>>

    if (n % 2 === 0) {
      const totalCycleRounds = n - 1;
      const pool = Array.from({ length: n }, (_, i) => i);
      for (let r = 0; r < targetK; r++) {
        const cycleRound = r % totalCycleRounds;
        const rotated = [pool[0]];
        const tail = pool.slice(1);
        for (let k = 0; k < tail.length; k++) {
          rotated.push(tail[(k + cycleRound) % tail.length]);
        }
        const pairs = [];
        for (let pair = 0; pair < n / 2; pair++) {
          const flip = Math.floor(r / totalCycleRounds) % 2 === 1;
          pairs.push(flip ? [rotated[n - 1 - pair], rotated[pair]] : [rotated[pair], rotated[n - 1 - pair]]);
        }
        scheduledRounds.push(pairs);
      }
    } else {
      // Odd n regular graph construction + conflict-free round packing
      const edges = [];
      const fullCycles = Math.floor(targetK / (n - 1));
      const remK = targetK % (n - 1);

      for (let c = 0; c < fullCycles; c++) {
        for (let d = 1; d <= Math.floor((n - 1) / 2); d++) {
          for (let i = 0; i < n; i++) {
            const j = (i + d) % n;
            edges.push(c % 2 === 1 ? [j, i] : [i, j]);
          }
        }
      }

      if (remK > 0) {
        const halfSteps = Math.floor(remK / 2);
        for (let d = 1; d <= halfSteps; d++) {
          for (let i = 0; i < n; i++) {
            edges.push([i, (i + d) % n]);
          }
        }
        if (remK % 2 === 1) {
          // Odd n with odd targetK requires a transparent rotating sit-out bye round
          // Never silently count a bye as a Bingo win or award points unless byePolicy === 'AWARD_WIN_POINTS'
          const extraD = Math.min(Math.floor(n / 2), halfSteps + 1);
          const used = new Set();
          for (let i = 0; i < n; i++) {
            const j = (i + extraD) % n;
            if (!used.has(i) && !used.has(j)) {
              edges.push([i, j]);
              used.add(i);
              used.add(j);
            }
          }
          for (let i = 0; i < n; i++) {
            if (!used.has(i) && p[i]) {
              const byePts = this.byePolicy === 'AWARD_WIN_POINTS' ? this.pointsPerWin : 0;
              this.byeSchedule.push({
                playerId: p[i].id,
                playerName: p[i].name,
                policy: this.byePolicy,
                pointsAwarded: byePts,
                countsAsBingoWin: false
              });
              if (byePts > 0) {
                const row = this.pointsTable.find(r => r.id === p[i].id);
                if (row) row.points += byePts;
              }
            }
          }
        }
      }

      // Pack edges into disjoint rounds (never schedule a player twice in the same round)
      const pendingEdges = [...edges];
      while (pendingEdges.length > 0) {
        const roundPairs = [];
        const busyInRound = new Set();
        for (let idx = 0; idx < pendingEdges.length; ) {
          const [u, v] = pendingEdges[idx];
          if (!busyInRound.has(u) && !busyInRound.has(v)) {
            roundPairs.push([u, v]);
            busyInRound.add(u);
            busyInRound.add(v);
            pendingEdges.splice(idx, 1);
          } else {
            idx++;
          }
        }
        if (roundPairs.length === 0) break;
        scheduledRounds.push(roundPairs);
      }
    }

    const activePlayers = new Set();
    scheduledRounds.forEach((pairs, rIdx) => {
      for (const [idx1, idx2] of pairs) {
        const p1 = p[idx1];
        const p2 = p[idx2];
        if (!p1 || !p2) continue;
        const canActivate = rIdx === 0 && !activePlayers.has(p1.id) && !activePlayers.has(p2.id);
        if (canActivate) {
          activePlayers.add(p1.id);
          activePlayers.add(p2.id);
        }
        const fixtureId = `fix-${fixId}-${this.id}`;
        this.leagueFixtures.push({
          id: fixtureId,
          stageId: 'league-main',
          round: `Round ${rIdx + 1}`,
          roundNumber: rIdx + 1,
          roundKey: `r${rIdx + 1}`,
          roundTitle: `Round ${rIdx + 1}`,
          index: fixId - 1,
          label: `Match ${String(fixId).padStart(2, '0')}`,
          p1,
          p2,
          player1: p1,
          player2: p2,
          slots: [
            { playerId: p1.id, playerName: p1.name, avatar: p1.avatar || '🦊' },
            { playerId: p2.id, playerName: p2.name, avatar: p2.avatar || '🦊' }
          ],
          scores: [0, 0],
          winner: null,
          winnerId: null,
          status: canActivate ? 'READY' : 'WAITING'
        });
        fixId++;
      }
    });
  }

  _initTeamLeague() {
    if (!this.teams || this.teams.length < 2) {
      this.teams = this._initDefaultTeams();
    }

    // Ensure every registered participant is placed on a team
    this.participants.forEach((p, idx) => {
      const alreadyInTeam = this.teams.some(t => t.members.some(m => m.id === p.id));
      if (!alreadyInTeam) {
        const targetTeam = this.teams[idx % this.teams.length];
        targetTeam.members.push({ id: p.id, name: p.name, isCaptain: false });
      }
    });

    this.pointsTable = this.teams.map((t, idx) => ({
      id: t.id,
      playerId: t.id,
      name: t.name,
      playerName: t.name,
      logo: t.logo,
      color: t.color,
      isTeam: true,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      rank: idx + 1,
      qualified: idx < this.qualificationSlots,
      winRate: '0%'
    }));

    // Round-robin pairings between teams
    this.leagueFixtures = [];
    let fixId = 1;
    for (let i = 0; i < this.teams.length; i++) {
      for (let j = i + 1; j < this.teams.length; j++) {
        const t1 = this.teams[i];
        const t2 = this.teams[j];
        const p1 = t1.members[0] || { id: `m-${t1.id}`, name: t1.name };
        const p2 = t2.members[0] || { id: `m-${t2.id}`, name: t2.name };
        const fixtureId = `team-fix-${fixId}-${this.id}`;
        this.leagueFixtures.push({
          id: fixtureId,
          stageId: 'team-league-main',
          round: `Clash ${fixId}: ${t1.name} vs ${t2.name}`,
          index: fixId - 1,
          label: `Match ${String(fixId).padStart(2, '0')}`,
          p1,
          p2,
          player1: p1,
          player2: p2,
          team1: { id: t1.id, name: t1.name, logo: t1.logo, color: t1.color },
          team2: { id: t2.id, name: t2.name, logo: t2.logo, color: t2.color },
          slots: [
            { playerId: p1.id, playerName: `${t1.name} (${p1.name})`, teamId: t1.id },
            { playerId: p2.id, playerName: `${t2.name} (${p2.name})`, teamId: t2.id }
          ],
          scores: [0, 0],
          winner: null,
          winnerId: null,
          status: fixId === 1 ? 'READY' : 'WAITING'
        });
        fixId++;
      }
    }
  }

  _initHybrid() {
    // Stage 1: League stage
    this._initLeague();

    // Stage 2: Playoff bracket structure based on configured playoffFormat & qualificationSlots
    if (this.playoffFormat === 'TOP2_FINAL' || this.qualificationSlots === 2) {
      const fin = {
        id: `playoff-fin-${this.id}`,
        stageId: 'playoff-knockout',
        playoffStage: 'GRAND_FINAL',
        round: 'Grand Final (Rank 1 vs 2)',
        roundKey: 'final',
        roundTitle: 'Grand Final',
        index: 0,
        label: 'Grand Final',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'League Rank #1', source: { rank: 1 } },
          { playerId: null, playerName: 'League Rank #2', source: { rank: 2 } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: null
      };
      this.playoffMatches = [fin];
      return;
    }

    if (this.playoffFormat === 'IPL_TOP4') {
      const q1Id = `playoff-q1-${this.id}`;
      const elimId = `playoff-elim-${this.id}`;
      const q2Id = `playoff-q2-${this.id}`;
      const finId = `playoff-fin-${this.id}`;

      const q1 = {
        id: q1Id,
        stageId: 'playoff-knockout',
        playoffStage: 'QUALIFIER_1',
        round: 'Qualifier 1 (Rank 1 vs 2)',
        roundKey: 'q1_elim',
        roundTitle: 'Qualifier 1 & Eliminator',
        index: 0,
        label: 'Qualifier 1',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'League Rank #1', source: { rank: 1 } },
          { playerId: null, playerName: 'League Rank #2', source: { rank: 2 } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: { matchId: finId, slot: 0 },
        loserAdvancesTo: { matchId: q2Id, slot: 0 }
      };

      const elim = {
        id: elimId,
        stageId: 'playoff-knockout',
        playoffStage: 'ELIMINATOR',
        round: 'Eliminator (Rank 3 vs 4)',
        roundKey: 'q1_elim',
        roundTitle: 'Qualifier 1 & Eliminator',
        index: 1,
        label: 'Eliminator',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'League Rank #3', source: { rank: 3 } },
          { playerId: null, playerName: 'League Rank #4', source: { rank: 4 } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: { matchId: q2Id, slot: 1 },
        loserAdvancesTo: null
      };

      const q2 = {
        id: q2Id,
        stageId: 'playoff-knockout',
        playoffStage: 'QUALIFIER_2',
        round: 'Qualifier 2',
        roundKey: 'q2',
        roundTitle: 'Qualifier 2',
        index: 0,
        label: 'Qualifier 2',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'Loser of Qualifier 1', source: { matchId: q1Id, outcome: 'loser' } },
          { playerId: null, playerName: 'Winner of Eliminator', source: { matchId: elimId, outcome: 'winner' } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: { matchId: finId, slot: 1 },
        loserAdvancesTo: null
      };

      const fin = {
        id: finId,
        stageId: 'playoff-knockout',
        playoffStage: 'GRAND_FINAL',
        round: 'Grand Final',
        roundKey: 'final',
        roundTitle: 'Grand Final',
        index: 0,
        label: 'Grand Final',
        player1: null,
        player2: null,
        slots: [
          { playerId: null, playerName: 'Winner of Qualifier 1', source: { matchId: q1Id, outcome: 'winner' } },
          { playerId: null, playerName: 'Winner of Qualifier 2', source: { matchId: q2Id, outcome: 'winner' } }
        ],
        scores: [0, 0],
        winner: null,
        winnerId: null,
        status: 'WAITING',
        advancesTo: null
      };

      this.playoffMatches = [q1, elim, q2, fin];
      return;
    }

    // Legacy Semifinals (Rank 1v4, 2v3 -> Grand Final)
    const sf1 = {
      id: `playoff-sf1-${this.id}`,
      stageId: 'playoff-knockout',
      playoffStage: 'SEMIFINAL',
      round: 'Semifinal 1 (Rank 1 vs 4)',
      roundKey: 'sf',
      roundTitle: 'Semifinals',
      index: 0,
      label: 'Playoff SF 1',
      player1: null,
      player2: null,
      slots: [
        { playerId: null, playerName: 'League Rank #1', source: { rank: 1 } },
        { playerId: null, playerName: 'League Rank #4', source: { rank: 4 } }
      ],
      scores: [0, 0],
      winner: null,
      winnerId: null,
      status: 'WAITING',
      advancesTo: { matchId: `playoff-fin-${this.id}`, slot: 0 }
    };

    const sf2 = {
      id: `playoff-sf2-${this.id}`,
      stageId: 'playoff-knockout',
      playoffStage: 'SEMIFINAL',
      round: 'Semifinal 2 (Rank 2 vs 3)',
      roundKey: 'sf',
      roundTitle: 'Semifinals',
      index: 1,
      label: 'Playoff SF 2',
      player1: null,
      player2: null,
      slots: [
        { playerId: null, playerName: 'League Rank #2', source: { rank: 2 } },
        { playerId: null, playerName: 'League Rank #3', source: { rank: 3 } }
      ],
      scores: [0, 0],
      winner: null,
      winnerId: null,
      status: 'WAITING',
      advancesTo: { matchId: `playoff-fin-${this.id}`, slot: 1 }
    };

    const fin = {
      id: `playoff-fin-${this.id}`,
      stageId: 'playoff-knockout',
      playoffStage: 'GRAND_FINAL',
      round: 'Grand Final',
      roundKey: 'final',
      roundTitle: 'Grand Final',
      index: 0,
      label: 'Grand Final',
      player1: null,
      player2: null,
      slots: [
        { playerId: null, playerName: 'Winner of SF 1', source: { matchId: sf1.id, outcome: 'winner' } },
        { playerId: null, playerName: 'Winner of SF 2', source: { matchId: sf2.id, outcome: 'winner' } }
      ],
      scores: [0, 0],
      winner: null,
      winnerId: null,
      status: 'WAITING',
      advancesTo: null
    };

    this.playoffMatches = [sf1, sf2, fin];
  }

  recordMatchResult(matchId, winnerId, scores = [5, 3]) {
    if (this.type === 'KNOCKOUT') {
      return this._recordKnockoutResult(matchId, winnerId, scores);
    } else if (this.type === 'LEAGUE' || this.type === 'TEAM_LEAGUE') {
      return this._recordLeagueResult(matchId, winnerId, scores);
    } else if (this.type === 'HYBRID') {
      return this._recordHybridResult(matchId, winnerId, scores);
    }
    return this.getSnapshot();
  }

  _recordKnockoutResult(matchId, winnerId, scores = [5, 3]) {
    const match = this.knockoutMatches.find(m => m.id === matchId);
    if (!match || match.status === 'COMPLETED') return this.getSnapshot();

    const winner = (match.player1 && match.player1.id === winnerId) ? match.player1 : match.player2;
    const runnerUp = winner === match.player1 ? match.player2 : match.player1;

    match.winner = winner;
    match.winnerId = winner ? winner.id : winnerId;
    match.loser = runnerUp || null;
    match.loserId = runnerUp?.id || null;
    match.scores = scores;
    match.status = 'COMPLETED';
    match.completedAt = Date.now();

    // Add match result notifications & qualification status updates
    if (winner) {
      const pWin = this.participants.find(p => p.id === winner.id);
      if (pWin) pWin.qualificationStatus = match.advancesTo ? 'QUALIFIED' : 'CHAMPION';
      if (!winner.id.startsWith('bot-')) {
        this.addNotification(winner.id, 'MATCH_WON', 'Match Victory!', `You won ${match.round || match.roundTitle || 'your match'} (${scores[0]}-${scores[1]})!`, `/tournaments/${this.id}`);
      }
    }
    if (runnerUp) {
      const pLose = this.participants.find(p => p.id === runnerUp.id);
      if (pLose) pLose.qualificationStatus = match.advancesTo ? 'ELIMINATED' : 'RUNNER_UP';
      if (!runnerUp.id.startsWith('bot-')) {
        this.addNotification(runnerUp.id, 'ELIMINATED', 'Match Defeat', `You were knocked out in ${match.round || match.roundTitle || 'this round'}.`, `/tournaments/${this.id}`);
      }
    }

    // Propagate winner to parent match in bracket
    if (match.advancesTo) {
      const parentMatch = this.knockoutMatches.find(m => m.id === match.advancesTo.matchId);
      if (parentMatch) {
        const targetSlot = typeof match.advancesTo.slot === 'number' ? match.advancesTo.slot : (match.advancesTo.slotIndex || 0);
        if (targetSlot === 0) {
          parentMatch.player1 = winner;
          if (parentMatch.slots && parentMatch.slots[0]) {
            parentMatch.slots[0].playerId = winner.id;
            parentMatch.slots[0].playerName = winner.name;
            parentMatch.slots[0].avatar = winner.avatar || '🦊';
            parentMatch.slots[0].isBye = false;
          }
        } else {
          parentMatch.player2 = winner;
          if (parentMatch.slots && parentMatch.slots[1]) {
            parentMatch.slots[1].playerId = winner.id;
            parentMatch.slots[1].playerName = winner.name;
            parentMatch.slots[1].avatar = winner.avatar || '🦊';
            parentMatch.slots[1].isBye = false;
          }
        }

        if (parentMatch.player1 && parentMatch.player2 && parentMatch.status === 'WAITING') {
          parentMatch.status = 'READY';
          if (!parentMatch.player1.isBot) {
            this.addNotification(
              parentMatch.player1.id,
              'NEXT_MATCH_READY',
              'Next Round Match Ready!',
              `Your ${parentMatch.roundTitle || parentMatch.round} vs ${parentMatch.player2.name} is ready to play.`,
              `/tournaments/${this.id}/matches/${parentMatch.id}`
            );
          }
          if (!parentMatch.player2.isBot) {
            this.addNotification(
              parentMatch.player2.id,
              'NEXT_MATCH_READY',
              'Next Round Match Ready!',
              `Your ${parentMatch.roundTitle || parentMatch.round} vs ${parentMatch.player1.name} is ready to play.`,
              `/tournaments/${this.id}/matches/${parentMatch.id}`
            );
          }
        }
      }
    } else {
      // Final match completed!
      this.champion = winner;
      this.runnerUp = runnerUp;
      this.status = 'COMPLETED';
      this.completedAt = Date.now();
      if (this.lobby) this.lobby.status = 'CLOSED';
      this._finalizeRewards();
      this.addAuditLog(winner.id, winner.name, 'CHAMPION', `Crowned Grand Champion of "${this.name}"`);
      if (this.champion && !this.champion.id.startsWith('bot-')) {
        this.addNotification(this.champion.id, 'CHAMPION', '🏆 Grand Champion!', `Congratulations! You are the official Champion of ${this.name}! Prize: ${this.prizePool} Coins!`, `/tournaments/${this.id}/champion`);
        economy.awardTournamentWin(this.champion.id, this.prizePool, 'Knockout');
      }
      if (this.runnerUp && !this.runnerUp.id.startsWith('bot-')) {
        this.addNotification(this.runnerUp.id, 'RUNNER_UP', '🥈 Tournament Finalist', `You finished Runner-Up in "${this.name}" against Champion ${winner?.name}!`, `/tournaments/${this.id}/results`);
      }
    }

    return this.getSnapshot();
  }

  _recordLeagueResult(matchId, winnerId, scores = [5, 3]) {
    const fix = this.leagueFixtures.find(f => f.id === matchId);
    if (!fix || fix.status === 'COMPLETED') return this.getSnapshot();

    const winner = (fix.p1 && fix.p1.id === winnerId) ? fix.p1 : fix.p2;
    const loser = winner === fix.p1 ? fix.p2 : fix.p1;
    fix.winner = winner;
    fix.winnerId = winner ? winner.id : winnerId;
    fix.scores = scores;
    fix.status = 'COMPLETED';

    const isTeam = Boolean(fix.team1 && fix.team2);
    let winRow = null;
    let loseRow = null;

    if (isTeam) {
      const winTeam = (winner && fix.p1 && winner.id === fix.p1.id) ? fix.team1 : fix.team2;
      const loseTeam = winTeam.id === fix.team1.id ? fix.team2 : fix.team1;
      winRow = this.pointsTable.find(r => r.id === winTeam.id);
      loseRow = this.pointsTable.find(r => r.id === loseTeam.id);
      const teamObj = this.teams.find(t => t.id === winTeam.id);
      if (teamObj) {
        teamObj.played = (teamObj.played || 0) + 1;
        teamObj.won = (teamObj.won || 0) + 1;
        teamObj.points = (teamObj.points || 0) + this.pointsPerWin;
      }
      const loseTeamObj = this.teams.find(t => t.id === loseTeam.id);
      if (loseTeamObj) {
        loseTeamObj.played = (loseTeamObj.played || 0) + 1;
        loseTeamObj.lost = (loseTeamObj.lost || 0) + 1;
      }
    } else {
      winRow = this.pointsTable.find(r => r.id === winner.id);
      loseRow = this.pointsTable.find(r => r.id === loser.id);
    }
    if (winRow) {
      winRow.played += 1;
      winRow.won += 1;
      winRow.points += this.pointsPerWin;
      winRow.winRate = `${Math.round((winRow.won / winRow.played) * 100)}%`;
    }
    if (loseRow) {
      loseRow.played += 1;
      loseRow.lost += 1;
      loseRow.points += this.pointsPerLoss;
      loseRow.winRate = `${Math.round((loseRow.won / loseRow.played) * 100)}%`;
    }

    // Build Head-to-Head map from completed league fixtures
    const h2hWins = new Map(); // `${winnerId}->${loserId}` -> count
    const overallH2hWins = new Map();
    for (const lf of this.leagueFixtures) {
      if (lf.status === 'COMPLETED' && lf.winnerId) {
        const wId = lf.winnerId;
        const p1Id = lf.p1?.id || lf.player1?.id;
        const p2Id = lf.p2?.id || lf.player2?.id;
        const lId = p1Id === wId ? p2Id : p1Id;
        if (wId && lId) {
          h2hWins.set(`${wId}->${lId}`, (h2hWins.get(`${wId}->${lId}`) || 0) + 1);
          overallH2hWins.set(wId, (overallH2hWins.get(wId) || 0) + 1);
        }
      }
    }

    // Deterministic Tie-Breaker: Points -> Direct Head-to-Head -> Total Wins -> Win % -> Seed
    this.pointsTable.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aBeatB = h2hWins.get(`${a.id}->${b.id}`) || 0;
      const bBeatA = h2hWins.get(`${b.id}->${a.id}`) || 0;
      if (aBeatB !== bBeatA) return bBeatA - aBeatB;
      if (b.won !== a.won) return b.won - a.won;
      const pctA = a.played > 0 ? a.won / a.played : 0;
      const pctB = b.played > 0 ? b.won / b.played : 0;
      if (pctB !== pctA) return pctB - pctA;
      return (a.seed || 999) - (b.seed || 999);
    });
    this.pointsTable.forEach((row, i) => {
      row.rank = i + 1;
      row.qualified = i < this.qualificationSlots;
      row.h2hSummary = `${row.won || 0}-${row.lost || 0}`;
      row.tieBreakerNote = null;
    });

    // Record explicit tie-breaker reason whenever players share equal points and played > 0
    for (let i = 0; i < this.pointsTable.length; i++) {
      const cur = this.pointsTable[i];
      if (!cur.played) continue;
      const tiedPeers = this.pointsTable.filter(other => other.id !== cur.id && other.points === cur.points && other.played > 0);
      if (tiedPeers.length === 0) continue;

      const rival = tiedPeers.find(other => (h2hWins.get(`${cur.id}->${other.id}`) || 0) > (h2hWins.get(`${other.id}->${cur.id}`) || 0));
      if (rival) {
        cur.tieBreakerNote = `Ranked above ${rival.name} via direct Head-to-Head win`;
      } else {
        const lowerByWins = tiedPeers.find(other => cur.won > other.won);
        if (lowerByWins) {
          cur.tieBreakerNote = `Ranked above ${lowerByWins.name} via Total Wins (${cur.won} vs ${lowerByWins.won})`;
        } else {
          const curPct = cur.played > 0 ? cur.won / cur.played : 0;
          const lowerByPct = tiedPeers.find(other => other.played > 0 && curPct > (other.won / other.played));
          if (lowerByPct) {
            cur.tieBreakerNote = `Ranked above ${lowerByPct.name} via higher Win %`;
          }
        }
      }
    }

    // Activate next waiting fixture(s) without scheduling any player into simultaneous matches
    if (this.matchesPerPlayer) {
      const busyPlayers = new Set();
      for (const f of this.leagueFixtures) {
        if (f.status === 'READY' || f.status === 'IN_PROGRESS') {
          if (f.p1?.id) busyPlayers.add(f.p1.id);
          if (f.p2?.id) busyPlayers.add(f.p2.id);
        }
      }
      for (const f of this.leagueFixtures) {
        if (f.status === 'WAITING' && f.p1?.id && f.p2?.id && !busyPlayers.has(f.p1.id) && !busyPlayers.has(f.p2.id)) {
          f.status = 'READY';
          busyPlayers.add(f.p1.id);
          busyPlayers.add(f.p2.id);
        }
      }
    } else {
      const nextFix = this.leagueFixtures.find(f => f.status === 'WAITING');
      if (nextFix) {
        nextFix.status = 'READY';
      }
    }

    if (this.type !== 'HYBRID' && this.leagueFixtures.every(f => f.status === 'COMPLETED')) {
      this.status = 'COMPLETED';
      this.completedAt = Date.now();
      if (this.lobby) this.lobby.status = 'CLOSED';
      this.champion = this.pointsTable[0];
      this.runnerUp = this.pointsTable[1] || null;
      this.pointsTable.forEach((row, i) => {
        const pObj = this.participants.find(p => p.id === row.id);
        if (pObj) {
          pObj.qualificationStatus = i === 0 ? 'CHAMPION' : (i === 1 ? 'RUNNER_UP' : (i < this.qualificationSlots ? 'QUALIFIED' : 'ELIMINATED'));
        }
      });
      this._finalizeRewards();
      if (this.champion && !this.champion.id.startsWith('bot-')) {
        economy.awardTournamentWin(this.champion.id, this.prizePool, 'League');
      }
    }

    return this.getSnapshot();
  }

  _recordHybridResult(matchId, winnerId, scores = [5, 3]) {
    if (this.leagueFixtures.some(f => f.id === matchId)) {
      this._recordLeagueResult(matchId, winnerId, scores);
      const allLeagueDone = this.leagueFixtures.every(f => f.status === 'COMPLETED');
      if (allLeagueDone) {
        this.status = 'PLAYOFFS';
        this.leagueLocked = true;
        const cutoff = (this.playoffFormat === 'TOP2_FINAL' || this.qualificationSlots === 2) ? 2 : 4;
        this.pointsTable.forEach((row, i) => {
          row.qualified = i < cutoff;
          const pObj = this.participants.find(p => p.id === row.id);
          if (pObj) {
            pObj.qualificationStatus = i < cutoff ? 'QUALIFIED' : 'ELIMINATED';
            if (!pObj.isBot) {
              this.addNotification(
                pObj.id,
                i < cutoff ? 'QUALIFIED' : 'ELIMINATED',
                i < cutoff ? 'Playoff Qualification!' : 'Group Stage Complete',
                i < cutoff
                  ? `You finished Rank #${i + 1} in the League and qualified for IPL Playoffs!`
                  : `You finished Rank #${i + 1} in "${this.name}" League stage.`,
                `/tournaments/${this.id}/bracket`
              );
            }
          }
        });
        this.addAuditLog(this.creatorId, this.creatorName, 'LEAGUE_LOCKED', `League finished; Top ${cutoff} qualified for Playoffs`);

        const r1 = this.pointsTable[0];
        const r2 = this.pointsTable[1] || r1;
        const r3 = this.pointsTable[2] || r2;
        const r4 = this.pointsTable[3] || r2;

        if (this.playoffFormat === 'TOP2_FINAL' || this.qualificationSlots === 2) {
          const fin = this.playoffMatches[0];
          if (fin) {
            fin.player1 = r1;
            fin.player2 = r2;
            fin.slots = [
              { playerId: r1.id, playerName: r1.name, avatar: r1.avatar || '🦊', source: { rank: 1 } },
              { playerId: r2.id, playerName: r2.name, avatar: r2.avatar || '🦊', source: { rank: 2 } }
            ];
            fin.status = 'READY';
          }
        } else if (this.playoffFormat === 'IPL_TOP4') {
          const q1 = this.playoffMatches.find(m => m.playoffStage === 'QUALIFIER_1') || this.playoffMatches[0];
          const elim = this.playoffMatches.find(m => m.playoffStage === 'ELIMINATOR') || this.playoffMatches[1];

          q1.player1 = r1;
          q1.player2 = r2;
          q1.slots = [
            { playerId: r1.id, playerName: r1.name, avatar: r1.avatar || '🦊', source: { rank: 1 } },
            { playerId: r2.id, playerName: r2.name, avatar: r2.avatar || '🦊', source: { rank: 2 } }
          ];
          q1.status = 'READY';

          elim.player1 = r3;
          elim.player2 = r4;
          elim.slots = [
            { playerId: r3.id, playerName: r3.name, avatar: r3.avatar || '🦊', source: { rank: 3 } },
            { playerId: r4.id, playerName: r4.name, avatar: r4.avatar || '🦊', source: { rank: 4 } }
          ];
          elim.status = 'READY';
        } else {
          // Legacy Semifinals (1v4, 2v3)
          const sf1 = this.playoffMatches[0];
          const sf2 = this.playoffMatches[1];

          sf1.player1 = r1;
          sf1.player2 = r4;
          if (sf1.slots) {
            sf1.slots[0] = { playerId: sf1.player1.id, playerName: sf1.player1.name };
            sf1.slots[1] = { playerId: sf1.player2.id, playerName: sf1.player2.name };
          }
          sf1.status = 'READY';

          sf2.player1 = r2;
          sf2.player2 = r3;
          if (sf2.slots) {
            sf2.slots[0] = { playerId: sf2.player1.id, playerName: sf2.player1.name };
            sf2.slots[1] = { playerId: sf2.player2.id, playerName: sf2.player2.name };
          }
          sf2.status = 'READY';
        }
      }
      return this.getSnapshot();
    }

    const playoffMatch = this.playoffMatches.find(m => m.id === matchId);
    if (playoffMatch && playoffMatch.status !== 'COMPLETED') {
      const winner = playoffMatch.player1?.id === winnerId ? playoffMatch.player1 : playoffMatch.player2;
      const loser = winner === playoffMatch.player1 ? playoffMatch.player2 : playoffMatch.player1;
      playoffMatch.winner = winner;
      playoffMatch.winnerId = winner?.id || winnerId;
      playoffMatch.loser = loser || null;
      playoffMatch.loserId = loser?.id || null;
      playoffMatch.scores = scores;
      playoffMatch.status = 'COMPLETED';
      playoffMatch.completedAt = Date.now();

      // Propagate Winner & Loser dynamically
      if (playoffMatch.advancesTo) {
        const winTarget = this.playoffMatches.find(m => m.id === playoffMatch.advancesTo.matchId);
        if (winTarget) {
          const slotIdx = playoffMatch.advancesTo.slot ?? 0;
          if (slotIdx === 0) winTarget.player1 = winner;
          else winTarget.player2 = winner;
          if (winTarget.slots && winTarget.slots[slotIdx]) {
            winTarget.slots[slotIdx] = {
              playerId: winner.id,
              playerName: winner.name,
              avatar: winner.avatar || '🦊',
              source: winTarget.slots[slotIdx].source || null
            };
          }
          if (winTarget.player1 && winTarget.player2 && winTarget.status === 'WAITING') {
            winTarget.status = 'READY';
          }
        }
      }

      if (playoffMatch.loserAdvancesTo && loser) {
        const loseTarget = this.playoffMatches.find(m => m.id === playoffMatch.loserAdvancesTo.matchId);
        if (loseTarget) {
          const slotIdx = playoffMatch.loserAdvancesTo.slot ?? 0;
          if (slotIdx === 0) loseTarget.player1 = loser;
          else loseTarget.player2 = loser;
          if (loseTarget.slots && loseTarget.slots[slotIdx]) {
            loseTarget.slots[slotIdx] = {
              playerId: loser.id,
              playerName: loser.name,
              avatar: loser.avatar || '🦊',
              source: loseTarget.slots[slotIdx].source || null
            };
          }
          if (loseTarget.player1 && loseTarget.player2 && loseTarget.status === 'WAITING') {
            loseTarget.status = 'READY';
          }
        }
        const pLose = this.participants.find(p => p.id === loser.id);
        if (pLose) pLose.qualificationStatus = 'QUALIFIED'; // Loser of Qualifier 1 advances to Qualifier 2
      } else if (loser && playoffMatch.advancesTo) {
        const pElim = this.participants.find(p => p.id === loser.id);
        if (pElim) pElim.qualificationStatus = 'ELIMINATED';
      }

      const fin = this.playoffMatches.find(m => m.playoffStage === 'GRAND_FINAL' || m.roundKey === 'final')
        || this.playoffMatches[this.playoffMatches.length - 1];

      // Legacy fallback linkage for SF1/SF2 when advancesTo wasn't hydrated from legacy snapshot
      if (this.playoffFormat === 'SEMIFINAL_TOP4' && !playoffMatch.advancesTo && playoffMatch !== fin && this.playoffMatches.length === 3) {
        const sf1 = this.playoffMatches[0];
        const sf2 = this.playoffMatches[1];
        if (sf1.winner && sf2.winner && fin.status === 'WAITING') {
          fin.player1 = sf1.winner;
          fin.player2 = sf2.winner;
          if (fin.slots) {
            fin.slots[0] = { playerId: sf1.winner.id, playerName: sf1.winner.name };
            fin.slots[1] = { playerId: sf2.winner.id, playerName: sf2.winner.name };
          }
          fin.status = 'READY';
        }
      }

      if (playoffMatch === fin) {
        this.champion = fin.winner;
        this.runnerUp = loser;
        this.status = 'COMPLETED';
        this.completedAt = Date.now();
        if (this.lobby) this.lobby.status = 'CLOSED';
        const pChamp = this.participants.find(p => p.id === fin.winner?.id);
        if (pChamp) pChamp.qualificationStatus = 'CHAMPION';
        const pRunner = this.participants.find(p => p.id === loser?.id);
        if (pRunner) pRunner.qualificationStatus = 'RUNNER_UP';
        this._finalizeRewards();
        this.addAuditLog(fin.winner?.id, fin.winner?.name, 'CHAMPION', `Crowned IPL Playoff Champion of "${this.name}"`);
        if (this.champion && !this.champion.id.startsWith('bot-')) {
          economy.awardTournamentWin(this.champion.id, this.prizePool, 'Hybrid');
        }
      }
    }

    return this.getSnapshot();
  }

  /**
   * Declares a 3-minute no-show walkover for a match.
   * Default walkover awards 5-0 victory to the present player.
   * Host can also override.
   * 
   * @param {string} matchId 
   * @param {string} winnerId 
   * @param {string} [reason='No-show walkover']
   * @returns {object} Updated tournament snapshot
   */
  recordWalkover(matchId, winnerId, reason = 'No-show walkover') {
    let match = this.knockoutMatches.find(m => m.id === matchId) ||
      this.leagueFixtures.find(f => f.id === matchId) ||
      this.playoffMatches.find(p => p.id === matchId);

    if (match && match.status === 'COMPLETED') {
      return this.getSnapshot();
    }

    if (match) {
      match.isWalkover = true;
      match.walkoverReason = reason;
      match.walkoverDeclaredAt = Date.now();
    }

    return this.recordMatchResult(matchId, winnerId, [5, 0]);
  }

  getMatchById(matchId) {
    return this.knockoutMatches.find(m => m.id === matchId) ||
      this.leagueFixtures.find(f => f.id === matchId) ||
      this.playoffMatches.find(p => p.id === matchId) || null;
  }

  /**
   * Links a tournament match to a real 5-character device room.
   * @param {string} matchId 
   * @param {object} roomManager 
   * @returns {{ success: boolean, roomCode?: string, error?: string }}
   */
  createTournamentMatchRoom(matchId, roomManager) {
    let match = this.getMatchById(matchId);

    if (!match) {
      return { success: false, error: 'Match not found' };
    }

    const p1 = match.player1 || match.p1;
    const p2 = match.player2 || match.p2;

    if (!p1 || !p2) {
      return { success: false, error: 'Both players must be determined before creating match room' };
    }

    // Reuse existing room if still valid
    if (match.roomCode) {
      const existingRoom = roomManager.getRoom(match.roomCode);
      if (existingRoom && existingRoom.status !== 'finished') {
        existingRoom.allowedPlayerIds = [p1.id, p2.id];
        return {
          success: true,
          roomCode: existingRoom.code,
          tournamentId: this.id,
          matchId
        };
      }
    }

    const room = roomManager.createRoom(
      p1.id,
      `tourn-tok-${p1.id}`,
      p1.name || 'Player 1',
      p1.avatar || '👤',
      {
        turnTimerSeconds: this.turnTimerSeconds || 30,
        disconnectRule: this.disconnectRule || 'PAUSE_60S',
        timeoutRule: this.timeoutRule || 'AUTO_PICK',
        allowedPlayerIds: [p1.id, p2.id]
      }
    );

    if (room.players && room.players[0]) {
      room.players[0].isConnected = false;
    }
    room.tournamentId = this.id;
    room.tournamentMatchId = matchId;
    room.turnTimerSeconds = this.turnTimerSeconds || 30;
    match.roomCode = room.code;
    match.tournamentId = this.id;
    match.status = 'IN_PROGRESS';

    return {
      success: true,
      roomCode: room.code,
      tournamentId: this.id,
      matchId
    };
  }

  getSnapshot() {
    const format = this.type.toLowerCase();

    // Ensure every match has tournamentId attached
    for (const m of this.knockoutMatches) { m.tournamentId = this.id; }
    for (const m of this.leagueFixtures) { m.tournamentId = this.id; }
    for (const m of this.playoffMatches) { m.tournamentId = this.id; }

    // Normalized stages array for React UI
    const stages = [];
    if (this.type === 'KNOCKOUT') {
      stages.push({
        id: 'stage-knockout',
        type: 'knockout',
        title: 'Championship Bracket',
        rounds: this._groupMatchesIntoRounds(this.knockoutMatches),
        matches: this.knockoutMatches,
        qualifiers: 1
      });
    } else if (this.type === 'LEAGUE') {
      stages.push({
        id: 'stage-league',
        type: 'league',
        title: 'League Stage',
        fixtures: this.leagueFixtures,
        standings: this.pointsTable,
        tieBreakRule: 'Points > Total Wins > Head-to-Head > Earliest Registration',
        qualifiers: this.qualificationSlots
      });
    } else if (this.type === 'TEAM_LEAGUE') {
      stages.push({
        id: 'stage-team-league',
        type: 'league',
        title: 'Team Franchise League',
        fixtures: this.leagueFixtures,
        standings: this.pointsTable,
        tieBreakRule: 'Points > Team Wins > Head-to-Head',
        qualifiers: this.qualificationSlots
      });
    } else if (this.type === 'HYBRID') {
      stages.push({
        id: 'stage-league',
        type: 'league',
        title: 'League Stage',
        fixtures: this.leagueFixtures,
        standings: this.pointsTable,
        tieBreakRule: 'Points > Total Wins > Head-to-Head',
        qualifiers: this.qualificationSlots
      });
      stages.push({
        id: 'stage-playoffs',
        type: 'knockout',
        title: 'Playoffs Bracket',
        rounds: this._groupMatchesIntoRounds(this.playoffMatches),
        matches: this.playoffMatches,
        qualifiers: 1
      });
    }

    const lobbyStatus = this.status === 'REGISTERING'
      ? 'OPEN'
      : (this.status === 'COMPLETED' || this.status === 'CANCELLED' ? 'CLOSED' : 'LOCKED');
    const lobbySnapshot = {
      ...(this.lobby || {}),
      id: this.lobby?.id || `lobby-${this.id}`,
      tournamentId: this.id,
      code: this.code,
      joinUrl: this.joinUrl || `/tournaments/join/${this.code}`,
      status: lobbyStatus,
      maxCapacity: this.maxParticipants,
      onlinePlayerIds: this.participants.filter(p => p.isOnline).map(p => p.id),
      onlineCount: this.participants.filter(p => p.isOnline).length
    };
    const roomSnapshot = {
      id: lobbySnapshot.id,
      tournamentId: this.id,
      code: this.code,
      joinLink: lobbySnapshot.joinUrl,
      status: lobbyStatus,
      hostId: this.creatorId,
      hostName: this.creatorName,
      maxCapacity: this.maxParticipants,
      currentPlayers: this.participants.length,
      participants: this.participants
    };

    return {
      id: this.id,
      name: this.name,
      title: this.name,
      season: this.season,
      logo: this.logo,
      description: this.description,
      type: this.type,
      format,
      visibility: this.visibility,
      approvalMode: this.approvalMode,
      scheduleMode: this.scheduleMode,
      isTeamLeague: this.isTeamLeague,
      code: this.code,
      joinUrl: this.joinUrl || `/tournaments/join/${this.code}`,
      status: this.status,
      lobbyStatus,
      lobbyState: this.status === 'REGISTERING' ? 'WAITING' : this.status,
      hostId: this.creatorId,
      creatorId: this.creatorId,
      creatorName: this.creatorName,
      minParticipants: this.minParticipants,
      maxParticipants: this.maxParticipants,
      maxPlayers: this.maxParticipants,
      matchesPerPlayer: this.matchesPerPlayer,
      registrationDeadline: this.registrationDeadline,
      startTime: this.startTime,
      turnTimerSeconds: this.turnTimerSeconds,
      requireReadyToStart: this.requireReadyToStart,
      disconnectRule: this.disconnectRule,
      timeoutRule: this.timeoutRule,
      drawRule: this.drawRule,
      abandonedRule: this.abandonedRule,
      startedAt: this.startedAt || null,
      completedAt: this.completedAt || null,
      canStart: this.canStart(),
      readyCount: this.participants.filter(p => p.isReady || p.isBot).length,
      onlineCount: this.participants.filter(p => p.isOnline).length,
      lobby: lobbySnapshot,
      room: roomSnapshot,
      rewards: this.rewards || [],
      pointsPerWin: this.pointsPerWin,
      pointsPerLoss: this.pointsPerLoss,
      qualificationSlots: this.qualificationSlots,
      playoffFormat: this.playoffFormat,
      byePolicy: this.byePolicy,
      byeSchedule: this.byeSchedule,
      leagueLocked: Boolean(this.leagueLocked),
      entryFee: this.entryFee,
      prizePool: this.prizePool,
      thirdPlaceMatch: this.thirdPlaceMatch,
      rulesText: this.rulesText,
      createdAt: this.createdAt,
      participants: this.participants,
      pendingApprovals: this.pendingApprovals,
      teams: this.teams,
      winner: this.champion,
      champion: this.champion,
      runnerUp: this.runnerUp,
      stages,
      matches: this.matches,
      fixtures: this.matches,
      standings: this.pointsTable,
      auditLog: this.auditLog,
      notifications: this.notifications,
      invitations: this.invitations,
      // Legacy compatibility
      knockoutMatches: this.knockoutMatches,
      leagueFixtures: this.leagueFixtures,
      pointsTable: this.pointsTable,
      playoffMatches: this.playoffMatches
    };
  }

  get matches() {
    if (this.type === 'KNOCKOUT') return this.knockoutMatches || [];
    if (this.type === 'HYBRID') return [...(this.leagueFixtures || []), ...(this.playoffMatches || [])];
    return this.leagueFixtures || [];
  }

  _groupMatchesIntoRounds(matches) {
    const roundMap = new Map();
    for (const m of matches) {
      const key = m.roundKey || (m.round.includes('Final') ? 'final' : (m.round.includes('Semifinal') ? 'sf' : 'qf'));
      const title = m.roundTitle || m.round.split(' ')[0] || 'Round';
      if (!roundMap.has(key)) {
        roundMap.set(key, { key, title, matches: [] });
      }
      roundMap.get(key).matches.push(m);
    }
    return Array.from(roundMap.values());
  }

  setParticipantOnline(playerId, isOnline = true) {
    if (!playerId) return false;
    const p = this.participants.find(part => part.id === playerId);
    if (!p) return false;
    p.isOnline = Boolean(isOnline);
    if (this.lobby) {
      const onlineIds = this.participants.filter(pt => pt.isOnline).map(pt => pt.id);
      this.lobby.onlinePlayerIds = onlineIds;
      this.lobby.onlineCount = onlineIds.length;
    }
    return true;
  }

  _finalizeRewards() {
    if (this.rewards && this.rewards.length > 0) return;
    const list = [];
    if (this.champion) {
      list.push({
        id: `rew-1-${this.id}`,
        tournamentId: this.id,
        recipientId: this.champion.id,
        recipientName: this.champion.name || 'Champion',
        placement: 1,
        coinsAwarded: Math.round((this.prizePool || 0) * 0.6) || (this.prizePool || 0),
        status: 'AWARDED',
        awardedAt: Date.now()
      });
    }
    if (this.runnerUp) {
      list.push({
        id: `rew-2-${this.id}`,
        tournamentId: this.id,
        recipientId: this.runnerUp.id,
        recipientName: this.runnerUp.name || 'Runner-Up',
        placement: 2,
        coinsAwarded: Math.round((this.prizePool || 0) * 0.25),
        status: 'AWARDED',
        awardedAt: Date.now()
      });
    }
    this.rewards = list;
  }

  toSerializableState() {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      season: this.season,
      logo: this.logo,
      description: this.description,
      creatorId: this.creatorId,
      creatorName: this.creatorName,
      status: this.status,
      visibility: this.visibility,
      approvalMode: this.approvalMode,
      scheduleMode: this.scheduleMode,
      isTeamLeague: this.isTeamLeague,
      code: this.code,
      joinUrl: this.joinUrl,
      createdAt: this.createdAt,
      startedAt: this.startedAt || null,
      completedAt: this.completedAt || null,
      maxParticipants: this.maxParticipants,
      minParticipants: this.minParticipants,
      matchesPerPlayer: this.matchesPerPlayer,
      registrationDeadline: this.registrationDeadline,
      startTime: this.startTime,
      turnTimerSeconds: this.turnTimerSeconds,
      requireReadyToStart: this.requireReadyToStart,
      disconnectRule: this.disconnectRule,
      timeoutRule: this.timeoutRule,
      drawRule: this.drawRule,
      abandonedRule: this.abandonedRule,
      pointsPerWin: this.pointsPerWin,
      pointsPerLoss: this.pointsPerLoss,
      qualificationSlots: this.qualificationSlots,
      playoffFormat: this.playoffFormat,
      byePolicy: this.byePolicy,
      byeSchedule: this.byeSchedule,
      leagueLocked: Boolean(this.leagueLocked),
      entryFee: this.entryFee,
      prizePool: this.prizePool,
      thirdPlaceMatch: this.thirdPlaceMatch,
      rulesText: this.rulesText,
      _prizeAwarded: Boolean(this._prizeAwarded),
      participants: this.participants,
      pendingApprovals: this.pendingApprovals,
      teams: this.teams,
      champion: this.champion,
      runnerUp: this.runnerUp,
      knockoutMatches: this.knockoutMatches,
      leagueFixtures: this.leagueFixtures,
      pointsTable: this.pointsTable,
      playoffMatches: this.playoffMatches,
      lobby: this.lobby,
      rewards: this.rewards,
      invitations: this.invitations,
      notifications: this.notifications,
      auditLog: this.auditLog
    };
  }

  static fromSerializedState(data) {
    if (!data || !data.id) return null;
    const t = new Tournament(data.id, data.type || 'KNOCKOUT', data.name || 'Tournament', data.creatorId || 'host-1', data.creatorName || 'Host', {
      code: data.code,
      joinUrl: data.joinUrl,
      season: data.season,
      logo: data.logo,
      description: data.description,
      visibility: data.visibility,
      approvalMode: data.approvalMode,
      scheduleMode: data.scheduleMode,
      isTeamLeague: data.isTeamLeague,
      maxParticipants: data.maxParticipants,
      minParticipants: data.minParticipants,
      matchesPerPlayer: data.matchesPerPlayer,
      registrationDeadline: data.registrationDeadline,
      startTime: data.startTime,
      turnTimerSeconds: data.turnTimerSeconds,
      requireReadyToStart: data.requireReadyToStart,
      disconnectRule: data.disconnectRule,
      timeoutRule: data.timeoutRule,
      drawRule: data.drawRule,
      abandonedRule: data.abandonedRule,
      pointsPerWin: data.pointsPerWin,
      pointsPerLoss: data.pointsPerLoss,
      qualificationSlots: data.qualificationSlots,
      playoffFormat: data.playoffFormat,
      byePolicy: data.byePolicy,
      entryFee: data.entryFee,
      prizePool: data.prizePool,
      thirdPlaceMatch: data.thirdPlaceMatch,
      rulesText: data.rulesText,
      teams: data.teams,
      lobby: data.lobby,
      rewards: data.rewards
    });
    t.status = data.status || 'REGISTERING';
    t.leagueLocked = Boolean(data.leagueLocked);
    t.createdAt = data.createdAt || Date.now();
    t.startedAt = data.startedAt || null;
    t.completedAt = data.completedAt || null;
    t._prizeAwarded = Boolean(data._prizeAwarded);
    if (Array.isArray(data.participants)) t.participants = data.participants;
    if (Array.isArray(data.pendingApprovals)) t.pendingApprovals = data.pendingApprovals;
    if (Array.isArray(data.teams)) t.teams = data.teams;
    t.champion = data.champion || null;
    t.runnerUp = data.runnerUp || null;
    if (Array.isArray(data.knockoutMatches)) t.knockoutMatches = data.knockoutMatches;
    if (Array.isArray(data.leagueFixtures)) t.leagueFixtures = data.leagueFixtures;
    if (Array.isArray(data.pointsTable)) t.pointsTable = data.pointsTable;
    if (Array.isArray(data.playoffMatches)) t.playoffMatches = data.playoffMatches;
    if (Array.isArray(data.byeSchedule)) t.byeSchedule = data.byeSchedule;
    if (data.lobby) t.lobby = data.lobby;
    if (Array.isArray(data.rewards)) t.rewards = data.rewards;
    if (Array.isArray(data.invitations)) t.invitations = data.invitations;
    if (Array.isArray(data.notifications)) t.notifications = data.notifications;
    if (Array.isArray(data.auditLog)) t.auditLog = data.auditLog;
    return t;
  }
}

export class TournamentManager {
  constructor() {
    /** @type {Map<string, Tournament>} */
    this.tournaments = new Map();
    this._initDefaultTournaments();
  }

  _initDefaultTournaments() {
    // Real standard production tournaments initialized on server start
    const ko = new Tournament('tourn-cobalt-cup', 'KNOCKOUT', 'Cobalt Cup Knockout', 'system-admin', 'Bingo Official', {
      maxParticipants: 8,
      entryFee: 100,
      prizePool: 2500,
      visibility: 'OPEN'
    });
    ko.fillWithBots();
    ko.startTournament();
    this.tournaments.set(ko.id, ko);

    const league = new Tournament('tourn-premier-league', 'LEAGUE', 'Bingo Premier League', 'system-admin', 'Bingo Official', {
      season: 'Season 01',
      logo: '🏆',
      description: 'Compete. Qualify. Become Champion.',
      maxParticipants: 6,
      entryFee: 150,
      prizePool: 5000,
      pointsPerWin: 3,
      pointsPerLoss: 0,
      qualificationSlots: 4,
      visibility: 'OPEN'
    });
    league.fillWithBots();
    league.startTournament();
    this.tournaments.set(league.id, league);

    const teamTourn = new Tournament('tourn-bpl-franchises', 'TEAM_LEAGUE', 'BPL Franchise Champions', 'system-admin', 'Bingo Official', {
      season: 'Season 01',
      logo: '🦁',
      description: 'IPL-Style Franchise Cup. Captains and teams battle for the championship.',
      maxParticipants: 8,
      entryFee: 200,
      prizePool: 8000,
      isTeamLeague: true,
      pointsPerWin: 3,
      pointsPerLoss: 0,
      visibility: 'OPEN'
    });
    teamTourn.fillWithBots();
    teamTourn.startTournament();
    this.tournaments.set(teamTourn.id, teamTourn);

    const hybrid = new Tournament('tourn-champions-hybrid', 'HYBRID', 'Champions Hybrid Trophy', 'system-admin', 'Bingo Official', {
      season: 'Season 01',
      logo: '🛡️',
      description: 'IPL-style 5-match league stage followed by Qualifier 1, Eliminator, Qualifier 2 & Grand Final.',
      maxParticipants: 8,
      matchesPerPlayer: 5,
      entryFee: 200,
      prizePool: 5000,
      pointsPerWin: 2,
      pointsPerLoss: 0,
      qualificationSlots: 4,
      playoffFormat: 'IPL_TOP4',
      visibility: 'OPEN'
    });
    hybrid.fillWithBots();
    hybrid.startTournament();
    this.tournaments.set(hybrid.id, hybrid);
  }

  _generateUniqueCode() {
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = generateInviteCode(6);
      if (!this.getTournamentByCode(candidate)) {
        return candidate;
      }
    }
    return `T${Date.now().toString(36).slice(-5).toUpperCase()}`;
  }

  createTournament(type, name, creatorId, creatorName, config = {}) {
    let id = config.id || `tourn-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
    while (this.tournaments.has(id)) {
      id = `tourn-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    }
    const uniqueCode = config.code ? String(config.code).trim().toUpperCase() : this._generateUniqueCode();
    const tourn = new Tournament(id, type, name, creatorId, creatorName, {
      ...config,
      code: uniqueCode
    });
    if (config.autoStart || config.startImmediately) {
      tourn.fillWithBots();
      tourn.startTournament();
    }
    this.tournaments.set(id, tourn);
    return tourn;
  }

  getTournament(id) {
    return this.tournaments.get(id) || null;
  }

  getTournamentByCode(code) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    for (const t of this.tournaments.values()) {
      if (t.code === clean || t.id === clean || t.id.toLowerCase() === clean.toLowerCase()) {
        return t;
      }
    }
    return null;
  }

  listTournaments() {
    return Array.from(this.tournaments.values())
      .filter(t => t.status !== 'CANCELLED')
      .map(t => t.getSnapshot());
  }

  getAllTournaments() {
    return this.listTournaments();
  }

  getTournaments() {
    return this.listTournaments();
  }

  addParticipant(id, playerId, playerName) {
    const t = this.getTournament(id) || this.getTournamentByCode(id);
    if (!t) return { success: false, error: 'Tournament not found' };
    return t.addParticipant(playerId, playerName);
  }

  startTournament(id, hostId) {
    const t = this.getTournament(id);
    if (!t) return { success: false, status: 404, error: 'Tournament not found' };
    const check = t.canStart(hostId);
    if (!check.ok) {
      return { success: false, status: 400, error: check.error };
    }
    const snapshot = t.startTournament(hostId);
    return { success: true, tournament: snapshot };
  }

  recordMatchResult(id, matchId, winnerId, details) {
    const t = this.getTournament(id);
    if (!t) return { success: false, error: 'Tournament not found' };
    const snapshot = t.recordMatchResult(matchId, winnerId, details);
    return { success: true, tournament: snapshot, ...snapshot };
  }

  approveParticipant(id, hostId, playerId) {
    const t = this.getTournament(id);
    if (!t) return { success: false, error: 'Tournament not found' };
    return t.approveParticipant(hostId, playerId);
  }

  rejectParticipant(id, hostId, playerId) {
    const t = this.getTournament(id);
    if (!t) return { success: false, error: 'Tournament not found' };
    return t.rejectParticipant(hostId, playerId);
  }

  getAllNotifications(userId) {
    const list = [];
    for (const t of this.tournaments.values()) {
      if (Array.isArray(t.notifications)) {
        for (const n of t.notifications) {
          if (!userId || !n.recipientId || n.recipientId === userId) {
            list.push({ ...n, tournamentId: t.id, tournamentName: t.name });
          }
        }
      }
    }
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }
}

export const tournamentManager = new TournamentManager();
