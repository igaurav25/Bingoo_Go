/**
 * src/tournaments/screens/TournamentHome.jsx
 * 
 * Main Tournament Hub Screen (/tournaments).
 * Responsive on mobile phones (320px-430px), tablets, and desktop.
 * Features:
 * - Header with Title, Search button, Notifications button (with unread badge), and Profile card.
 * - Format Guides modal and IPL championship hero banner.
 * - Category filter tabs: All Tournaments, My Tournaments, Upcoming/Open, Live, Completed.
 * - Real tournament cards showing: Name, Format, Host name, Participants/Capacity,
 *   Entry fee, Prize pool, Status, Start time/schedule, and context-aware action buttons.
 * - Tournament Notifications Drawer/Modal (match invitations, match-ready alerts, and results).
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PageShell } from '../components/PageShell.jsx';
import { StatusBadge } from '../components/StatusBadge.jsx';
import { Num } from '../components/Num.jsx';
import { FormatDetailsModal } from '../components/FormatDetailsModal.jsx';

export function TournamentHome({
  tournaments = [],
  currentUserId = null,
  currentUser = null,
  coins = 500,
  isLoading = false,
  error = null,
  onRefresh = null,
  onNavigate = null,
  onNavigateProfile = null,
  onNavigateHome = null
}) {
  const [filter, setFilter] = useState('all'); // all | my | open | live | finished
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFormatGuide, setSelectedFormatGuide] = useState(null); // 'LEAGUE' | 'KNOCKOUT' | 'HYBRID' | null
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifFilter, setNotifFilter] = useState('all'); // all | match | invite | result
  const [isSearchActive, setIsSearchActive] = useState(false);

  const searchInputRef = useRef(null);

  // User profile
  const user = currentUser || {
    id: currentUserId,
    name: 'Player',
    avatar: '🦊',
    level: 1,
    rank: 'Challenger'
  };

  // Fetch real notifications on mount or when drawer opens
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      try {
        const url = currentUserId ? `/api/notifications?userId=${encodeURIComponent(currentUserId)}` : '/api/notifications';
        const res = await fetch(url);
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
        }
      } catch (e) {
        // Fallback: extract notifications directly from tournaments list if available
        if (isMounted && Array.isArray(tournaments)) {
          const list = [];
          tournaments.forEach(t => {
            if (Array.isArray(t.notifications)) {
              t.notifications.forEach(n => {
                if (!currentUserId || !n.recipientId || n.recipientId === currentUserId) {
                  list.push({ ...n, tournamentId: t.id, tournamentName: t.name });
                }
              });
            }
          });
          setNotifications(list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
        }
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUserId, tournaments]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const filteredTournaments = useMemo(() => {
    return (tournaments || []).filter(t => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = t.name?.toLowerCase().includes(query);
        const matchesFormat = t.format?.toLowerCase().includes(query);
        const matchesCode = t.code?.toLowerCase().includes(query);
        const matchesHost = (t.hostName || t.creatorName)?.toLowerCase().includes(query);
        if (!matchesName && !matchesFormat && !matchesCode && !matchesHost) return false;
      }

      // Category filter
      if (filter === 'my') {
        return currentUserId && t.participants?.some(p => p.id === currentUserId);
      }
      if (filter === 'open') {
        return t.status === 'PENDING' || t.status === 'REGISTERING' || t.status === 'OPEN';
      }
      if (filter === 'live') {
        return t.status === 'IN_PROGRESS';
      }
      if (filter === 'finished') {
        return t.status === 'COMPLETED';
      }
      return true; // all
    });
  }, [tournaments, filter, searchQuery, currentUserId]);

  const stats = useMemo(() => {
    const list = tournaments || [];
    return {
      total: list.length,
      live: list.filter(t => t.status === 'IN_PROGRESS').length,
      open: list.filter(t => t.status === 'PENDING' || t.status === 'REGISTERING' || t.status === 'OPEN').length,
      my: list.filter(t => currentUserId && t.participants?.some(p => p.id === currentUserId)).length
    };
  }, [tournaments, currentUserId]);

  const filteredNotifications = useMemo(() => {
    if (notifFilter === 'all') return notifications;
    if (notifFilter === 'match') return notifications.filter(n => n.type === 'MATCH_READY' || n.type === 'MATCH_UPDATE');
    if (notifFilter === 'invite') return notifications.filter(n => n.type === 'INVITATION');
    if (notifFilter === 'result') return notifications.filter(n => n.type === 'MATCH_RESULT' || n.type === 'CHAMPION');
    return notifications;
  }, [notifications, notifFilter]);

  const handleToggleSearch = () => {
    setIsSearchActive(prev => {
      const next = !prev;
      if (next && searchInputRef.current) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      return next;
    });
  };

  const handleProfileClick = () => {
    if (onNavigateProfile) {
      onNavigateProfile();
    } else if (onNavigate) {
      onNavigate('/profile');
    }
  };

  return (
    <PageShell
      title="🏆 Tournament Arena"
      subtitle="Compete in real-time brackets, leagues and championships with friends"
      isLoading={isLoading}
      error={error}
      onRetry={onRefresh}
      actions={
        <div className="tourn-home-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Search Toggle Button */}
          <button
            type="button"
            className={`btn-tactile ${isSearchActive ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 12px', minHeight: '40px' }}
            onClick={handleToggleSearch}
            title="Search tournaments by name or code"
            aria-label="Search tournaments"
          >
            <span>🔍</span>
            <span className="hide-on-mobile">Search</span>
          </button>

          {/* Notifications Button */}
          <button
            type="button"
            className="btn-tactile btn-secondary tourn-notification-trigger"
            style={{ position: 'relative', padding: '8px 12px', minHeight: '40px' }}
            onClick={() => setShowNotifications(true)}
            title="Tournament Notifications"
            aria-label="Notifications"
          >
            <span>🔔</span>
            <span className="hide-on-mobile">Alerts</span>
            {unreadCount > 0 && (
              <span className="tourn-notif-badge">{unreadCount}</span>
            )}
          </button>

          {/* Profile Quick Pill */}
          <button
            type="button"
            className="tourn-header-profile-pill"
            onClick={handleProfileClick}
            title="View Player Profile"
            aria-label="User Profile"
          >
            <span className="pill-avatar">{user.avatar || '🦊'}</span>
            <div className="pill-info hide-on-mobile">
              <span className="pill-name">{user.name}</span>
              <span className="pill-rank">Lvl {user.level || 12} • 🪙 {coins}</span>
            </div>
          </button>

          {/* Primary Action Buttons */}
          <button
            type="button"
            className="btn-tactile btn-primary"
            onClick={() => onNavigate && onNavigate('/tournaments/new')}
            style={{ padding: '8px 14px', minHeight: '40px' }}
          >
            <span>➕</span>
            <span>Create</span>
          </button>
          <button
            type="button"
            className="btn-tactile btn-amber"
            onClick={() => onNavigate && onNavigate('/tournaments/join')}
            style={{ padding: '8px 14px', minHeight: '40px' }}
          >
            <span>🔑</span>
            <span>Join</span>
          </button>
        </div>
      }
    >
      {/* ==================== 0. IPL-STYLE TOURNAMENT HERO BANNER ==================== */}
      <section className="tourn-ipl-hero-banner" aria-label="Bingo Premier League Championship">
        <div className="ipl-hero-content">
          <div className="ipl-badge-row">
            <span className="ipl-season-badge">🏆 BINGO PREMIER LEAGUE • SEASON 01</span>
            <span className="ipl-live-pulse-badge">
              <span className="pulse-dot"></span>
              {stats.live > 0 ? `${stats.live} Matches Live` : 'Registration Open'}
            </span>
          </div>

          <h1 className="ipl-hero-title">
            Compete. Qualify.<br />Become Champion.
          </h1>
          <p className="ipl-hero-desc">
            Experience 5-match IPL League seasons (+2 Pts/Win), real-time Points Tables, Qualifier 1, Eliminator, Qualifier 2 &amp; Grand Final on the live 5×5 Bingo arena.
          </p>

          <div className="ipl-hero-meta-strip">
            <div className="meta-stat">
              <span className="stat-label">Active Cups</span>
              <strong className="stat-value">{stats.total}</strong>
            </div>
            <div className="meta-stat">
              <span className="stat-label">Live Matches</span>
              <strong className="stat-value">{stats.live}</strong>
            </div>
            <div className="meta-stat">
              <span className="stat-label">Open for Entry</span>
              <strong className="stat-value">{stats.open}</strong>
            </div>
            <div className="meta-stat">
              <span className="stat-label">My Joined</span>
              <strong className="stat-value">{stats.my}</strong>
            </div>
          </div>

          <div className="ipl-hero-buttons-row">
            <button
              type="button"
              className="btn-tactile btn-primary btn-hero-action"
              onClick={() => onNavigate && onNavigate('/tournaments/new')}
            >
              <span>➕</span> Create Tournament
            </button>
            <button
              type="button"
              className="btn-tactile btn-amber btn-hero-action"
              onClick={() => onNavigate && onNavigate('/tournaments/join')}
            >
              <span>🔑</span> Join Tournament
            </button>
            <button
              type="button"
              className="btn-tactile btn-secondary btn-hero-action"
              onClick={() => setFilter('open')}
            >
              <span>🟢</span> Open Tournaments
            </button>
            <button
              type="button"
              className="btn-tactile btn-secondary btn-hero-action"
              onClick={() => setFilter('my')}
            >
              <span>👤</span> My Tournaments ({stats.my})
            </button>
          </div>
        </div>
      </section>

      {/* ==================== 1. CORE FORMAT SHOWCASE CARDS ==================== */}
      <section className="tourn-formats-showcase" aria-label="Tournament formats explained">
        <div className="format-showcase-header">
          <h2 className="showcase-title">Choose Your Tournament Format</h2>
          <p className="showcase-sub">Every format is designed for exciting, fair competition among friends and open players.</p>
        </div>

        <div className="format-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {/* 1. League Tournament */}
          <div className="format-card league-theme">
            <div className="format-badge-pill">LEAGUE</div>
            <div className="format-card-icon">🏆</div>
            <h3 className="format-card-title">Individual League</h3>
            <p className="format-card-quote">
              "Play multiple matches, earn points, and qualify for the playoffs."
            </p>
            <div className="format-card-meta">
              <span>👥 4–16 Players</span>
              <span>•</span>
              <span>📈 Points Table</span>
              <span>•</span>
              <span>🪙 Prize Pool</span>
            </div>
            <div className="format-card-actions">
              <button
                type="button"
                className="btn-format-details"
                onClick={() => setSelectedFormatGuide('LEAGUE')}
              >
                <span>ℹ️</span> View Details
              </button>
              <button
                type="button"
                className="btn-tactile btn-primary btn-sm"
                onClick={() => onNavigate && onNavigate('/tournaments/new?format=LEAGUE')}
              >
                Create League
              </button>
            </div>
          </div>

          {/* 2. Knockout Tournament */}
          <div className="format-card knockout-theme">
            <div className="format-badge-pill">KNOCKOUT</div>
            <div className="format-card-icon">🥊</div>
            <h3 className="format-card-title">Knockout Tournament</h3>
            <p className="format-card-quote">
              "Win your match to advance. Lose and you are eliminated."
            </p>
            <div className="format-card-meta">
              <span>👥 4–16 Players</span>
              <span>•</span>
              <span>🌳 Elimination Tree</span>
              <span>•</span>
              <span>⚡ High Stakes</span>
            </div>
            <div className="format-card-actions">
              <button
                type="button"
                className="btn-format-details"
                onClick={() => setSelectedFormatGuide('KNOCKOUT')}
              >
                <span>ℹ️</span> View Details
              </button>
              <button
                type="button"
                className="btn-tactile btn-primary btn-sm"
                onClick={() => onNavigate && onNavigate('/tournaments/new?format=KNOCKOUT')}
              >
                Create Knockout
              </button>
            </div>
          </div>

          {/* 3. Hybrid Tournament */}
          <div className="format-card hybrid-theme">
            <div className="format-badge-pill">HYBRID</div>
            <div className="format-card-icon">🛡️</div>
            <h3 className="format-card-title">Hybrid Tournament</h3>
            <p className="format-card-quote">
              "Play the league stage first, then qualify for the knockout rounds."
            </p>
            <div className="format-card-meta">
              <span>👥 4–16 Players</span>
              <span>•</span>
              <span>📊 Group + Finals</span>
              <span>•</span>
              <span>🏅 Best of Both</span>
            </div>
            <div className="format-card-actions">
              <button
                type="button"
                className="btn-format-details"
                onClick={() => setSelectedFormatGuide('HYBRID')}
              >
                <span>ℹ️</span> View Details
              </button>
              <button
                type="button"
                className="btn-tactile btn-primary btn-sm"
                onClick={() => onNavigate && onNavigate('/tournaments/new?format=HYBRID')}
              >
                Create Hybrid
              </button>
            </div>
          </div>

          {/* 4. Team League Tournament */}
          <div className="format-card team-theme">
            <div className="format-badge-pill">TEAM LEAGUE</div>
            <div className="format-card-icon">🦁</div>
            <h3 className="format-card-title">Team Franchise League</h3>
            <p className="format-card-quote">
              "IPL-style franchise cup. Captains and teams battle for team points."
            </p>
            <div className="format-card-meta">
              <span>👥 4 Franchises</span>
              <span>•</span>
              <span>👑 Captains</span>
              <span>•</span>
              <span>⚡ Team Points</span>
            </div>
            <div className="format-card-actions">
              <button
                type="button"
                className="btn-format-details"
                onClick={() => setSelectedFormatGuide('LEAGUE')}
              >
                <span>ℹ️</span> View Details
              </button>
              <button
                type="button"
                className="btn-tactile btn-primary btn-sm"
                onClick={() => onNavigate && onNavigate('/tournaments/new?format=TEAM_LEAGUE')}
              >
                Create Team Cup
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 2. ACTIVE TOURNAMENTS LIST & FILTERS ==================== */}
      <section className="tourn-active-directory" aria-label="Active tournaments directory">
        <div className="directory-header-row">
          <h2 className="directory-title">Active & Open Tournaments</h2>
          <span className="directory-count-badge">{filteredTournaments.length} Displayed</span>
        </div>

        {/* Search & Filter Bar */}
        <div className="tourn-home-filters-bar">
          <div className={`tourn-search-input-wrapper ${isSearchActive || searchQuery ? 'search-highlight' : ''}`}>
            <span className="search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="tourn-search-input"
              placeholder="Search by name, format, host or 5-char code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tournaments"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="tourn-filter-pills" role="tablist" aria-label="Tournament filters">
            {[
              { id: 'all', label: 'All Tournaments', count: stats.total },
              { id: 'my', label: '👤 My Tournaments', count: stats.my },
              { id: 'open', label: '🟢 Upcoming / Open', count: stats.open },
              { id: 'live', label: '🔴 Live / In Progress', count: stats.live },
              { id: 'finished', label: '🏁 Completed' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={filter === tab.id}
                className={`tourn-filter-pill ${filter === tab.id ? 'active' : ''}`}
                onClick={() => setFilter(tab.id)}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && <span className="pill-count">({tab.count})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Tournaments Grid */}
        <div className="tourn-cards-grid arena-stagger">
          {isLoading ? (
            [1, 2, 3].map(n => (
              <div key={n} className="tournament-card skeleton-block" style={{ minHeight: '210px', pointerEvents: 'none' }} />
            ))
          ) : error ? (
            <div className="tourn-empty-state">
              <span className="empty-icon">⚠️</span>
              <h3>Could Not Load Tournaments</h3>
              <p>{error}</p>
              {onRefresh && (
                <button type="button" className="btn-tactile btn-primary" onClick={onRefresh} style={{ marginTop: '12px' }}>
                  Retry
                </button>
              )}
            </div>
          ) : filteredTournaments.length === 0 ? (
            <div className="tourn-empty-state">
              <span className="empty-icon">🏆</span>
              <h3>No tournaments found</h3>
              <p>
                {filter === 'my'
                  ? "You haven't joined any tournaments yet. Join an open tournament or create your own!"
                  : searchQuery
                  ? `No tournaments match "${searchQuery}". Check the code or tournament name.`
                  : "No tournaments match your current filter. Try selecting 'All' or create one."}
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-tactile btn-primary"
                  onClick={() => onNavigate && onNavigate('/tournaments/new')}
                >
                  Create Tournament Now
                </button>
                <button
                  type="button"
                  className="btn-tactile btn-amber"
                  onClick={() => onNavigate && onNavigate('/tournaments/join')}
                >
                  Join with Code
                </button>
              </div>
            </div>
          ) : (
            filteredTournaments.map(tournament => {
              const participantCount = tournament.participants?.length || 0;
              const maxPlayers = tournament.maxPlayers || tournament.totalPlayers || 8;
              const isFull = participantCount >= maxPlayers;
              const isJoined = currentUserId && tournament.participants?.some(p => p.id === currentUserId);
              const totalMatches = tournament.matches?.length || 0;
              const completedMatches = tournament.matches?.filter(m => m.status === 'COMPLETED').length || 0;
              const progressPct = totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0;
              
              const hostName = tournament.hostName || tournament.creatorName || (tournament.creatorId === 'host-1' ? 'Official Arena' : 'Host');
              const entryFee = tournament.entryFee || 0;
              const scheduleTime = tournament.startTime 
                ? new Date(tournament.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                : 'Instant on full';

              return (
                <article
                  key={tournament.id}
                  className={`tournament-card ${tournament.status.toLowerCase()}-card ${isJoined ? 'my-tournament' : ''}`}
                  onClick={() => onNavigate && onNavigate(`/tournaments/${tournament.id}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${tournament.name}, ${tournament.format} tournament`}
                >
                  {/* Header: Title + Status */}
                  <div className="tourn-card-header">
                    <div className="tourn-card-title-group">
                      <span className={`tourn-format-badge format-${tournament.format?.toLowerCase()}`}>
                        {tournament.format}
                      </span>
                      <h3 className="tourn-card-name">{tournament.name}</h3>
                    </div>
                    <StatusBadge status={tournament.status} size="small" />
                  </div>

                  {/* Host & Entry Strip */}
                  <div className="tourn-card-host-strip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '8px', fontSize: '0.82rem', margin: '4px 0' }}>
                    <span style={{ color: 'var(--tourn-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>👑 Host:</span>
                      <strong style={{ color: 'var(--tourn-text-primary)' }}>{hostName}</strong>
                    </span>
                    <span style={{ color: entryFee > 0 ? '#fbbf24' : '#10b981', fontWeight: 600 }}>
                      {entryFee > 0 ? `🪙 ${entryFee} Entry` : 'Free Entry'}
                    </span>
                  </div>

                  {/* Info Chips */}
                  <div className="tourn-card-meta-chips">
                    <div className="meta-chip">
                      <span className="chip-icon">👥</span>
                      <span className="chip-label">
                        <Num value={participantCount} /> / <Num value={maxPlayers} /> Players{tournament.minParticipants > 2 ? ` (Min ${tournament.minParticipants})` : ''}
                      </span>
                    </div>

                    <div className="meta-chip">
                      <span className="chip-icon">🪙</span>
                      <span className="chip-label">
                        Prize: <Num value={tournament.prizePool || 1000} /> Coins
                      </span>
                    </div>

                    <div className="meta-chip">
                      <span className="chip-icon">⏰</span>
                      <span className="chip-label">{scheduleTime}</span>
                    </div>

                    {tournament.code && (
                      <div className="meta-chip code-chip">
                        <span className="chip-label">Code: {tournament.code}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar (for live / finished) */}
                  {tournament.status !== 'PENDING' && totalMatches > 0 && (
                    <div className="tourn-progress-container">
                      <div className="tourn-progress-labels">
                        <span>Matches Progress</span>
                        <span>{completedMatches} of {totalMatches} ({progressPct}%)</span>
                      </div>
                      <div className="tourn-progress-track">
                        <div className="tourn-progress-bar" style={{ width: `${progressPct}%` }}></div>
                      </div>
                    </div>
                  )}

                  {/* Footer Action */}
                  <div className="tourn-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isJoined ? (
                        <button
                          type="button"
                          className="btn-tactile btn-primary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigate) onNavigate(`/tournaments/${tournament.id}`);
                          }}
                        >
                          <span>⚡</span> Continue
                        </button>
                      ) : (tournament.status === 'PENDING' || tournament.status === 'REGISTERING' || tournament.status === 'OPEN') ? (
                        <button
                          type="button"
                          className="btn-tactile btn-amber btn-sm"
                          disabled={isFull}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigate) onNavigate(`/tournaments/${tournament.id}`);
                          }}
                        >
                          <span>{isFull ? '🔒 Full' : '➕ Join'}</span>
                        </button>
                      ) : tournament.status === 'COMPLETED' ? (
                        <button
                          type="button"
                          className="btn-tactile btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigate) onNavigate(`/tournaments/${tournament.id}/champion`);
                          }}
                        >
                          <span>🏆</span> View Results
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-tactile btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigate) onNavigate(`/tournaments/${tournament.id}`);
                          }}
                        >
                          <span>👀</span> View Details
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-link-action"
                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onNavigate) onNavigate(`/tournaments/${tournament.id}`);
                        }}
                      >
                        Details →
                      </button>
                    </div>

                    <span className="tourn-card-stage-tag" style={{ fontSize: '0.75rem', color: 'var(--tourn-text-muted)' }}>
                      {tournament.status === 'COMPLETED' && (tournament.champion?.name || tournament.winner?.name)
                        ? `🏆 Champion: ${tournament.champion?.name || tournament.winner?.name}`
                        : `${tournament.season || 'Season 01'} • ${tournament.status === 'COMPLETED' ? 'Concluded' : tournament.status === 'IN_PROGRESS' ? '🔴 Live Matches' : 'Registration Open'}`}
                    </span>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* ==================== 3. TOURNAMENT NOTIFICATIONS MODAL / DRAWER ==================== */}
      {showNotifications && (
        <div className="tourn-modal-backdrop" onClick={() => setShowNotifications(false)}>
          <div
            className="tourn-modal-content tourn-notifications-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="notif-modal-title"
          >
            <div className="tourn-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.4rem' }}>🔔</span>
                <h3 id="notif-modal-title" style={{ margin: 0, fontSize: '1.15rem' }}>Tournament Notifications</h3>
                {notifications.length > 0 && (
                  <span className="pill-count">({notifications.length})</span>
                )}
              </div>
              <button
                type="button"
                className="btn-tactile btn-secondary"
                style={{ minHeight: '36px', minWidth: '36px', padding: '6px 10px' }}
                onClick={() => setShowNotifications(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Notification Filter Tabs */}
            <div className="notif-filter-tabs" style={{ display: 'flex', gap: '6px', margin: '12px 0', borderBottom: '1px solid var(--tourn-border)', paddingBottom: '8px' }}>
              {[
                { id: 'all', label: 'All Alerts' },
                { id: 'match', label: '⚡ Match Ready' },
                { id: 'invite', label: '📩 Invitations' },
                { id: 'result', label: '🏆 Results' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  className={`btn-tactile btn-sm ${notifFilter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                  onClick={() => setNotifFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notification List */}
            <div className="tourn-notif-scroll-area" style={{ maxHeight: '380px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--tourn-text-muted)' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📭</span>
                  <p style={{ margin: 0, fontWeight: 500 }}>No notifications in this tab</p>
                  <span style={{ fontSize: '0.8rem' }}>Match-ready alerts, friend invitations, and tournament results will appear here.</span>
                </div>
              ) : (
                filteredNotifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`notif-card notif-${notif.type?.toLowerCase() || 'info'}`}
                    style={{
                      background: 'var(--tourn-bg-card)',
                      border: '1px solid var(--tourn-border)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--tourn-text-primary)' }}>
                        {notif.type === 'MATCH_READY' ? '⚡ ' : notif.type === 'INVITATION' ? '📩 ' : notif.type === 'CHAMPION' ? '👑 ' : '📢 '}
                        {notif.title}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--tourn-text-muted)' }}>
                        {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--tourn-text-secondary)', lineHeight: 1.4 }}>
                      {notif.message}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '4px' }}>
                      {notif.actionUrl && (
                        <button
                          type="button"
                          className="btn-tactile btn-primary btn-sm"
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                          onClick={() => {
                            setShowNotifications(false);
                            if (onNavigate) onNavigate(notif.actionUrl);
                          }}
                        >
                          View →
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button
                type="button"
                className="btn-tactile btn-secondary btn-sm"
                onClick={() => setShowNotifications(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 4. FORMAT DETAILS MODAL ==================== */}
      <FormatDetailsModal
        isOpen={Boolean(selectedFormatGuide)}
        initialFormat={selectedFormatGuide || 'LEAGUE'}
        onClose={() => setSelectedFormatGuide(null)}
        onCreateFormat={(fmt) => {
          setSelectedFormatGuide(null);
          if (onNavigate) onNavigate(`/tournaments/new?format=${fmt}`);
        }}
        onJoin={() => {
          setSelectedFormatGuide(null);
          if (onNavigate) onNavigate('/tournaments/join');
        }}
      />
    </PageShell>
  );
}
