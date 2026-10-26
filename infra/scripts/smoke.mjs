import { readFileSync, statSync } from 'node:fs';
import net from 'node:net';
import { pathToFileURL } from 'node:url';
import { loadConfig } from './config.mjs';

function ensure(ok, message) { if (!ok) throw new Error(message); }
export function canonicalModelDigest(value) {
  ensure(typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/.test(value), 'Invalid complete model digest');
  return value.startsWith('sha256:') ? value : `sha256:${value}`;
}
export function checkModels(body, cfg) {
  const models = body?.models;
  if (cfg.OFFICE_HOSTNAME === 'localhost' && cfg.MODEL_NAME === 'qwen3.5:9b') {
    ensure(Array.isArray(models) && models.length >= 1 && models.length <= 2 &&
      new Set(models.map(model => model.name)).size === models.length &&
      models.every(model => ['qwen3.5:4b', 'qwen3.5:9b'].includes(model.name)), 'Unexpected local pilot model set');
    for (const model of models) canonicalModelDigest(model.digest);
    const selected = models.filter(model => model.name === cfg.MODEL_NAME);
    ensure(selected.length === 1 && canonicalModelDigest(selected[0].digest) === cfg.MODEL_DIGEST, 'Selected local model digest differs');
    return;
  }
  ensure(Array.isArray(models) && models.length === 1 && models[0].name === cfg.MODEL_NAME && canonicalModelDigest(models[0].digest) === cfg.MODEL_DIGEST, 'Installed models do not match the approved name and digest');
}

