/**
 * src/tournaments/selectors.js
 * 
 * Pure, unit-tested selectors for Tournament Data Model.
 * Extracts and organizes brackets, standings, fixtures, and paths of players
 * without duplicating state or client-side mutations.
 */

/**
 * Normalizes a match object to guarantee slots, scores, status, and labels.
 */
export function normalizeMatch(match, index = 0) {
  if (!match) return null;

  const id = match.id || `m-${index}`;
  const stageId = match.stageId || 'default-stage';
  const round = match.round || 'Round';
  const roundKey = match.roundKey || (
    round.toLowerCase().includes('final') && !round.toLowerCase().includes('semi') ? 'final' :
    round.toLowerCase().includes('semi') ? 'sf' :
    round.toLowerCase().includes('quarter') ? 'qf' : `r${index + 1}`
  );
  const roundTitle = match.roundTitle || round;
  const label = match.label || `Match ${String(index + 1).padStart(2, '0')}`;

  // Normalize slots
  let slots = match.slots;
  if (!slots || !Array.isArray(slots) || slots.length < 2) {
    const p1 = match.player1 || match.p1;
    const p2 = match.player2 || match.p2;
    slots = [
      {
        playerId: typeof p1 === 'string' ? p1 : (p1?.id || null),
        playerName: typeof p1 === 'string' ? p1 : (p1?.name || (match.isBye && !p1 ? 'Bye' : (p1?.id ? 'Player' : 'TBD'))),
        isBye: Boolean(match.isBye && !p1),
        source: null
      },
      {
        playerId: typeof p2 === 'string' ? p2 : (p2?.id || null),
        playerName: typeof p2 === 'string' ? p2 : (p2?.name || (match.isBye && !p2 ? 'Bye' : (p2?.id ? 'Player' : 'TBD'))),
        isBye: Boolean(match.isBye && !p2),
        source: null
      }
    ];
  }

  const scores = Array.isArray(match.scores) && match.scores.length === 2
    ? match.scores
    : [typeof match.score1 === 'number' ? match.score1 : 0, typeof match.score2 === 'number' ? match.score2 : 0];
  const winnerId = match.winnerId || (typeof match.winner === 'string' ? match.winner : match.winner?.id) || null;
  const status = (match.status || (winnerId ? 'COMPLETED' : 'WAITING')).toUpperCase();

  return {
    id,
    stageId,
    round,
    roundKey,
    roundTitle,
    index,
    label,
    slots,
    scores,
    status,
    winnerId,
    loserId: match.loserId || null,
    playoffStage: match.playoffStage || null,
    stage: match.stage || null,
    isBye: Boolean(match.isBye),
    advancesTo: match.advancesTo || null,
    loserAdvancesTo: match.loserAdvancesTo || null
  };
}

/**
 * Selects bracket rounds for Knockout format or Hybrid Playoffs.
 * Returns array of { key: 'r1'|'qf'|'sf'|'final', title: string, matches: Match[] }.
 */
export function selectBracketRounds(tournament, stageId = null) {
  if (!tournament) return [];

  // 1. Check if tournament has stages
  if (tournament.stages && tournament.stages.length > 0) {
    const stage = stageId 
      ? tournament.stages.find(s => s.id === stageId)
      : (tournament.stages.find(s => s.type === 'knockout') || tournament.stages[0]);

    if (stage && stage.rounds && stage.rounds.length > 0) {
      return stage.rounds.map((r, rIdx) => ({
        key: r.key || `r${rIdx + 1}`,
        title: r.title || `Round ${rIdx + 1}`,
        matches: (r.matches || []).map((m, mIdx) => normalizeMatch(m, mIdx))
      }));
    }
  }

  // 2. Fallback to knockoutMatches or playoffMatches
  const rawMatches = (stageId === 'stage-playoffs' || tournament.type === 'HYBRID' && tournament.status === 'PLAYOFFS')
    ? (tournament.playoffMatches || tournament.knockoutMatches || [])
    : (tournament.knockoutMatches || tournament.playoffMatches || []);

  if (!rawMatches || rawMatches.length === 0) return [];

  const roundMap = new Map();
  rawMatches.forEach((m, idx) => {
    const norm = normalizeMatch(m, idx);
    const key = norm.roundKey;
    if (!roundMap.has(key)) {
      roundMap.set(key, {
        key,
        title: norm.roundTitle,
        matches: []
      });
    }
    roundMap.get(key).matches.push(norm);
  });

  return Array.from(roundMap.values());
}

/**
 * Selects standings for League format or Hybrid League Stage.
 * Returns sorted array of Standing objects with rank and qualification indicator.
 */
