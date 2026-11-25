/**
 * src/tournaments/screens/TournamentLobby.jsx
 * 
 * Tournament Lobby Screen (/tournaments/:id while status === 'PENDING').
 * Shows participant roster grid, ready states, invite code tools,
 * host controls, and explicit explanations of start conditions.
 */

import React, { useState, useEffect, useRef } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Num } from '../components/Num.jsx';
import { PlayerName } from '../components/PlayerName.jsx';
import { FormatDetailsModal } from '../components/FormatDetailsModal.jsx';
import { QRCodeSVG } from '../../components/QRCodeSVG.jsx';
import { socketClient } from '../../services/socketClient.js';
import { soundManager } from '../../../public/js/audio.js';

export function TournamentLobby({
  tournament,
  currentUserId = null,
  currentUserName = 'Player',
  onStartTournament = null,
  onKickPlayer = null,
  onCancelTournament = null,
  onRefresh = null,
  onNavigate = null
}) {
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const startLockRef = useRef(false);
  const [actionError, setActionError] = useState(null);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const participants = tournament?.participants || [];
  const hostId = tournament?.hostId;
  const myParticipant = participants.find(p => p.id === currentUserId);
  const [isMyReady, setIsMyReady] = useState(
    myParticipant ? Boolean(myParticipant.isReady) : (currentUserId === hostId)
  );
  const [pendingList, setPendingList] = useState(tournament?.pendingApprovals || []);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [directoryPlayers, setDirectoryPlayers] = useState([]);
  const [invitedFriends, setInvitedFriends] = useState({});

  useEffect(() => {
    setPendingList(tournament?.pendingApprovals || []);
  }, [tournament?.pendingApprovals]);

  useEffect(() => {
    const found = (tournament?.participants || []).find(p => p.id === currentUserId);
    if (found && typeof found.isReady === 'boolean') {
      setIsMyReady(found.isReady);
    }
  }, [tournament?.participants, currentUserId]);

  useEffect(() => {
    const tId = tournament?.id;
    if (!tId || !currentUserId) return;
    socketClient.send('join_tournament_lobby', {
      tournamentId: tId,
      playerId: currentUserId,
      name: currentUserName
    });
    return () => {
      socketClient.send('leave_tournament_lobby', {
        tournamentId: tId,
        playerId: currentUserId
      });
    };
  }, [tournament?.id, currentUserId, currentUserName]);

  useEffect(() => {
    if (!showInviteModal) return;
    const exclude = currentUserId ? `?excludeUserId=${encodeURIComponent(currentUserId)}` : '';
    fetch(`/api/users/directory${exclude}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.users)) {
          setDirectoryPlayers(d.users);
        }
      })
      .catch(() => {});
  }, [showInviteModal, currentUserId]);

  if (!tournament) return null;

  const {
    id,
    name,
    code,
    joinUrl: serverJoinUrl,
    format,
    maxPlayers = 8,
    minParticipants = 2,
    registrationDeadline = null,
    requireReadyToStart = false,
    hostName,
    prizePool = 1000,
    season = 'Season 01',
    logo = '🏆'
  } = tournament;

  const fullJoinUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${serverJoinUrl || `/tournaments/join/${code}`}`
    : (serverJoinUrl || `/tournaments/join/${code}`);
  const minPlayersRequired = Math.max(2, Number(minParticipants) || 2);
  const readyHumansCount = participants.filter(p => p.isBot || p.isReady).length;
  const unreadyNonHosts = participants.filter(p => !p.isBot && p.id !== hostId && p.isReady === false);
  const deadlineMs = registrationDeadline ? new Date(registrationDeadline).getTime() : null;
  const isDeadlineExpired = Boolean(deadlineMs && Number.isFinite(deadlineMs) && Date.now() > deadlineMs);

  const handleToggleReady = async () => {
    soundManager.playTap?.();
    const next = !isMyReady;
    setIsMyReady(next);
    try {
      const token = socketClient.getAuthToken?.();
      const res = await fetch(`/api/tournaments/${id}/ready`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          playerId: currentUserId,
          isReady: next
        })
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (e) {
      console.warn('Could not update ready state:', e);
    }
  };

  const handleLeaveTournament = async () => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to leave this tournament lobby?')) {
      return;
    }
    try {
      const res = await fetch(`/api/tournaments/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentUserId })
      });
      const data = await res.json();
      if (data.success && onNavigate) {
        onNavigate('/tournaments');
      } else {
        setActionError(data.error || 'Failed to leave tournament');
      }
    } catch (e) {
      setActionError(e.message || 'Error leaving tournament');
    }
  };

  const isHost = currentUserId && hostId === currentUserId;
  const isParticipant = participants.some(p => p.id === currentUserId);
  const isPending = pendingList.some(p => p.id === currentUserId);
  const meetsMinPlayers = participants.length >= minPlayersRequired;
  const meetsReadyCheck = !requireReadyToStart || unreadyNonHosts.length === 0;
  const canStart = meetsMinPlayers && meetsReadyCheck;

  const handleCopyCode = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyJoinLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && fullJoinUrl) {
      navigator.clipboard.writeText(fullJoinUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/tournaments/join/${code}` : '';
    const shareText = `Join my Bingo Premier League tournament "${name}"! Code: ${code}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: name,
          text: shareText,
          url: shareUrl
        });
      } catch (e) {
        // user cancelled or share failed
      }
    } else {
      handleCopyCode();
    }
  };

  const handleWhatsAppShare = () => {
    const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/tournaments/join/${code}` : '';
    const text = encodeURIComponent(`🏆 Join my Bingo Premier League tournament "${name}" (${season})!\nCode: ${code}\nLink: ${shareUrl}`);
    if (typeof window !== 'undefined') {
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    }
  };

  const handleApprove = async (playerId) => {
    try {
      const res = await fetch(`/api/tournaments/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: currentUserId, playerId })
      });
      const data = await res.json();
      if (data.success) {
        setPendingList(prev => prev.filter(p => p.id !== playerId));
      } else {
        setActionError(data.error || 'Failed to approve player');
      }
    } catch (err) {
      setActionError(err.message || 'Error approving player');
    }
  };

  const handleReject = async (playerId) => {
    try {
      const res = await fetch(`/api/tournaments/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: currentUserId, playerId })
      });
      const data = await res.json();
      if (data.success) {
        setPendingList(prev => prev.filter(p => p.id !== playerId));
      } else {
        setActionError(data.error || 'Failed to reject player');
      }
    } catch (err) {
      setActionError(err.message || 'Error rejecting player');
    }
  };

  const handleSendFriendInvite = async (friend) => {
    const friendName = typeof friend === 'string' ? friend : friend.name;
    const friendId = typeof friend === 'object' && friend.id ? friend.id : `friend-${friendName}`;
    setInvitedFriends(prev => ({ ...prev, [friendName]: true }));
    try {
      await fetch(`/api/tournaments/${id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId || 'player',
          senderName: currentUserName || 'Host',
          receiverId: friendId,
          receiverName: friendName
        })
      });
    } catch (e) {
      console.warn('Could not post friend invitation:', e);
    }
  };

  const handleStart = async () => {
    if (!canStart || isStarting || startLockRef.current) return;
    startLockRef.current = true;
    setIsStarting(true);
    setActionError(null);
    try {
      if (onStartTournament) {
        soundManager.playTournamentFanfare?.();
        await onStartTournament(id);
      } else {
        const token = socketClient.getAuthToken?.();
        const res = await fetch(`/api/tournaments/${id}/start`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ hostId: currentUserId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          soundManager.playError?.();
          setActionError(data.error || 'Failed to start tournament');
        } else {
          soundManager.playTournamentFanfare?.();
          if (onNavigate) onNavigate(`/tournaments/${id}`);
        }
      }
    } catch (err) {
      setActionError(err.message || 'Error starting tournament');
    } finally {
      startLockRef.current = false;
      setIsStarting(false);
    }
  };

  const handleFillBotsAndStart = async () => {
    setIsStarting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/tournaments/${id}/fill-bots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostId: currentUserId })
      });
      const data = await res.json();
      if (data.success && data.tournament) {
        if (onRefresh) onRefresh();
        if (onNavigate) onNavigate(`/tournaments/${id}`);
      } else {
        setActionError(data.error || 'Failed to fill bots and start');
      }
    } catch (err) {
      setActionError(err.message || 'Error starting tournament with AI bots');
    } finally {
      setIsStarting(false);
    }
  };

  const handleKick = async (playerId) => {
    if (!isHost || playerId === hostId) return;
    try {
      if (onKickPlayer) {
        await onKickPlayer(id, playerId);
      } else {
        await fetch(`/api/tournaments/${id}/kick`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostId: currentUserId, playerId })
        });
      }
    } catch (err) {
      setActionError(err.message || 'Error kicking player');
    }
  };

  // Generate seats array to show open slots
  const seats = Array.from({ length: maxPlayers }).map((_, idx) => {
    return participants[idx] || null;
  });

  return (
    <PageShell
      title={name}
      subtitle={`Tournament Lobby • ${format} Format • ${participants.length} of ${maxPlayers} seats filled`}
      onBack={() => onNavigate && onNavigate('/tournaments')}
      actions={
        <button
          type="button"
          className="btn-tactile btn-secondary"
          onClick={() => setShowFormatModal(true)}
          style={{ fontSize: '0.85rem', padding: '8px 12px' }}
        >
          <span>ℹ️</span> Format Rules
        </button>
      }
    >
      <div className="tourn-lobby-container">
        {actionError && (
          <div className="tourn-form-error-banner" role="alert">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
        )}

        {/* Start Condition & Guidance Banner */}
        {isPending ? (
          <div className="lobby-condition-banner waiting" role="status" style={{ borderLeft: '4px solid #f59e0b' }}>
            <span className="condition-icon">⏳</span>
            <div className="condition-content">
              <strong className="condition-title">Registration Pending Host Approval</strong>
              <p className="condition-desc">
                Your request to join this tournament has been sent to the host ({hostName || 'Host'}). Once approved, your seat will be confirmed in the official roster.
              </p>
            </div>
          </div>
        ) : (
          <div className={`lobby-condition-banner ${canStart ? 'ready' : 'waiting'}`} role="status">
            <span className="condition-icon">{canStart ? '✅' : '⚠️'}</span>
            <div className="condition-content">
              <strong className="condition-title">
                {canStart
                  ? (isHost ? 'Tournament Ready to Start!' : 'Waiting for Host to Launch')
                  : (!meetsMinPlayers ? `Waiting for Minimum ${minPlayersRequired} Players` : 'Waiting for Players to Mark Ready')}
              </strong>
              <p className="condition-desc">
                {!meetsMinPlayers
                  ? `At least ${minPlayersRequired} players must join before generating fixtures. Currently ${participants.length} of ${maxPlayers} seats filled.`
                  : (!meetsReadyCheck
                      ? `Waiting for ${unreadyNonHosts.length} player(s) to toggle Ready (${readyHumansCount}/${participants.length} ready).`
                      : (isHost
                          ? `You have ${participants.length}/${maxPlayers} players registered (${readyHumansCount} ready). Click Start Tournament when everyone is set.`
                          : `Lobby has ${participants.length}/${maxPlayers} players. Waiting for host (${hostName || 'Host'}) to launch.`))}
              </p>
            </div>
          </div>
        )}

        {/* Host Pending Approvals Workflow */}
        {isHost && pendingList.length > 0 && (
          <div className="lobby-pending-approvals-card">
            <div className="pending-approvals-header">
              <strong style={{ color: 'var(--tourn-amber)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>🛡️</span> Pending Player Registrations ({pendingList.length})
              </strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--tourn-text-muted)' }}>Approval Required</span>
            </div>
            <div className="pending-approvals-list">
              {pendingList.map(p => (
                <div key={p.id} className="pending-approval-item">
                  <div className="pending-player-info">
                    <span style={{ fontSize: '1.2rem' }}>{p.avatar || '👤'}</span>
                    <div>
                      <strong style={{ fontSize: '0.88rem', display: 'block' }}>{p.name || 'Player'}</strong>
                      <span style={{ fontSize: '0.7rem', color: 'var(--tourn-text-muted)' }}>Wants to join</span>
                    </div>
                  </div>
                  <div className="pending-actions-row">
                    <button
                      type="button"
                      className="btn-approve-player"
                      onClick={() => handleApprove(p.id)}
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      className="btn-reject-player"
                      onClick={() => handleReject(p.id)}
                    >
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lobby Details & Invite Card */}
        <div className="lobby-info-card">
          <div className="lobby-info-main">
            <div className="format-badge-wrap">
              <span className="tourn-format-badge">{logo} {season}</span>
              <span className="tourn-format-badge">{format}</span>
              <span className="host-pill">Host: {hostName || 'Player'}</span>
            </div>
            <div className="lobby-stats-row">
              <div className="lobby-stat-item">
                <span className="stat-label">Prize Pool</span>
                <span className="stat-val">🪙 <Num value={prizePool} /> Coins</span>
              </div>
              <div className="lobby-stat-item">
                <span className="stat-label">Capacity</span>
                <span className="stat-val">{participants.length} / {maxPlayers} (Open: {Math.max(0, maxPlayers - participants.length)})</span>
              </div>
              <div className="lobby-stat-item">
                <span className="stat-label">IPL Rules</span>
                <span className="stat-val">{tournament.matchesPerPlayer || 5} Matches • +{tournament.pointsPerWin ?? 2}W/{tournament.pointsPerLoss ?? 0}L • Top {tournament.qualificationSlots || 4}</span>
              </div>
              <div className="lobby-stat-item">
                <span className="stat-label">Ready Status</span>
                <span className="stat-val">{readyHumansCount} / {participants.length} Ready</span>
              </div>
              <div className="lobby-stat-item">
                <span className="stat-label">Online Now</span>
                <span className="stat-val">🟢 {tournament.onlineCount || participants.filter(p => p.isOnline || p.id === currentUserId).length} Connected</span>
              </div>
              <div className="lobby-stat-item">
                <span className="stat-label">Registration</span>
                <span className="stat-val">{isDeadlineExpired ? 'Closed (Deadline)' : '🟢 Open'}</span>
              </div>
            </div>

            <div className="lobby-rules-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', color: 'var(--tourn-text-secondary)', marginTop: '4px' }}>
              <span>⏱️ Turn: {tournament.turnTimerSeconds || 30}s</span>
              <span>•</span>
              <span>⏸️ Disconnect: {tournament.disconnectRule === 'FORFEIT' ? 'Instant Forfeit' : '60s Pause & Resume'}</span>
              <span>•</span>
              <span>🎲 Timeout: {tournament.timeoutRule === 'SKIP_TURN' ? 'Skip Turn' : 'Auto-Pick'}</span>
              <span>•</span>
              <span>🎯 {tournament.rulesText || '5x5 Bingo • 5 lines to win'}</span>
            </div>

            {/* Ready Toggle & Share Pill Actions */}
            <div className="lobby-share-actions-row">
              {isParticipant && !isHost && (
                <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn-share-pill ready-toggle ${!isMyReady ? 'unready' : ''}`}
                    onClick={handleToggleReady}
                  >
                    {isMyReady ? '✓ You Are Ready' : '⏳ Mark as Ready'}
                  </button>
                  <button
                    type="button"
                    className="btn-share-pill"
                    onClick={handleLeaveTournament}
                    style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171' }}
                  >
                    <span>🚪</span> Leave Lobby
                  </button>
                </div>
              )}
              {code && (
                <>
                  <button
                    type="button"
                    className="btn-share-pill"
                    onClick={handleCopyCode}
                  >
                    <span>{copied ? '✓' : '📋'}</span>
                    <span>{copied ? 'Code Copied!' : `Code: ${code}`}</span>
                  </button>
                  <button
                    type="button"
                    className="btn-share-pill"
                    onClick={handleShare}
                  >
                    <span>📤</span>
                    <span>Share Link</span>
                  </button>
                  <button
                    type="button"
                    className="btn-share-pill whatsapp"
                    onClick={handleWhatsAppShare}
                  >
                    <span>💬</span>
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="btn-share-pill"
                    onClick={() => setShowInviteModal(true)}
                  >
                    <span>👥</span>
                    <span>Invite Friends</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {code && (
            <div className="lobby-code-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <QRCodeSVG value={fullJoinUrl} size={136} label={`Scan QR • ${code}`} />
              <span className="code-label">Share Invite Code</span>
              <div className="code-display-group">
                <span className="lobby-code-text">{code}</span>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={handleCopyCode}
                  title="Copy code to clipboard"
                >
                  {copied ? '✓ Copied!' : '📋 Copy Code'}
                </button>
              </div>
              <button
                type="button"
                className="btn-share-pill"
                onClick={handleCopyJoinLink}
                style={{ fontSize: '0.75rem', padding: '5px 12px' }}
              >
                <span>{copiedLink ? '✓' : '🔗'}</span>
                <span>{copiedLink ? 'Invite Link Copied!' : 'Copy Invite Link'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Participant Seats Grid */}
        <div className="lobby-seats-section">
          <div className="section-header-row">
            <h3 className="section-title">Registered Players ({participants.length}/{maxPlayers})</h3>
            <span className="section-sub-tag">All slots will be seeded into matches</span>
          </div>

          <div className="seats-grid arena-stagger">
            {seats.map((player, idx) => {
              if (player) {
                const isPlayerHost = player.id === hostId;
                const isCurrentUser = currentUserId && player.id === currentUserId;

                return (
                  <div key={player.id || idx} className={`seat-card occupied ${isCurrentUser ? 'current-player' : ''}`}>
                    <div className="seat-avatar">
                      <span>{player.avatar || '👤'}</span>
                      {isPlayerHost && <span className="host-crown" title="Tournament Host">👑</span>}
                    </div>

                    <div className="seat-details">
                      <PlayerName
                        name={player.name}
                        seed={idx + 1}
                        isCurrentUser={isCurrentUser}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className={`seat-status-tag ${player.isBot || player.isReady ? 'ready' : 'waiting'}`}>
                          {player.isBot ? '🤖 Bot Ready' : (player.isReady ? '✓ Ready' : '⏳ Waiting')}
                        </span>
                        <span className={`seat-online-badge ${player.isOnline || isCurrentUser || player.isBot ? 'online' : 'offline'}`}>
                          {player.isBot ? '🤖 AI' : (player.isOnline || isCurrentUser ? '🟢 Online' : '⚫ Offline')}
                        </span>
                      </div>
                    </div>

                    {isHost && !isPlayerHost && (
                      <button
                        type="button"
                        className="btn-kick-player"
                        onClick={() => handleKick(player.id)}
                        title="Kick player from lobby"
                        aria-label={`Kick ${player.name}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              }

              // Empty Slot
              return (
                <div key={`empty-${idx}`} className="seat-card empty">
                  <div className="seat-avatar-empty">
                    <span>{idx + 1}</span>
                  </div>
                  <div className="seat-details">
                    <span className="empty-seat-title">Open Seat #{idx + 1}</span>
                    <span className="empty-seat-sub">Waiting for friend to join...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="lobby-bottom-bar">
          {isHost ? (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn-tactile btn-amber"
                disabled={isStarting}
                onClick={handleFillBotsAndStart}
                style={{ minHeight: '48px', padding: '10px 20px', fontWeight: 800 }}
              >
                <span>⚡</span>
                <span>Fill Slots with AI & Start</span>
              </button>
              <button
                type="button"
                className="btn-tactile btn-primary btn-start-tourn"
                disabled={!canStart || isStarting}
                onClick={handleStart}
              >
                <span>🚀</span>
                <span>
                  {isStarting
                    ? 'Starting Tournament...'
                    : canStart
                      ? `Start Tournament Now (${participants.length} Players)`
                      : (!meetsMinPlayers ? `Need Min ${minPlayersRequired} Players` : `Waiting (${unreadyNonHosts.length} Not Ready)`)}
                </span>
              </button>
            </div>
          ) : (
            <div className="lobby-waiting-notice">
              <span className="spinner-dot"></span>
              <span>Waiting for tournament host ({hostName || 'Host'}) to start the tournament...</span>
            </div>
          )}
        </div>
      </div>

      {/* Format Details Modal */}
      <FormatDetailsModal
        isOpen={showFormatModal}
        initialFormat={format}
        onClose={() => setShowFormatModal(false)}
      />

      {/* Invite Friends Modal */}
      {showInviteModal && (
        <div className="tourn-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setShowInviteModal(false)}>
          <div className="tourn-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="format-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>👥</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>Invite Friends to Tournament</h3>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowInviteModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                type="text"
                placeholder="🔍 Search friend username..."
                value={friendSearch}
                onChange={e => setFriendSearch(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--tourn-bg-surface)',
                  border: '1px solid var(--tourn-border)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: 'var(--tourn-text-primary)',
                  fontSize: '0.9rem'
                }}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                {directoryPlayers.length === 0 ? (
                  <p style={{ margin: '12px 0', textAlign: 'center', fontSize: '0.84rem', color: 'var(--tourn-text-muted)' }}>
                    No other registered players available right now. Share your tournament code <strong>{code}</strong> directly!
                  </p>
                ) : (
                  directoryPlayers
                    .filter(f => !friendSearch || (f.username || f.name || '').toLowerCase().includes(friendSearch.toLowerCase()))
                    .map(friend => {
                      const fName = friend.username || friend.name || 'Player';
                      const isInvited = invitedFriends[fName];
                      return (
                        <div
                          key={friend.id || fName}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'var(--tourn-bg-surface)',
                            borderRadius: '10px',
                            padding: '10px 12px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.3rem' }}>{friend.avatar || '🦊'}</span>
                            <div>
                              <strong style={{ fontSize: '0.9rem', display: 'block' }}>{fName}</strong>
                              <span style={{ fontSize: '0.72rem', color: friend.online ? 'var(--tourn-green)' : 'var(--tourn-text-muted)' }}>
                                ● {friend.online ? 'Online' : 'Registered'}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-tactile btn-secondary"
                            style={{
                              fontSize: '0.78rem',
                              padding: '6px 12px',
                              minHeight: '34px',
                              background: isInvited ? 'rgba(16, 185, 129, 0.2)' : undefined,
                              color: isInvited ? 'var(--tourn-green)' : undefined,
                              borderColor: isInvited ? 'var(--tourn-green)' : undefined
                            }}
                            onClick={() => handleSendFriendInvite({ id: friend.id, name: fName })}
                            disabled={isInvited}
                          >
                            {isInvited ? '✓ Invited' : 'Invite'}
                          </button>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--tourn-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-tactile btn-primary"
                onClick={() => setShowInviteModal(false)}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