export async function consumeStream(response, { timeoutMs = 120_000, maxBytes = 2_000_000 } = {}) {
  ensure(response.ok && response.headers.get('content-type')?.includes('text/event-stream'), 'Expected a successful streaming response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let timer;
  const parse = async () => {
    let pending = '', bytes = 0, content = false, done = false;
    while (!done) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      ensure(bytes <= maxBytes, 'Streaming response exceeded the limit');
      pending += decoder.decode(part.value, { stream: true });
      const lines = pending.split('\n'); pending = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const value = line.slice(5).trim();
        if (value === '[DONE]') { done = true; break; }
        if (!value) continue;
        let data;
        try { data = JSON.parse(value); } catch { throw new Error('Streaming response failed'); }
        ensure(!data.error, 'Streaming response failed');
        if (data.choices?.some(c => typeof c.delta?.content === 'string' && c.delta.content.trim().length)) content = true;
      }
    }
    ensure(content, 'No generated content');
    ensure(done, 'Incomplete stream');
    return true;
  };
  try {
    return await Promise.race([parse(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Streaming response timed out')), timeoutMs); })]);
  } catch (error) {
    // Never include upstream content, URLs, prompts or credentials in failures.
    const safe = ['Streaming response failed', 'No generated content', 'Incomplete stream', 'Streaming response exceeded the limit', 'Streaming response timed out'];
    throw new Error(safe.includes(error.message) ? error.message : 'Streaming response failed');
  } finally { clearTimeout(timer); await reader.cancel().catch(() => {}); }
}

async function jsonBody(response) {
  const reader = response.body.getReader();
  let bytes = 0;
  const chunks = [];
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      ensure(bytes <= 1_000_000, 'Service metadata exceeded the limit');
      chunks.push(Buffer.from(part.value));
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new Error('Invalid or unavailable service metadata'); }
  finally { await reader.cancel().catch(() => {}); }
}

export async function probeClosedPorts(ip) {
  for (const port of [8080, 11434, 5432, 8443]) {
    await new Promise((resolve, reject) => {
      const socket = net.createConnection({ host: ip, port });
      socket.setTimeout(2000);
      socket.once('connect', () => { socket.destroy(); reject(new Error(`Internal service port ${port} is reachable`)); });
      socket.once('timeout', () => { socket.destroy(); resolve(); });
      socket.once('error', error => {
        socket.destroy();
        if (['ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH'].includes(error.code)) resolve();
        else reject(new Error('Port isolation probe failed'));
      });
    });
  }
}

export async function runSmoke({ config, token, fetchImpl = fetch, probePorts = probeClosedPorts, timeoutMs = 120_000 }) {
  ensure(typeof token === 'string' && token.length > 0 && !/[\r\n]/.test(token), 'Supply a valid administrator session token file');
  const base = `https://${config.OFFICE_HOSTNAME}`;
  const checks = [];
  async function request(path, { auth = false, method = 'GET', body, headers = {} } = {}) {
    try {
      return await fetchImpl(`${base}${path}`, {
        method, redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(auth ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    } catch { throw new Error('HTTPS request failed; check local service health, DNS, CA trust and timeout'); }
  }
  const health = await request('/health');
  ensure(health.status === 200 && (await jsonBody(health)).status === true, 'UI health failed');
  checks.push('https-health');
  for (const endpoint of ['/api/models', '/api/v1/chats/', '/api/v1/auths/']) {
    const result = await request(endpoint, { headers: { 'X-Forwarded-Email': 'synthetic-admin@example.invalid', 'X-Forwarded-User': 'admin' } });
    ensure([401, 403].includes(result.status), 'Anonymous or forged-header access was not denied');
    await result.body?.cancel();
  }
  checks.push('anonymous-and-forged-identity-denied');
  for (const endpoint of ['/api/v1/auths/signup', '/api/v1/files/', '/ollama/api/pull']) {
    const response = await request(endpoint, { auth: true, method: 'POST', body: {} });
    ensure(response.status === 403, 'A restricted Phase 1 endpoint is accessible');
    await response.body?.cancel();
  }
  checks.push('signup-uploads-model-mutation-denied');
  const settingsResponse = await request('/api/config');
  ensure(settingsResponse.ok, 'Public settings unavailable');
  const settings = await jsonBody(settingsResponse);
  ensure(settings.onboarding === false && settings.features?.auth === true && settings.features?.enable_signup === false, 'Administrator provisioning or authentication configuration is unsafe');
  checks.push('authentication-settings');
  const identityResponse = await request('/api/v1/auths/', { auth: true });
  ensure(identityResponse.ok && (await jsonBody(identityResponse)).role === 'admin', 'Administrator authentication failed');
  checks.push('administrator-authenticated');
  const modelsResponse = await request('/api/models', { auth: true });
  ensure(modelsResponse.ok, 'Approved model list unavailable');
  const models = await jsonBody(modelsResponse);
  ensure(models.data?.length === 1 && models.data[0].id === config.MODEL_NAME, 'UI model list does not match the approved model');
  const tagsResponse = await request('/ollama/api/tags', { auth: true });
  ensure(tagsResponse.ok, 'Local model metadata unavailable');
  checkModels(await jsonBody(tagsResponse), config);
  checks.push('installed-model-digest');
  const response = await request('/api/chat/completions', { auth: true, method: 'POST', body: {
    model: config.MODEL_NAME, stream: true, messages: [{ role: 'system', content: 'Use British English. Generated content must be reviewed.' }, { role: 'user', content: 'Synthetic smoke check: reply with a short greeting.' }],
    options: { num_ctx: 4096, num_predict: 32, temperature: 0 }, params: { num_ctx: 4096, num_predict: 32, temperature: 0 },
    features: { web_search: false, image_generation: false, code_interpreter: false }
  } });
  await consumeStream(response, { timeoutMs });
  checks.push('streamed-chat');
  const missing = await request('/api/chat/completions', { auth: true, method: 'POST', body: { model: 'phase1-missing-synthetic:absent', messages: [{ role: 'user', content: 'Synthetic missing model check.' }], stream: false } });
  ensure([400, 403, 404].includes(missing.status), 'Missing model was not explicitly rejected');
  await missing.body?.cancel();
  checks.push('missing-model-rejected');
  await probePorts(config.LAN_BIND_IP);
  checks.push('direct-service-ports-closed');
  return { status: 'passed', checks, limitations: 'Does not prove internet egress denial, WebSocket authentication, browser cancellation, persistence, backup/restore or full phase acceptance.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    ensure(process.argv.length === 2, 'Usage: SMOKE_TOKEN_FILE=<restricted file> node infra/scripts/smoke.mjs');
    ensure(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS verification must remain enabled');
    ensure(process.env.SMOKE_TOKEN_FILE, 'Set SMOKE_TOKEN_FILE to a restricted administrator session token file');
    const stat = statSync(process.env.SMOKE_TOKEN_FILE);
    ensure(stat.isFile() && stat.size <= 16_384 && (process.platform === 'win32' || (stat.mode & 0o077) === 0), 'Token file must be small and restricted (0600 on Linux)');
    const token = readFileSync(process.env.SMOKE_TOKEN_FILE, 'utf8').trim();
    console.log(JSON.stringify(await runSmoke({ config: loadConfig(), token }), null, 2));
  } catch { console.error('FAIL: Foundation smoke check failed. Check restricted service diagnostics, CA trust, configuration and credentials; no sensitive response is printed.'); process.exitCode = 1; }
}