export function selectStandings(tournament, stageId = null) {
  if (!tournament) return [];

  let table = [];

  // Check stage standings first
  if (tournament.stages) {
    const stage = stageId
      ? tournament.stages.find(s => s.id === stageId)
      : tournament.stages.find(s => s.type === 'league');
    if (stage && stage.standings) {
      table = stage.standings;
    }
  }

  // Fallback to pointsTable
  if (table.length === 0 && tournament.pointsTable) {
    table = tournament.pointsTable;
  }

  if (!Array.isArray(table) || table.length === 0) return [];

  const qualifiers = tournament.qualificationSlots || 4;

  // Clone and sort deterministically: Points (desc) -> H2H rank (if scored) -> Won (desc)
  const sorted = [...table].sort((a, b) => {
    const ptsA = Number(a.points) || 0;
    const ptsB = Number(b.points) || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;

    if (a.rank && b.rank && a.h2hSummary && b.h2hSummary && a.h2hSummary !== '-' && b.h2hSummary !== '-') {
      return Number(a.rank) - Number(b.rank);
    }

    const wonA = Number(a.won) || 0;
    const wonB = Number(b.won) || 0;
    if (wonB !== wonA) return wonB - wonA;

    const bingosA = Number(a.bingosCompleted) || 0;
    const bingosB = Number(b.bingosCompleted) || 0;
    if (bingosB !== bingosA) return bingosB - bingosA;

    return (a.name || a.playerName || '').localeCompare(b.name || b.playerName || '');
  });

  return sorted.map((row, index) => {
    const rank = index + 1;
    const playerId = row.playerId || row.id;
    const playerName = row.playerName || row.name || `Player ${rank}`;
    const played = Number(row.played) || 0;
    const won = Number(row.won) || 0;
    const lost = Number(row.lost) || 0;
    const points = Number(row.points) || 0;
    const qualified = rank <= qualifiers;

    return {
      playerId,
      playerName,
      avatar: row.avatar || '🦊',
      played,
      won,
      lost,
      points,
      rank,
      qualified,
      h2hSummary: row.h2hSummary || '-',
      tieBreakerNote: row.tieBreakerNote || null,
      winRate: played > 0 ? `${Math.round((won / played) * 100)}%` : '0%'
    };
  });
}

/**
 * Selects fixtures with optional status/user filtering.
 * Filter options: 'all' | 'mine' | 'live' | 'done'.
 */
export function selectFixtures(tournament, stageId = null, filter = 'all', currentUserId = null) {
  if (!tournament) return [];

  let raw = [];
  if (tournament.stages) {
    const stage = stageId 
      ? tournament.stages.find(s => s.id === stageId)
      : (tournament.stages.find(s => s.type === 'league') || tournament.stages[0]);
    if (stage && stage.fixtures) {
      raw = stage.fixtures;
    }
  }

  if (raw.length === 0) {
    raw = tournament.leagueFixtures || tournament.knockoutMatches || [];
  }

  const normalized = raw.map((f, idx) => normalizeMatch(f, idx));

  if (filter === 'mine' && currentUserId) {
    return normalized.filter(m => m.slots.some(s => s.playerId === currentUserId));
  }
  if (filter === 'live') {
    return normalized.filter(m => m.status === 'READY' || m.status === 'IN_PROGRESS');
  }
  if (filter === 'done') {
    return normalized.filter(m => m.status === 'COMPLETED');
  }

  return normalized;
}

/**
 * Traces the path of a player through a tournament bracket.
 * Returns { matchIds: Set<string>, currentMatchId: string|null, isEliminated: boolean, isChampion: boolean }
 */
export function selectPathOf(tournament, playerId) {
  if (!tournament || !playerId) {
    return { matchIds: new Set(), matches: [], currentMatchId: null, isEliminated: false, isChampion: false };
  }

  const matchIds = new Set();
  const matches = [];
  const allMatches = (tournament.knockoutMatches || []).concat(tournament.playoffMatches || []);
  let currentMatchId = null;
  let isEliminated = false;
  const championId = tournament.champion?.id || (typeof tournament.champion === 'string' ? tournament.champion : null)
    || tournament.winner?.id || (typeof tournament.winner === 'string' ? tournament.winner : null);
  const isChampion = championId === playerId;

  for (const match of allMatches) {
    const norm = normalizeMatch(match);
    const hasPlayer = norm.slots.some(s => s.playerId === playerId);
    if (hasPlayer) {
      matchIds.add(norm.id);
      matches.push(norm);
      if (norm.status === 'READY' || norm.status === 'IN_PROGRESS') {
        currentMatchId = norm.id;
      }
      if (norm.status === 'COMPLETED' && norm.winnerId && norm.winnerId !== playerId && !norm.loserAdvancesTo) {
        isEliminated = true;
      }
    }
  }

  return {
    matchIds,
    matches,
    currentMatchId,
    isEliminated,
    isChampion
  };
}

/**
 * Finds a specific match by ID across all stages.
 */
export function selectMatchById(tournament, matchId) {
  if (!tournament || !matchId) return null;

  const matches = (tournament.knockoutMatches || [])
    .concat(tournament.leagueFixtures || [])
    .concat(tournament.playoffMatches || []);

  const found = matches.find(m => m.id === matchId);
  return found ? normalizeMatch(found) : null;
}
