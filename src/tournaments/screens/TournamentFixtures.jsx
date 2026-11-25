/**
 * src/tournaments/screens/TournamentFixtures.jsx
 * 
 * Fixtures Screen (/tournaments/:id/fixtures).
 * Fixtures grouped by round with filter chips (All, My Matches, Live, Completed),
 * interactive MatchCards, and direct navigation to match focus.
 */

import React, { useState, useMemo } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { MatchCard } from '../components/MatchCard.jsx';
import { selectFixtures } from '../selectors.js';

export function TournamentFixtures({
  tournament,
  currentUserId = null,
  onNavigate = null,
  onPlayMatch = null
}) {
  const [filter, setFilter] = useState('all'); // all | my | live | completed

  const allFixtures = useMemo(() => selectFixtures(tournament), [tournament]);

  // Filter fixtures
  const filteredFixtures = useMemo(() => {
    return allFixtures.filter(match => {
      if (filter === 'my') {
        return currentUserId && match.slots?.some(s => s.playerId === currentUserId);
      }
      if (filter === 'live') {
        return match.status === 'IN_PROGRESS' || match.status === 'READY';
      }
      if (filter === 'completed') {
        return match.status === 'COMPLETED';
      }
      return true; // all
    });
  }, [allFixtures, filter, currentUserId]);

  // Group filtered fixtures by roundTitle
  const groupedByRound = useMemo(() => {
    const map = new Map();
    for (const match of filteredFixtures) {
      const title = match.roundTitle || 'Round 1';
      if (!map.has(title)) {
        map.set(title, []);
      }
      map.get(title).push(match);
    }
    return Array.from(map.entries()).map(([roundTitle, matches]) => ({
      roundTitle,
      matches
    }));
  }, [filteredFixtures]);

  const hasMyMatches = currentUserId && allFixtures.some(m => m.slots?.some(s => s.playerId === currentUserId));

  return (
    <PageShell
      title="Tournament Fixtures"
      subtitle={`${tournament?.name || 'Tournament'} • ${allFixtures.length} Total Matches`}
      onBack={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}`)}
    >
      <div className="tourn-fixtures-container">
        {/* Navigation Tabs Bar */}
        <nav className="tourn-section-nav" aria-label="Tournament navigation">
          <button
            type="button"
            className="tourn-nav-pill"
            onClick={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}`)}
          >
            <span>Overview</span>
          </button>
          <button
            type="button"
            className="tourn-nav-pill active"
            onClick={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}/fixtures`)}
          >
            <span>Fixtures</span>
          </button>
          {tournament?.format !== 'KNOCKOUT' && (
            <button
              type="button"
              className="tourn-nav-pill"
              onClick={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}/table`)}
            >
              <span>Points Table</span>
            </button>
          )}
          {tournament?.format !== 'LEAGUE' && (
            <button
              type="button"
              className="tourn-nav-pill"
              onClick={() => onNavigate && onNavigate(`/tournaments/${tournament?.id}/bracket`)}
            >
              <span>Bracket</span>
            </button>
          )}
        </nav>

        {/* Filter Chips */}
        <div className="tourn-filter-pills" role="tablist" aria-label="Fixtures filter">
          {[
            { id: 'all', label: 'All Matches' },
            { id: 'live', label: '🔴 Live / Ready' },
            ...(hasMyMatches ? [{ id: 'my', label: '👤 My Matches' }] : []),
            { id: 'completed', label: '🏁 Completed' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className={`tourn-filter-pill ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Fixtures List Grouped by Round */}
        <div className="fixtures-rounds-stack">
          {groupedByRound.length === 0 ? (
            <div className="tourn-empty-state">
              <span className="empty-icon">📅</span>
              <h3>No matches found</h3>
              <p>No matches match the selected filter.</p>
            </div>
          ) : (
            groupedByRound.map(group => (
              <section key={group.roundTitle} className="fixtures-round-section">
                <div className="round-header">
                  <h3 className="round-title">{group.roundTitle}</h3>
                  <span className="round-count">({group.matches.length} {group.matches.length === 1 ? 'match' : 'matches'})</span>
                </div>

                <div className="fixtures-cards-grid">
                  {group.matches.map(match => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      currentUserId={currentUserId}
                      onPlay={onPlayMatch}
                      onViewDetails={(m) => onNavigate && onNavigate(`/tournaments/${tournament?.id}/matches/${m.id}`)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </PageShell>
  );
}
