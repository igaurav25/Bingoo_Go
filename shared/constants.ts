/**
 * shared/constants.ts
 * 
 * Shared constants, color codes, and game mode catalog.
 */

import { GameModeInfo } from './types';

export const SPORTS_COLORS = {
  deepNavy: '#0C1422',
  midnightBlue: '#101827',
  secondaryBlue: '#17243A',
  royalBlue: '#2864D9',
  electricBlue: '#438BFF',
  premiumWhite: '#F4F6FA',
  gold: '#F3B94F',
  goldGradientStart: '#FFF4B8',
  goldGradientEnd: '#92400E',
  slate: '#8995A8',
  successGreen: '#32B879',
  dangerRed: '#E6535D',
  purple: '#A855F7',
  cyan: '#06B6D4'
};

export const BINGO_COLUMN_COLORS = {
  B: '#E6535D',
  I: '#F59E0B',
  N: '#10B981',
  G: '#3B82F6',
  O: '#A855F7'
};

export const GAME_MODES: GameModeInfo[] = [
  {
    id: 'quick-match',
    name: 'Quick Match',
    icon: '⚡',
    tagline: 'Play Instantly',
    description: 'Fast 1v1 matchmaking with competitive line cutting.',
    players: '2 Players',
    category: 'MULTIPLAYER'
  },
  {
    id: 'private-room',
    name: 'Private Room',
    icon: '👥',
    tagline: 'Create / Join',
    description: 'Host custom duels with unique 5-character room codes.',
    players: '2 Players',
    category: 'MULTIPLAYER'
  },
  {
    id: '2v2-team',
    name: '2v2 Team Mode',
    icon: '👥',
    tagline: 'Play with Friend',
    description: 'Team up with a partner against another squad.',
    players: '4 Players',
    category: 'MULTIPLAYER'
  },
  {
    id: 'friend-challenge',
    name: 'Friend Challenge',
    icon: '🏆',
    tagline: 'Challenge Friends',
    description: 'Send direct duel challenges to friends on your roster.',
    players: '2 Players',
    category: 'MULTIPLAYER'
  },
  {
    id: 'knockout-tourn',
    name: 'Knockout Tournament',
    icon: '🏆',
    tagline: 'Elimination Match',
    description: 'Single-elimination championship bracket with apex trophy.',
    players: '8 Players',
    category: 'TOURNAMENT',
    isTournament: true
  },
  {
    id: 'league-tourn',
    name: 'League Tournament',
    icon: '🏆',
    tagline: 'Group Stage & Table',
    description: 'Round-robin points league with qualification cut line.',
    players: '4-8 Players',
    category: 'TOURNAMENT',
    isTournament: true
  },
  {
    id: 'practice',
    name: 'Practice Mode',
    icon: '🛡️',
    tagline: 'Solo Training',
    description: 'Sharpen your skills against an adaptive bot opponent.',
    players: '1 Player',
    category: 'SOLO'
  },
  {
    id: 'offline',
    name: 'Offline Mode',
    icon: '🎮',
    tagline: 'Play with Bots',
    description: 'Play anywhere without an active network connection.',
    players: '1 Player',
    category: 'SOLO'
  },
  {
    id: 'survival',
    name: 'Survival Mode',
    icon: '🔥',
    tagline: 'Sudden Death',
    description: 'Multi-round elimination ladder with increasing difficulty.',
    players: '1-4 Players',
    category: 'SPECIAL'
  },
  {
    id: 'time-challenge',
    name: 'Time Challenge',
    icon: '⏱️',
    tagline: 'Speed Blitz',
    description: 'Beat the clock by completing 5 lines under intense pressure.',
    players: '1 Player',
    category: 'SPECIAL'
  },
  {
    id: 'friends-league',
    name: 'Friends League',
    icon: '🏆',
    tagline: 'Group Fixtures',
    description: 'Private league table and custom fixtures for your friend circle.',
    players: '4-12 Players',
    category: 'TOURNAMENT',
    isTournament: true
  },
  {
    id: 'friends-knockout',
    name: 'Friends Knockout',
    icon: '🏆',
    tagline: 'Private Bracket',
    description: 'Invite-only bracket tournament with custom match management.',
    players: '4-16 Players',
    category: 'TOURNAMENT',
    isTournament: true
  },
  {
    id: 'friends-hybrid',
    name: 'Friends Hybrid',
    icon: '🏆',
    tagline: 'League & Playoffs',
    description: 'Comprehensive IPL format: Group stage followed by top-4 playoffs.',
    players: '8 Players',
    category: 'TOURNAMENT',
    isTournament: true
  }
];
