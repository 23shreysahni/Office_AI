import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { createReviewApp, startReview } from '../review/server.mjs';

async function serve(context) {
  const server = createReviewApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (url, options = {}) => fetch(`${base}${url}`, { ...options, signal: AbortSignal.timeout(5000) });
  // Use the raw HTTP client here: Fetch may normalise or discard a forged Host.
  request.raw = (url, headers) => new Promise((resolve, reject) => {
    const req = httpRequest(`${base}${url}`, { headers }, res => {
      res.resume(); res.once('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('HTTP test timed out')));
    req.once('error', reject); req.end();
  });
  return request;
}

test('review serves local assets, safe headers and accurately labelled synthetic data over HTTP', async context => {
  const request = await serve(context);
  const page = await request('/'); assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.equal(page.headers.get('x-powered-by'), null);
  assert.match(await page.text(), /Local review/);
  for (const [asset, type] of [['/app.js', 'javascript'], ['/styles.css', 'css']]) {
    const response = await request(asset); assert.equal(response.status, 200); assert.ok(response.headers.get('content-type').includes(type)); await response.body.cancel();
  }
  const response = await request('/api/review'); const data = await response.json();
  assert.equal(data.mode, 'read-only-local-review'); assert.equal(data.acceptedPhases, 0);
  assert.equal(data.evaluationCases.executed, 0); assert.equal(data.phases.length, 6);
  assert.equal(data.documents.length, 7); assert.equal(data.profiles.length, 3);
  const body = JSON.stringify(data);
  for (const forbidden of ['ACCOUNTS_FIXTURE_CANARY_K7', 'DELETED_FIXTURE_CANARY_Z3', 'ed-revision-old', 'webui_session_key']) assert.ok(!body.includes(forbidden));
  assert.ok(data.documents.some(d => /[\u0900-\u097f]/.test(d.title)));
});

test('review denies mutation, forged Host and cross-origin reads even with spoofed forwarding headers', async context => {
  const request = await serve(context);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
    const response = await request('/api/review', { method }); assert.equal(response.status, 405); assert.equal(response.headers.get('allow'), 'GET, HEAD'); await response.body.cancel();
  }
  for (const headers of [
    { Host: 'attacker.invalid' }, { Origin: 'https://attacker.invalid' },
    { 'Sec-Fetch-Site': 'cross-site' }, { 'Sec-Fetch-Site': 'same-site' },
    { Host: 'attacker.invalid', 'X-Forwarded-Host': 'localhost', 'X-Forwarded-For': '127.0.0.1' }
  ]) { const response = await request.raw('/api/review', headers); assert.equal(response.status, 403, JSON.stringify(headers)); assert.equal(response.headers['access-control-allow-origin'], undefined); }
  const navigation = { 'Sec-Fetch-Site': 'cross-site', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document' };
  assert.equal((await request.raw('/', navigation)).status, 200, 'A review link from another site must open');
  assert.equal((await request.raw('/api/review', navigation)).status, 403, 'Navigation headers cannot bypass API isolation');
  assert.equal((await request.raw('/', { ...navigation, 'Sec-Fetch-Dest': 'iframe' })).status, 403);
  const head = await request('/', { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('review exposes only fixed specification files and no filesystem, credentials or production routes', async context => {
  const request = await serve(context);
  const spec = await request('/review-files/foundation'); assert.equal(spec.status, 200); assert.match(spec.headers.get('content-type'), /text\/plain/); assert.match(await spec.text(), /Phase 1/);
  for (const url of ['/.env', '/secrets/webui_session_key', '/state/webui/webui.db', '/SPEC.md', '/review-files/.env', '/review-files/%2e%2e%2f.env', '/api/access/session', '/api/library/documents', '/api/accounts/imports']) {
    const response = await request(url); assert.equal(response.status, 404, url); assert.deepEqual(await response.json(), { error: 'not_found' });
  }
  for (const port of [0, 80, -1, 65536, '4173']) assert.throws(() => startReview(port));
});
