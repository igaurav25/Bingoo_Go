/**
 * src/tournaments/screens/TournamentMatchFocus.jsx
 * 
 * Focused Match Screen (/tournaments/:id/matches/:matchId).
 * High-intensity match detail view with head-to-head comparison,
 * scores, round context, and "Enter Match" / "Play BINGO" action.
 */

import React, { useMemo } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Num } from '../components/Num.jsx';
import { PlayerName } from '../components/PlayerName.jsx';
import { selectMatchById } from '../selectors.js';

export function TournamentMatchFocus({
  tournament,
  matchId,
  currentUserId = null,
  onNavigate = null,
  onPlayMatch = null
}) {
  const match = useMemo(() => {
    return selectMatchById(tournament, matchId);
  }, [tournament, matchId]);

  if (!match) {
    return (
      <PageShell
        title="Match Not Found"
        onBack={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}/fixtures`)}
      >
        <div className="tourn-empty-state">
          <h3>Match could not be found</h3>
          <button
            type="button"
            className="btn-tactile btn-primary"
            onClick={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}/fixtures`)}
          >
            Back to Fixtures
          </button>
        </div>
      </PageShell>
    );
  }

  const { id, label, roundTitle, slots = [], scores = [0, 0], status, winnerId, advancesTo } = match;
  const slot1 = slots[0] || { playerName: 'TBD' };
  const slot2 = slots[1] || { playerName: 'TBD' };

  const isUserPlaying = currentUserId && (slot1.playerId === currentUserId || slot2.playerId === currentUserId);
  const isReady = status === 'READY' || status === 'IN_PROGRESS';
  const isCompleted = status === 'COMPLETED';

  const slot1Winner = isCompleted && winnerId && slot1.playerId === winnerId;
  const slot2Winner = isCompleted && winnerId && slot2.playerId === winnerId;

  return (
    <PageShell
      title={label}
      subtitle={`${roundTitle} • ${tournament?.name || 'Tournament'}`}
      onBack={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}/fixtures`)}
    >
      <div className="match-focus-container">
        {/* Status Header */}
        <div className="match-focus-header">
          <StatusBadge status={status} size="large" />
          <span className="round-badge">{roundTitle}</span>
        </div>

        {/* Head-to-Head Arena */}
        <div className="h2h-arena-card">
          {/* Player 1 Card */}
          <div className={`h2h-player-card ${slot1Winner ? 'winner-card' : ''}`}>
            <div className="h2h-avatar">
              <span>{slot1Winner ? '👑' : '👤'}</span>
            </div>
            <PlayerName
              name={slot1.playerName}
              seed={slot1.source?.seed}
              isWinner={slot1Winner}
              isCurrentUser={currentUserId && slot1.playerId === currentUserId}
            />
            <div className="h2h-score-box">
              <Num value={scores[0]} variant="large" className={slot1Winner ? 'score-winner' : ''} />
            </div>
          </div>

          {/* VS Divider */}
          <div className="h2h-vs-divider">
            <span className="vs-text">VS</span>
            {isReady && <span className="live-indicator">LIVE</span>}
          </div>

          {/* Player 2 Card */}
          <div className={`h2h-player-card ${slot2Winner ? 'winner-card' : ''}`}>
            <div className="h2h-avatar">
              <span>{slot2Winner ? '👑' : '👤'}</span>
            </div>
            <PlayerName
              name={slot2.playerName}
              seed={slot2.source?.seed}
              isWinner={slot2Winner}
              isCurrentUser={currentUserId && slot2.playerId === currentUserId}
            />
            <div className="h2h-score-box">
              <Num value={scores[1]} variant="large" className={slot2Winner ? 'score-winner' : ''} />
            </div>
          </div>
        </div>

        {/* Match Details Card */}
        <div className="match-details-card">
          <h4>Match Details</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Tournament</span>
              <span className="detail-value">{tournament?.name}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Stage</span>
              <span className="detail-value">{roundTitle}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Advancement</span>
              <span className="detail-value">
                {advancesTo ? `Winner advances to match ${advancesTo.matchId}` : 'Final Round (Championship)'}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Format</span>
              <span className="detail-value">Standard 5x5 BINGO Match</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="match-focus-actions">
          {isReady && isUserPlaying ? (
            <button
              type="button"
              className="btn-tactile btn-primary btn-submit-large"
              onClick={() => onPlayMatch && onPlayMatch(match)}
            >
              <span>🎮</span>
              <span>Play Match Now</span>
            </button>
          ) : isReady ? (
            <button
              type="button"
              className="btn-tactile btn-amber btn-submit-large"
              onClick={() => onPlayMatch && onPlayMatch(match)}
            >
              <span>👀</span>
              <span>Spectate Match</span>
            </button>
          ) : isCompleted ? (
            <div className="match-completed-banner">
              <span>🏆 Match finished: {slot1Winner ? slot1.playerName : slot2.playerName} won!</span>
            </div>
          ) : (
            <div className="match-waiting-banner">
              <span>⏳ Match is waiting for previous rounds to complete.</span>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
