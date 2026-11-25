/**
 * src/tournaments/screens/TournamentChampion.jsx
 * 
 * Realistic Sports Celebration & Grand Champion Screen.
 * Inspired by Champions League and IPL Trophy Presentations.
 * 
 * Features:
 * - Premium 3D-styled SVG Golden Trophy with glowing radiant halo and sparkle particles.
 * - Champion crowning with avatar, custom title, level, and player statistics.
 * - Prize coins celebration banner with coin counter.
 * - Full tournament journey path (Quarter-Final -> Semi-Final -> Grand Final victories).
 * - Runner-Up honor acknowledgement.
 * - Full integration with canvas confetti celebration.
 * - Tactile action triggers (Share Victory, Full Bracket, Tournament Directory).
 */

import React, { useMemo, useEffect } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { Num } from '../components/Num.jsx';
import { PlayerName } from '../components/PlayerName.jsx';
import { selectBracketRounds, selectStandings, selectPathOf } from '../selectors.js';
import { soundManager } from '../../../public/js/audio.js';

export function TournamentChampion({
  tournament,
  currentUserId = null,
  onNavigate = null
}) {
  const { id, name, format, prizePool = 10000 } = tournament || {};
  const bracketRounds = useMemo(() => (tournament ? selectBracketRounds(tournament) : []), [tournament]);
  const standings = useMemo(() => (tournament ? selectStandings(tournament) : []), [tournament]);

  // Find winner and runner-up
  const { champion, runnerUp, finalScore } = useMemo(() => {
    if (!tournament) {
      return {
        champion: { playerName: 'Grand Champion' },
        runnerUp: { playerName: 'Runner-Up' },
        finalScore: '0 – 0'
      };
    }
    if (format === 'KNOCKOUT' || format === 'HYBRID') {
      const finalRound = bracketRounds.find(r => r.key === 'final') || bracketRounds[bracketRounds.length - 1];
      const finalMatch = finalRound?.matches[0];
      if (finalMatch) {
        const winner = finalMatch.slots.find(s => s.playerId === finalMatch.winnerId);
        const runner = finalMatch.slots.find(s => s.playerId !== finalMatch.winnerId);
        return {
          champion: winner || (tournament.winner ? { playerName: typeof tournament.winner === 'object' ? tournament.winner.name : tournament.winner } : { playerName: 'Grand Champion' }),
          runnerUp: runner || { playerName: 'Runner-Up' },
          finalScore: `${finalMatch.scores[0]} – ${finalMatch.scores[1]}`
        };
      }
    }

    return {
      champion: standings[0] ? { playerName: standings[0].playerName, playerId: standings[0].playerId } : { playerName: 'Grand Champion' },
      runnerUp: standings[1] ? { playerName: standings[1].playerName, playerId: standings[1].playerId } : { playerName: 'Runner-Up' },
      finalScore: '5 – 0'
    };
  }, [tournament, format, bracketRounds, standings]);

  const isUserChampion = Boolean(currentUserId && champion.playerId === currentUserId);
  const championPrize = Math.round(prizePool * 0.60);
  const runnerUpPrize = Math.round(prizePool * 0.25);

  // Trigger canvas confetti & championship fanfare on mount
  useEffect(() => {
    if (tournament) {
      soundManager.playTournamentFanfare?.();
      if (typeof window !== 'undefined' && window.confettiCelebration) {
        window.confettiCelebration.burst(120);
      }
    }
  }, [tournament]);

  // Compute champion's path of victories
  const victoryJourney = useMemo(() => {
    if (!tournament || !champion.playerId) return [];
    const path = selectPathOf(tournament, champion.playerId);
    const pathMatches = path.matches || [];
    return pathMatches.map(m => {
      const opponentSlot = m.slots.find(s => s.playerId !== champion.playerId);
      const championSlot = m.slots.find(s => s.playerId === champion.playerId);
      const champScore = championSlot ? (m.slots[0].playerId === champion.playerId ? m.scores[0] : m.scores[1]) : 5;
      const oppScore = opponentSlot ? (m.slots[0].playerId === opponentSlot.playerId ? m.scores[0] : m.scores[1]) : 0;
      return {
        id: m.id,
        roundTitle: m.roundTitle || m.label,
        opponentName: opponentSlot ? opponentSlot.playerName : 'Opponent',
        score: `${champScore} – ${oppScore}`
      };
    });
  }, [tournament, champion]);

  if (!tournament) return null;

  const handleShare = () => {
    const shareText = `🏆 BINGO GRAND CHAMPION: ${champion.playerName} conquered ${name} and claimed ${championPrize} coins!`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        title: `🏆 ${champion.playerName} is BINGO Champion!`,
        text: shareText,
        url: window.location.href
      }).catch(() => {});
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareText + ' ' + window.location.href);
      alert('Victory share message copied to clipboard!');
    }
  };

  return (
    <PageShell
      title="🏆 Grand Champion"
      subtitle={`Honoring the champion of ${name}`}
      onBack={() => onNavigate && onNavigate(`/tournaments/${id}`)}
    >
      <div className="tourn-sports-champion-screen">
        {/* Championship Sports Card */}
        <div className="sports-champion-card">
          {/* Top Gold Ribbon Banner */}
          <div className="sports-champion-ribbon">
            <span>✨ OFFICIAL TOURNAMENT WINNER • {name.toUpperCase()} ✨</span>
          </div>

          {/* Premium Animated SVG Trophy Artwork */}
          <div className="sports-trophy-stage arena-trophy-float">
            <div className="trophy-ambient-glow"></div>
            <div className="trophy-sparkles-ring"></div>

            <svg
              className="premium-golden-trophy-svg"
              viewBox="0 0 200 220"
              width="180"
              height="200"
              aria-label="Golden Champions Trophy"
            >
              <defs>
                <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF2A3" />
                  <stop offset="30%" stopColor="#F59E0B" />
                  <stop offset="70%" stopColor="#D97706" />
                  <stop offset="100%" stopColor="#78350F" />
                </linearGradient>
                <linearGradient id="shineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                  <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
                <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Pedestal Base */}
              <ellipse cx="100" cy="200" rx="60" ry="14" fill="#0F172A" stroke="url(#goldGradient)" strokeWidth="3" />
              <path d="M 55 190 L 65 170 L 135 170 L 145 190 Z" fill="url(#goldGradient)" />
              <rect x="70" y="165" width="60" height="8" rx="3" fill="#FFF2A3" />

              {/* Stem */}
              <path d="M 90 165 C 90 135, 80 130, 80 115 L 120 115 C 120 130, 110 135, 110 165 Z" fill="url(#goldGradient)" />

              {/* Cup Handles */}
              <path
                d="M 60 45 C 20 50, 15 105, 75 110"
                fill="none"
                stroke="url(#goldGradient)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <path
                d="M 140 45 C 180 50, 185 105, 125 110"
                fill="none"
                stroke="url(#goldGradient)"
                strokeWidth="8"
                strokeLinecap="round"
              />

              {/* Main Cup Body */}
              <path
                d="M 50 35 C 50 110, 150 110, 150 35 Z"
                fill="url(#goldGradient)"
                filter="url(#glowFilter)"
              />
              <ellipse cx="100" cy="35" rx="50" ry="12" fill="#FFE875" stroke="#D97706" strokeWidth="2" />

              {/* Star on Cup */}
              <polygon
                points="100,55 104,66 116,66 106,73 110,84 100,77 90,84 94,73 84,66 96,66"
                fill="#FFFDF0"
                stroke="#B45309"
                strokeWidth="1.5"
              />

              {/* Crown Emblem */}
              <path
                d="M 85 92 L 92 100 L 100 88 L 108 100 L 115 92 L 112 104 L 88 104 Z"
                fill="#FFF2A3"
              />
            </svg>
          </div>

          {/* Champion Crown and Identity */}
          <div className="sports-champion-identity">
            <span className="champion-crown-icon">👑</span>
            <span className="champion-badge-pill">GRAND CHAMPION</span>
            <h2 className="champion-title-name">{champion.playerName}</h2>
            {isUserChampion && (
              <span className="champion-current-user-tag">
                ⭐ YOU ARE THE CHAMPION! ⭐
              </span>
            )}
            {finalScore && (
              <span className="champion-final-result-tag">
                Final Match Score: {finalScore}
              </span>
            )}
          </div>

          {/* Prize Breakdown Banner */}
          <div className="sports-prize-awards-row">
            <div className="prize-award-card grand-winner-award">
              <span className="award-badge">🥇 1ST PLACE WINNER</span>
              <strong className="award-amount">🪙 <Num value={championPrize} /> Coins</strong>
              <span className="award-sub">Grand Prize (60% Pool)</span>
            </div>

            {runnerUp && (
              <div className="prize-award-card runner-up-award">
                <span className="award-badge">🥈 RUNNER-UP</span>
                <strong className="award-amount">🪙 <Num value={runnerUpPrize} /> Coins</strong>
                <span className="award-sub">{runnerUp.playerName} (25% Pool)</span>
              </div>
            )}
          </div>

          {/* Road to the Championship: Path of Victories */}
          {victoryJourney.length > 0 && (
            <div className="sports-road-to-glory">
              <h4 className="road-title">
                <span>⚔️</span>
                <span>Road to the Championship</span>
              </h4>
              <div className="road-steps-grid">
                {victoryJourney.map((step, idx) => (
                  <div key={step.id || idx} className="road-step-card">
                    <span className="step-round">{step.roundTitle}</span>
                    <strong className="step-opp">vs {step.opponentName}</strong>
                    <span className="step-score">Won {step.score}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action CTAs */}
          <div className="sports-champion-actions">
            <button
              type="button"
              className="btn-tactile btn-amber btn-lg"
              onClick={handleShare}
            >
              <span>🔗</span>
              <span>Share Victory Trophy</span>
            </button>

            <button
              type="button"
              className="btn-tactile btn-secondary btn-lg"
              onClick={() => onNavigate && onNavigate(`/tournaments/${id}/bracket`)}
            >
              <span>🥊</span>
              <span>View Full Bracket</span>
            </button>

            <button
              type="button"
              className="btn-tactile btn-primary btn-lg"
              onClick={() => onNavigate && onNavigate('/tournaments')}
            >
              <span>🏆</span>
              <span>More Tournaments</span>
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
