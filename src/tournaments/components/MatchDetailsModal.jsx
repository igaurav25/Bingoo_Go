/**
 * src/tournaments/components/MatchDetailsModal.jsx
 * 
 * Interactive Sports Match Details Modal.
 * Opens when a user clicks an Upcoming, Ready, Live, or Completed match card.
 * Displays head-to-head competitor comparison, verified scores, advancement
 * notes, scheduled information, and direct "Play Match" action triggers.
 */

import React from 'react';
import { Num } from './Num.jsx';
import { PlayerName } from './PlayerName.jsx';
import { StatusBadge } from './StatusBadge.jsx';

export function MatchDetailsModal({
  match,
  tournament = null,
  currentUserId = null,
  onClose = null,
  onPlay = null,
  onViewPlayer = null
}) {
  if (!match) return null;

  const {
    id,
    label = 'Match',
    roundTitle = 'Knockout Match',
    slots = [],
    scores = [0, 0],
    status = 'WAITING',
    winnerId = null,
    isBye = false,
    advancesTo = null,
    scheduledTime = null
  } = match;

  const slot1 = slots[0] || { playerName: 'TBD', playerId: null };
  const slot2 = slots[1] || { playerName: 'TBD', playerId: null };

  const isCompleted = status === 'COMPLETED';
  const isLive = status === 'READY' || status === 'IN_PROGRESS';
  const isScheduled = status === 'WAITING' || status === 'SCHEDULED';
  const isUserPlaying = currentUserId && (slot1.playerId === currentUserId || slot2.playerId === currentUserId);

  const slot1Winner = Boolean(winnerId && slot1.playerId === winnerId);
  const slot2Winner = Boolean(winnerId && slot2.playerId === winnerId);
  const slot1Eliminated = Boolean(isCompleted && winnerId && slot1.playerId && !slot1Winner);
  const slot2Eliminated = Boolean(isCompleted && winnerId && slot2.playerId && !slot2Winner);

  const formatScheduledTime = (time) => {
    if (!time) return 'TBD / Live Queue';
    try {
      const date = new Date(time);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' • ' + date.toLocaleDateString();
    } catch {
      return String(time);
    }
  };

  return (
    <div className="tourn-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="tourn-modal-container match-details-modal" onClick={e => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="match-modal-header">
          <div className="match-modal-title-group">
            <span className="match-modal-tag">{roundTitle.toUpperCase()}</span>
            <h3 className="match-modal-title">{label}</h3>
          </div>
          <button
            type="button"
            className="match-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Status Broadcast Banner */}
        <div className={`match-status-banner banner-${status.toLowerCase()}`}>
          <div className="status-banner-left">
            <StatusBadge status={status} size="normal" />
            <span className="status-banner-text">
              {isCompleted && 'Official Verified Result'}
              {status === 'IN_PROGRESS' && 'Match In Progress • Live Tracking'}
              {status === 'READY' && 'Players Ready • Match Available to Play'}
              {isScheduled && 'Upcoming Fixture • Awaiting Players / Schedule'}
            </span>
          </div>
          {scheduledTime && (
            <span className="status-banner-time">
              🕒 {formatScheduledTime(scheduledTime)}
            </span>
          )}
        </div>

        {/* Head-to-Head Competitor Arena */}
        <div className="match-h2h-arena">
          {/* Competitor 1 */}
          <div className={`h2h-card ${slot1Winner ? 'h2h-winner' : ''} ${slot1Eliminated ? 'h2h-eliminated' : ''}`}>
            <div className="h2h-avatar-wrap">
              <span className="h2h-avatar">{slot1.avatar || '👤'}</span>
              {slot1.seed && <span className="h2h-seed-badge">#{slot1.seed}</span>}
              {slot1Winner && <span className="h2h-crown-badge">👑</span>}
            </div>

            <div className="h2h-player-info">
              <h4 className="h2h-player-name">
                <PlayerName
                  name={slot1.playerName}
                  isWinner={slot1Winner}
                  isEliminated={slot1Eliminated}
                  isCurrentUser={Boolean(currentUserId && slot1.playerId === currentUserId)}
                />
              </h4>
              <span className="h2h-player-rank">{slot1.rank || 'Contender'}</span>
            </div>

            <div className="h2h-score-box">
              <span className="h2h-score-label">Lines</span>
              <span className={`h2h-score-num ${slot1Winner ? 'score-win' : ''}`}>
                <Num value={scores[0]} />
              </span>
            </div>

            {slot1Winner && (
              <div className="h2h-winner-ribbon">
                <span>🏆 WINNER</span>
              </div>
            )}

            {onViewPlayer && slot1.playerId && (
              <button
                type="button"
                className="btn-h2h-profile"
                onClick={() => onViewPlayer(slot1)}
              >
                Profile 👤
              </button>
            )}
          </div>

          {/* VS Center Divider */}
          <div className="h2h-vs-divider">
            <span className="h2h-vs-badge">VS</span>
            <span className="h2h-format-pill">1v1 BINGO</span>
          </div>

          {/* Competitor 2 */}
          <div className={`h2h-card ${slot2Winner ? 'h2h-winner' : ''} ${slot2Eliminated ? 'h2h-eliminated' : ''}`}>
            <div className="h2h-avatar-wrap">
              <span className="h2h-avatar">{slot2.avatar || '👤'}</span>
              {slot2.seed && <span className="h2h-seed-badge">#{slot2.seed}</span>}
              {slot2Winner && <span className="h2h-crown-badge">👑</span>}
            </div>

            <div className="h2h-player-info">
              <h4 className="h2h-player-name">
                <PlayerName
                  name={slot2.playerName}
                  isWinner={slot2Winner}
                  isEliminated={slot2Eliminated}
                  isCurrentUser={Boolean(currentUserId && slot2.playerId === currentUserId)}
                />
              </h4>
              <span className="h2h-player-rank">{slot2.rank || 'Contender'}</span>
            </div>

            <div className="h2h-score-box">
              <span className="h2h-score-label">Lines</span>
              <span className={`h2h-score-num ${slot2Winner ? 'score-win' : ''}`}>
                <Num value={scores[1]} />
              </span>
            </div>

            {slot2Winner && (
              <div className="h2h-winner-ribbon">
                <span>🏆 WINNER</span>
              </div>
            )}

            {onViewPlayer && slot2.playerId && (
              <button
                type="button"
                className="btn-h2h-profile"
                onClick={() => onViewPlayer(slot2)}
              >
                Profile 👤
              </button>
            )}
          </div>
        </div>

        {/* Advancement / Progression Note */}
        <div className="match-modal-advancement">
          {isCompleted && winnerId ? (
            <div className="advancement-success-card">
              <span className="advancement-icon">🏆</span>
              <div className="advancement-details">
                <strong>Match Completed & Verified</strong>
                <span>
                  {slot1Winner ? slot1.playerName : slot2.playerName} qualified for the next round of {tournament?.name || 'Playoffs'}.
                </span>
              </div>
            </div>
          ) : advancesTo ? (
            <div className="advancement-info-card">
              <span className="advancement-icon">➔</span>
              <div className="advancement-details">
                <strong>Knockout Stakes: Single Elimination</strong>
                <span>Winner qualifies into Round {advancesTo.roundTitle || 'Next Round'}. Loser is eliminated.</span>
              </div>
            </div>
          ) : (
            <div className="advancement-info-card championship-stakes">
              <span className="advancement-icon">🌟</span>
              <div className="advancement-details">
                <strong>Championship Match</strong>
                <span>The winner of this match is crowned Grand Champion of {tournament?.name || 'Tournament'}!</span>
              </div>
            </div>
          )}
        </div>

        {/* Match Action CTAs */}
        <div className="match-modal-actions">
          {isLive && isUserPlaying && onPlay ? (
            <button
              type="button"
              className="btn-tactile btn-primary btn-modal-action btn-pulse-play"
              onClick={() => {
                onClose();
                onPlay(match);
              }}
            >
              <span>⚡</span>
              <span>PLAY MATCH NOW</span>
            </button>
          ) : isLive && onPlay ? (
            <button
              type="button"
              className="btn-tactile btn-amber btn-modal-action"
              onClick={() => {
                onClose();
                onPlay(match);
              }}
            >
              <span>👁️</span>
              <span>SPECTATE LIVE MATCH</span>
            </button>
          ) : (
            <button
              type="button"
              className="btn-tactile btn-secondary btn-modal-action"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
