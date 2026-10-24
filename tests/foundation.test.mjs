import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseEnv, validateConfig, validatePolicy } from '../infra/scripts/config.mjs';
import { checkModels, consumeStream, runSmoke } from '../infra/scripts/smoke.mjs';

const digest = `sha256:${'a'.repeat(64)}`;
const valid = () => ({
  OFFICE_HOSTNAME: 'office-ai.internal', LAN_BIND_IP: '192.168.50.10',
  LAN_ALLOWED_CIDRS: '192.168.50.0/24 10.8.0.0/24', COMPOSE_PROJECT_NAME: 'office-ai',
  MODEL_NAME: 'qwen3.5:9b', MODEL_DIGEST: digest, NETWORK_POLICY_REVIEWED: 'true',
  OLLAMA_MEMORY: '12g', WEBUI_MEMORY: '4g', OLLAMA_CPUS: '4', WEBUI_CPUS: '2'
});
test('configuration accepts explicit private LAN configuration', () => {
  assert.equal(validateConfig(valid()).LAN_BIND_IP, '192.168.50.10');
});
test('configuration rejects absent and ambiguous inputs', () => {
  for (const key of Object.keys(valid())) {
    const cfg = valid(); delete cfg[key];
    assert.throws(() => validateConfig(cfg), undefined, key);
  }
  assert.throws(() => parseEnv('LAN_BIND_IP=10.0.0.1\nLAN_BIND_IP=10.0.0.2'));
  assert.throws(() => parseEnv('export LAN_BIND_IP=10.0.0.1'));
  assert.throws(() => parseEnv('UNKNOWN_SETTING=true'));
});
test('configuration rejects public, wildcard and loopback LAN exposure', () => {
  for (const ip of ['0.0.0.0', '127.0.0.1', '8.8.8.8', '::', '192.168.50.10:443']) {
    assert.throws(() => validateConfig({ ...valid(), LAN_BIND_IP: ip }));
  }
  for (const cidr of ['0.0.0.0/0', '192.168.0.0/8', '127.0.0.1/32', '10.0.0.0/33']) {
    assert.throws(() => validateConfig({ ...valid(), LAN_ALLOWED_CIDRS: cidr }));
  }
  assert.throws(() => validateConfig({ ...valid(), LAN_ALLOWED_CIDRS: '10.0.0.0/8' }));
});
test('configuration rejects injected hostname, unsupported model and unsafe limits', () => {
  for (const value of ['example.com\nrespond OK', 'https://office.local', '*.local', 'localhost', '10.0.0.1']) {
    assert.throws(() => validateConfig({ ...valid(), OFFICE_HOSTNAME: value }));
  }
  assert.throws(() => validateConfig({ ...valid(), MODEL_NAME: 'cloud:model' }));
  assert.throws(() => validateConfig({ ...valid(), OLLAMA_CPUS: '0' }));
  assert.throws(() => validateConfig({ ...valid(), OLLAMA_MEMORY: 'unlimited' }));
  assert.throws(() => validateConfig({ ...valid(), MODEL_DIGEST: 'short-hash' }));
  assert.throws(() => validateConfig({ ...valid(), NETWORK_POLICY_REVIEWED: 'false' }));
  assert.doesNotThrow(() => validateConfig({ ...valid(), MODEL_DIGEST: '', NETWORK_POLICY_REVIEWED: 'false' }, { bootstrap: true }));
});
test('image manifest has complete immutable digests', () => {
  const pins = JSON.parse(readFileSync(new URL('../infra/images.json', import.meta.url)));
  for (const name of ['nginx', 'webui', 'ollama']) assert.match(pins[name], /:[\w.\-]+@sha256:[a-f0-9]{64}$/);
});

