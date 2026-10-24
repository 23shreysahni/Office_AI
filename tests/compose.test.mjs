import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root, validatePolicy } from '../infra/scripts/config.mjs';

const cfg = {
  OFFICE_HOSTNAME: 'office-ai.internal', LAN_BIND_IP: '192.168.50.10',
  LAN_ALLOWED_CIDRS: '192.168.50.0/24', COMPOSE_PROJECT_NAME: 'office-ai-test',
  MODEL_NAME: 'qwen3.5:9b', MODEL_DIGEST: `sha256:${'a'.repeat(64)}`,
  NETWORK_POLICY_REVIEWED: 'true', OLLAMA_MEMORY: '12g', WEBUI_MEMORY: '4g', OLLAMA_CPUS: '4', WEBUI_CPUS: '2'
};
for (const gpu of [false, true]) {
  test(`real Compose CLI validates ${gpu ? 'NVIDIA override' : 'CPU baseline'} without a daemon`, context => {
    const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8', windowsHide: true });
    if (version.error?.code === 'ENOENT') { context.skip('Docker CLI unavailable'); return; }
    const result = spawnSync('docker', ['compose', '--env-file', '.env.example', '-f', 'compose.yaml', ...(gpu ? ['-f', 'compose.gpu.yaml'] : []), '--profile', '*', 'config', '--format', 'json'], {
      cwd: root, env: { ...process.env, ...cfg, COMPOSE_PROFILES: '' }, encoding: 'utf8', windowsHide: true
    });
    assert.equal(result.status, 0, 'Compose configuration must parse');
    const doc = JSON.parse(result.stdout);
    validatePolicy(doc, cfg);
    for (const service of ['proxy', 'bootstrap']) assert.deepEqual(doc.services[service].tmpfs, ['/tmp:size=32m,mode=1777']);
    assert.deepEqual(Object.keys(doc.services.proxy.networks).sort(), ['frontend', 'ingress']);
    assert.equal(doc.networks.ingress.driver_opts['com.docker.network.bridge.enable_ip_masquerade'], 'false');
    assert.equal(doc.services.webui.environment.WEBUI_SECRET_KEY_FILE, '/run/secrets/webui_session_key');
    assert.equal(doc.services.webui.environment.WEBUI_SECRET_KEY, undefined);
    assert.equal(doc.services.webui.secrets[0].source, 'webui_session_key');
    assert.ok(doc.services.webui.volumes.some(v => v.target === '/app/backend/data' && v.type === 'bind'));
    assert.ok(doc.services.ollama.volumes.some(v => v.target === '/root/.ollama' && v.type === 'bind'));
    assert.ok(doc.services.proxy.volumes.some(v => v.target === '/etc/nginx/generated' && v.type === 'bind'));
    assert.equal(doc.secrets.webui_session_key.file, path.join(root, 'secrets/webui_session_key'));
    if (gpu) assert.deepEqual(doc.services.ollama.deploy.resources.reservations.devices[0].capabilities, ['gpu']);
    else assert.equal(doc.services.ollama.deploy, undefined);
    assert.equal(doc.services.ollama.environment.CUDA_VISIBLE_DEVICES, gpu ? '0' : '-1');
    assert.equal(doc.services.ollama.environment.GGML_VK_VISIBLE_DEVICES, '-1');
    assert.equal(doc.services.ollama.environment.OLLAMA_NUM_PARALLEL, '1');
    assert.equal(doc.services.ollama.environment.OLLAMA_MAX_QUEUE, '2');
  });
}
