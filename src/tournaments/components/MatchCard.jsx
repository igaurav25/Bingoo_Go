/**
 * src/tournaments/components/MatchCard.jsx
 * 
 * Professional Sports-Style Tournament Match Card.
 * Inspired by IPL playoffs, UEFA Champions League, and Esports knockout brackets.
 * 
 * Features:
 * - Match number / stage label & status badge (Live, Ready, Scheduled, Completed).
 * - Competitor slots with player avatar, seed/rank badge, verified Bingo lines, and winner highlight.
 * - Distinct visual treatments for:
 *   - Winner (rich gold tint, crown icon, bright gold score pill)
 *   - Eliminated (dimmed, subtle strikethrough, grayed badge)
 *   - Live / In-Progress (electric blue border, pulsing live beacon)
 *   - Featured / Grand Final (gold double border, championship badge)
 * - Tactile action triggers (Play Match, Spectate, Details Modal).
 */

import React from 'react';
import { Num } from './Num.jsx';
import { PlayerName } from './PlayerName.jsx';
import { StatusBadge } from './StatusBadge.jsx';

export function MatchCard({
  match,
  currentUserId = null,
  isOnMyPath = false,
  isFeatured = false,
  onPlay = null,
  onViewDetails = null,
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

  const isLive = status === 'READY' || status === 'IN_PROGRESS';
  const isCompleted = status === 'COMPLETED';
  const isUserPlaying = Boolean(currentUserId && (slot1.playerId === currentUserId || slot2.playerId === currentUserId));

  const slot1Winner = Boolean(winnerId && slot1.playerId === winnerId);
  const slot2Winner = Boolean(winnerId && slot2.playerId === winnerId);
  const slot1Eliminated = Boolean(isCompleted && winnerId && slot1.playerId && !slot1Winner);
  const slot2Eliminated = Boolean(isCompleted && winnerId && slot2.playerId && !slot2Winner);

  const handleClickCard = (e) => {
    // If click was on an action button, don't trigger card click
    if (e.target.closest('button')) return;
    if (onViewDetails) {
      onViewDetails(match);
    } else if (isLive && onPlay) {
      onPlay(match);
    }
  };

  return (
    <article
      data-match-id={id}
      className={`sports-match-card ${isFeatured ? 'featured-grand-final' : ''} ${isOnMyPath ? 'on-my-path' : ''} ${isLive ? 'is-live-match' : ''} ${isCompleted ? 'is-completed-match' : ''}`}
      aria-label={`${label}, ${roundTitle}: ${slot1.playerName} vs ${slot2.playerName}`}
      onClick={handleClickCard}
    >
      {/* Top Header: Match Label & Status Badge */}
      <div className="sports-match-header">
        <div className="sports-match-meta">
          <span className="sports-match-number">{label}</span>
          {scheduledTime && !isCompleted && (
            <span className="sports-match-time">🕒 {scheduledTime}</span>
          )}
        </div>
        <div className="sports-match-status-wrap">
          <StatusBadge status={status} size="small" />
        </div>
      </div>

      {/* Competitors Slot List */}
      <div className="sports-slots-list">
        {/* Competitor Slot 1 */}
        <div
          className={`sports-slot-row ${slot1Winner ? 'winner-slot' : ''} ${slot1Eliminated ? 'eliminated-slot' : ''}`}
          onClick={(e) => {
            if (onViewPlayer && slot1.playerId) {
              e.stopPropagation();
              onViewPlayer(slot1);
            }
          }}
        >
          <div className="sports-slot-left">
            <div className="sports-slot-avatar-wrap">
              <span className="sports-slot-avatar">{slot1.avatar || '👤'}</span>
              {slot1.seed && <span className="sports-slot-seed">#{slot1.seed}</span>}
              {slot1Winner && <span className="sports-slot-crown">👑</span>}
            </div>
            <div className="sports-slot-names">
              <PlayerName
                name={slot1.playerName}
                seed={slot1.source?.seed || slot1.seed}
                isWinner={slot1Winner}
                isEliminated={slot1Eliminated}
                isCurrentUser={Boolean(currentUserId && slot1.playerId === currentUserId)}
              />
              <span className="sports-slot-subtext">
                {slot1Winner ? 'Winner' : slot1Eliminated ? 'Eliminated' : (slot1.rank || 'Contender')}
              </span>
            </div>
          </div>

          <div className="sports-slot-right">
            <span className={`sports-slot-score ${slot1Winner ? 'score-winner' : ''}`}>
              <Num value={scores[0]} variant="score" />
            </span>
          </div>
        </div>

        {/* Competitor Slot 2 */}
        <div
          className={`sports-slot-row ${slot2Winner ? 'winner-slot' : ''} ${slot2Eliminated ? 'eliminated-slot' : ''}`}
          onClick={(e) => {
            if (onViewPlayer && slot2.playerId) {
              e.stopPropagation();
              onViewPlayer(slot2);
            }
          }}
        >
          <div className="sports-slot-left">
            <div className="sports-slot-avatar-wrap">
              <span className="sports-slot-avatar">{slot2.avatar || '👤'}</span>
              {slot2.seed && <span className="sports-slot-seed">#{slot2.seed}</span>}
              {slot2Winner && <span className="sports-slot-crown">👑</span>}
            </div>
            <div className="sports-slot-names">
              <PlayerName
                name={slot2.playerName}
                seed={slot2.source?.seed || slot2.seed}
                isWinner={slot2Winner}
                isEliminated={slot2Eliminated}
                isCurrentUser={Boolean(currentUserId && slot2.playerId === currentUserId)}
              />
              <span className="sports-slot-subtext">
                {slot2Winner ? 'Winner' : slot2Eliminated ? 'Eliminated' : (slot2.rank || 'Contender')}
              </span>
            </div>
          </div>

          <div className="sports-slot-right">
            <span className={`sports-slot-score ${slot2Winner ? 'score-winner' : ''}`}>
              <Num value={scores[1]} variant="score" />
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Advancement Note / Direct Actions */}
      <div className="sports-match-footer">
        <div className="sports-match-footer-note">
          {isCompleted && winnerId ? (
            <span className="sports-winner-pill">
              🏆 {slot1Winner ? slot1.playerName : slot2.playerName} Advances
            </span>
          ) : advancesTo ? (
            <span className="sports-advancement-pill">
              Advances to {advancesTo.roundTitle || 'Next Round'} ➔
            </span>
          ) : isFeatured ? (
            <span className="sports-grand-final-pill">
              🌟 Grand Championship Trophy Match
            </span>
          ) : (
            <span className="sports-advancement-pill">Single Elimination</span>
          )}
        </div>

        <div className="sports-match-actions">
          {isLive && isUserPlaying && onPlay ? (
            <button
              type="button"
              className="btn-tactile btn-primary btn-sm btn-sports-play"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(match);
              }}
            >
              Play ⚡
            </button>
          ) : isLive && onPlay ? (
            <button
              type="button"
              className="btn-tactile btn-amber btn-sm btn-sports-spectate"
              onClick={(e) => {
                e.stopPropagation();
                onPlay(match);
              }}
            >
              Watch 👁️
            </button>
          ) : onViewDetails ? (
            <button
              type="button"
              className="btn-tactile btn-secondary btn-sm btn-sports-details"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(match);
              }}
            >
              Details
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
