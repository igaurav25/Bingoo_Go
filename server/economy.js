/**
 * server/economy.js
 * 
 * In-memory authoritative economy and coin management system.
 * Handles virtual coin balances, win rewards, and transaction history.
 */

export class EconomyManager {
  constructor() {
    /**
     * Store of player balances: playerId -> { balance: number, history: Array<Transaction> }
     * @type {Map<string, { balance: number, history: Array<object> }>}
     */
    this.accounts = new Map();
  }

  /**
   * Gets or initializes an account with a 500 coin welcome bonus.
   * @param {string} playerId
   * @param {string} [name='Player']
   * @returns {{ balance: number, history: Array<object> }}
   */
  getAccount(playerId, name = 'Player') {
    if (!this.accounts.has(playerId)) {
      this.accounts.set(playerId, {
        playerId,
        name,
        balance: 500, // Welcome gift
        history: [
          {
            id: `tx-init-${Date.now()}`,
            timestamp: Date.now(),
            type: 'WELCOME_BONUS',
            amount: 500,
            balanceAfter: 500,
            description: 'Welcome gift: 500 Virtual Coins'
          }
        ]
      });
    }
    return this.accounts.get(playerId);
  }

  /**
   * Awards coins for a 1v1 match victory.
   * @param {string} playerId
   * @param {number} [amount=150]
   * @param {string} [opponentName='Opponent']
   * @returns {{ balance: number, transaction: object }}
   */
  awardMatchWin(playerId, amount = 150, opponentName = 'Opponent') {
    const acc = this.getAccount(playerId);
    acc.balance += amount;
    const tx = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'MATCH_WIN',
      amount,
      balanceAfter: acc.balance,
      description: `1v1 Match Victory vs ${opponentName}`
    };
    acc.history.unshift(tx);
    return { balance: acc.balance, transaction: tx };
  }

  /**
   * Awards coins for a tournament victory.
   * @param {string} playerId
   * @param {number} [amount=500]
   * @param {string} [tournamentType='Knockout']
   * @returns {{ balance: number, transaction: object }}
   */
  awardTournamentWin(playerId, amount = 500, tournamentType = 'Knockout') {
    const acc = this.getAccount(playerId);
    acc.balance += amount;
    const tx = {
      id: `tx-tourn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      type: 'TOURNAMENT_CHAMPION',
      amount,
      balanceAfter: acc.balance,
      description: `🏆 ${tournamentType} Tournament Champion Prize`
    };
    acc.history.unshift(tx);
    return { balance: acc.balance, transaction: tx };
  }

  /**
   * Returns wallet snapshot for client.
   * @param {string} playerId
   * @returns {{ balance: number, history: Array<object> }}
   */
  getWallet(playerId) {
    const acc = this.getAccount(playerId);
    return {
      balance: acc.balance,
      history: acc.history.slice(0, 20)
    };
  }
}

export const economy = new EconomyManager();
