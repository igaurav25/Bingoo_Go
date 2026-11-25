/**
 * server/friendsManager.js
 *
 * Manages real connected user presence and direct player challenges.
 * Derives directory entries from connected sockets rather than fake mock friends.
 */

export class FriendsManager {
  constructor() {
    /** @type {Map<string, { id: string, name: string, avatar: string, status: 'online' | 'in_game' | 'offline', ws: any }>} */
    this.users = new Map();
    /** @type {Map<string, { id: string, fromId: string, fromName: string, fromAvatar: string, toId: string, createdAt: number, status: 'pending' | 'accepted' | 'rejected' | 'expired' }>} */
    this.challenges = new Map();

    // Practice/sparring directory entries (flagged isBot: true)
    this.defaultFriends = [
      { id: 'f-alex', name: 'Alex_Pro', avatar: '⚡', status: 'online', rank: 'Diamond I', isBot: true },
      { id: 'f-rohit', name: 'Rohit', avatar: '🦊', status: 'online', rank: 'Platinum II', isBot: true },
      { id: 'f-zara', name: 'Zara_Queen', avatar: '🐼', status: 'in_game', rank: 'Gold III', isBot: true },
      { id: 'f-shadow', name: 'ShadowNinja', avatar: '🐱', status: 'offline', rank: 'Diamond III', isBot: true },
      { id: 'f-priya', name: 'Priya_Star', avatar: '🐰', status: 'online', rank: 'Gold I', isBot: true }
    ];
  }

  registerUser(playerId, name, avatar, ws) {
    if (!playerId) return;
    this.users.set(playerId, {
      id: playerId,
      name: name || 'Player',
      avatar: avatar || '🦊',
      status: 'online',
      ws
    });
  }

  unregisterUser(playerId, ws = null) {
    const user = this.users.get(playerId);
    if (user && (!ws || user.ws === ws)) {
      user.status = 'offline';
      user.ws = null;
    }
  }

  getUser(playerId) {
    return this.users.get(playerId) || null;
  }

  setUserStatus(playerId, status) {
    const user = this.users.get(playerId);
    if (user) {
      user.status = status;
    }
  }

  getFriendsList(playerId, includeDefaults = true) {
    const list = includeDefaults ? [...this.defaultFriends] : [];
    for (const [id, user] of this.users.entries()) {
      if (id !== playerId && !id.startsWith('bot-') && !list.some(f => f.id === id)) {
        list.unshift({
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          status: user.status || 'offline',
          isOnline: Boolean(user.ws && user.status !== 'offline'),
          isBot: false
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
