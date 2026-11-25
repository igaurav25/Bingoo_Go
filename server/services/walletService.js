/**
 * server/services/walletService.js
 * 
 * ACID-compliant Wallet & Coin Transactions with Prisma ORM.
 */

import { prisma, isDbConnected, handlePrismaError } from '../db/prisma.js';

// In-memory fallback balances
const fallbackWallets = new Map();
const fallbackTransactions = new Map();

export class WalletService {
  /**
   * Gets or initializes user wallet.
   */
  async getWallet(userId) {
    if (isDbConnected()) {
      try {
        let wallet = await prisma.wallet.findUnique({
          where: { userId }
        });
        if (!wallet) {
          wallet = await prisma.wallet.create({
            data: {
              userId,
              balance: 500,
              diamonds: 10
            }
          });
        }
        return wallet;
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    if (!fallbackWallets.has(userId)) {
      fallbackWallets.set(userId, { userId, balance: 500, diamonds: 10 });
    }
    return fallbackWallets.get(userId);
  }

  /**
   * Awards coins atomically with transaction history.
   */
  async awardCoins(userId, amount, type = 'MATCH_WIN', description = 'Match Reward', referenceId = null) {
    if (amount <= 0) return await this.getWallet(userId);

    if (isDbConnected()) {
      try {
        return await prisma.$transaction(async (tx) => {
          const wallet = await tx.wallet.upsert({
            where: { userId },
            update: { balance: { increment: amount } },
            create: { userId, balance: 500 + amount, diamonds: 10 }
          });

          const transaction = await tx.coinTransaction.create({
            data: {
              walletId: wallet.id,
              amount,
              type,
              description,
              balanceAfter: wallet.balance,
              referenceId
            }
          });

          return { wallet, transaction };
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    const wallet = await this.getWallet(userId);
    wallet.balance += amount;
    const tx = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      amount,
      balanceAfter: wallet.balance,
      description,
      referenceId
    };

    if (!fallbackTransactions.has(userId)) {
      fallbackTransactions.set(userId, []);
    }
    fallbackTransactions.get(userId).unshift(tx);

    return { wallet, transaction: tx };
  }

  /**
   * Deducts coins atomically after verifying sufficient balance.
   */
  async deductCoins(userId, amount, type = 'TOURNAMENT_ENTRY', description = 'Entry Fee') {
    if (amount <= 0) return await this.getWallet(userId);

    if (isDbConnected()) {
      try {
        return await prisma.$transaction(async (tx) => {
          const current = await tx.wallet.findUnique({ where: { userId } });
          if (!current || current.balance < amount) {
            throw { status: 400, message: 'Insufficient coin balance.' };
          }

          const wallet = await tx.wallet.update({
            where: { userId },
            data: { balance: { decrement: amount } }
          });

          const transaction = await tx.coinTransaction.create({
            data: {
              walletId: wallet.id,
              amount: -amount,
              type,
              description,
              balanceAfter: wallet.balance
            }
          });

          return { wallet, transaction };
        });
      } catch (err) {
        if (err.status) throw err;
        throw handlePrismaError(err);
      }
    }

    const wallet = await this.getWallet(userId);
    if (wallet.balance < amount) {
      throw { status: 400, message: 'Insufficient coin balance.' };
    }

    wallet.balance -= amount;
    const tx = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type,
      amount: -amount,
      balanceAfter: wallet.balance,
      description
    };

    if (!fallbackTransactions.has(userId)) {
      fallbackTransactions.set(userId, []);
    }
    fallbackTransactions.get(userId).unshift(tx);

    return { wallet, transaction: tx };
  }

  /**
   * Fetches recent coin transactions for a user.
   */
  async getTransactionHistory(userId, limit = 20) {
    if (isDbConnected()) {
      try {
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) return [];

        return await prisma.coinTransaction.findMany({
          where: { walletId: wallet.id },
          take: limit,
          orderBy: { createdAt: 'desc' }
        });
      } catch (err) {
        throw handlePrismaError(err);
      }
    }

    return (fallbackTransactions.get(userId) || []).slice(0, limit);
  }
}

export const walletService = new WalletService();
