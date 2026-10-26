import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, renameSync, statfsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, loadConfig, validateConfig } from './config.mjs';
import { checkCertificates } from './proxy.mjs';
import { checkModels } from './smoke.mjs';

export function localChatConfig() {
  return {
    OFFICE_HOSTNAME: 'localhost', LAN_BIND_IP: '127.0.0.1', LAN_ALLOWED_CIDRS: '127.0.0.1/32',
    COMPOSE_PROJECT_NAME: 'office-ai-local', MODEL_NAME: 'qwen3.5:4b', MODEL_DIGEST: '',
    OLLAMA_MEMORY: '5g', WEBUI_MEMORY: '2g', OLLAMA_CPUS: '4', WEBUI_CPUS: '2', NETWORK_POLICY_REVIEWED: 'false'
  };
}

export function checkLocalChatConfig(cfg) {
  validateConfig(cfg, { bootstrap: true });
  const expected = localChatConfig();
  if (cfg.MODEL_NAME === 'qwen3.5:9b') {
    expected.MODEL_NAME = 'qwen3.5:9b';
    expected.OLLAMA_MEMORY = '7g';
    if (cfg.COMPUTE_MODE !== 'nvidia') throw new Error('The local 9B profile requires explicit NVIDIA compute.');
  }
  for (const key of Object.keys(expected)) {
    if (key !== 'MODEL_DIGEST' && cfg[key] !== expected[key]) throw new Error('Existing local pilot configuration differs; it was not overwritten. Review it before continuing.');
  }
  return cfg;
}

function command(binary, args, { capture = false, timeout = 3_600_000 } = {}) {
  const result = spawnSync(binary, args, { cwd: root, encoding: 'utf8', timeout, maxBuffer: 1024 * 1024,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
  if (result.error || result.status !== 0) throw new Error('A local chat setup step failed. Read the preceding local tool status; no credentials or model response are printed.');
  return result.stdout?.trim();
}

export function provisionLocalChat() {
  if (process.platform !== 'linux' || process.getuid() !== 0 || path.resolve(root) !== '/srv/office-ai-local') throw new Error('Run the Windows start-chat launcher; this operation requires the separate Linux local-pilot directory.');
  const envFile = path.join(root, '.env');
  if (!existsSync(envFile)) writeFileSync(envFile, Object.entries(localChatConfig()).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  let cfg = checkLocalChatConfig(loadConfig({ bootstrap: true }));
  const stack = (step, options) => command(process.execPath, ['infra/scripts/stack.mjs', step], options);
  stack('doctor'); stack('init'); stack('check');
  if (!existsSync(path.join(root, 'secrets/tls'))) command(process.execPath, ['infra/scripts/certificates.mjs']);
  checkCertificates(cfg);
  let started = false;
  try {
    if (!cfg.MODEL_DIGEST) {
      const disk = statfsSync(root);
      if (disk.bavail * disk.bsize < 16 * 1024 ** 3) throw new Error('At least 16 GiB free Linux filesystem space is required for initial provisioning; also check the Windows disk hosting Docker/WSL.');
      stack('stop');
      console.log(`Downloading pinned images and ${cfg.MODEL_NAME}. This requires several GB and may take time.`);
      stack('pull-images'); stack('pull-model');
    }
    console.log('Starting isolated HTTPS bootstrap and checking the installed local model…');
    started = true;
    stack('bootstrap');
    const state = JSON.parse(stack('inspect', { capture: true, timeout: 60_000 }));
    const selected = state.models?.filter(model => model.name === cfg.MODEL_NAME);
    if (!selected || selected.length !== 1) throw new Error('The selected local pilot model is missing or duplicated.');
    if (cfg.MODEL_DIGEST && cfg.MODEL_DIGEST !== selected[0].digest) throw new Error('The installed model digest changed; review it before use.');
    cfg = { ...cfg, MODEL_DIGEST: selected[0].digest };
    checkModels({ models: state.models }, cfg);
    if (state.features?.auth !== true || state.features?.enable_signup !== false) throw new Error('Unsafe upstream authentication settings; local chat entry point stopped.');
    const next = `${envFile}.next`;
    writeFileSync(next, Object.entries(cfg).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(next, envFile);
    // Operational verification uses the existing upstream image's standard library.
    // Return timing/token metadata only, never the generated response or a token.
    console.log('Testing local generation (up to four minutes). A failure stops this pilot; model fit is not assumed.');
    const requestBody = JSON.stringify({ model: cfg.MODEL_NAME, prompt: 'Synthetic setup test: reply with one short greeting.', stream: false, think: false, options: { num_ctx: 4096, num_predict: 32, temperature: 0 } });
    const code = `import json,urllib.request; body=${JSON.stringify(requestBody)}; req=urllib.request.Request('http://ollama:11434/api/generate',data=body.encode(),headers={'Content-Type':'application/json'}); raw=urllib.request.urlopen(req,timeout=240).read(1000001); assert len(raw)<=1000000; data=json.loads(raw); assert data.get('done') is True and isinstance(data.get('response'),str) and data['response'].strip(); print(json.dumps({'generation':'passed','outputTokens':data.get('eval_count'),'durationNs':data.get('total_duration')}))`;
    const result = JSON.parse(command('docker', ['compose', '--env-file', '.env', '-f', 'compose.yaml', 'exec', '-T', 'webui', 'python3', '-c', code], { capture: true, timeout: 270_000 }));
    if (result.generation !== 'passed') throw new Error('Local generation did not complete.');
    writeFileSync(path.join(root, 'state/local-chat-evidence.json'), JSON.stringify({ ...result, model: cfg.MODEL_NAME, modelDigest: cfg.MODEL_DIGEST, checkedAt: new Date().toISOString(), limitations: 'Internal synthetic generation only; authenticated browser chat and full phase acceptance remain unverified.' }, null, 2) + '\n', { mode: 0o600 });
    console.log('PASS: Local inference completed. Windows TLS trust and your named administrator account are the remaining interactive steps.');
  } catch (error) {
    if (started) {
      try { stack('stop'); } catch { throw new Error('Setup failed and service shutdown needs operator attention; run the local stack stop command.'); }
    }
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if (process.argv.length !== 2) throw new Error('No arguments are accepted'); provisionLocalChat(); }
  catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
