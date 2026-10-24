import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { localChatConfig, checkLocalChatConfig } from '../infra/scripts/local-chat.mjs';
import { validateConfig, validatePolicy, root } from '../infra/scripts/config.mjs';
import { canonicalModelDigest, checkModels } from '../infra/scripts/smoke.mjs';
import { provisionFromWindows } from '../infra/scripts/start-chat.mjs';

test('local pilot config is valid only for isolated bootstrap; 4B cannot silently become the LAN baseline', () => {
  const cfg = localChatConfig();
  assert.doesNotThrow(() => checkLocalChatConfig(cfg));
  assert.throws(() => validateConfig(cfg));
  for (const extra of [{ LAN_BIND_IP: '0.0.0.0' }, { OFFICE_HOSTNAME: 'localhost.attacker.invalid' }, { LAN_ALLOWED_CIDRS: '127.0.0.0/8' }, { NETWORK_POLICY_REVIEWED: 'true' }, { MODEL_NAME: 'arbitrary:cloud' }, { WEBUI_MEMORY: '8g' }]) assert.throws(() => checkLocalChatConfig({ ...cfg, ...extra }));
});

test('real Compose parser preserves loopback-only bootstrap and private model/UI for the local pilot', context => {
  const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8', windowsHide: true });
  if (version.error?.code === 'ENOENT') { context.skip('Docker CLI unavailable'); return; }
  const cfg = localChatConfig();
  const result = spawnSync('docker', ['compose', '--env-file', '.env.example', '-f', 'compose.yaml', '--profile', '*', 'config', '--format', 'json'], { cwd: root, env: { ...process.env, ...cfg, COMPOSE_PROFILES: '' }, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0);
  const doc = JSON.parse(result.stdout); validatePolicy(doc, cfg);
  assert.equal(doc.services.bootstrap.ports[0].host_ip, '127.0.0.1');
  assert.equal(doc.services.bootstrap.ports[0].published, '8443');
  assert.deepEqual(Object.keys(doc.services.bootstrap.networks).sort(), ['frontend', 'ingress']);
  assert.equal(doc.services.webui.environment.ENABLE_SIGNUP, 'false');
  assert.equal(doc.services.webui.environment.DEFAULT_MODELS, 'qwen3.5:4b');
  assert.equal(doc.services.webui.environment.CORS_ALLOW_ORIGIN, 'https://localhost;https://localhost:8443');
  const params = JSON.parse(doc.services.webui.environment.DEFAULT_MODEL_PARAMS);
  assert.equal(params.num_predict, 1536);
  assert.equal(params.num_ctx, 4096);
  assert.match(params.system, /enough explanation/);
});

test('9B pilot requires NVIDIA and its exact memory profile, with validated rollback artefact', () => {
  const digest = `sha256:${'a'.repeat(64)}`;
  const cfg = { ...localChatConfig(), MODEL_NAME: 'qwen3.5:9b', OLLAMA_MEMORY: '7g', COMPUTE_MODE: 'nvidia', MODEL_DIGEST: digest };
  assert.doesNotThrow(() => checkLocalChatConfig(cfg));
  for (const extra of [{ COMPUTE_MODE: 'cpu' }, { COMPUTE_MODE: 'auto' }, { OLLAMA_MEMORY: '12g' }, { WEBUI_MEMORY: '4g' }]) assert.throws(() => checkLocalChatConfig({ ...cfg, ...extra }));
  const selected = { name: cfg.MODEL_NAME, digest };
  const rollback = { name: 'qwen3.5:4b', digest: 'b'.repeat(64) };
  assert.doesNotThrow(() => checkModels({ models: [rollback, selected] }, cfg));
  for (const models of [[rollback], [selected, selected], [selected, { ...rollback, name: 'unapproved:cloud' }], [selected, { ...rollback, digest: 'bad' }], [{ ...selected, digest: 'b'.repeat(64) }]]) assert.throws(() => checkModels({ models }, cfg));
  assert.throws(() => checkModels({ models: [rollback, selected] }, { ...cfg, OFFICE_HOSTNAME: 'office-ai.internal' }));
});

test('Ollama complete bare SHA-256 API digest and prefixed configuration digest identify the same model', () => {
  const bare = 'a'.repeat(64), cfg = { ...localChatConfig(), MODEL_DIGEST: `sha256:${bare}` };
  for (const digest of [bare, `sha256:${bare}`]) assert.doesNotThrow(() => checkModels({ models: [{ name: cfg.MODEL_NAME, digest }] }, cfg));
  for (const digest of [bare.slice(0, 12), `sha256:${'b'.repeat(64)}`, `${bare}\n`, 'SHA256:' + bare, null]) assert.throws(() => checkModels({ models: [{ name: cfg.MODEL_NAME, digest }] }, cfg));
  assert.equal(canonicalModelDigest(bare), cfg.MODEL_DIGEST);
});

function fixture({ memory = '8219885568', linuxPath = '/mnt/d/office-ai', syntaxFailure = false, provisioningFailure = false, validCertificate = true } = {}) {
  const calls = [], installed = [];
  return { calls, installed, platform: 'win32', log() {}, sourceSignature: 'a'.repeat(64),
    installTools(options) { installed.push(options); },
    certificateFromPem() { return { ca: validCertificate, verify: () => validCertificate, publicKey: {}, validTo: 'Jan 1 00:00:00 2040 GMT', fingerprint256: 'AA:BB', fingerprint: 'AA:BB' }; },
    invoke(args, options) {
      calls.push({ args, options });
      if (args.includes('{{.MemTotal}}')) return memory;
      if (args.includes('wslpath')) return linuxPath;
      if (args.includes('-n') && syntaxFailure) throw new Error('Invalid shell');
      if (args.includes('/srv/office-ai-local/infra/scripts/local-chat.mjs') && provisioningFailure) throw new Error('Model failed');
      if (args.includes('cat')) return 'synthetic-public-root';
      return '';
    }
  };
}

test('Windows bring-up stages code and provisions before requesting only the public root certificate', () => {
  const config = fixture();
  const result = provisionFromWindows(config);
  assert.equal(config.installed.length, 1);
  assert.equal(result.url, 'https://localhost:8443');
  const syntax = config.calls.findIndex(c => c.args.includes('-n'));
  const staging = config.calls.findIndex(c => c.args.includes('-s'));
  const provisioning = config.calls.findIndex(c => c.args.includes('/srv/office-ai-local/infra/scripts/local-chat.mjs'));
  assert.ok(syntax < staging && staging < provisioning);
  assert.deepEqual(config.calls.at(-1).args.slice(-2), ['cat', '/srv/office-ai-local/secrets/tls/root.crt']);
  assert.ok(!JSON.stringify(config.calls).includes('cat /srv/office-ai-local/secrets/tls/root.key'));
});

test('insufficient resources, invalid paths, failed syntax or failed generation prevent certificate-trust readiness', () => {
  for (const options of [{ memory: '1024' }, { memory: 'not-a-number' }, { linuxPath: 'unsafe\npath' }, { syntaxFailure: true }, { provisioningFailure: true }, { validCertificate: false }]) {
    const config = fixture(options);
    assert.throws(() => provisionFromWindows(config));
    if (options.memory || options.linuxPath || options.syntaxFailure) assert.ok(!config.calls.some(c => c.args.includes('/srv/office-ai-local/infra/scripts/local-chat.mjs')));
    if (options.provisioningFailure) assert.ok(!config.calls.some(c => c.args.includes('cat')));
  }
});
