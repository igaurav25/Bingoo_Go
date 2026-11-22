import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { server, wss } from '../server/server.js';

test('Single App Routing, Health Check & Legacy Redirects', async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  
  const fetchUrl = (path) => new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method: 'GET'
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end();
  });

  try {
    // 1. Health Check
    const health = await fetchUrl('/health');
    assert.equal(health.status, 200);
    const healthJson = JSON.parse(health.body);
    assert.equal(healthJson.status, 'ok');

    // 2. Route / (Home)
    const home = await fetchUrl('/');
    assert.equal(home.status, 200);
    assert.match(home.headers['content-type'], /text\/html/);
    assert.match(home.body, /BINGO/);

    // 3. Route /r/:code (Single app direct room link)
    const roomRoute = await fetchUrl('/r/B4K8M');
    assert.equal(roomRoute.status, 200);
    assert.match(roomRoute.body, /BINGO/);

    // 4. Legacy URL Redirect: ?match=B4K8M -> 302 to /r/B4K8M
    const legacy = await fetchUrl('/?match=B4K8M');
    assert.equal(legacy.status, 302);
    assert.equal(legacy.headers.location, '/r/B4K8M');

    // 5. Static CSS and JS
    const css = await fetchUrl('/css/style.css');
    assert.equal(css.status, 200);
    assert.match(css.headers['content-type'], /text\/css/);

    const js = await fetchUrl('/js/gameClient.js');
    assert.equal(js.status, 200);
  } finally {
    wss.close();
    await new Promise(r => server.close(r));
  }
});
