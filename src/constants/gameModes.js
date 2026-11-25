/**
 * src/constants/gameModes.js
 * 
 * Master definitions for all 13 BINGO game modes.
 * Shared between React components, tests, and routing.
 */

export const ALL_GAME_MODES = [
  {
    id: 'quick-match',
    modeNumber: 'Mode 01',
    title: 'Quick Match',
    icon: '⚡',
    reqPill: '1v1 Online',
    badgeBg: '#EBF2FD',
    badgeColor: '#1769E0',
    category: 'online',
    desc: 'Instant 1v1 matchmaking with players worldwide or swift AI queue.'
  },
  {
    id: 'private-room',
    modeNumber: 'Mode 02',
    title: 'Private Room',
    icon: '🔑',
    reqPill: '2 Players',
    badgeBg: '#FFF4EB',
    badgeColor: '#FF8A24',
    category: 'friends',
    desc: 'Create or join custom private rooms using 5-character codes.'
  },
  {
    id: 'team-2v2',
    modeNumber: 'Mode 03',
    title: '2v2 Team Battle',
    icon: '🛡️',
    reqPill: '4 Players (2v2)',
    badgeBg: '#EDFAF5',
    badgeColor: '#46D6A0',
    category: 'friends',
    desc: 'Team Blue vs Team Orange in a cooperative shared-line duel.'
  },
  {
    id: 'friend-challenge',
    modeNumber: 'Mode 04',
    title: 'Friend Challenge',
    icon: '🎯',
    reqPill: 'Direct Duel',
    badgeBg: '#EBF8FD',
    badgeColor: '#55C7F2',
    category: 'friends',
    desc: 'Challenge online friends directly from your active directory.'
  },
  {
    id: 'knockout',
    modeNumber: 'Mode 05',
    title: 'Knockout Cup',
    icon: '🥊',
    reqPill: '8 Players',
    badgeBg: '#FFEBEB',
    badgeColor: '#FF5555',
    category: 'tournaments',
    desc: 'Elimination bracket tournament: Quarterfinals to Champion!'
  },
  {
    id: 'league',
    modeNumber: 'Mode 06',
    title: 'Premier League',
    icon: '🦁',
    reqPill: '4 Teams / 6 Rds',
    badgeBg: '#FDF8EB',
    badgeColor: '#F5A623',
    category: 'tournaments',
    desc: 'IPL-style round-robin league with points table and playoff cutoff.'
  },
  {
    id: 'practice',
    modeNumber: 'Mode 07',
    title: 'Practice Mode',
    icon: '🤖',
    reqPill: 'Solo / Offline',
    badgeBg: '#F0EBFD',
    badgeColor: '#8E55F2',
    category: 'solo',
    desc: 'Play against smart AI bots with customizable difficulty.'
  },
  {
    id: 'offline',
    modeNumber: 'Mode 08',
    title: 'Offline Pass & Play',
    icon: '📱',
    reqPill: '2 Players • 1 Phone',
    badgeBg: '#EBFDF5',
    badgeColor: '#10B981',
    category: 'solo',
    desc: 'Take turns on the same device with privacy curtain between turns.'
  },
  {
    id: 'survival',
    modeNumber: 'Mode 09',
    title: 'Survival Mode',
    icon: '❤️',
    reqPill: '3 Lives • Rapid',
    badgeBg: '#FFF0F0',
    badgeColor: '#EF4444',
    category: 'solo',
    desc: 'Endure rapid-fire AI calls without missing a number. 3 lives total!'
  },
  {
    id: 'time-challenge',
    modeNumber: 'Mode 10',
    title: 'Time Challenge',
    icon: '⏱️',
    reqPill: '15s Turn Blitz',
    badgeBg: '#FFFBEB',
    badgeColor: '#D97706',
    category: 'solo',
    desc: 'High-speed blitz rules: only 15 seconds per call with speed points.'
  },
  {
    id: 'friends-league',
    modeNumber: 'Mode 11',
    title: 'Friends League Cup',
    icon: '🤝',
    reqPill: '4–8 Friends',
    badgeBg: '#F3E8FF',
    badgeColor: '#9333EA',
    category: 'tournaments',
    desc: 'Private round-robin league reserved exclusively for your squad.'
  },
  {
    id: 'friends-knockout',
    modeNumber: 'Mode 12',
    title: 'Friends Knockout Cup',
    icon: '🏆',
    reqPill: '4–16 Friends',
    badgeBg: '#FEF3C7',
    badgeColor: '#B45309',
    category: 'tournaments',
    desc: 'Custom elimination cup with custom prize pool and rules.'
  },
  {
    id: 'friends-hybrid',
    modeNumber: 'Mode 13',
    title: 'Friends Hybrid Cup',
    icon: '🌟',
    reqPill: 'Group + Playoffs',
    badgeBg: '#E0F2FE',
    badgeColor: '#0284C7',
    category: 'tournaments',
    desc: 'IPL format: Round-robin groups followed by Semis and Grand Final.'
  }
];
