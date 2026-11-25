/**
 * shared/types.ts
 * 
 * Central TypeScript Definitions for BINGO Game.
 * Shared across Mobile (React Native + Expo), Web, and Backend.
 */

export type GameModeId =
  | 'quick-match'
  | 'private-room'
  | '2v2-team'
  | 'friend-challenge'
  | 'knockout-tourn'
  | 'league-tourn'
  | 'practice'
  | 'offline'
  | 'survival'
  | 'time-challenge'
  | 'friends-league'
  | 'friends-knockout'
  | 'friends-hybrid';

export interface GameModeInfo {
  id: GameModeId;
  name: string;
  icon: string;
  tagline: string;
  description: string;
  players: string;
  category: 'MULTIPLAYER' | 'TOURNAMENT' | 'SOLO' | 'SPECIAL';
  isTournament?: boolean;
}

export type MatchStatus = 'arranging' | 'waiting' | 'playing' | 'finished' | 'forfeited';

export interface Competitor {
  id: string;
  name: string;
  avatar: string;
  level: number;
  rank: string;
  online: boolean;
  linesCompleted: number;
}

export interface LineStrike {
  id: string; // e.g. "row-0", "col-2", "diag-main"
  type: 'row' | 'col' | 'diag';
  index: number;
  indices: number[]; // the 5 indices on the 5x5 board
}

export interface MatchResultData {
  won: boolean;
  reason?: string;
  coinsAwarded?: number;
  diamondsAwarded?: number;
  playerScore?: number;
  opponentScore?: number;
  opponentName?: string;
  opponentAvatar?: string;
  linesCompleted?: number;
}

export interface TournamentData {
  id: string;
  name: string;
  format: 'KNOCKOUT' | 'LEAGUE' | 'HYBRID';
  status: 'REGISTERING' | 'IN_PROGRESS' | 'PLAYOFFS' | 'COMPLETED';
  participantsCount: number;
  maxParticipants: number;
  prizePool: number;
  season?: string;
  winner?: { id: string; name: string; avatar?: string };
}

export interface FixtureData {
  id: string;
  roundTitle: string;
  roundKey: string;
  player1: { id: string; name: string; avatar: string; score?: number };
  player2: { id: string; name: string; avatar: string; score?: number };
  status: 'SCHEDULED' | 'READY' | 'IN_PROGRESS' | 'COMPLETED';
  winnerId?: string;
}

export interface StandingData {
  rank: number;
  playerId: string;
  playerName: string;
  avatar?: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  winRate: string;
  qualified: boolean;
}

export interface UserProfileData {
  id: string;
  username: string;
  avatar: string;
  level: number;
  rank: string;
  coins: number;
  diamonds: number;
  played: number;
  won: number;
  lost: number;
  winRate: string;
  goldTrophies: number;
  silverTrophies: number;
  bronzeTrophies: number;
}
