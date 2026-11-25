/**
 * src/tournaments/components/BracketView.jsx
 * 
 * Professional Sports-Style Knockout Bracket & Playoffs View.
 * Inspired by IPL Playoffs, UEFA Champions League knockout brackets, and Tier-1 Esports.
 * 
 * Highlights:
 * 1. Dedicated Playoffs Broadcast Banner (Stage, remaining players, progress bar, live indicator, prize pool).
 * 2. Horizontally connected sports bracket with dynamic SVG connector lines.
 * 3. Champion podium column at the apex of the Grand Final.
 * 4. Interactive Match Details Modal on card click.
 * 5. Responsive mobile round tabs + pan-friendly horizontal tree mode.
 * 6. "Highlight My Path" toggle with glowing progression tracks.
 */

import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { selectBracketRounds, selectPathOf } from '../selectors.js';
import { MatchCard } from './MatchCard.jsx';
import { RoundTabs } from './RoundTabs.jsx';
import { MatchDetailsModal } from './MatchDetailsModal.jsx';
import { Num } from './Num.jsx';
import { TrophyChampionCrown } from '../../components/SportsGraphics.jsx';

export function BracketView({
  tournament,
  currentUserId = null,
  initialRoundKey = null,
  onPlayMatch = null,
  onViewMatchDetails = null,
  onViewPlayer = null,
  onViewChampion = null
}) {
  const containerRef = useRef(null);
  const scrollerRef = useRef(null);
  const [connectors, setConnectors] = useState([]);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });
  const [showMyPathOnly, setShowMyPathOnly] = useState(false);
  const [modalMatch, setModalMatch] = useState(null);
  const [mobileViewMode, setMobileViewMode] = useState('tabs'); // 'tabs' or 'tree'

  // Compute bracket rounds from tournament data
  const rounds = useMemo(() => {
    return selectBracketRounds(tournament);
  }, [tournament]);

  // Flatten all matches in the bracket
  const allBracketMatches = useMemo(() => {
    return rounds.flatMap(r => r.matches);
  }, [rounds]);

  // Compute tournament playoffs metrics
  const metrics = useMemo(() => {
    const totalMatches = allBracketMatches.length || 1;
    const completedMatches = allBracketMatches.filter(m => m.status === 'COMPLETED').length;
    const liveMatches = allBracketMatches.filter(m => m.status === 'READY' || m.status === 'IN_PROGRESS').length;
    const progressPercent = Math.min(100, Math.round((completedMatches / totalMatches) * 100));

    // Participants count from tournament or bracket slots
    const participantsCount = tournament?.participants?.length || tournament?.maxParticipants || (rounds[0]?.matches.length * 2) || 8;
    
    // Remaining active players: in current active rounds
    const eliminatedPlayerIds = new Set();
    allBracketMatches.forEach(m => {
      if (m.status === 'COMPLETED' && m.winnerId) {
        m.slots.forEach(s => {
          if (s.playerId && s.playerId !== m.winnerId) {
            eliminatedPlayerIds.add(s.playerId);
          }
        });
      }
    });

    const remainingPlayers = Math.max(1, participantsCount - eliminatedPlayerIds.size);

    // Current stage label
    const activeRound = rounds.find(r => r.matches.some(m => m.status === 'READY' || m.status === 'IN_PROGRESS'))
      || rounds.find(r => r.matches.some(m => m.status !== 'COMPLETED'))
      || rounds[rounds.length - 1];

    const stageLabel = activeRound ? activeRound.title : 'Playoffs';
    const isChampionshipDecided = Boolean(tournament?.winner || rounds[rounds.length - 1]?.matches[0]?.status === 'COMPLETED');

    return {
      totalMatches,
      completedMatches,
      liveMatches,
      progressPercent,
      participantsCount,
      remainingPlayers,
      stageLabel,
      isChampionshipDecided,
      prizePool: tournament?.prizePool || 10000
    };
  }, [allBracketMatches, tournament, rounds]);

  // Find Grand Champion if final match is completed
  const grandChampion = useMemo(() => {
    if (tournament?.winner) {
      return typeof tournament.winner === 'object' ? tournament.winner : { name: tournament.winner, id: tournament.winnerId };
    }
    const finalRound = rounds.find(r => r.key === 'final') || rounds[rounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    if (finalMatch && finalMatch.status === 'COMPLETED' && finalMatch.winnerId) {
      const winnerSlot = finalMatch.slots.find(s => s.playerId === finalMatch.winnerId);
      return winnerSlot ? { name: winnerSlot.playerName, id: winnerSlot.playerId, avatar: winnerSlot.avatar } : null;
    }
    return null;
  }, [tournament, rounds]);

  // Compute player's path match IDs
  const myPathMatchIds = useMemo(() => {
    if (!currentUserId || !tournament) return new Set();
    const path = selectPathOf(tournament, currentUserId);
    return path.matchIds instanceof Set ? path.matchIds : new Set(path.matches?.map(m => m.id) || []);
  }, [tournament, currentUserId]);

  // Determine active round for mobile view
  const [activeRoundKey, setActiveRoundKey] = useState(() => {
    if (initialRoundKey && rounds.some(r => r.key === initialRoundKey)) {
      return initialRoundKey;
    }
    const pendingRound = rounds.find(r => r.matches.some(m => m.status === 'READY' || m.status === 'IN_PROGRESS'));
    return pendingRound ? pendingRound.key : (rounds[0]?.key || 'round_1');
  });

  // Track window resize
  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update active round when initialRoundKey changes
  useEffect(() => {
    if (initialRoundKey && rounds.some(r => r.key === initialRoundKey)) {
      setActiveRoundKey(initialRoundKey);
    }
  }, [initialRoundKey, rounds]);

  // Measure connector coordinates on desktop or mobile tree view
  const measureConnectors = () => {
    if (!containerRef.current || (isMobile && mobileViewMode === 'tabs')) {
      setConnectors([]);
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newConnectors = [];

    for (let r = 0; r < rounds.length; r++) {
      const round = rounds[r];
      for (const match of round.matches) {
        const targets = [];
        if (match.advancesTo?.matchId) targets.push({ targetId: match.advancesTo.matchId, isLoserPath: false });
        if (match.loserAdvancesTo?.matchId) targets.push({ targetId: match.loserAdvancesTo.matchId, isLoserPath: true });

        for (const edge of targets) {
          const sourceEl = containerRef.current.querySelector(`[data-match-id="${match.id}"]`);
          const targetEl = containerRef.current.querySelector(`[data-match-id="${edge.targetId}"]`);

          if (sourceEl && targetEl) {
            const srcRect = sourceEl.getBoundingClientRect();
            const trgRect = targetEl.getBoundingClientRect();

            // Horizontal progression: right center of source -> left center of target
            const x1 = srcRect.right - containerRect.left;
            const y1 = srcRect.top + srcRect.height / 2 - containerRect.top;

            const x2 = trgRect.left - containerRect.left;
            const y2 = trgRect.top + trgRect.height / 2 - containerRect.top;

            const dx = Math.max(24, (x2 - x1) / 2);
            const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

            const isWinnerAdvanced = match.status === 'COMPLETED' && Boolean(match.winnerId);
            const isHighlighted = myPathMatchIds.has(match.id) && myPathMatchIds.has(edge.targetId);

            newConnectors.push({
              id: `${match.id}->${edge.targetId}-${edge.isLoserPath ? 'loser' : 'win'}`,
              pathData,
              isHighlighted,
              isWinnerAdvanced,
              isLoserPath: edge.isLoserPath,
              sourceStatus: match.status
            });
          }
        }
      }
    }

    // Connect Grand Final match to Champion Podium if champion exists
    const finalRound = rounds.find(r => r.key === 'final') || rounds[rounds.length - 1];
    const finalMatch = finalRound?.matches[0];
    if (finalMatch) {
      const sourceEl = containerRef.current.querySelector(`[data-match-id="${finalMatch.id}"]`);
      const targetEl = containerRef.current.querySelector('.sports-champion-podium');
      if (sourceEl && targetEl) {
        const srcRect = sourceEl.getBoundingClientRect();
        const trgRect = targetEl.getBoundingClientRect();

        const x1 = srcRect.right - containerRect.left;
        const y1 = srcRect.top + srcRect.height / 2 - containerRect.top;
        const x2 = trgRect.left - containerRect.left;
        const y2 = trgRect.top + trgRect.height / 2 - containerRect.top;

        const dx = Math.max(20, (x2 - x1) / 2);
        const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

        newConnectors.push({
          id: `${finalMatch.id}->podium`,
          pathData,
          isHighlighted: grandChampion !== null,
          isWinnerAdvanced: grandChampion !== null,
          sourceStatus: finalMatch.status
        });
      }
    }

    setConnectors(newConnectors);
  };

  useLayoutEffect(() => {
    measureConnectors();

    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(measureConnectors);
    }

    let observer = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => {
        measureConnectors();
      });
      observer.observe(containerRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, [rounds, isMobile, mobileViewMode, showMyPathOnly, grandChampion]);

  const handleSelectRound = (key) => {
    setActiveRoundKey(key);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('round', key);
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleCardClick = (match) => {
    setModalMatch(match);
    if (onViewMatchDetails) {
      onViewMatchDetails(match);
    }
  };

  const activeRound = rounds.find(r => r.key === activeRoundKey) || rounds[0];

  return (
    <div className="sports-playoffs-view" ref={containerRef}>
      {/* ================= 1. SPORTS PLAYOFFS BROADCAST BANNER ================= */}
      <section className="sports-playoffs-hero-banner" aria-label="Playoffs Overview Banner">
        <div className="hero-banner-glow"></div>
        <div className="hero-banner-content">
          {/* Top Title & Branding */}
          <div className="hero-banner-top">
            <div className="hero-brand-group">
              <span className="hero-trophy-icon">🏆</span>
              <div>
                <span className="hero-badge">IPL & CHAMPIONS LEAGUE PLAYOFFS FORMAT</span>
                <h2 className="hero-title">{tournament?.name || 'Championship Knockout & Playoffs'}</h2>
              </div>
            </div>

            <div className="hero-prize-pill">
              <span className="prize-coin">🪙</span>
              <div className="prize-text-group">
                <span className="prize-caption">TOTAL PRIZE POOL</span>
                <span className="prize-amount"><Num value={metrics.prizePool} /> COINS</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="hero-metrics-grid">
            <div className="hero-metric-card">
              <span className="metric-label">CURRENT STAGE</span>
              <span className="metric-value stage-val">{metrics.stageLabel}</span>
            </div>

            <div className="hero-metric-card">
              <span className="metric-label">REMAINING PLAYERS</span>
              <span className="metric-value">{metrics.remainingPlayers} / {metrics.participantsCount}</span>
            </div>

            <div className="hero-metric-card">
              <span className="metric-label">COMPLETED MATCHES</span>
              <span className="metric-value">{metrics.completedMatches} / {metrics.totalMatches}</span>
            </div>

            <div className="hero-metric-card">
              <span className="metric-label">LIVE MATCHES</span>
              <span className={`metric-value ${metrics.liveMatches > 0 ? 'live-val-pulse' : ''}`}>
                {metrics.liveMatches > 0 ? `⚡ ${metrics.liveMatches} LIVE NOW` : '0 Scheduled'}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="hero-progress-section">
            <div className="hero-progress-header">
              <span>Tournament Completion</span>
              <span className="progress-percent">{metrics.progressPercent}%</span>
            </div>
            <div className="hero-progress-track">
              <div
                className="hero-progress-fill"
                style={{ width: `${metrics.progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= 2. CONTROLS BAR ================= */}
      <div className="sports-bracket-controls-bar">
        <div className="controls-left">
          <div className="bracket-format-chip">
            <span>🥊</span>
            <span>Single Elimination • {rounds.length} Rounds</span>
          </div>

          {isMobile && (
            <div className="mobile-view-toggle-group">
              <button
                type="button"
                className={`btn-view-toggle ${mobileViewMode === 'tabs' ? 'active' : ''}`}
                onClick={() => setMobileViewMode('tabs')}
              >
                Round Tabs
              </button>
              <button
                type="button"
                className={`btn-view-toggle ${mobileViewMode === 'tree' ? 'active' : ''}`}
                onClick={() => setMobileViewMode('tree')}
              >
                Full Tree 🌲
              </button>
            </div>
          )}
        </div>

        <div className="controls-right">
          {myPathMatchIds.size > 0 && (
            <button
              type="button"
              className={`btn-tactile btn-my-path-toggle ${showMyPathOnly ? 'active' : ''}`}
              onClick={() => setShowMyPathOnly(!showMyPathOnly)}
            >
              <span>🎯</span>
              <span>{showMyPathOnly ? 'Showing My Path' : 'Highlight My Path'}</span>
            </button>
          )}

          {grandChampion && (
            <button
              type="button"
              className="btn-tactile btn-amber btn-crown-nav"
              onClick={() => onViewChampion ? onViewChampion() : (onViewMatchDetails && onViewMatchDetails({ isChampion: true }))}
            >
              <span>🏆</span>
              <span>Champion: {grandChampion.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= 3. BRACKET PRESENTATION ================= */}
      {isMobile && mobileViewMode === 'tabs' ? (
        /* Mobile Tabbed View (Clean 1-Round-At-a-Time Stack) */
        <div className="bracket-mobile-tabs-mode">
          <RoundTabs
            rounds={rounds}
            activeRoundKey={activeRoundKey}
            onSelectRound={handleSelectRound}
            hasMyPath={myPathMatchIds.size > 0}
            isMyPathActive={showMyPathOnly}
            onToggleMyPath={() => setShowMyPathOnly(!showMyPathOnly)}
          />

          <div className="bracket-mobile-round-content">
            <div className="bracket-round-header-mobile">
              <h3 className="bracket-round-title">{activeRound?.title}</h3>
              <span className="bracket-round-match-count">
                {activeRound?.matches.length} {activeRound?.matches.length === 1 ? 'Match' : 'Matches'}
              </span>
            </div>

            <div className="bracket-card-stack-mobile">
              {activeRound?.matches
                .filter(m => !showMyPathOnly || myPathMatchIds.has(m.id))
                .map(match => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    currentUserId={currentUserId}
                    isOnMyPath={myPathMatchIds.has(match.id)}
                    isFeatured={match.roundKey === 'final' || match.round?.toLowerCase().includes('final')}
                    onPlay={onPlayMatch}
                    onViewDetails={() => handleCardClick(match)}
                    onViewPlayer={onViewPlayer}
                  />
                ))}

              {showMyPathOnly && activeRound?.matches.filter(m => myPathMatchIds.has(m.id)).length === 0 && (
                <div className="bracket-empty-path-card">
                  <p>You have no matches in {activeRound?.title}.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Desktop, Tablet & Mobile Full-Tree Horizontal Scroller */
        <div className="sports-bracket-canvas-wrapper">
          <div
            className="sports-bracket-scroller"
            ref={scrollerRef}
            tabIndex={0}
            aria-label="Interactive Tournament Bracket"
          >
            {/* SVG Connector Lines Overlay */}
            <svg
              className="sports-bracket-svg-overlay"
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1
              }}
            >
              {connectors.map(c => (
                <path
                  key={c.id}
                  d={c.pathData}
                  className={`sports-connector-path ${c.isWinnerAdvanced ? 'path-winner-advanced' : ''} ${c.isHighlighted ? 'path-my-path' : ''} ${c.isLoserPath ? 'path-loser-drop' : ''}`}
                  stroke={c.isLoserPath ? '#F59E0B' : undefined}
                  strokeDasharray={c.isLoserPath ? '6 4' : undefined}
                  fill="none"
                />
              ))}
            </svg>

            {/* Horizontal Rounds Columns */}
            <div className="sports-rounds-columns-container" style={{ position: 'relative', zIndex: 2 }}>
              {rounds.map((round, rIdx) => (
                <section
                  key={round.key}
                  className={`sports-round-column ${round.key === 'final' ? 'column-grand-final' : ''}`}
                  aria-label={round.title}
                >
                  <header className="sports-column-header">
                    <span className="column-round-number">ROUND {rIdx + 1}</span>
                    <h4 className="sports-column-title">{round.title}</h4>
                    <span className="sports-column-count">
                      {round.matches.length} {round.matches.length === 1 ? 'Match' : 'Matches'}
                    </span>
                  </header>

                  <div className="sports-column-matches-arena">
                    {round.matches.map(match => (
                      <div key={match.id} className="sports-match-node-wrapper">
                        <MatchCard
                          match={match}
                          currentUserId={currentUserId}
                          isOnMyPath={myPathMatchIds.has(match.id)}
                          isFeatured={round.key === 'final' || match.round?.toLowerCase().includes('final')}
                          onPlay={onPlayMatch}
                          onViewDetails={() => handleCardClick(match)}
                          onViewPlayer={onViewPlayer}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              {/* Champion Podium Column */}
              <section className="sports-round-column column-podium" aria-label="Grand Champion Podium">
                <header className="sports-column-header podium-header">
                  <span className="column-round-number">CHAMPIONSHIP</span>
                  <h4 className="sports-column-title">Grand Champion</h4>
                  <span className="sports-column-count">Tournament Winner</span>
                </header>

                <div className="sports-column-matches-arena">
                  <div className="sports-champion-podium" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <TrophyChampionCrown
                      winnerName={grandChampion?.name || 'Awaiting Finalist'}
                      size={110}
                    />

                    {grandChampion ? (
                      <div className="podium-winner-card" style={{ marginTop: '10px' }}>
                        <span className="podium-crown">👑</span>
                        <h4 className="podium-winner-name">{grandChampion.name}</h4>
                        <span className="podium-winner-tag">UNDISPUTED CHAMPION</span>
                        <div className="podium-prize-pill">
                          <span>🪙 <Num value={Math.round(metrics.prizePool * 0.60)} /> Coins</span>
                        </div>
                        {onViewChampion && (
                          <button
                            type="button"
                            className="btn-tactile btn-amber btn-sm btn-podium-celebrate"
                            onClick={onViewChampion}
                          >
                            Celebration View 🎉
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="podium-placeholder-card" style={{ marginTop: '10px' }}>
                        <span className="placeholder-icon">⚔️</span>
                        <strong className="placeholder-title">Awaiting Final</strong>
                        <span className="placeholder-subtext">Winner of Grand Final will be crowned Champion</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. INTERACTIVE MATCH DETAILS MODAL ================= */}
      {modalMatch && (
        <MatchDetailsModal
          match={modalMatch}
          tournament={tournament}
          currentUserId={currentUserId}
          onClose={() => setModalMatch(null)}
          onPlay={onPlayMatch}
          onViewPlayer={onViewPlayer}
        />
      )}
    </div>
  );
}
