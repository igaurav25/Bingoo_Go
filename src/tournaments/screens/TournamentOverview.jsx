/**
 * src/tournaments/screens/TournamentOverview.jsx
 * 
 * Central Tournament Hub Screen (/tournaments/:id).
 * Features:
 * - Prominent "Next Action" Banner personalized to the player's real tournament status.
 * - Player Tournament Dashboard (Rank, Points, Wins/Losses, Qualification status).
 * - Format Visual Stage Progression.
 * - Quick navigation tabs (Overview, Fixtures, Table, Bracket, Results).
 * - Featured next active match card with direct "Play Match" CTA.
 */

import React, { useMemo, useState, useEffect } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Num } from '../components/Num.jsx';
import { MatchCard } from '../components/MatchCard.jsx';
import { StandingsTable } from '../components/StandingsTable.jsx';
import { BracketView } from '../components/BracketView.jsx';
import { PlayerName } from '../components/PlayerName.jsx';
import { FormatDetailsModal } from '../components/FormatDetailsModal.jsx';
import { selectFixtures, selectStandings, selectBracketRounds, normalizeMatch } from '../selectors.js';
import { socketClient } from '../../services/socketClient.js';

export function TournamentOverview({
  tournament,
  currentUserId = null,
  onNavigate = null,
  onPlayMatch = null,
  onRefresh = null
}) {
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [participantSearch, setParticipantSearch] = useState('');
  const [scheduleRoundFilter, setScheduleRoundFilter] = useState('all');
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState('all');

  // Strict Host Verification
  const isHost = Boolean(currentUserId && (
    tournament?.hostId === currentUserId ||
    tournament?.creatorId === currentUserId
  ));

  const [showHostModal, setShowHostModal] = useState(false);
  const [hostTab, setHostTab] = useState('settings');
  const [editName, setEditName] = useState(tournament?.name || '');
  const [editDescription, setEditDescription] = useState(tournament?.description || '');
  const [editPrizePool, setEditPrizePool] = useState(tournament?.prizePool || 1000);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [hostActionLoading, setHostActionLoading] = useState(false);
  const [hostActionMessage, setHostActionMessage] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [historyList, setHistoryList] = useState([]);

  useEffect(() => {
    if (activeTab !== 'history') return;
    fetch('/api/tournaments/history')
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.history)) {
          setHistoryList(d.history);
        }
      })
      .catch(() => {});
  }, [activeTab]);

  const { id, name, format, status, participants = [], prizePool = 1000, logo = '🏆', season = 'Season 01' } = tournament || {};

  // Fetch audit log when tab is active
  useEffect(() => {
    if (showHostModal && hostTab === 'audit' && id) {
      setIsLoadingAudit(true);
      fetch(`/api/tournaments/${id}/audit-log`)
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.auditLog)) {
            setAuditLogs(data.auditLog);
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingAudit(false));
    }
  }, [showHostModal, hostTab, id]);

  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setHostActionLoading(true);
    setHostActionMessage(null);
    try {
      const token = socketClient.getAuthToken?.();
      const res = await fetch(`/api/tournaments/${id}/settings`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          hostId: currentUserId,
          name: editName,
          description: editDescription,
          prizePool: Number(editPrizePool)
        })
      });
      const data = await res.json();
      if (data.success) {
        setHostActionMessage({ type: 'success', text: 'Settings updated successfully!' });
        if (onRefresh) onRefresh();
      } else {
        setHostActionMessage({ type: 'error', text: data.error || 'Failed to update settings.' });
      }
    } catch (err) {
      setHostActionMessage({ type: 'error', text: err.message || 'Error updating settings.' });
    } finally {
      setHostActionLoading(false);
    }
  };

  const handleKickParticipant = async (playerId, pName) => {
    if (typeof window !== 'undefined' && !window.confirm(`Are you sure you want to remove ${pName || 'this player'} from the tournament?`)) {
      return;
    }
    setHostActionLoading(true);
    setHostActionMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${id}/kick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: currentUserId,
          playerId
        })
      });
      const data = await res.json();
      if (data.success) {
        setHostActionMessage({ type: 'success', text: `Removed ${pName || 'player'} from the roster.` });
        if (onRefresh) onRefresh();
      } else {
        setHostActionMessage({ type: 'error', text: data.error || 'Failed to remove player.' });
      }
    } catch (err) {
      setHostActionMessage({ type: 'error', text: err.message || 'Error removing player.' });
    } finally {
      setHostActionLoading(false);
    }
  };

  const handleCancelTournament = async () => {
    if (typeof window !== 'undefined' && !window.confirm('CAUTION: Are you sure you want to cancel this entire tournament? This cannot be undone.')) {
      return;
    }
    setHostActionLoading(true);
    setHostActionMessage(null);
    try {
      const res = await fetch(`/api/tournaments/${id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostId: currentUserId,
          reason: cancelReason || 'Cancelled by tournament host'
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowHostModal(false);
        if (onNavigate) onNavigate('/tournaments');
      } else {
        setHostActionMessage({ type: 'error', text: data.error || 'Failed to cancel tournament.' });
      }
    } catch (err) {
      setHostActionMessage({ type: 'error', text: err.message || 'Error cancelling tournament.' });
    } finally {
      setHostActionLoading(false);
    }
  };
  const leagueFixturesList = useMemo(() => (tournament ? selectFixtures(tournament) : []), [tournament]);
  const playoffFixturesList = useMemo(
    () => (Array.isArray(tournament?.playoffMatches) ? tournament.playoffMatches.map((m, i) => normalizeMatch(m, i)) : []),
    [tournament]
  );
  const fixtures = useMemo(
    () => (format === 'HYBRID' ? [...leagueFixturesList, ...playoffFixturesList] : leagueFixturesList),
    [format, leagueFixturesList, playoffFixturesList]
  );
  const standings = useMemo(() => (tournament ? selectStandings(tournament) : []), [tournament]);
  const bracketRounds = useMemo(() => (tournament ? selectBracketRounds(tournament) : []), [tournament]);

  // Overall match counts & stage tracking
  const totalMatches = fixtures.length;
  const completedMatches = fixtures.filter(m => m.status === 'COMPLETED').length;
  const liveMatches = fixtures.filter(m => m.status === 'IN_PROGRESS' || m.status === 'READY');
  const remainingMatches = Math.max(0, totalMatches - completedMatches);
  const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const activeStageLabel = useMemo(() => {
    if (status === 'COMPLETED') return 'Championship Completed';
    const nextPlayoff = playoffFixturesList.find(m => m.status === 'IN_PROGRESS' || m.status === 'READY');
    if (nextPlayoff) return `Playoffs • ${nextPlayoff.roundTitle || nextPlayoff.round || 'Matchday'}`;
    if (status === 'PLAYOFFS' || tournament?.leagueLocked) return 'Championship Playoffs';
    const nextLive = fixtures.find(m => m.status === 'IN_PROGRESS' || m.status === 'READY');
    if (nextLive) return nextLive.roundTitle || nextLive.round || 'League Stage';
    return 'League Stage';
  }, [status, fixtures, playoffFixturesList, tournament?.leagueLocked]);
  const officialChampionId = tournament?.champion?.id || tournament?.winner?.id || tournament?.winnerId || null;
  const officialChampionName = tournament?.champion?.name || tournament?.winner?.name || tournament?.winnerName || standings[0]?.name || standings[0]?.playerName || (status === 'COMPLETED' ? 'Grand Champion' : 'TBD');
  const officialRunnerUpName = tournament?.runnerUp?.name || standings[1]?.name || standings[1]?.playerName || (status === 'COMPLETED' ? 'Runner-Up' : 'TBD');

  const hasBracket = format === 'KNOCKOUT' || format === 'HYBRID';
  const hasTable = format === 'LEAGUE' || format === 'HYBRID' || format === 'TEAM_LEAGUE';

  const displayTeams = Array.isArray(tournament?.teams) ? tournament.teams : [];

  // Enrich participants with their tournament match records
  const enrichedParticipants = useMemo(() => {
    return participants.map(p => {
      const isWinner = officialChampionId === p.id;
      const myStanding = standings.find(s => s.playerId === p.id);
      
      let pPlayed = 0;
      let pWon = 0;
      let pLost = 0;
      let pEliminated = p.qualificationStatus === 'ELIMINATED';

      fixtures.forEach(m => {
        const inMatch = m.slots?.some(s => s.playerId === p.id);
        if (inMatch && m.status === 'COMPLETED') {
          pPlayed++;
          if (m.winnerId === p.id) {
            pWon++;
          } else if (m.winnerId) {
            pLost++;
            const isPlayoffKO = format === 'KNOCKOUT'
              || ((m.stage === 'PLAYOFFS' || ['q1', 'elim', 'q2', 'sf', 'final', 'fin'].includes(String(m.roundKey || '').toLowerCase())) && !m.loserAdvancesTo);
            if (isPlayoffKO) {
              pEliminated = true;
            }
          }
        }
      });

      const winRate = pPlayed > 0 ? Math.round((pWon / pPlayed) * 100) : 0;
      let badgeStatus = 'ACTIVE';
      if (isWinner) badgeStatus = 'CHAMPION';
      else if (pEliminated) badgeStatus = 'ELIMINATED';
      else if (myStanding?.qualified) badgeStatus = 'QUALIFIED';

      return {
        ...p,
        played: pPlayed,
        won: pWon,
        lost: pLost,
        points: myStanding?.points || 0,
        winRate,
        badgeStatus
      };
    });
  }, [participants, fixtures, standings, tournament.winnerId, format]);

  const filteredParticipants = useMemo(() => {
    if (!participantSearch.trim()) return enrichedParticipants;
    const q = participantSearch.toLowerCase();
    return enrichedParticipants.filter(p => (p.name || '').toLowerCase().includes(q));
  }, [enrichedParticipants, participantSearch]);

  // Find user's next active or ready match
  const myNextMatch = useMemo(() => {
    if (!currentUserId || !fixtures.length) return null;
    return fixtures.find(m => {
      const isParticipant = m.slots?.some(s => s.playerId === currentUserId);
      const isActive = m.status === 'READY' || m.status === 'IN_PROGRESS';
      return isParticipant && isActive;
    }) || null;
  }, [fixtures, currentUserId]);

  // Compute player's personal tournament metrics
  const playerStats = useMemo(() => {
    if (!currentUserId) return null;
    const isParticipant = participants.some(p => p.id === currentUserId);
    if (!isParticipant) return null;

    const myStanding = standings.find(s => s.playerId === currentUserId);
    const myRank = standings.findIndex(s => s.playerId === currentUserId) + 1;

    // Check knockout elimination
    let isEliminated = false;
    let hasReachedFinal = false;

    fixtures.forEach(m => {
      const inMatch = m.slots?.some(s => s.playerId === currentUserId);
      if (inMatch) {
        if (m.roundTitle === 'Final' || m.isFinal) {
          hasReachedFinal = true;
        }
        if (m.status === 'COMPLETED' && m.winnerId && m.winnerId !== currentUserId) {
          if (format === 'KNOCKOUT' || (format === 'HYBRID' && (m.roundTitle?.includes('Semi') || m.roundTitle === 'Final'))) {
            isEliminated = true;
          }
        }
      }
    });

    const isQualified = myStanding?.qualified || (myRank > 0 && myRank <= 4);

    return {
      rank: myRank > 0 ? myRank : '-',
      points: myStanding?.points || 0,
      played: myStanding?.played || 0,
      won: myStanding?.won || 0,
      lost: myStanding?.lost || 0,
      isQualified,
      isEliminated,
      hasReachedFinal
    };
  }, [currentUserId, participants, standings, fixtures, format]);

  // Determine prominent "Next Action" based on actual tournament state
  const nextAction = useMemo(() => {
    if (status === 'COMPLETED') {
      const isWinner = officialChampionId && officialChampionId === currentUserId;
      if (isWinner) {
        return {
          tone: 'gold',
          icon: '👑',
          title: 'TOURNAMENT CHAMPION!',
          desc: 'Congratulations! You won the tournament and claimed the championship trophy.',
          actionText: 'View Trophy & Rewards →',
          actionUrl: `/tournaments/${id}/champion`
        };
      }
      return {
        tone: 'neutral',
        icon: '🏁',
        title: 'Tournament Concluded',
        desc: 'All fixtures are completed. View final tournament standings and champions.',
        actionText: 'View Results →',
        actionUrl: `/tournaments/${id}/results`
      };
    }

    if (myNextMatch) {
      const oppSlot = myNextMatch.slots?.find(s => s.playerId !== currentUserId);
      const oppName = oppSlot?.name || 'Opponent';
      return {
        tone: 'action-ready',
        icon: '⚡',
        title: 'Your Next Match is Ready!',
        desc: `You are paired against ${oppName} in ${myNextMatch.roundTitle || 'Round'}. Enter the match arena now!`,
        actionText: 'Play Match Now →',
        onAction: () => onPlayMatch && onPlayMatch(myNextMatch)
      };
    }

    if (playerStats?.isEliminated) {
      return {
        tone: 'eliminated',
        icon: '❌',
        title: 'You Have Been Eliminated',
        desc: 'You were knocked out in this tournament round. You can still spectate remaining matches and track standings.',
        actionText: 'View Fixtures & Standings →',
        actionUrl: `/tournaments/${id}/fixtures`
      };
    }

    if (playerStats?.hasReachedFinal) {
      return {
        tone: 'gold',
        icon: '🏆',
        title: 'Congratulations! You Reached the Final!',
        desc: 'Waiting for your final opponent match to finish. Get ready for the championship duel!',
        actionText: 'View Bracket Tree →',
        actionUrl: `/tournaments/${id}/bracket`
      };
    }

    if (playerStats?.isQualified && format !== 'KNOCKOUT') {
      return {
        tone: 'success',
        icon: '🎉',
        title: 'You Qualified for the Playoffs!',
        desc: 'Your group stage standings qualified you for the championship knockout rounds.',
        actionText: 'View Playoff Bracket →',
        actionUrl: `/tournaments/${id}/bracket`
      };
    }

    if (status === 'IN_PROGRESS') {
      return {
        tone: 'waiting',
        icon: '⏳',
        title: 'Waiting for Current Round Matches',
        desc: 'Other participants are currently playing their fixtures. Your next match pairing will appear as soon as the round completes.',
        actionText: 'View Live Matches →',
        actionUrl: `/tournaments/${id}/fixtures`
      };
    }

    return {
      tone: 'info',
      icon: '📋',
      title: 'Tournament Registered',
      desc: 'You are registered in the tournament roster. Prepare your card for upcoming matches.',
      actionText: 'View All Fixtures →',
      actionUrl: `/tournaments/${id}/fixtures`
    };
  }, [status, myNextMatch, playerStats, currentUserId, id, format, tournament.winnerId, onPlayMatch]);

  return (
    <PageShell
      title={name}
      subtitle={`${format} Tournament • ${status === 'IN_PROGRESS' ? 'Matches Live' : status}`}
      onBack={() => onNavigate && onNavigate('/tournaments')}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isHost && (
            <button
              type="button"
              className="btn-tactile btn-amber"
              onClick={() => {
                setShowHostModal(true);
                setHostActionMessage(null);
              }}
              style={{ fontSize: '0.85rem', padding: '8px 12px' }}
            >
              <span>👑</span> Host Controls
            </button>
          )}
          <button
            type="button"
            className="btn-tactile btn-secondary"
            onClick={() => setShowFormatModal(true)}
            style={{ fontSize: '0.85rem', padding: '8px 12px' }}
          >
            <span>ℹ️</span> Rules
          </button>
          {status === 'COMPLETED' && (
            <button
              type="button"
              className="btn-tactile btn-amber"
              onClick={() => onNavigate && onNavigate(`/tournaments/${id}/champion`)}
            >
              <span>🏆</span> Champion
            </button>
          )}
        </div>
      }
    >
      <div className="tourn-overview-container">
        {/* Navigation Tabs Bar for Tournament */}
        <nav className="tourn-10tabs-nav" aria-label="Tournament navigation">
          {[
            { id: 'overview', label: 'Overview', icon: '🏠' },
            { id: 'lobby', label: 'Lobby', icon: '🛋️', count: participants.length },
            { id: 'league', label: 'League Fixtures', icon: '🏏', count: leagueFixturesList.length },
            { id: 'live', label: 'Live Matches', icon: '🔴', count: liveMatches.length },
            { id: 'schedule', label: 'Fixtures', icon: '📅', count: totalMatches },
            { id: 'table', label: 'Points Table', icon: '📋' },
            { id: 'teams', label: 'Teams', icon: '🦁', count: displayTeams.length },
            { id: 'players', label: 'Participants', icon: '👥', count: participants.length },
            { id: 'playoffs', label: 'Bracket', icon: '🥊' },
            { id: 'final', label: 'Grand Final', icon: '🔥' },
            { id: 'champion', label: 'Champion', icon: '👑' },
            { id: 'stats', label: 'Statistics', icon: '📊' },
            { id: 'results', label: 'Results', icon: '🏆' },
            { id: 'history', label: 'History', icon: '📜' },
            { id: 'rewards', label: 'Rewards', icon: '🎁' },
            { id: 'rules', label: 'Rules', icon: 'ℹ️' },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`tourn-10tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="tourn-tab-badge">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>

        {/* ==================== 1. OVERVIEW TAB ==================== */}
        {activeTab === 'overview' && (
          <>
            {/* Prominent Next Action Banner */}
            <div className={`tourn-next-action-banner tone-${nextAction.tone}`} role="region" aria-label="Your next tournament action">
              <div className="next-action-icon-col">
                <span className="action-main-icon">{nextAction.icon}</span>
              </div>

              <div className="next-action-body">
                <div className="action-tagline">NEXT ACTION FOR YOU</div>
                <h3 className="action-title">{nextAction.title}</h3>
                <p className="action-desc">{nextAction.desc}</p>

                <div className="action-btn-row">
                  {nextAction.onAction ? (
                    <button
                      type="button"
                      className="btn-tactile btn-primary btn-play-action"
                      onClick={nextAction.onAction}
                    >
                      <span>⚔️</span>
                      <span>{nextAction.actionText}</span>
                    </button>
                  ) : nextAction.actionUrl ? (
                    <button
                      type="button"
                      className="btn-tactile btn-primary btn-play-action"
                      onClick={() => onNavigate && onNavigate(nextAction.actionUrl)}
                    >
                      <span>{nextAction.actionText}</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Player Tournament Dashboard */}
            {playerStats && (
              <div className="tourn-player-dashboard-card">
                <div className="dash-header">
                  <span className="dash-title">👤 Your Tournament Dashboard</span>
                  <span className="dash-status-pill">
                    {playerStats.isEliminated ? 'Eliminated' : playerStats.isQualified ? 'Playoff Qualified' : 'Active Contender'}
                  </span>
                </div>

                <div className="dash-stats-grid">
                  <div className="dash-stat-box">
                    <span className="stat-label">Current Rank</span>
                    <strong className="stat-val rank-val">#{playerStats.rank}</strong>
                  </div>

                  <div className="dash-stat-box">
                    <span className="stat-label">Points</span>
                    <strong className="stat-val points-val">{playerStats.points} pts</strong>
                  </div>

                  <div className="dash-stat-box">
                    <span className="stat-label">Record (W - L)</span>
                    <strong className="stat-val">{playerStats.won}W - {playerStats.lost}L</strong>
                  </div>

                  <div className="dash-stat-box">
                    <span className="stat-label">Matches Played</span>
                    <strong className="stat-val">{playerStats.played} Matches</strong>
                  </div>
                </div>
              </div>
            )}

            {/* IPL Season Flow Progression Strip */}
            {format === 'HYBRID' && (
              <div
                className="tourn-season-flow-strip"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  alignItems: 'center',
                  background: 'rgba(13, 21, 38, 0.72)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}
              >
                {[
                  { label: '1. Lobby', done: status !== 'REGISTERING', active: status === 'REGISTERING', tab: 'lobby' },
                  { label: `2. League (${leagueFixturesList.filter(m => m.status === 'COMPLETED').length}/${leagueFixturesList.length})`, done: Boolean(tournament?.leagueLocked), active: status === 'IN_PROGRESS' && !tournament?.leagueLocked, tab: 'schedule' },
                  { label: `3. Points Table (Top ${tournament?.qualificationSlots || 4})`, done: Boolean(tournament?.leagueLocked), active: status === 'IN_PROGRESS' && !tournament?.leagueLocked, tab: 'table' },
                  { label: `4. ${tournament?.playoffFormat === 'TOP2_FINAL' ? 'Final Stage' : 'IPL Playoffs'}`, done: status === 'COMPLETED', active: status === 'PLAYOFFS' || (tournament?.leagueLocked && status !== 'COMPLETED'), tab: 'playoffs' },
                  { label: '5. Grand Final & Champion', done: status === 'COMPLETED', active: status === 'COMPLETED', tab: 'results' }
                ].map((step, sIdx) => (
                  <React.Fragment key={step.label}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(step.tab)}
                      style={{
                        background: step.active ? 'rgba(245, 158, 11, 0.18)' : (step.done ? 'rgba(0, 229, 163, 0.14)' : 'rgba(255,255,255,0.04)'),
                        border: `1px solid ${step.active ? '#F59E0B' : (step.done ? '#00E5A3' : 'rgba(255,255,255,0.1)')}`,
                        color: step.active ? '#FBBF24' : (step.done ? '#00E5A3' : '#94A3B8'),
                        borderRadius: '999px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 800
                      }}
                    >
                      {step.done ? '✓ ' : ''}{step.label}
                    </button>
                    {sIdx < 4 && <span style={{ color: '#64748B' }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Tournament Progress Banner */}
            <div className="tourn-summary-banner">
              <div className="banner-details">
                <div className="banner-badge-row">
                  <span className="tourn-format-badge">{logo} {season}</span>
                  <span className="tourn-format-badge">{format}</span>
                  <StatusBadge status={status} size="small" />
                </div>
                <div className="banner-meta">
                  <span>👥 {participants.length} Players</span>
                  <span className="bullet">•</span>
                  <span>🥊 {activeStageLabel}</span>
                  <span className="bullet">•</span>
                  <span>✅ {completedMatches} Done / ⏳ {remainingMatches} Left</span>
                  <span className="bullet">•</span>
                  <span>🪙 <Num value={prizePool} /> Coins Pool</span>
                </div>
              </div>

              <div className="banner-progress-section">
                <div className="progress-labels">
                  <span>Matches Progress</span>
                  <span><Num value={completedMatches} /> / <Num value={totalMatches} /> ({progressPct}%)</span>
                </div>
                <div className="tourn-progress-track">
                  <div className="tourn-progress-bar" style={{ width: `${progressPct}%` }}></div>
                </div>
              </div>
            </div>

            {/* Featured Next Match */}
            {myNextMatch && (
              <div className="my-next-match-card">
                <div className="callout-header">
                  <span className="callout-badge">⚡ Match Ready</span>
                  <span className="callout-round">{myNextMatch.roundTitle}</span>
                </div>
                <MatchCard
                  match={myNextMatch}
                  currentUserId={currentUserId}
                  isOnMyPath={true}
                  isFeatured={true}
                  onPlay={onPlayMatch}
                  onViewDetails={(m) => onNavigate && onNavigate(`/tournaments/${id}/matches/${m.id}`)}
                />
              </div>
            )}

            {/* Live Matches Preview */}
            {liveMatches.length > 0 && !myNextMatch && (
              <section className="overview-section">
                <div className="section-header-row">
                  <h3 className="section-heading">🔴 Live & Upcoming Matches</h3>
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={() => setActiveTab('live')}
                  >
                    View All Live ({liveMatches.length}) →
                  </button>
                </div>
                <div className="overview-matches-grid">
                  {liveMatches.slice(0, 3).map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUserId={currentUserId}
                      onPlay={onPlayMatch}
                      onViewDetails={(m) => onNavigate && onNavigate(`/tournaments/${id}/matches/${m.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Standings Table Preview */}
            {hasTable && standings.length > 0 && (
              <section className="overview-section">
                <div className="section-header-row">
                  <h3 className="section-heading">📋 Standings Preview</h3>
                  <button
                    type="button"
                    className="btn-link-action"
                    onClick={() => setActiveTab('table')}
                  >
                    Full Points Table →
                  </button>
                </div>
                <StandingsTable
                  standings={standings.slice(0, 5)}
                  tournament={tournament}
                  currentUserId={currentUserId}
                  qualifierCutoff={tournament?.qualificationSlots || 4}
                  tieBreakRule="Points > Direct Head-to-Head > Total Wins > Win %"
                  showCompactOnMobile={true}
                />
              </section>
            )}

            {/* Quick Actions Footer */}
            <div className="overview-quick-actions" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {myNextMatch && (
                <button
                  type="button"
                  className="btn-tactile btn-amber action-btn-half"
                  onClick={() => onPlayMatch && onPlayMatch(myNextMatch)}
                >
                  <span>⚔️</span>
                  <span>Open My Match</span>
                </button>
              )}
              {hasBracket && (
                <button
                  type="button"
                  className="btn-tactile btn-primary action-btn-half"
                  onClick={() => setActiveTab('playoffs')}
                >
                  <span>🥊</span>
                  <span>View Bracket</span>
                </button>
              )}
              <button
                type="button"
                className="btn-tactile btn-secondary action-btn-half"
                onClick={() => setActiveTab('players')}
              >
                <span>👥</span>
                <span>View Participants ({participants.length})</span>
              </button>
              <button
                type="button"
                className="btn-tactile btn-secondary action-btn-half"
                onClick={() => status === 'COMPLETED' && onNavigate ? onNavigate(`/tournaments/${id}/champion`) : setActiveTab('results')}
              >
                <span>🏆</span>
                <span>View Results</span>
              </button>
              <button
                type="button"
                className="btn-tactile btn-secondary action-btn-half"
                onClick={() => setActiveTab('schedule')}
              >
                <span>📋</span>
                <span>All Fixtures ({fixtures.length})</span>
              </button>
            </div>
          </>
        )}

        {/* ==================== 2. LIVE MATCHES TAB ==================== */}
        {activeTab === 'live' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="section-header-row">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🔴 Live & Active Matches ({liveMatches.length})</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                  Active fixtures currently in progress or waiting for players. Click Play Match to start.
                </p>
              </div>
            </div>

            {liveMatches.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--tourn-bg-card)', borderRadius: '12px', border: '1px solid var(--tourn-border)' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '8px' }}>⏳</span>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>No Active Matches Right Now</h4>
                <p style={{ color: 'var(--tourn-text-muted)', fontSize: '0.88rem', margin: '6px 0 16px' }}>
                  All matches for the current round are finished. Check the Schedule tab for upcoming rounds.
                </p>
                <button type="button" className="btn-tactile btn-secondary" onClick={() => setActiveTab('schedule')}>
                  View Schedule Tab →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
                {liveMatches.map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={currentUserId}
                    onPlay={onPlayMatch}
                    onViewDetails={(m) => onNavigate && onNavigate(`/tournaments/${id}/matches/${m.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== 3. SCHEDULE TAB ==================== */}
        {activeTab === 'schedule' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📅 Tournament Fixtures Schedule ({fixtures.length})</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                  Complete round-by-round pairings, match timings, and completed results.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {['all', 'ready', 'completed', 'my'].map(st => (
                  <button
                    key={st}
                    type="button"
                    className={`select-chip ${scheduleStatusFilter === st ? 'active' : ''}`}
                    onClick={() => setScheduleStatusFilter(st)}
                    style={{ padding: '6px 12px', fontSize: '0.78rem', minHeight: '34px' }}
                  >
                    {st === 'all' ? 'All Matches' : st === 'ready' ? '⚡ Ready' : st === 'completed' ? '✓ Completed' : '👤 My Matches'}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtered fixtures grouped by roundTitle */}
            {(() => {
              const filtered = fixtures.filter(m => {
                if (scheduleStatusFilter === 'ready') return m.status === 'READY' || m.status === 'IN_PROGRESS';
                if (scheduleStatusFilter === 'completed') return m.status === 'COMPLETED';
                if (scheduleStatusFilter === 'my') return currentUserId && m.slots?.some(s => s.playerId === currentUserId);
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '30px', background: 'var(--tourn-bg-card)', borderRadius: '12px' }}>
                    <p style={{ margin: 0, color: 'var(--tourn-text-muted)' }}>No fixtures match the selected filter.</p>
                  </div>
                );
              }

              // Group by round
              const groups = new Map();
              for (const m of filtered) {
                const title = m.roundTitle || 'Round 1';
                if (!groups.has(title)) groups.set(title, []);
                groups.get(title).push(m);
              }

              return Array.from(groups.entries()).map(([roundTitle, matches]) => (
                <div key={roundTitle} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--tourn-border)', paddingBottom: '6px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--tourn-amber)' }}>🥊 {roundTitle}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--tourn-text-muted)' }}>({matches.length} matches)</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
                    {matches.map(m => (
                      <MatchCard
                        key={m.id}
                        match={m}
                        currentUserId={currentUserId}
                        onPlay={onPlayMatch}
                        onViewDetails={(match) => onNavigate && onNavigate(`/tournaments/${id}/matches/${match.id}`)}
                      />
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* ==================== 4. POINTS TABLE TAB ==================== */}
        {activeTab === 'table' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📋 Official Tournament Points Table ({season})</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                +{tournament?.pointsPerWin ?? 2} Points awarded for Match Victory{tournament?.pointsPerLoss ? ` (+${tournament.pointsPerLoss} Loss)` : ''}. Top {tournament?.qualificationSlots || 4} advance to Championship Playoffs.
              </p>
            </div>
            <StandingsTable
              standings={standings}
              tournament={tournament}
              currentUserId={currentUserId}
              qualifierCutoff={tournament?.qualificationSlots || 4}
              tieBreakRule="Points > Direct Head-to-Head > Total Wins > Win %"
            />
          </div>
        )}

        {/* ==================== 5. TEAMS TAB ==================== */}
        {activeTab === 'teams' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🦁 Tournament Franchise Teams ({displayTeams.length})</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                IPL-inspired team franchises, captains, active squads, and points tallies.
              </p>
            </div>

            <div className="franchise-teams-grid">
              {displayTeams.map(t => (
                <div key={t.id} className="franchise-team-card">
                  <div className="team-card-header">
                    <div className="team-brand">
                      <div className="team-logo-badge">{t.logo || '🛡️'}</div>
                      <div>
                        <h4 className="team-name-title">{t.name}</h4>
                        <span className="team-captain-tag">👑 Captain: {t.captainName || 'Captain'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="team-card-stats">
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--tourn-text-muted)' }}>P</div>
                      <div style={{ fontWeight: 800 }}><Num value={t.played || 0} /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--tourn-text-muted)' }}>W</div>
                      <div style={{ fontWeight: 800, color: 'var(--tourn-green)' }}><Num value={t.won || 0} /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--tourn-text-muted)' }}>L</div>
                      <div style={{ fontWeight: 800 }}><Num value={t.lost || 0} /></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--tourn-text-muted)' }}>PTS</div>
                      <div style={{ fontWeight: 800, color: 'var(--tourn-amber)' }}><Num value={t.points || 0} /></div>
                    </div>
                  </div>

                  <div className="team-roster-list">
                    <span style={{ fontSize: '0.72rem', color: 'var(--tourn-text-muted)', fontWeight: 700 }}>SQUAD ROSTER:</span>
                    {(t.members || ['Player 1', 'Player 2']).map((m, idx) => (
                      <div key={idx} className="team-roster-item">
                        <span>👤 {typeof m === 'string' ? m : m.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--tourn-green)' }}>● Active</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 6. PLAYERS TAB ==================== */}
        {activeTab === 'players' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>👥 Tournament Roster ({participants.length})</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--tourn-text-secondary)', margin: '4px 0 0 0' }}>
                  Track participant match performance, qualification and knockout status.
                </p>
              </div>
              <input
                type="text"
                placeholder="🔍 Search participant..."
                value={participantSearch}
                onChange={e => setParticipantSearch(e.target.value)}
                style={{
                  background: 'var(--tourn-bg-surface)',
                  border: '1px solid var(--tourn-border)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  color: 'var(--tourn-text-primary)',
                  fontSize: '0.85rem',
                  maxWidth: '220px'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {filteredParticipants.map(p => {
                const isMe = p.id === currentUserId;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: isMe ? 'rgba(245, 158, 11, 0.08)' : 'var(--tourn-bg-card)',
                      border: isMe ? '1px solid var(--tourn-border-highlight)' : '1px solid var(--tourn-border)',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontSize: '1.6rem', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--tourn-bg-surface)', borderRadius: '50%' }}>
                          {p.avatar || '🦊'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{p.name || 'Player'}</span>
                            {isMe && (
                              <span style={{ fontSize: '0.65rem', background: 'var(--tourn-amber)', color: '#000', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>YOU</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--tourn-text-muted)' }}>
                            Seed #{p.seed || 1}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <StatusBadge status={p.qualificationStatus || p.badgeStatus} size="small" />
                        <span className={`seat-online-badge ${p.isOnline || isMe || p.isBot ? 'online' : 'offline'}`}>
                          {p.isBot ? '🤖 AI' : (p.isOnline || isMe ? '🟢 Online' : '⚫ Offline')}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: 'var(--tourn-bg-surface)', borderRadius: '8px', padding: '8px', textAlign: 'center', fontSize: '0.8rem' }}>
                      <div>
                        <div style={{ color: 'var(--tourn-text-muted)', fontSize: '0.7rem' }}>Played</div>
                        <div style={{ fontWeight: 700 }}>{p.played}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--tourn-text-muted)', fontSize: '0.7rem' }}>W - L</div>
                        <div style={{ fontWeight: 700, color: p.won > p.lost ? 'var(--tourn-green)' : 'inherit' }}>{p.won} - {p.lost}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--tourn-text-muted)', fontSize: '0.7rem' }}>{hasTable ? 'Points' : 'Win %'}</div>
                        <div style={{ fontWeight: 700, color: 'var(--tourn-amber)' }}>{hasTable ? `${p.points} pts` : `${p.winRate}%`}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== 7. PLAYOFFS TAB ==================== */}
        {activeTab === 'playoffs' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🥊 Championship Playoffs Bracket</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Single-elimination playoff tree leading to the Grand Final and Champion crowning.
              </p>
            </div>
            <BracketView
              tournament={tournament}
              currentUserId={currentUserId}
              onPlayMatch={onPlayMatch}
              onViewMatchDetails={(m) => m?.id && onNavigate && onNavigate(`/tournaments/${id}/matches/${m.id}`)}
              onViewChampion={() => onNavigate && onNavigate(`/tournaments/${id}/champion`)}
            />
          </div>
        )}

        {/* ==================== 8. STATISTICS TAB ==================== */}
        {activeTab === 'stats' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📊 Tournament Leaders & Statistics</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Top performing players across points, victories, and match consistency.
              </p>
            </div>

            <div className="tourn-stats-grid">
              {/* Leaderboard 1: Top Points */}
              <div className="tourn-stat-leader-card">
                <h4 className="stat-leader-title">
                  <span>🏆</span>
                  <span>Top Points Leaders</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...enrichedParticipants].sort((a,b) => b.points - a.points).slice(0, 5).map((p, idx) => (
                    <div key={p.id} className={`leader-row ${idx === 0 ? 'gold-leader' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, minWidth: '2ch', color: idx === 0 ? 'var(--tourn-amber)' : 'inherit' }}>#{idx + 1}</span>
                        <span>{p.avatar || '👤'}</span>
                        <strong style={{ fontSize: '0.9rem' }}>{p.name}</strong>
                      </div>
                      <strong style={{ color: 'var(--tourn-amber)' }}>{p.points} PTS</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard 2: Most Wins */}
              <div className="tourn-stat-leader-card">
                <h4 className="stat-leader-title">
                  <span>⚡</span>
                  <span>Most Match Wins</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[...enrichedParticipants].sort((a,b) => b.won - a.won).slice(0, 5).map((p, idx) => (
                    <div key={p.id} className={`leader-row ${idx === 0 ? 'gold-leader' : ''}`}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, minWidth: '2ch', color: idx === 0 ? 'var(--tourn-amber)' : 'inherit' }}>#{idx + 1}</span>
                        <span>{p.avatar || '👤'}</span>
                        <strong style={{ fontSize: '0.9rem' }}>{p.name}</strong>
                      </div>
                      <strong style={{ color: 'var(--tourn-green)' }}>{p.won} Wins</strong>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leaderboard 3: Tournament Overview Summary */}
              <div className="tourn-stat-leader-card">
                <h4 className="stat-leader-title">
                  <span>📈</span>
                  <span>Tournament Overview</span>
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="leader-row">
                    <span>Total Matches Scheduled:</span>
                    <strong><Num value={totalMatches} /></strong>
                  </div>
                  <div className="leader-row">
                    <span>Completed Matches:</span>
                    <strong style={{ color: 'var(--tourn-green)' }}><Num value={completedMatches} /></strong>
                  </div>
                  <div className="leader-row">
                    <span>Completion Progress:</span>
                    <strong style={{ color: 'var(--tourn-amber)' }}>{progressPct}%</strong>
                  </div>
                  <div className="leader-row">
                    <span>Prize Pool Total:</span>
                    <strong style={{ color: 'var(--gold-dark)' }}>🪙 <Num value={prizePool} /> Coins</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 9. RESULTS TAB ==================== */}
        {activeTab === 'results' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🏆 Championship Results & Podium</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Official tournament conclusion, champions podium, and prize rewards.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {/* 1st Place */}
              <div style={{ background: 'rgba(245, 158, 11, 0.12)', border: '2px solid var(--tourn-amber)', borderRadius: '16px', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '3rem' }}>👑</span>
                <span style={{ fontSize: '0.8rem', background: 'var(--tourn-amber)', color: '#000', fontWeight: 800, padding: '2px 10px', borderRadius: '12px' }}>1ST PLACE CHAMPION</span>
                <h4 style={{ margin: '4px 0', fontSize: '1.2rem', fontWeight: 800 }}>
                  {officialChampionName}
                </h4>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--gold-dark)' }}>
                  🪙 {Math.round(prizePool * 0.60)} Coins (60%)
                </div>
              </div>

              {/* 2nd Place */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '2.5rem' }}>🥈</span>
                <span style={{ fontSize: '0.75rem', background: '#94a3b8', color: '#000', fontWeight: 800, padding: '2px 10px', borderRadius: '12px' }}>2ND PLACE RUNNER-UP</span>
                <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800 }}>
                  {officialRunnerUpName}
                </h4>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--gold-dark)' }}>
                  🪙 {Math.round(prizePool * 0.25)} Coins (25%)
                </div>
              </div>

              {/* 3rd Place */}
              <div style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '16px', padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '2.5rem' }}>🥉</span>
                <span style={{ fontSize: '0.75rem', background: '#b45309', color: '#fff', fontWeight: 800, padding: '2px 10px', borderRadius: '12px' }}>3RD PLACE</span>
                <h4 style={{ margin: '4px 0', fontSize: '1.1rem', fontWeight: 800 }}>
                  {standings[2]?.name || standings[2]?.playerName || 'TBD'}
                </h4>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--gold-dark)' }}>
                  🪙 {Math.round(prizePool * 0.15)} Coins (15%)
                </div>
              </div>
            </div>

            {status === 'COMPLETED' && (
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn-tactile btn-amber"
                  onClick={() => onNavigate && onNavigate(`/tournaments/${id}/champion`)}
                  style={{ padding: '10px 24px', fontSize: '1rem' }}
                >
                  <span>🎉</span>
                  <span>View Grand Celebration Screen →</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== 10. RULES TAB ==================== */}
        {activeTab === 'rules' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>ℹ️ Official Tournament Format Rules</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Comprehensive rules regarding gameplay, scoring, tie-breakers, and qualification.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div className="rule-box">
                <strong>🎯 5×5 Bingo Board & Turn Clock</strong>
                <ul>
                  <li>Each match is played on a standard 5×5 grid with numbers 1 to 25.</li>
                  <li>Players take turns calling numbers with a 30-second turn clock.</li>
                  <li>First player to complete 5 lines shouts BINGO and wins the match.</li>
                </ul>
              </div>

              <div className="rule-box">
                <strong>⚖️ Points &amp; Scoring System</strong>
                <ul>
                  <li>Each verified Match Victory awards <strong>+{tournament.pointsPerWin ?? 2} Points</strong> in the league table.</li>
                  <li>Losses award <strong>{tournament.pointsPerLoss ?? 0} Points</strong>.</li>
                  <li>All statistics (matches played, won, lost, win %, points, head-to-head) update atomically after server win verification.</li>
                </ul>
              </div>

              <div className="rule-box">
                <strong>🛡️ Tie-Breaker Hierarchy</strong>
                <ul>
                  <li>1. Total Points earned</li>
                  <li>2. Direct Head-to-Head match outcome</li>
                  <li>3. Total Match Victories</li>
                  <li>4. Win Percentage &amp; Lobby Seed</li>
                </ul>
              </div>

              <div className="rule-box">
                <strong>🥊 IPL-Style Playoff Qualification</strong>
                {tournament.playoffFormat === 'TOP2_FINAL' ? (
                  <ul>
                    <li>Top 2 ranked players qualify directly for the <strong>Grand Final</strong>.</li>
                    <li>Grand Final winner is crowned Champion; loser finishes Runner-Up.</li>
                  </ul>
                ) : tournament.playoffFormat === 'SEMIFINAL_TOP4' ? (
                  <ul>
                    <li>Top 4 seeds qualify for Semifinals (Rank #1 vs #4 and Rank #2 vs #3).</li>
                    <li>Semifinal winners clash in the Grand Final for the championship trophy.</li>
                  </ul>
                ) : (
                  <ul>
                    <li>Top 4 league finishers qualify for IPL-style Playoffs once league standings lock.</li>
                    <li><strong>Qualifier 1 (Rank 1 vs Rank 2)</strong>: Winner advances straight to Grand Final; Loser drops to Qualifier 2.</li>
                    <li><strong>Eliminator (Rank 3 vs Rank 4)</strong>: Winner advances to Qualifier 2; Loser is eliminated.</li>
                    <li><strong>Qualifier 2</strong>: Qualifier 1 Loser vs Eliminator Winner clash for the final Grand Final spot.</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 11. LOBBY TAB ==================== */}
        {activeTab === 'lobby' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🛋️ Tournament Bingo Lobby</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Room Code: <strong>{tournament.code}</strong> • Lobby Status: <strong>{tournament.lobby?.status || status}</strong> • Online: <strong>{tournament.onlineCount || 0}</strong>
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
              {participants.map((p, idx) => (
                <div key={p.id || idx} className="seat-card occupied">
                  <div className="seat-avatar">{p.avatar || '🦊'}</div>
                  <div className="seat-details">
                    <PlayerName name={p.name} seed={p.seed || idx + 1} isCurrentUser={p.id === currentUserId} />
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span className={`seat-status-tag ${p.isReady || p.isBot ? 'ready' : 'waiting'}`}>
                        {p.isBot ? '🤖 Bot' : (p.isReady ? '✓ Ready' : '⏳ Waiting')}
                      </span>
                      <span className={`seat-online-badge ${p.isOnline || p.id === currentUserId || p.isBot ? 'online' : 'offline'}`}>
                        {p.isOnline || p.id === currentUserId ? '🟢 Online' : '⚫ Offline'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 12. TOURNAMENT HISTORY TAB ==================== */}
        {activeTab === 'history' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>📜 Tournament Event Timeline &amp; History</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Authoritative audit events for this tournament alongside concluded tournament champions.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div className="rule-box">
                <strong>⚡ Tournament Event Log</strong>
                {(tournament.auditLog || []).length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>No events logged yet.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {(tournament.auditLog || []).slice(0, 20).map(ev => (
                      <div key={ev.id} style={{ padding: '8px', background: 'rgba(15,23,42,0.55)', borderRadius: '8px', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#38bdf8' }}>{ev.action}</strong> • <span>{ev.details}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rule-box">
                <strong>🏆 Past Champions Archive ({historyList.length})</strong>
                {historyList.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>Complete this tournament to record the first champion.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {historyList.map(ht => (
                      <div key={ht.id} style={{ padding: '8px 10px', background: 'rgba(15,23,42,0.55)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                        <div>
                          <strong>{ht.name}</strong>
                          <span style={{ display: 'block', color: 'var(--tourn-amber)', fontSize: '0.75rem' }}>
                            👑 Champion: {ht.champion?.name || ht.winner?.name || 'Verified Winner'}
                          </span>
                        </div>
                        <button type="button" className="btn-link-action" onClick={() => onNavigate && onNavigate(`/tournaments/${ht.id}/champion`)}>
                          View →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 13. REWARDS TAB ==================== */}
        {activeTab === 'rewards' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🎁 Tournament Prize Pool &amp; Verified Rewards</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                Total Prize Pool: <strong>🪙 <Num value={prizePool} /> Coins</strong> • Rewards are credited once upon verified championship completion.
              </p>
            </div>
            {(tournament.rewards || []).length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                {tournament.rewards.map(r => (
                  <div key={r.id} style={{ background: 'var(--tourn-bg-card)', border: '1px solid var(--tourn-border-highlight)', borderRadius: '12px', padding: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--tourn-amber)', fontWeight: 800 }}>
                      {r.placement === 1 ? '🥇 1ST PLACE CHAMPION' : '🥈 2ND PLACE RUNNER-UP'}
                    </span>
                    <h4 style={{ margin: '6px 0 4px' }}>{r.recipientName}</h4>
                    <div style={{ fontWeight: 800, color: '#fbbf24' }}>🪙 <Num value={r.coinsAwarded} /> Coins</div>
                    <span style={{ fontSize: '0.72rem', color: '#10b981' }}>✓ {r.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div className="rule-box"><strong>🥇 Champion Reward</strong><p style={{ color: '#fbbf24', fontWeight: 800 }}>🪙 {Math.round(prizePool * 0.6)} Coins</p></div>
                <div className="rule-box"><strong>🥈 Runner-Up Reward</strong><p style={{ color: '#94a3b8', fontWeight: 800 }}>🪙 {Math.round(prizePool * 0.25)} Coins</p></div>
                <div className="rule-box"><strong>🥉 3rd Place Share</strong><p style={{ color: '#d97706', fontWeight: 800 }}>🪙 {Math.round(prizePool * 0.15)} Coins</p></div>
              </div>
            )}
          </div>
        )}

        {/* ==================== 14. LEAGUE FIXTURES TAB ==================== */}
        {activeTab === 'league' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🏏 League Stage Fixtures ({leagueFixturesList.length})</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                {tournament.matchesPerPlayer
                  ? `Every participant plays ${tournament.matchesPerPlayer} league matches before Top ${tournament.qualificationSlots || 4} qualification locks.`
                  : 'Round-robin league fixtures powered by live multiplayer 5×5 Bingo.'}
              </p>
            </div>
            {leagueFixturesList.length === 0 ? (
              <div style={{ padding: '24px', background: 'var(--tourn-bg-card)', borderRadius: '12px', textAlign: 'center', color: 'var(--tourn-text-muted)' }}>
                League fixtures will be generated once the host starts the tournament.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
                {leagueFixturesList.map(m => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    currentUserId={currentUserId}
                    onPlay={onPlayMatch}
                    onViewDetails={(match) => onNavigate && onNavigate(`/tournaments/${id}/matches/${match.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== 15. GRAND FINAL TAB ==================== */}
        {activeTab === 'final' && (() => {
          const grandFinal = playoffFixturesList.find(m => m.playoffStage === 'GRAND_FINAL' || m.roundKey === 'fin' || m.roundKey === 'final')
            || playoffFixturesList[playoffFixturesList.length - 1]
            || (format === 'KNOCKOUT' ? fixtures[fixtures.length - 1] : null);
          return (
            <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>🔥 Championship Grand Final</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--tourn-text-muted)' }}>
                  Played via live multiplayer 5×5 Bingo. Winner becomes Champion; loser finishes Runner-Up.
                </p>
              </div>
              {grandFinal ? (
                <div style={{ maxWidth: '520px' }}>
                  <MatchCard
                    match={grandFinal}
                    currentUserId={currentUserId}
                    isFeatured={true}
                    onPlay={onPlayMatch}
                    onViewDetails={(match) => onNavigate && onNavigate(`/tournaments/${id}/matches/${match.id}`)}
                  />
                </div>
              ) : (
                <div style={{ padding: '24px', background: 'var(--tourn-bg-card)', borderRadius: '12px', color: 'var(--tourn-text-muted)' }}>
                  Complete earlier rounds to unlock the Grand Final matchup.
                </div>
              )}
            </div>
          );
        })()}

        {/* ==================== 16. CHAMPION TAB ==================== */}
        {activeTab === 'champion' && (
          <div className="tourn-tab-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '28px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.18), rgba(15, 23, 42, 0.9))', border: '1px solid rgba(251, 191, 36, 0.45)', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem' }}>👑</div>
              <h3 style={{ margin: '8px 0 4px', fontSize: '1.45rem', fontWeight: 900, color: '#FBBF24' }}>
                {status === 'COMPLETED' ? officialChampionName : 'Champion Yet to Be Crowned'}
              </h3>
              <p style={{ margin: '0 0 14px', fontSize: '0.9rem', color: 'var(--tourn-text-muted)' }}>
                {status === 'COMPLETED'
                  ? `Runner-Up: ${officialRunnerUpName} • Prize Pool: 🪙 ${prizePool} Coins`
                  : `Stage: ${activeStageLabel} • Complete the Grand Final to declare the verified Champion.`}
              </p>
              {status === 'COMPLETED' && (
                <button
                  type="button"
                  className="btn-tactile btn-amber"
                  onClick={() => onNavigate && onNavigate(`/tournaments/${id}/champion`)}
                >
                  <span>🎉 Open Celebration Screen →</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Format Details Modal */}
      <FormatDetailsModal
        isOpen={showFormatModal}
        initialFormat={format}
        onClose={() => setShowFormatModal(false)}
      />

      {/* ==================== HOST CONTROLS MODAL ==================== */}
      {showHostModal && (
        <div className="tourn-modal-backdrop" onClick={() => !hostActionLoading && setShowHostModal(false)}>
          <div
            className="tourn-modal-content tourn-host-controls-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="host-controls-title"
            style={{ maxWidth: '640px', width: '92%' }}
          >
            <div className="tourn-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--tourn-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>👑</span>
                <h3 id="host-controls-title" style={{ margin: 0, fontSize: '1.2rem', color: 'var(--tourn-text-primary)' }}>
                  Tournament Host Controls
                </h3>
              </div>
              <button
                type="button"
                className="btn-tactile btn-secondary"
                disabled={hostActionLoading}
                onClick={() => setShowHostModal(false)}
                style={{ minHeight: '34px', minWidth: '34px', padding: '4px 8px' }}
              >
                ✕
              </button>
            </div>

            {/* Host tabs bar */}
            <div style={{ display: 'flex', gap: '6px', margin: '12px 0', borderBottom: '1px solid var(--tourn-border)', paddingBottom: '8px', overflowX: 'auto' }}>
              {[
                { id: 'settings', label: '⚙️ Settings' },
                { id: 'participants', label: `👥 Participants (${participants.length})` },
                { id: 'audit', label: '📜 Audit Log' },
                { id: 'danger', label: '⚠️ Danger Zone' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`btn-tactile btn-sm ${hostTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.8rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                  onClick={() => {
                    setHostTab(t.id);
                    setHostActionMessage(null);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Host action feedback message */}
            {hostActionMessage && (
              <div
                className={`tourn-form-${hostActionMessage.type === 'success' ? 'success' : 'error'}-banner`}
                style={{
                  background: hostActionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${hostActionMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
                  color: hostActionMessage.type === 'success' ? '#6ee7b7' : '#fca5a5',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>{hostActionMessage.type === 'success' ? '✅' : '⚠️'}</span>
                <span>{hostActionMessage.text}</span>
              </div>
            )}

            {/* 1. SETTINGS TAB */}
            {hostTab === 'settings' && (
              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tournament Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Description</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Brief tournament summary..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Prize Pool (Coins)</label>
                  <input
                    type="number"
                    className="form-input"
                    min={100}
                    step={100}
                    value={editPrizePool}
                    onChange={(e) => setEditPrizePool(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button
                    type="submit"
                    className="btn-tactile btn-amber"
                    disabled={hostActionLoading}
                    style={{ padding: '8px 16px', fontWeight: 700 }}
                  >
                    {hostActionLoading ? 'Saving...' : '💾 Save Settings'}
                  </button>
                </div>
              </form>
            )}

            {/* 2. PARTICIPANTS TAB */}
            {hostTab === 'participants' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
                {participants.length === 0 ? (
                  <p style={{ color: 'var(--tourn-text-muted)', fontSize: '0.85rem' }}>No participants registered.</p>
                ) : (
                  participants.map(p => {
                    const isSelf = p.id === currentUserId;
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'var(--tourn-bg-card)',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--tourn-border)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{p.avatar || '👤'}</span>
                          <div>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--tourn-text-primary)' }}>{p.name}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--tourn-text-muted)', display: 'block' }}>
                              ID: {p.id} {isSelf && '(You / Host)'}
                            </span>
                          </div>
                        </div>

                        {!isSelf && status === 'REGISTERING' ? (
                          <button
                            type="button"
                            className="btn-tactile btn-danger btn-sm"
                            disabled={hostActionLoading}
                            onClick={() => handleKickParticipant(p.id, p.name)}
                            style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          >
                            Remove
                          </button>
                        ) : !isSelf ? (
                          <span style={{ fontSize: '0.72rem', color: 'var(--tourn-text-muted)', fontWeight: 600 }}>🔒 Roster Locked</span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* 3. AUDIT LOG TAB */}
            {hostTab === 'audit' && (
              <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {isLoadingAudit ? (
                  <p style={{ color: 'var(--tourn-text-muted)', textAlign: 'center', padding: '24px' }}>Loading audit events...</p>
                ) : auditLogs.length === 0 ? (
                  <p style={{ color: 'var(--tourn-text-muted)', textAlign: 'center', padding: '24px' }}>No audit history recorded yet.</p>
                ) : (
                  auditLogs.map(log => (
                    <div
                      key={log.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.6)',
                        border: '1px solid var(--tourn-border)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        fontSize: '0.82rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#38bdf8' }}>
                          ⚡ {log.action}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--tourn-text-muted)' }}>
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div style={{ color: 'var(--tourn-text-secondary)', lineHeight: 1.4 }}>
                        {log.details || log.action}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--tourn-text-muted)', marginTop: '4px' }}>
                        Actor: {log.actorName || log.actorId || 'System'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 4. DANGER ZONE TAB */}
            {hostTab === 'danger' && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: 0, color: '#f87171', fontSize: '1rem' }}>⚠️ Cancel Tournament</h4>
                <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--tourn-text-secondary)', lineHeight: 1.4 }}>
                  Cancelling the tournament will immediately terminate all active fixtures, notify participants, and close the room.
                </p>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem', color: '#fca5a5' }}>Cancellation Reason</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Host unavailable, rescheduling..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn-tactile btn-danger"
                    disabled={hostActionLoading}
                    onClick={handleCancelTournament}
                    style={{ padding: '8px 16px', fontWeight: 700 }}
                  >
                    {hostActionLoading ? 'Cancelling...' : 'Cancel Tournament'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
