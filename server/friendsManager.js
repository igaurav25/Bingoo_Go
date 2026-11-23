/**
 * server/friendsManager.js
 * 
 * Manages user friends directory, online status, and direct friend challenges.
 */

export class FriendsManager {
  constructor() {
    /** @type {Map<string, { id: string, name: string, avatar: string, status: 'online' | 'in_game' | 'offline', ws: any }>} */
    this.users = new Map();
    /** @type {Map<string, { id: string, fromId: string, fromName: string, fromAvatar: string, toId: string, createdAt: number, status: 'pending' | 'accepted' | 'rejected' | 'expired' }>} */
    this.challenges = new Map();

    // Default mock friends directory for demo and sparring
    this.defaultFriends = [
      { id: 'f-alex', name: 'Alex_Pro', avatar: '⚡', status: 'online', rank: 'Diamond I' },
      { id: 'f-rohit', name: 'Rohit', avatar: '🦊', status: 'online', rank: 'Platinum II' },
      { id: 'f-zara', name: 'Zara_Queen', avatar: '🐼', status: 'in_game', rank: 'Gold III' },
      { id: 'f-shadow', name: 'ShadowNinja', avatar: '🐱', status: 'offline', rank: 'Diamond III' },
      { id: 'f-priya', name: 'Priya_Star', avatar: '🐰', status: 'online', rank: 'Gold I' }
    ];
  }

  registerUser(playerId, name, avatar, ws) {
    this.users.set(playerId, { id: playerId, name, avatar, status: 'online', ws });
  }

  unregisterUser(playerId) {
    const user = this.users.get(playerId);
    if (user) {
      user.status = 'offline';
      user.ws = null;
    }
  }

  setUserStatus(playerId, status) {
    const user = this.users.get(playerId);
    if (user) {
      user.status = status;
    }
  }

  getFriendsList(playerId) {
    // Return registered active users + default friends
    const list = [...this.defaultFriends];
    for (const [id, user] of this.users.entries()) {
      if (id !== playerId && !list.some(f => f.id === id)) {
        list.unshift({
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          status: user.status,
          rank: 'Gold II'
        });
      }
    }
    return list;
  }

  createChallenge(fromUser, toPlayerId) {
    const id = `chal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const challenge = {
      id,
      fromId: fromUser.id,
      fromName: fromUser.name,
      fromAvatar: fromUser.avatar,
      toId: toPlayerId,
      createdAt: Date.now(),
      status: 'pending'
    };
    this.challenges.set(id, challenge);
    return challenge;
  }

  getChallenge(challengeId) {
    return this.challenges.get(challengeId) || null;
  }

  respondToChallenge(challengeId, accept = true) {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) return { success: false, error: 'Challenge not found' };
    if (challenge.status !== 'pending') return { success: false, error: 'Challenge already concluded' };

    challenge.status = accept ? 'accepted' : 'rejected';
    return { success: true, challenge };
  }
}

export const friendsManager = new FriendsManager();
