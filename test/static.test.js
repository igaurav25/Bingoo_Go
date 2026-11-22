import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { server, wss } from '../server/server.js';

test('Static Asset Delivery: HTML, CSS, JS, Shared modules', async () => {
  const port = server.address() ? server.address().port : 3000;
  
  const fetchUrl = (path) => new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });

  try {
    // Verify HTML
    const html = await fetchUrl('/');
    assert.equal(html.status, 200);
    assert.match(html.headers['content-type'], /text\/html/);
    assert.match(html.body, /Classic Notebook Bingo/);
    assert.match(html.body, /line-strike-overlay/);

    // Verify CSS
    const css = await fetchUrl('/css/style.css');
    assert.equal(css.status, 200);
    assert.match(css.headers['content-type'], /text\/css/);
    assert.match(css.body, /--paper-bg/);
    assert.match(css.body, /bingo-pen-stroke/);

    // Verify client JS
    const js = await fetchUrl('/js/gameClient.js');
    assert.equal(js.status, 200);
    assert.match(js.headers['content-type'], /application\/javascript/);
    assert.match(js.body, /BingoClient/);

    // Verify shared line model JS
    const shared = await fetchUrl('/shared/lineModel.js');
    assert.equal(shared.status, 200);
    assert.match(shared.headers['content-type'], /application\/javascript/);
    assert.match(shared.body, /findCompletedLines/);

    // Verify 404 for non-existent path
    const notFound = await fetchUrl('/unknown-file.txt');
    assert.equal(notFound.status, 404);
  } finally {
    wss.close();
    server.close();
  }
});

