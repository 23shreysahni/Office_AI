import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';
import { once } from 'node:events';
import { renderProxy } from '../infra/scripts/proxy.mjs';
import { root } from '../infra/scripts/config.mjs';
const cfg = { OFFICE_HOSTNAME: 'office-ai.internal', LAN_BIND_IP: '192.168.50.10', LAN_ALLOWED_CIDRS: '192.168.50.0/24', COMPOSE_PROJECT_NAME: 'office-ai-test', MODEL_NAME: 'qwen3.5:9b', MODEL_DIGEST: '', NETWORK_POLICY_REVIEWED: 'false', OLLAMA_MEMORY: '12g', WEBUI_MEMORY: '4g', OLLAMA_CPUS: '4', WEBUI_CPUS: '2' };
test('Nginx rendering isolates signup, limits CIDRs and disables stream buffering', () => {
  const lan = renderProxy(cfg), boot = renderProxy(cfg, { bootstrap: true });
  assert.ok(lan.includes('"POST:/api/v1/auths/signup" 0;'));
  assert.ok(boot.includes('"POST:/api/v1/auths/signup" 1;'));
  assert.ok(lan.includes('~^GET:/api/v1/ 1;'));
  assert.ok(lan.includes('allow 192.168.50.0/24;'));
  assert.ok(lan.includes('deny all;'));
  assert.ok(lan.includes('proxy_buffering off;'));
  assert.ok(lan.includes('proxy_set_header Upgrade $http_upgrade;'));
  assert.ok(!lan.includes('__HOSTNAME__'));
  assert.throws(() => renderProxy({ ...cfg, OFFICE_HOSTNAME: 'host; return 200;' }));
});
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
test('real Nginx parses TLS configuration and enforces bootstrap/LAN API boundaries', { timeout: 30000 }, async context => {
  const nginx = process.env.NGINX_BIN;
  if (!nginx || !process.env.NGINX_TEST_CERT || !process.env.NGINX_TEST_KEY) { context.skip('Set NGINX_BIN, NGINX_TEST_CERT and NGINX_TEST_KEY for Nginx integration'); return; }
  mkdirSync(path.join(root, 'artifacts'), { recursive: true });
  const work = mkdtempSync(path.join(root, 'artifacts/office-ai-nginx-'));
  mkdirSync(path.join(work, 'logs')); mkdirSync(path.join(work, 'tmp'));
  const prefix = work.replaceAll('\\', '/');
  let forwarded = 0;
  const upstream = createServer((req, res) => {
    forwarded++;
    if (req.url === '/api/v1/auths/signup') { res.writeHead(200); res.end('{}'); return; }
    if (req.url.startsWith('/api/') && !req.headers.authorization) { res.writeHead(401); res.end('{}'); return; }
    res.writeHead(200); res.end('{}');
  });
  const upstreamPort = await listen(upstream);
  context.after(() => new Promise(resolve => upstream.close(resolve)));
  for (const bootstrap of [false, true]) {
    const reserve = createServer(), port = await listen(reserve);
    await new Promise(resolve => reserve.close(resolve));
    const production = renderProxy(cfg, { bootstrap }).replaceAll('/tmp/', `${prefix}/tmp/`)
      .replace('webui:8080', `127.0.0.1:${upstreamPort}`)
      .replace('/run/secrets/tls_certificate', process.env.NGINX_TEST_CERT.replaceAll('\\', '/'))
      .replace('/run/secrets/tls_private_key', process.env.NGINX_TEST_KEY.replaceAll('\\', '/'));
    const full = path.join(work, 'tls.conf'); writeFileSync(full, production);
    const syntax = spawnSync(nginx, ['-p', `${prefix}/`, '-c', full.replaceAll('\\', '/'), '-t'], { encoding: 'utf8', windowsHide: true });
    assert.equal(syntax.status, 0, `Nginx TLS configuration failed: ${syntax.stderr}`);
    // Runtime matcher test uses loopback HTTP and a synthetic upstream.
    const runtime = production.replace('listen 443 ssl default_server;', `listen 127.0.0.1:${port};`)
      .replace(/^\s*ssl_[^\n]+\n/gm, '').replace('allow 192.168.50.0/24;', 'allow 127.0.0.1/32;')
      .replaceAll(cfg.OFFICE_HOSTNAME, '127.0.0.1');
    const localFile = path.join(work, 'local.conf'); writeFileSync(localFile, runtime);
    const args = ['-p', `${prefix}/`, '-c', localFile.replaceAll('\\', '/')];
    const child = spawn(nginx, [...args, '-g', 'daemon off;'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let diagnostics = '';
    child.stdout.on('data', () => {}); child.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-4000); });
    const request = (endpoint, method = 'GET', auth = false) => fetch(`http://127.0.0.1:${port}${endpoint}`, {
      method, headers: { Host: cfg.OFFICE_HOSTNAME, ...(auth ? { Authorization: 'Bearer synthetic-token' } : {}) }, signal: AbortSignal.timeout(4000)
    });
    try {
      let ready = false, lastResult = '';
      for (let i = 0; i < 80; i++) {
        try { const result = await request('/health'); await result.arrayBuffer(); ready = result.ok; lastResult = `status ${result.status}`; } catch (error) { lastResult = error.message; }
        if (ready) break;
        await delay(50);
      }
      assert.ok(ready, `Nginx did not become ready: ${lastResult}; ${diagnostics}`);
      for (const endpoint of ['/api/v1/files/', '/api/v1/functions/create', '/api/v1/tools/create', '/api/v1/configs/', '/ollama/api/pull', '/openai/chat/completions', '/api/v1/auths/add', '/api/v1/chats/test/share', '/api/v1/chats/import']) {
        const before = forwarded, result = await request(endpoint, 'POST', true);
        assert.equal(result.status, 403, endpoint); await result.arrayBuffer();
        assert.equal(forwarded, before, 'Forbidden endpoint reached upstream');
      }
      for (const endpoint of ['/api/v1/users/test-user/profile/image', '/api/v1/configs/banners', '/api/v1/tools/', '/api/v1/notes/pinned', '/api/v1/folders/', '/api/v1/folders/shared', '/api/v1/models/list?page=1', '/api/v1/knowledge/search?page=1', '/api/v1/prompts/list?page=1', '/api/v1/skills/list?page=1', '/api/v1/tools/list', '/api/v1/groups/?', '/api/v1/functions/', '/api/v1/skills/?', '/api/v1/models/model/profile/image?id=qwen3.5:4b']) {
        const before = forwarded, result = await request(endpoint, 'GET', true);
        assert.equal(result.status, 200, endpoint); await result.arrayBuffer();
        assert.equal(forwarded, before + 1, 'Allowed UI request reached upstream');
      }
      const sharedChats = await request('/api/v1/chats/test/share', 'GET', true);
      assert.equal(sharedChats.status, 403); await sharedChats.arrayBuffer();
      const timezone = await request('/api/v1/auths/update/timezone', 'POST', true);
      assert.equal(timezone.status, 200); await timezone.arrayBuffer();
      const signup = await request('/api/v1/auths/signup', 'POST'); assert.equal(signup.status, bootstrap ? 200 : 403); await signup.arrayBuffer();
      const anon = await request('/api/models'); assert.equal(anon.status, 401); await anon.arrayBuffer();
      const chat = await request('/api/chat/completions', 'POST', true); assert.equal(chat.status, 200); await chat.arrayBuffer();
      const wrong = await request('/api/models', 'POST', true); assert.equal(wrong.status, 403); await wrong.arrayBuffer();
    } finally {
      if (child.exitCode === null) {
        const exited = once(child, 'exit');
        spawnSync(nginx, [...args, '-s', 'stop'], { windowsHide: true, timeout: 3000 });
        await Promise.race([exited, delay(3000)]);
        if (child.exitCode === null) child.kill();
      }
    }
  }
});
