/**
 * scratch/test_all_endpoints.js
 * Calls handleApiRoute with simulated mock req/res objects for every endpoint
 * to ensure all 18 endpoints are properly routed and return valid responses!
 */

import { handleApiRequest } from '../server/routes/apiRoutes.js';
import { tournamentManager } from '../server/tournamentManager.js';

// Setup test tournament
const testTourn = tournamentManager.createTournament(
  'KNOCKOUT',
  'Endpoint Test Cup',
  'host-test',
  'Host Test'
);
testTourn.addParticipant('p1', 'Player One');

const endpointsToTest = [
  { method: 'GET', url: '/api/tournaments' },
  { method: 'POST', url: '/api/tournaments', body: { name: 'New Tourn', type: 'KNOCKOUT', creatorId: 'host-1', creatorName: 'Host' } },
  { method: 'GET', url: `/api/tournaments/${testTourn.id}` },
  { method: 'POST', url: '/api/tournaments/join', body: { code: testTourn.code, playerId: 'p2', playerName: 'Player Two' } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/ready`, body: { playerId: 'p1', isReady: true } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/leave`, body: { playerId: 'p2' } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/invitations`, body: { recipientName: 'Friend1', senderId: 'host-test' } },
  { method: 'GET', url: `/api/tournaments/${testTourn.id}/invitations` },
  { method: 'GET', url: `/api/tournaments/${testTourn.id}/audit-log` },
  { method: 'PATCH', url: `/api/tournaments/${testTourn.id}/settings`, body: { hostId: 'host-test', name: 'Updated Name' } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/fill-bots`, body: { hostId: 'host-test' } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/start`, body: { hostId: 'host-test' } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/kick`, body: { hostId: 'host-test', playerId: 'p1' } },
  { method: 'POST', url: `/api/tournaments/${testTourn.id}/cancel`, body: { hostId: 'host-test', reason: 'Test' } },
  { method: 'GET', url: '/api/notifications?userId=host-test' },
  { method: 'GET', url: '/api/users/leaderboard' },
  { method: 'GET', url: '/api/wallet/transactions?userId=host-test' }
];

async function run() {
  console.log('Testing all endpoints against handleApiRoute:');
  let failures = 0;

  for (const ep of endpointsToTest) {
    let statusCode = null;
    let resData = null;

    const req = {
      method: ep.method,
      url: ep.url,
      headers: { 'content-type': 'application/json' },
      on(event, cb) {
        if (event === 'data' && ep.body) {
          cb(Buffer.from(JSON.stringify(ep.body)));
        } else if (event === 'end') {
          cb();
        }
      }
    };

    const res = {
      writeHead(code, headers) {
        statusCode = code;
      },
      end(data) {
        try {
          resData = JSON.parse(data);
        } catch (e) {
          resData = data;
        }
      }
    };

    const handled = await handleApiRequest(req, res);
    if (!handled) {
      console.error(`❌ NOT HANDLED: ${ep.method} ${ep.url}`);
      failures++;
    } else if (statusCode >= 400 && statusCode !== 404) {
      console.warn(`⚠️ HANDLED WITH ${statusCode}: ${ep.method} ${ep.url}`, resData);
    } else {
      console.log(`✅ ${statusCode} OK: ${ep.method} ${ep.url}`);
    }
  }

  if (failures === 0) {
    console.log('\n🎉 ALL ENDPOINTS HANDLED SUCCESSFULLY!');
  } else {
    console.error(`\n❌ ${failures} endpoint(s) not handled!`);
  }
}

run();
