import test from 'node:test';
import assert from 'node:assert/strict';
import { EconomyManager } from '../server/economy.js';

test('Economy: Welcome bonus, win rewards, and transaction history', () => {
  const econ = new EconomyManager();
  const acc = econ.getAccount('user-1', 'Alice');

  // Welcome gift
  assert.equal(acc.balance, 500);
  assert.equal(acc.history.length, 1);
  assert.equal(acc.history[0].type, 'WELCOME_BONUS');

  // Match victory
  const matchWin = econ.awardMatchWin('user-1', 150, 'Bob');
  assert.equal(matchWin.balance, 650);
  assert.equal(acc.history.length, 2);
  assert.equal(acc.history[0].type, 'MATCH_WIN');
  assert.equal(acc.history[0].amount, 150);

  // Tournament champion victory
  const tournWin = econ.awardTournamentWin('user-1', 500, 'Knockout');
  assert.equal(tournWin.balance, 1150);
  assert.equal(acc.history[0].type, 'TOURNAMENT_CHAMPION');
  assert.equal(acc.history[0].amount, 500);

  // Wallet snapshot
  const wallet = econ.getWallet('user-1');
  assert.equal(wallet.balance, 1150);
  assert.ok(wallet.history.length >= 3);
});