const policy = () => ({
  services: {
    proxy: { image: 'nginx', profiles: ['lan'], networks: { frontend: {}, ingress: {} }, ports: [{ host_ip: '192.168.50.10', published: '443', target: 443, protocol: 'tcp' }] },
    bootstrap: { image: 'nginx', profiles: ['bootstrap'], networks: { frontend: {}, ingress: {} }, ports: [{ host_ip: '127.0.0.1', published: '8443', target: 443, protocol: 'tcp' }] },
    webui: { image: 'webui', networks: { frontend: {}, inference: {} }, environment: { WEBUI_AUTH: 'true', ENABLE_SIGNUP: 'false', ENABLE_PERSISTENT_CONFIG: 'false', ENABLE_OPENAI_API: 'false', OFFLINE_MODE: 'true', OLLAMA_BASE_URL: 'http://ollama:11434' } },
    ollama: { image: 'ollama', networks: { inference: {} } }
  }, networks: { frontend: { internal: true }, inference: { internal: true }, ingress: { driver: 'bridge', driver_opts: { 'com.docker.network.bridge.enable_ip_masquerade': 'false' } } }
});
const pins = { nginx: 'nginx', webui: 'webui', ollama: 'ollama' };
test('Compose policy rejects published backend ports, host networking and changed pins', () => {
  assert.doesNotThrow(() => validatePolicy(policy(), valid(), pins));
  for (const mutate of [
    p => { p.services.ollama.ports = [{ published: '11434', target: 11434 }]; },
    p => { p.services.webui.network_mode = 'host'; },
    p => { p.services.proxy.image = 'nginx:latest'; },
    p => { p.services.proxy.ports[0].host_ip = '0.0.0.0'; },
    p => { p.networks.inference.internal = false; },
    p => { p.services.proxy.networks.inference = {}; },
    p => { p.services.webui.environment.ENABLE_SIGNUP = 'true'; }
  ]) { const p = policy(); mutate(p); assert.throws(() => validatePolicy(p, valid(), pins)); }
});
test('model verification requires the exact installed digest and approved model only', () => {
  assert.doesNotThrow(() => checkModels({ models: [{ name: 'qwen3.5:9b', digest }] }, valid()));
  for (const models of [[], [{ name: 'qwen3.5:9b', digest: `sha256:${'b'.repeat(64)}` }], [{ name: 'unapproved:1', digest }]]) {
    assert.throws(() => checkModels({ models }, valid()));
  }
});
function streamResponse(text) {
  return new Response(text, { headers: { 'content-type': 'text/event-stream' } });
}
test('stream parser requires actual content and successful completion without leaking prose', async () => {
  assert.equal(await consumeStream(streamResponse('data: {"choices":[{"delta":{"content":"synthetic"}}]}\n\ndata: [DONE]\n\n')), true);
  await assert.rejects(consumeStream(streamResponse('data: {"error":"private canary"}\n\n')), /Streaming response failed/);
  await assert.rejects(consumeStream(streamResponse('data: [DONE]\n\n')), /No generated content/);
  await assert.rejects(consumeStream(streamResponse('data: {"choices":[{"delta":{"content":"x"}}]}\n\n')), /Incomplete stream/);
});
test('stream parser bounds response size and stalled streams', async () => {
  await assert.rejects(consumeStream(streamResponse(`data: ${'x'.repeat(100)}\n\n`), { maxBytes: 16 }), /exceeded the limit/);
  const stalled = new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/event-stream' } });
  await assert.rejects(consumeStream(stalled, { timeoutMs: 10 }), /timed out/);
});
const fakeFetch = ({ failAuth = false, timeout = false } = {}) => async (url, options = {}) => {
  if (timeout) throw new Error('private canary token');
  const u = new URL(url);
  const auth = options.headers?.Authorization;
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.pathname === '/health') return json({ status: true });
  if (u.pathname === '/api/config') return json({ onboarding: false, features: { auth: true, enable_signup: false } });
  if (u.pathname === '/api/v1/auths/signup' || u.pathname.startsWith('/api/v1/files') || u.pathname === '/ollama/api/pull') return json({}, 403);
  if (!auth || failAuth) return json({}, 401);
  if (u.pathname === '/api/v1/auths/') return json({ role: 'admin' });
  if (u.pathname === '/api/models') return json({ data: [{ id: 'qwen3.5:9b' }] });
  if (u.pathname === '/ollama/api/tags') return json({ models: [{ name: 'qwen3.5:9b', digest }] });
  if (u.pathname === '/api/chat/completions') {
    if (JSON.parse(options.body).model !== 'qwen3.5:9b') return json({}, 404);
    return streamResponse('data: {"choices":[{"delta":{"content":"synthetic"}}]}\n\ndata: [DONE]\n\n');
  }
  throw new Error('Unexpected fixture request');
};
test('smoke checks protected paths, settings, exact local model and streamed chat', async () => {
  const report = await runSmoke({ config: valid(), token: 'synthetic-token', fetchImpl: fakeFetch(), probePorts: async () => {} });
  assert.ok(report.checks.includes('streamed-chat'));
  assert.ok(report.checks.includes('missing-model-rejected'));
  assert.ok(!JSON.stringify(report).includes('synthetic-token'));
});
test('smoke rejects invalid identity, configuration and connection errors with redacted failures', async () => {
  await assert.rejects(runSmoke({ config: valid(), token: 'synthetic-token', fetchImpl: fakeFetch({ failAuth: true }), probePorts: async () => {} }));
  await assert.rejects(runSmoke({ config: valid(), token: 'synthetic-token', fetchImpl: fakeFetch({ timeout: true }), probePorts: async () => {} }), error => !error.message.includes('private canary'));
  await assert.rejects(runSmoke({ config: valid(), token: '', fetchImpl: fakeFetch(), probePorts: async () => {} }));
});
