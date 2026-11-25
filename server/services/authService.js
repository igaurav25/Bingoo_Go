/**
 * server/services/authService.js
 *
 * Authentication Service with Prisma ORM and resilient in-memory fallback.
 * Handles user registration, guest authenticated sessions, bcrypt password hashing, session tokens, and OTP.
 */

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { prisma, isDbConnected, handlePrismaError } from '../db/prisma.js';

// Resilient memory cache for offline mode / unit tests
const fallbackUsers = new Map();
const fallbackSessions = new Map();
const fallbackOTPs = new Map();

export class AuthService {
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password, hash) {
    if (!hash) return false;
    return bcrypt.compare(password, hash);
  }

  getFallbackUsers() {
    return Array.from(fallbackUsers.values());
  }

  async register({ username, email, password, avatar = '🦊' }) {
    if (!username || username.trim().length < 3) {
      throw { status: 400, message: 'Username must be at least 3 characters long.' };
    }
    const cleanUsername = username.trim();
    const cleanEmail = email ? email.trim().toLowerCase() : null;
    const passwordHash = password ? await this.hashPassword(password) : null;

    if (isDbConnected()) {
      try {
        const user = await prisma.user.create({
          data: {
            username: cleanUsername,
            email: cleanEmail,
            passwordHash,
            avatar,
            profile: {
              create: {
                displayName: cleanUsername,
                level: 1,
                experiencePoints: 0,
                currentXp: 0,
                title: 'Rookie Striker'
              }
            },
            wallet: {
              create: {
                balance: 500,
                diamonds: 10,
                totalEarned: 500
              }
            },
            statistics: {
              create: {
                totalMatches: 0,
                matchesPlayed: 0,
                wins: 0,
                matchesWon: 0,
                losses: 0,
                winRate: 0,
                winStreak: 0,
                currentStreak: 0,
                highestWinStreak: 0,
                bestStreak: 0
              }
            },
            settings: {
              create: {
                soundEnabled: true,
                musicEnabled: true,
                vibrationEnabled: true,
                theme: 'indigo'
              }
            },
            presence: {
              create: {
                status: 'ONLINE',
                lastSeen: new Date()
              }
            }
          },
          include: {
            profile: true,
            wallet: true,
            statistics: true,
            settings: true
          }
        });

        await prisma.coinTransaction.create({
          data: {
            walletId: user.wallet.id,
            amount: 500,
            type: 'WELCOME_BONUS',
            description: 'Welcome gift: 500 Virtual Coins',
            balanceAfter: 500
          }
        });

        const token = crypto.randomBytes(32).toString('hex');
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: token,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });

        return { user, sessionToken: token, token };
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    for (const u of fallbackUsers.values()) {
      if (u.username.toLowerCase() === cleanUsername.toLowerCase()) {
        throw { status: 409, message: 'A user with this username already exists.' };
      }
      if (cleanEmail && u.email === cleanEmail) {
        throw { status: 409, message: 'A user with this email already exists.' };
      }
    }

    const userId = `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const user = {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      avatar,
      role: 'PLAYER',
      profile: { displayName: cleanUsername, level: 1, experiencePoints: 0, currentXp: 0, title: 'Rookie Striker' },
      wallet: { id: `wlt-${userId}`, balance: 500, diamonds: 10 },
      statistics: { totalMatches: 0, matchesPlayed: 0, wins: 0, matchesWon: 0, losses: 0, winRate: 0, currentStreak: 0, bestStreak: 0 },
      settings: { soundEnabled: true, musicEnabled: true, vibrationEnabled: true, theme: 'indigo' },
      presence: { status: 'ONLINE', lastSeen: new Date() }
    };

    fallbackUsers.set(userId, user);
    const token = crypto.randomBytes(32).toString('hex');
    fallbackSessions.set(token, { userId, sessionToken: token, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });

    return { user, sessionToken: token, token };
  }

  /**
   * Mints a persistent authenticated guest player account & session token automatically.
   */
  async createGuestSession({ username = null, avatar = '🦊' } = {}) {
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const baseName = (username && username.trim().length >= 3)
      ? username.trim().slice(0, 16)
      : `Player_${suffix}`;

    let candidate = baseName;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.register({
          username: candidate,
          email: null,
          password: crypto.randomBytes(12).toString('hex'),
          avatar
        });
      } catch (err) {
        if (err.status === 409) {
          candidate = `${baseName.slice(0, 11)}_${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
          continue;
        }
        throw err;
      }
    }
    throw { status: 500, message: 'Unable to create player session.' };
  }

  async login({ username, password }) {
    if (!username || !password) {
      throw { status: 400, message: 'Username and password are required.' };
    }

    if (isDbConnected()) {
      try {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: username.trim() },
              { email: username.trim().toLowerCase() }
            ]
          },
          include: {
            profile: true,
            wallet: true,
            statistics: true,
            settings: true
          }
        });

        if (!user || !user.passwordHash) {
          throw { status: 401, message: 'Invalid username or password.' };
        }

        const valid = await this.comparePassword(password, user.passwordHash);
        if (!valid) {
          throw { status: 401, message: 'Invalid username or password.' };
        }

        const token = crypto.randomBytes(32).toString('hex');
        await prisma.session.create({
          data: {
            userId: user.id,
            sessionToken: token,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          }
        });

        await prisma.userPresence.upsert({
          where: { userId: user.id },
          update: { status: 'ONLINE', lastSeen: new Date() },
          create: { userId: user.id, status: 'ONLINE', lastSeen: new Date() }
        });

        return { user, sessionToken: token, token };
      } catch (err) {
        if (err.status) throw err;
        throw handlePrismaError(err);
      }
    }

    let matchedUser = null;
    for (const u of fallbackUsers.values()) {
      if (u.username.toLowerCase() === username.trim().toLowerCase() ||
          (u.email && u.email === username.trim().toLowerCase())) {
        matchedUser = u;
        break;
      }
    }

    if (!matchedUser || !matchedUser.passwordHash) {
      throw { status: 401, message: 'Invalid username or password.' };
    }

    const valid = await this.comparePassword(password, matchedUser.passwordHash);
    if (!valid) {
      throw { status: 401, message: 'Invalid username or password.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    fallbackSessions.set(token, { userId: matchedUser.id, sessionToken: token, expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
    return { user: matchedUser, sessionToken: token, token };
  }

  async verifySession(token) {
    if (!token) return null;

    if (isDbConnected()) {
      try {
        const session = await prisma.session.findUnique({
          where: { sessionToken: token },
          include: {
            user: {
              include: {
                profile: true,
                wallet: true,
                statistics: true,
                settings: true
              }
            }
          }
        });

        if (!session || new Date(session.expiresAt) < new Date()) {
          return null;
        }

        return session.user;
      } catch {
        return null;
      }
    }

    const session = fallbackSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    return fallbackUsers.get(session.userId) || null;
  }

  async requestOTP(identifier) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    if (isDbConnected()) {
      try {
        await prisma.oTPVerification.create({
          data: {
            phoneOrEmail: identifier,
            otpHash: code,
            purpose: 'VERIFICATION',
            expiresAt
          }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    } else {
      fallbackOTPs.set(identifier, { code, expiresAt: expiresAt.getTime(), attempts: 0 });
    }

    return { identifier, code, expiresAt };
  }

  async verifyOTP(identifier, code) {
    if (isDbConnected()) {
      try {
        const record = await prisma.oTPVerification.findFirst({
          where: {
            phoneOrEmail: identifier,
            otpHash: code,
            isUsed: false,
            expiresAt: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!record) return false;

        await prisma.oTPVerification.update({
          where: { id: record.id },
          data: { isUsed: true }
        });

        return true;
      } catch {
        return false;
      }
    }

    const cached = fallbackOTPs.get(identifier);
    if (!cached || cached.code !== code || cached.expiresAt < Date.now()) {
      return false;
    }

    fallbackOTPs.delete(identifier);
    return true;
  }
}

export const authService = new AuthService();
