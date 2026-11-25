/**
 * server/services/userService.js
 *
 * User profile, statistics, directory, and leaderboard management with Prisma ORM.
 */

import { prisma, isDbConnected, handlePrismaError } from '../db/prisma.js';
import { authService } from './authService.js';

const fallbackProfiles = new Map();

export class UserService {
  async getUserById(userId) {
    if (isDbConnected()) {
      try {
        return await prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: true,
            wallet: true,
            statistics: true,
            settings: true,
            achievements: {
              include: { achievement: true }
            }
          }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }
    const authUser = authService.getFallbackUsers().find(u => u.id === userId);
    const profOverride = fallbackProfiles.get(userId);
    if (authUser) {
      return profOverride ? { ...authUser, ...profOverride, profile: { ...authUser.profile, ...profOverride.profile } } : authUser;
    }
    return profOverride || null;
  }

  async updateProfile(userId, { displayName, username, bio, avatar, title }) {
    if (isDbConnected()) {
      try {
        if (avatar || username) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              ...(avatar ? { avatar } : {}),
              ...(username ? { username: username.trim().slice(0, 20) } : {})
            }
          });
        }

        return await prisma.userProfile.upsert({
          where: { userId },
          update: {
            ...(displayName !== undefined ? { displayName } : {}),
            ...(bio !== undefined ? { bio } : {}),
            ...(title !== undefined ? { title } : {})
          },
          create: {
            userId,
            displayName: displayName || username || 'Player',
            bio: bio || '',
            title: title || 'Novice Striker'
          }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    const authUser = authService.getFallbackUsers().find(u => u.id === userId);
    const existing = fallbackProfiles.get(userId) || { profile: { ...(authUser?.profile || {}) } };
    if (displayName) existing.profile.displayName = displayName;
    if (username && authUser) {
      authUser.username = username.trim().slice(0, 20);
      if (authUser.profile) authUser.profile.displayName = authUser.username;
    }
    if (bio !== undefined) existing.profile.bio = bio;
    if (avatar) {
      existing.avatar = avatar;
      if (authUser) authUser.avatar = avatar;
    }
    if (title) existing.profile.title = title;
    fallbackProfiles.set(userId, existing);
    return existing.profile;
  }

  async updateSettings(userId, settingsData) {
    if (isDbConnected()) {
      try {
        return await prisma.userSettings.upsert({
          where: { userId },
          update: settingsData,
          create: { userId, ...settingsData }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }
    return settingsData;
  }

  async listUsersDirectory(excludeUserId = null, search = '') {
    const q = (search || '').trim().toLowerCase();
    if (isDbConnected()) {
      try {
        const users = await prisma.user.findMany({
          take: 50,
          where: {
            ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
            ...(q ? { username: { contains: q, mode: 'insensitive' } } : {})
          },
          include: {
            profile: true,
            presence: true,
            statistics: true
          },
          orderBy: { createdAt: 'desc' }
        });

        return users.map(u => ({
          id: u.id,
          username: u.username,
          name: u.profile?.displayName || u.username,
          avatar: u.avatar || '🦊',
          level: u.profile?.level || 1,
          rank: u.profile?.title || 'Novice Striker',
          status: (u.presence?.status || 'OFFLINE').toLowerCase(),
          wins: u.statistics?.matchesWon || u.statistics?.wins || 0
        }));
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    return authService.getFallbackUsers()
      .filter(u => (!excludeUserId || u.id !== excludeUserId))
      .filter(u => !q || u.username.toLowerCase().includes(q))
      .map(u => ({
        id: u.id,
        username: u.username,
        name: u.profile?.displayName || u.username,
        avatar: u.avatar || '🦊',
        level: u.profile?.level || 1,
        rank: u.profile?.title || 'Novice Striker',
        status: (u.presence?.status || 'online').toLowerCase(),
        wins: u.statistics?.matchesWon || u.statistics?.wins || 0
      }));
  }

  async getLeaderboard(limit = 10, category = 'wins') {
    if (isDbConnected()) {
      try {
        if (category === 'balance') {
          const wallets = await prisma.wallet.findMany({
            where: { userId: { not: null } },
            take: limit,
            orderBy: { balance: 'desc' },
            include: {
              user: { include: { profile: true } }
            }
          });
          return wallets.filter(w => w.user).map((w, idx) => ({
            rank: idx + 1,
            userId: w.userId,
            username: w.user.username,
            name: w.user.profile?.displayName || w.user.username,
            displayName: w.user.profile?.displayName || w.user.username,
            avatar: w.user.avatar,
            level: w.user.profile?.level || 1,
            rankTier: w.user.profile?.title || 'Contender',
            score: w.balance,
            wins: 0,
            coins: w.balance,
            winRate: '0%',
            category: 'balance'
          }));
        }

        const stats = await prisma.userStatistics.findMany({
          take: limit,
          orderBy: [{ wins: 'desc' }, { matchesWon: 'desc' }],
          include: {
            user: { include: { profile: true, wallet: true } }
          }
        });
        return stats.map((s, idx) => {
          const played = s.totalMatches || s.matchesPlayed || 0;
          const won = s.wins || s.matchesWon || 0;
          const rate = played > 0 ? `${Math.round((won / played) * 100)}%` : '0%';
          return {
            rank: idx + 1,
            userId: s.userId,
            username: s.user.username,
            name: s.user.profile?.displayName || s.user.username,
            displayName: s.user.profile?.displayName || s.user.username,
            avatar: s.user.avatar,
            level: s.user.profile?.level || 1,
            rankTier: s.user.profile?.title || 'Contender',
            wins: won,
            score: won,
            coins: s.user.wallet?.balance || 500,
            winRate: rate,
            streak: s.winStreak || s.currentStreak || 0,
            category: 'wins'
          };
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    // Fallback mode: derive strictly from actual registered users (never fake players!)
    const realUsers = authService.getFallbackUsers();
    const sorted = [...realUsers].sort((a, b) => {
      if (category === 'balance') {
        return (b.wallet?.balance || 0) - (a.wallet?.balance || 0);
      }
      return (b.statistics?.matchesWon || b.statistics?.wins || 0) - (a.statistics?.matchesWon || a.statistics?.wins || 0);
    });

    return sorted.slice(0, limit).map((u, idx) => {
      const played = u.statistics?.matchesPlayed || u.statistics?.totalMatches || 0;
      const won = u.statistics?.matchesWon || u.statistics?.wins || 0;
      return {
        rank: idx + 1,
        userId: u.id,
        username: u.username,
        name: u.profile?.displayName || u.username,
        displayName: u.profile?.displayName || u.username,
        avatar: u.avatar || '🦊',
        level: u.profile?.level || 1,
        rankTier: u.profile?.title || 'Rookie Striker',
        wins: won,
        score: category === 'balance' ? (u.wallet?.balance || 500) : won,
        coins: u.wallet?.balance || 500,
        winRate: played > 0 ? `${Math.round((won / played) * 100)}%` : '0%',
        streak: u.statistics?.currentStreak || 0,
        category
      };
    });
  }
}

export const userService = new UserService();
