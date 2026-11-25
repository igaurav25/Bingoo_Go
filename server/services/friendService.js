/**
 * server/services/friendService.js
 *
 * Social & Friend management with Prisma ORM.
 * Uses real User & Friendship models cleanly without hardcoded fake friends.
 */

import { prisma, isDbConnected, handlePrismaError } from '../db/prisma.js';
import { authService } from './authService.js';

const fallbackFriends = new Map(); // userId -> Set<friendUserId>
const fallbackRequests = new Map(); // requestId -> { id, senderId, receiverId, status, createdAt }

export class FriendService {
  async sendFriendRequest(senderId, receiverId) {
    if (!senderId || !receiverId) {
      throw { status: 400, message: 'Sender and receiver IDs are required.' };
    }
    if (senderId === receiverId) {
      throw { status: 400, message: 'You cannot send a friend request to yourself.' };
    }

    if (isDbConnected()) {
      try {
        const existing = await prisma.friendRequest.findFirst({
          where: {
            OR: [
              { senderId, receiverId, status: 'PENDING' },
              { senderId: receiverId, receiverId: senderId, status: 'PENDING' }
            ]
          }
        });

        if (existing) {
          throw { status: 409, message: 'A pending friend request already exists between these users.' };
        }

        return await prisma.friendRequest.create({
          data: {
            senderId,
            receiverId,
            status: 'PENDING'
          },
          include: {
            sender: { include: { profile: true } },
            receiver: { include: { profile: true } }
          }
        });
      } catch (err) {
        if (err.status) throw err;
        throw handlePrismaError(err);
      }
    }

    for (const r of fallbackRequests.values()) {
      if (r.status === 'PENDING' &&
          ((r.senderId === senderId && r.receiverId === receiverId) ||
           (r.senderId === receiverId && r.receiverId === senderId))) {
        throw { status: 409, message: 'A pending friend request already exists between these users.' };
      }
    }

    const reqId = `fr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const req = { id: reqId, senderId, receiverId, status: 'PENDING', createdAt: new Date() };
    fallbackRequests.set(reqId, req);
    return req;
  }

  async respondToFriendRequest(requestId, accept = true) {
    if (isDbConnected()) {
      try {
        return await prisma.$transaction(async (tx) => {
          const req = await tx.friendRequest.findUnique({ where: { id: requestId } });
          if (!req || req.status !== 'PENDING') {
            throw { status: 404, message: 'Friend request not found or already processed.' };
          }

          const status = accept ? 'ACCEPTED' : 'DECLINED';
          const updated = await tx.friendRequest.update({
            where: { id: requestId },
            data: { status }
          });

          if (accept) {
            const [u1, u2] = [req.senderId, req.receiverId].sort();
            await tx.friendship.upsert({
              where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
              update: {},
              create: { user1Id: u1, user2Id: u2 }
            });
          }

          return updated;
        });
      } catch (err) {
        if (err.status) throw err;
        throw handlePrismaError(err);
      }
    }

    const req = fallbackRequests.get(requestId);
    if (!req) throw { status: 404, message: 'Friend request not found.' };
    req.status = accept ? 'ACCEPTED' : 'DECLINED';
    if (accept) {
      if (!fallbackFriends.has(req.senderId)) fallbackFriends.set(req.senderId, new Set());
      if (!fallbackFriends.has(req.receiverId)) fallbackFriends.set(req.receiverId, new Set());
      fallbackFriends.get(req.senderId).add(req.receiverId);
      fallbackFriends.get(req.receiverId).add(req.senderId);
    }
    return req;
  }

  async getPendingRequests(userId) {
    if (isDbConnected()) {
      try {
        return await prisma.friendRequest.findMany({
          where: { receiverId: userId, status: 'PENDING' },
          include: { sender: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    const users = authService.getFallbackUsers();
    return Array.from(fallbackRequests.values())
      .filter(r => r.receiverId === userId && r.status === 'PENDING')
      .map(r => {
        const sender = users.find(u => u.id === r.senderId);
        return {
          ...r,
          sender: sender ? { id: sender.id, username: sender.username, avatar: sender.avatar } : null
        };
      });
  }

  async getFriends(userId) {
    if (!userId) return [];

    if (isDbConnected()) {
      try {
        const friendships = await prisma.friendship.findMany({
          where: { OR: [{ user1Id: userId }, { user2Id: userId }] },
          include: {
            user1: { include: { profile: true, presence: true, statistics: true } },
            user2: { include: { profile: true, presence: true, statistics: true } }
          }
        });

        return friendships.map(f => {
          const friend = f.user1Id === userId ? f.user2 : f.user1;
          return {
            id: friend.id,
            username: friend.username,
            name: friend.profile?.displayName || friend.username,
            displayName: friend.profile?.displayName || friend.username,
            avatar: friend.avatar,
            level: friend.profile?.level || 1,
            rank: friend.profile?.title || 'Contender',
            status: (friend.presence?.status || 'OFFLINE').toLowerCase(),
            lastSeen: friend.presence?.lastSeen,
            matchesWon: friend.statistics?.matchesWon || friend.statistics?.wins || 0
          };
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    const friendIds = fallbackFriends.get(userId);
    if (!friendIds || friendIds.size === 0) return [];
    const realUsers = authService.getFallbackUsers();
    return Array.from(friendIds)
      .map(fid => realUsers.find(u => u.id === fid))
      .filter(Boolean)
      .map(u => ({
        id: u.id,
        username: u.username,
        name: u.profile?.displayName || u.username,
        displayName: u.profile?.displayName || u.username,
        avatar: u.avatar || '🦊',
        level: u.profile?.level || 1,
        rank: u.profile?.title || 'Rookie Striker',
        status: (u.presence?.status || 'online').toLowerCase(),
        matchesWon: u.statistics?.matchesWon || u.statistics?.wins || 0
      }));
  }

  async updatePresence(userId, status = 'ONLINE') {
    if (!userId) return;
    if (isDbConnected()) {
      try {
        return await prisma.userPresence.upsert({
          where: { userId },
          update: { status, lastSeen: new Date() },
          create: { userId, status, lastSeen: new Date() }
        });
      } catch (err) {
        console.warn('⚠️ [Prisma FriendService] Presence update error:', err.message);
      }
    } else {
      const u = authService.getFallbackUsers().find(user => user.id === userId);
      if (u) {
        u.presence = { status, lastSeen: new Date() };
      }
    }
  }
}

export const friendService = new FriendService();
