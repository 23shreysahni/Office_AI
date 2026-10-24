import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, pins, loadConfig, checkSecret, validatePolicy } from './config.mjs';
import { checkModels, canonicalModelDigest } from './smoke.mjs';
import { writeProxy, checkCertificates } from './proxy.mjs';
import { checkDeploymentHost, runDoctor } from './doctor.mjs';
import { computeMode, selectCompute, saveCompute, savedCompute, inferenceProbeCode, validateInference, checkMemoryBudget } from './compute.mjs';

function docker(args, cfg, { capture = false, timeout = 120_000 } = {}) {
  const result = spawnSync('docker', args, {
    cwd: root, env: { ...process.env, ...cfg, COMPOSE_PROFILES: '' },
    encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error('Docker operation failed; check daemon availability, permissions and the documented command');
  return result.stdout?.trim();
}
function composeArgs(gpu = false) {
  return ['compose', '--env-file', path.join(root, '.env'), '-f', path.join(root, 'compose.yaml'), ...(gpu ? ['-f', path.join(root, 'compose.gpu.yaml')] : [])];
}
function initialise() {
  if (process.platform === 'linux') checkDeploymentHost();
  if (process.platform === 'linux' && process.getuid() !== 0) throw new Error('Initialise the Linux deployment as root (sudo node ... init) so upstream containers own the state directories');
  mkdirSync(path.join(root, 'secrets'), { recursive: true, mode: 0o700 });
  const file = path.join(root, 'secrets/webui_session_key');
  if (!existsSync(file)) writeFileSync(file, `${randomBytes(48).toString('base64url')}\n`, { flag: 'wx', mode: 0o600 });
  checkSecret();
  for (const dir of ['webui', 'ollama', 'nginx']) mkdirSync(path.join(root, 'state', dir), { recursive: true, mode: 0o700 });
  console.log('State directories and persistent session key ready; no secret printed.');
}

// Operational inspection uses the upstream image's existing standard library.
// Emit public configuration and local model metadata only, never credentials or chat text.
const inspectCode = 'import json,urllib.request; get=lambda u:json.load(urllib.request.urlopen(u,timeout=10)); print(json.dumps({"config":get("http://127.0.0.1:8080/api/config"),"models":get("http://ollama:11434/api/tags")}))';

export function main(argv = process.argv.slice(2)) {
  const [command, ...flags] = argv;
  computeMode(undefined, flags);
  if (command === 'doctor') { console.log(JSON.stringify(runDoctor(), null, 2)); return; }
  if (command === 'init') { initialise(); return; }
  const commands = ['check', 'config', 'pull-images', 'pull-model', 'bootstrap', 'inspect', 'start', 'stop', 'status'];
  if (!commands.includes(command)) throw new Error(`Usage: node infra/scripts/stack.mjs <doctor|init|${commands.join('|')}> [--gpu|--cpu|--auto]`);
  const cfg = loadConfig({ bootstrap: command !== 'start' });
  // Preserve the historical isolated pilot until a separate migration is reviewed.
  const mode = computeMode(cfg.COMPUTE_MODE ?? (cfg.OFFICE_HOSTNAME === 'localhost' ? 'cpu' : undefined), flags);
  let gpu = mode === 'nvidia';
  checkSecret();
  let base = composeArgs(gpu);
  const doc = JSON.parse(docker([...base, '--profile', '*', 'config', '--format', 'json'], cfg, { capture: true }));
  validatePolicy(doc, cfg);
  writeProxy(cfg);
  if (['check', 'config'].includes(command)) { console.log('PASS: Compose syntax, image pins, profiles, ports, networks and core UI security settings. Runtime acceptance not tested.'); return; }
  if (['start', 'bootstrap', 'pull-model'].includes(command)) checkDeploymentHost();
  if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw new Error('Use the reviewed local Docker daemon; remote context overrides are not supported');
  const endpoint = JSON.parse(docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], cfg, { capture: true }));
  if (!/^(unix:\/\/|npipe:\/\/)/.test(endpoint)) throw new Error('The selected Docker context must use a local socket');
  if (['start', 'bootstrap'].includes(command)) {
    // A failed probe must not leave an old externally reachable entry point up.
    docker([...base, '--profile', '*', 'stop', 'proxy', 'bootstrap'], cfg);
    checkMemoryBudget(cfg, Number(docker(['info', '--format', '{{.MemTotal}}'], cfg, { capture: true })));
    const selection = selectCompute(mode);
    gpu = selection.mode === 'nvidia';
    base = composeArgs(gpu);
    console.log(`Compute: ${selection.mode}; ${selection.reason}. Model remains ${cfg.MODEL_NAME}.`);
    // Persist before startup so stop/status remain possible after partial failure.
    saveCompute(path.join(root, 'state'), selection);
  } else if (['inspect', 'status', 'stop'].includes(command)) {
    gpu = savedCompute(path.join(root, 'state'), mode);
    base = composeArgs(gpu);
  }
  const verifyInference = () => {
    let result;
    try {
      result = JSON.parse(docker([...base, 'exec', '-T', 'webui', 'python3', '-c', inferenceProbeCode(cfg.MODEL_NAME)], cfg, { capture: true, timeout: 270_000 }));
    } catch { throw new Error('Synthetic model readiness failed; no LAN entry started. Check local capacity and inference health.'); }
    validateInference(result, gpu);
    writeFileSync(path.join(root, 'state/compute-evidence.json'), JSON.stringify({ ...result, model: cfg.MODEL_NAME, checkedAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
    console.log(`PASS: synthetic inference; model placement ${gpu ? 'GPU (possibly with CPU offload)' : 'CPU'}.`);
  };
  if (command === 'pull-images') { docker([...base, '--profile', '*', 'pull'], cfg, { timeout: 1_800_000 }); return; }
  if (command === 'stop') { docker([...base, '--profile', '*', 'stop', '--timeout', '60'], cfg); return; }
  if (command === 'status') { docker([...base, '--profile', '*', 'ps'], cfg); return; }
  if (command === 'pull-model') {
    const running = docker([...base, '--profile', '*', 'ps', '--status', 'running', '--services'], cfg, { capture: true });
    if (running) throw new Error('Stop the stack before the controlled model download window');
    docker(['run', '--rm', '--network', 'bridge', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
      '--mount', `type=bind,src=${path.join(root, 'state/ollama')},dst=/root/.ollama`,
      '--mount', `type=bind,src=${path.join(root, 'infra/scripts/provision-model.sh')},dst=/provision-model.sh,readonly`,
      '-e', 'OLLAMA_NO_CLOUD=1', '--entrypoint', '/bin/sh', pins.ollama, '/provision-model.sh', cfg.MODEL_NAME], cfg, { timeout: 3_600_000 });
    return;
  }
  if (command === 'bootstrap') {
    checkCertificates(cfg);
    docker([...base, 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '240', 'webui', 'ollama'], cfg, { timeout: 300_000 });
    // The legacy local launcher provisions the digest after bootstrap itself.
    if (cfg.MODEL_DIGEST) verifyInference();
    docker([...base, '--profile', 'bootstrap', 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '240', 'bootstrap'], cfg, { timeout: 300_000 });
    console.log('Bootstrap available only on server loopback port 8443. Install CA trust, create the named administrator, then inspect before LAN start.');
    return;
  }
  const inspect = () => {
    let data;
    try { data = JSON.parse(docker([...base, 'exec', '-T', 'webui', 'python3', '-c', inspectCode], cfg, { capture: true })); }
    catch { throw new Error('Internal inspection failed; start bootstrap and check service health'); }
    return data;
  };
  if (command === 'inspect') {
    const data = inspect();
    console.log(JSON.stringify({ onboarding: data.config.onboarding, features: data.config.features, models: data.models.models?.map(m => ({ name: m.name, digest: canonicalModelDigest(m.digest) })) }, null, 2));
    return;
  }
  if (command === 'start') {
    checkCertificates(cfg);
    // Stop either public entry point before validating the current backend state.
    docker([...base, '--profile', '*', 'stop', 'proxy', 'bootstrap'], cfg);
    docker([...base, 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '240', 'webui', 'ollama'], cfg, { timeout: 300_000 });
    const data = inspect();
    if (data.config.onboarding !== false || data.config.features?.auth !== true || data.config.features?.enable_signup !== false) throw new Error('Provision the administrator and verify disabled signup before LAN start');
    checkModels(data.models, cfg);
    verifyInference();
    docker([...base, '--profile', 'lan', 'up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '240', 'proxy'], cfg, { timeout: 300_000 });
    console.log('LAN HTTPS started. Run authenticated smoke checks from a second LAN client; production acceptance remains pending.');
    console.log(`LAN browser address: https://${cfg.OFFICE_HOSTNAME} (private DNS must resolve to ${cfg.LAN_BIND_IP}; client CA trust required).`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
