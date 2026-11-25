/**
 * src/tournaments/TournamentRouter.jsx
 * 
 * Complete Client-Side Router for the Tournament Section.
 * Routes Supported:
 * - /tournaments                       -> TournamentHome
 * - /tournaments/new                   -> TournamentCreate
 * - /tournaments/join                  -> TournamentJoin
 * - /tournaments/join/:code            -> TournamentJoin (with initialCode)
 * - /tournaments/:id                   -> TournamentLobby (if PENDING) or TournamentOverview (if started/concluded)
 * - /tournaments/:id/fixtures          -> TournamentFixtures
 * - /tournaments/:id/table             -> StandingsTable (in PageShell)
 * - /tournaments/:id/bracket           -> BracketView (in PageShell)
 * - /tournaments/:id/matches/:matchId  -> TournamentMatchFocus
 * - /tournaments/:id/results           -> TournamentResults
 * - /tournaments/:id/champion          -> TournamentChampion
 * 
 * Real Server-Authoritative Data Integration:
 * - Fetches tournament list from /api/tournaments
 * - Fetches active tournament details from /api/tournaments/:id
 * - Synchronizes with browser popstate and pushState
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { socketClient } from '../services/socketClient.js';
import { PageShell } from './components/PageShell.jsx';
import { StandingsTable } from './components/StandingsTable.jsx';
import { BracketView } from './components/BracketView.jsx';
import { selectStandings } from './selectors.js';

import { TournamentHome } from './screens/TournamentHome.jsx';
import { TournamentCreate } from './screens/TournamentCreate.jsx';
import { TournamentJoin } from './screens/TournamentJoin.jsx';
import { TournamentLobby } from './screens/TournamentLobby.jsx';
import { TournamentOverview } from './screens/TournamentOverview.jsx';
import { TournamentFixtures } from './screens/TournamentFixtures.jsx';
import { TournamentMatchFocus } from './screens/TournamentMatchFocus.jsx';
import { TournamentResults } from './screens/TournamentResults.jsx';
import { TournamentChampion } from './screens/TournamentChampion.jsx';

export function TournamentRouter({
  initialPath = null,
  currentUserId = null,
  currentUserName = 'Player',
  currentUser = null,
  coins = 500,
  onNavigateHome = null,
  onNavigateProfile = null,
  onPlayMatch = null,
  onExit = null
}) {
  // Current route pathname
  const [currentPath, setCurrentPath] = useState(() => {
    if (initialPath) return initialPath;
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p.startsWith('/tournaments') ? p : '/tournaments';
    }
    return '/tournaments';
  });

  // State for tournament data
  const [tournamentsList, setTournamentsList] = useState([]);
  const [tournamentsMap, setTournamentsMap] = useState(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Parse current route parameters
  const route = useMemo(() => {
    const clean = currentPath.split('?')[0].replace(/\/+$/, '') || '/tournaments';

    if (clean === '/tournaments') {
      return { screen: 'home' };
    }
    if (clean === '/tournaments/new') {
      return { screen: 'create' };
    }
    const joinMatch = clean.match(/^\/tournaments\/join(?:\/([A-Za-z0-9_-]+))?$/);
    if (joinMatch) {
      return { screen: 'join', code: joinMatch[1] || '' };
    }

    const matchFocusMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)\/matches\/([A-Za-z0-9_-]+)$/);
    if (matchFocusMatch) {
      return { screen: 'match-focus', tournamentId: matchFocusMatch[1], matchId: matchFocusMatch[2] };
    }

    const fixturesMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)\/fixtures$/);
    if (fixturesMatch) {
      return { screen: 'fixtures', tournamentId: fixturesMatch[1] };
    }

    const tableMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)\/table$/);
    if (tableMatch) {
      return { screen: 'table', tournamentId: tableMatch[1] };
    }

    const bracketMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)\/bracket$/);
    if (bracketMatch) {
      return { screen: 'bracket', tournamentId: bracketMatch[1] };
    }

    const resultsMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)\/results$/);
    if (resultsMatch) {
      return { screen: 'results', tournamentId: resultsMatch[1] };
    }

    const championMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)\/champion$/);
    if (championMatch) {
      return { screen: 'champion', tournamentId: championMatch[1] };
    }

    const overviewMatch = clean.match(/^\/tournaments\/([A-Za-z0-9_-]+)$/);
    if (overviewMatch) {
      return { screen: 'overview-or-lobby', tournamentId: overviewMatch[1] };
    }

    return { screen: 'home' };
  }, [currentPath]);

  // Navigate helper with history push
  const navigate = useCallback((toPath) => {
    if (typeof window !== 'undefined') {
      if (window.location.pathname !== toPath) {
        window.history.pushState({ path: toPath }, '', toPath);
      }
    }
    setCurrentPath(toPath);
  }, []);

  // Sync with browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/tournaments')) {
        setCurrentPath(path);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Fetch all tournaments
  const fetchTournaments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/tournaments');
      const data = await res.json();
      if (data.success && Array.isArray(data.tournaments)) {
        setTournamentsList(data.tournaments);
        setTournamentsMap(prev => {
          const next = new Map(prev);
          for (const t of data.tournaments) {
            next.set(t.id, t);
          }
          return next;
        });
      } else {
        setError(data.error || 'Failed to load tournaments list');
      }
    } catch (err) {
      setError(err.message || 'Error fetching tournaments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch individual tournament if needed
  const fetchTournamentById = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/tournaments/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (res.ok && data.success && data.tournament) {
        const normalized = data.room && !data.tournament.room
          ? { ...data.tournament, room: data.room }
          : data.tournament;
        setTournamentsMap(prev => new Map(prev).set(id, normalized));
        setDetailError(null);
      } else {
        setDetailError(data.error || 'Tournament not found');
      }
    } catch (err) {
      setDetailError(err.message || 'Unable to load tournament lobby');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Initial fetch + live WebSocket updates on mount
  useEffect(() => {
    fetchTournaments();
    const unsub = socketClient.on('tournament_updated', (data) => {
      if (data?.tournament?.id) {
        setTournamentsMap(prev => new Map(prev).set(data.tournament.id, data.tournament));
        setTournamentsList(prev => {
          const exists = prev.some(t => t.id === data.tournament.id);
          if (exists) {
            return prev.map(t => t.id === data.tournament.id ? data.tournament : t);
          }
          return [data.tournament, ...prev];
        });
      } else {
        fetchTournaments();
      }
    });
    const unsubBingo = socketClient.on('bingo_result', () => {
      if (route.tournamentId) fetchTournamentById(route.tournamentId);
      fetchTournaments();
    });
    return () => {
      unsub();
      if (unsubBingo) unsubBingo();
    };
  }, [fetchTournaments, fetchTournamentById, route.tournamentId]);

  // Fetch tournament for current route if not in map or whenever route changes
  useEffect(() => {
    if (route.tournamentId) {
      fetchTournamentById(route.tournamentId);
    }
  }, [route.tournamentId, fetchTournamentById]);

  // Handle match play intent
  const handlePlayMatch = useCallback(async (match) => {
    if (onPlayMatch) {
      onPlayMatch(match);
      return;
    }
  }, [onPlayMatch]);

  // Active tournament object
  const activeTournament = route.tournamentId ? tournamentsMap.get(route.tournamentId) : null;

  const renderScreen = () => {
    switch (route.screen) {
    case 'home':
      return (
        <TournamentHome
          tournaments={tournamentsList}
          currentUserId={currentUserId}
          currentUser={currentUser || { id: currentUserId, name: currentUserName, avatar: '🦊', level: 12, rank: 'Diamond III' }}
          coins={coins}
          isLoading={isLoading}
          error={error}
          onRefresh={fetchTournaments}
          onNavigate={navigate}
          onNavigateProfile={onNavigateProfile}
          onNavigateHome={onNavigateHome}
        />
      );

    case 'create':
      return (
        <TournamentCreate
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onNavigate={navigate}
          onCreateTournament={async (payload) => {
            let token = socketClient.getAuthToken?.();
            let resolvedHostId = payload.hostId || payload.creatorId || currentUserId || socketClient.playerId || null;
            let resolvedHostName = payload.hostName || payload.creatorName || currentUserName || socketClient.playerName || 'Host';

            if ((!token || !resolvedHostId) && typeof socketClient.ensureSession === 'function') {
              try {
                const sessionUser = await socketClient.ensureSession();
                token = socketClient.getAuthToken?.() || token;
                if (sessionUser?.id) {
                  resolvedHostId = sessionUser.id;
                  resolvedHostName = sessionUser.profile?.displayName || sessionUser.username || resolvedHostName;
                }
              } catch {
                // Proceed with existing identity if offline
              }
            }

            const res = await fetch('/api/tournaments', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                ...payload,
                ...(resolvedHostId ? { creatorId: resolvedHostId, hostId: resolvedHostId } : {}),
                creatorName: resolvedHostName,
                hostName: resolvedHostName
              })
            });
            const data = await res.json();
            if (res.ok && data.success && data.tournament) {
              const createdTournament = data.room && !data.tournament.room
                ? { ...data.tournament, room: data.room }
                : data.tournament;
              setTournamentsMap(prev => new Map(prev).set(createdTournament.id, createdTournament));
              setTournamentsList(prev => {
                const filtered = prev.filter(t => t.id !== createdTournament.id);
                return [createdTournament, ...filtered];
              });
              fetchTournaments();
              return createdTournament;
            }
            throw new Error(data.error || 'Failed to create tournament');
          }}
        />
      );

    case 'join':
      return (
        <TournamentJoin
          initialCode={route.code || ''}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onNavigate={navigate}
          onJoinTournament={async (code) => {
            const token = socketClient.getAuthToken?.();
            const res = await fetch('/api/tournaments/join', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {})
              },
              body: JSON.stringify({
                code,
                playerId: currentUserId || 'player-join',
                playerName: currentUserName
              })
            });
            const data = await res.json();
            if ((res.ok && data.success && data.tournament) || (data.alreadyJoined && data.tournament)) {
              setTournamentsMap(prev => new Map(prev).set(data.tournament.id, data.tournament));
              fetchTournaments();
              return data.tournament;
            }
            throw new Error(data.error || 'Failed to join tournament');
          }}
        />
      );

    case 'overview-or-lobby':
      if (!activeTournament) {
        return (
          <PageShell
            title={detailError ? 'Tournament Not Found' : 'Loading Tournament...'}
            loading={detailLoading || !detailError}
            error={detailError}
            onBack={() => navigate('/tournaments')}
          />
        );
      }

      // If registering/waiting/pending registration, show Lobby
      const isLobby = ['PENDING', 'REGISTERING', 'OPEN', 'WAITING'].includes(String(activeTournament.status || '').toUpperCase());
      if (isLobby) {
        return (
          <TournamentLobby
            tournament={activeTournament}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onNavigate={navigate}
            onRefresh={() => {
              fetchTournamentById(activeTournament.id);
              fetchTournaments();
            }}
            onStartTournament={async (id) => {
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
              if (data.success && data.tournament) {
                setTournamentsMap(prev => new Map(prev).set(id, data.tournament));
                fetchTournaments();
              } else {
                throw new Error(data.error || 'Failed to start tournament');
              }
            }}
            onKickPlayer={async (id, playerId) => {
              const token = socketClient.getAuthToken?.();
              const res = await fetch(`/api/tournaments/${id}/kick`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ hostId: currentUserId, playerId })
              });
              const data = await res.json();
              if (data.success && data.tournament) {
                setTournamentsMap(prev => new Map(prev).set(id, data.tournament));
                fetchTournaments();
              }
            }}
          />
        );
      }

      // If in progress or completed, show Overview
      return (
        <TournamentOverview
          tournament={activeTournament}
          currentUserId={currentUserId}
          onNavigate={navigate}
          onPlayMatch={handlePlayMatch}
          onRefresh={() => {
            fetchTournamentById(activeTournament.id);
            fetchTournaments();
          }}
        />
      );

    case 'fixtures':
      return (
        <TournamentFixtures
          tournament={activeTournament}
          currentUserId={currentUserId}
          onNavigate={navigate}
          onPlayMatch={handlePlayMatch}
        />
      );

    case 'table': {
      const standings = activeTournament ? selectStandings(activeTournament) : [];
      return (
        <PageShell
          title="Points Table"
          subtitle={`${activeTournament?.name || 'Tournament'} • League Standings`}
          onBack={() => navigate(`/tournaments/${route.tournamentId}`)}
        >
          <div className="tourn-table-screen-container">
            <nav className="tourn-section-nav" aria-label="Tournament navigation">
              <button
                type="button"
                className="tourn-nav-pill"
                onClick={() => navigate(`/tournaments/${route.tournamentId}`)}
              >
                <span>Overview</span>
              </button>
              <button
                type="button"
                className="tourn-nav-pill"
                onClick={() => navigate(`/tournaments/${route.tournamentId}/fixtures`)}
              >
                <span>Fixtures</span>
              </button>
              <button
                type="button"
                className="tourn-nav-pill active"
                onClick={() => navigate(`/tournaments/${route.tournamentId}/table`)}
              >
                <span>Points Table</span>
              </button>
              {activeTournament?.format !== 'LEAGUE' && (
                <button
                  type="button"
                  className="tourn-nav-pill"
                  onClick={() => navigate(`/tournaments/${route.tournamentId}/bracket`)}
                >
                  <span>Bracket</span>
                </button>
              )}
            </nav>

            <StandingsTable
              standings={standings}
              currentUserId={currentUserId}
              showCompactOnMobile={true}
            />
          </div>
        </PageShell>
      );
    }

    case 'bracket':
      return (
        <PageShell
          title="Tournament Bracket"
          subtitle={`${activeTournament?.name || 'Tournament'} • Elimination Bracket`}
          onBack={() => navigate(`/tournaments/${route.tournamentId}`)}
        >
          <div className="tourn-bracket-screen-container">
            <nav className="tourn-section-nav" aria-label="Tournament navigation">
              <button
                type="button"
                className="tourn-nav-pill"
                onClick={() => navigate(`/tournaments/${route.tournamentId}`)}
              >
                <span>Overview</span>
              </button>
              <button
                type="button"
                className="tourn-nav-pill"
                onClick={() => navigate(`/tournaments/${route.tournamentId}/fixtures`)}
              >
                <span>Fixtures</span>
              </button>
              {activeTournament?.format !== 'KNOCKOUT' && (
                <button
                  type="button"
                  className="tourn-nav-pill"
                  onClick={() => navigate(`/tournaments/${route.tournamentId}/table`)}
                >
                  <span>Points Table</span>
                </button>
              )}
              <button
                type="button"
                className="tourn-nav-pill active"
                onClick={() => navigate(`/tournaments/${route.tournamentId}/bracket`)}
              >
                <span>Bracket</span>
              </button>
            </nav>

            <BracketView
              tournament={activeTournament}
              currentUserId={currentUserId}
              onPlayMatch={handlePlayMatch}
              onViewMatchDetails={(m) => m.id ? navigate(`/tournaments/${route.tournamentId}/matches/${m.id}`) : null}
              onViewChampion={() => navigate(`/tournaments/${route.tournamentId}/champion`)}
            />
          </div>
        </PageShell>
      );

    case 'match-focus':
      return (
        <TournamentMatchFocus
          tournament={activeTournament}
          matchId={route.matchId}
          currentUserId={currentUserId}
          onNavigate={navigate}
          onPlayMatch={handlePlayMatch}
        />
      );

    case 'results':
      return (
        <TournamentResults
          tournament={activeTournament}
          currentUserId={currentUserId}
          onNavigate={navigate}
        />
      );

    case 'champion':
      return (
        <TournamentChampion
          tournament={activeTournament}
          currentUserId={currentUserId}
          onNavigate={navigate}
        />
      );

    default:
      return (
        <TournamentHome
          tournaments={tournamentsList}
          currentUserId={currentUserId}
          isLoading={isLoading}
          error={error}
          onRefresh={fetchTournaments}
          onNavigate={navigate}
        />
      );
    }
  };

  return (
    <div className="tournament-router-viewport">
      {renderScreen()}
    </div>
  );
}
