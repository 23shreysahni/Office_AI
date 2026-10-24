import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, validateConfig, parseEnv } from './config.mjs';
import { runWsl } from './setup-wsl.mjs';
import { checkDeploymentHost, runDoctor } from './doctor.mjs';

export function lanConfiguration(args) {
  const options = {};
  const names = { '--hostname': 'OFFICE_HOSTNAME', '--ip': 'LAN_BIND_IP', '--cidrs': 'LAN_ALLOWED_CIDRS', '--ollama-memory': 'OLLAMA_MEMORY', '--webui-memory': 'WEBUI_MEMORY', '--compute': 'COMPUTE_MODE' };
  for (let i = 0; i < args.length; i += 2) {
    const key = names[args[i]];
    if (!key || options[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Use --hostname NAME --ip PRIVATE_IP --cidrs "PRIVATE_CIDRS" [--compute auto|nvidia|cpu] [--ollama-memory 12g] [--webui-memory 4g]');
    options[key] = args[i + 1];
  }
  return validateConfig({ COMPOSE_PROJECT_NAME: 'office-ai', MODEL_NAME: 'qwen3.5:9b', MODEL_DIGEST: '', OLLAMA_MEMORY: '12g', WEBUI_MEMORY: '4g', OLLAMA_CPUS: '4', WEBUI_CPUS: '2', NETWORK_POLICY_REVIEWED: 'false', COMPUTE_MODE: 'auto', ...options }, { bootstrap: true });
}

export function writeLanConfiguration(directory, cfg) {
  validateConfig(cfg, { bootstrap: true });
  const file = path.join(directory, '.env');
  if (existsSync(file)) {
    const previous = parseEnv(readFileSync(file, 'utf8'));
    // A rerun may preserve a subsequently recorded digest/review; never reset it.
    for (const [key, value] of Object.entries(cfg)) {
      if (!['MODEL_DIGEST', 'NETWORK_POLICY_REVIEWED'].includes(key) && previous[key] !== value) throw new Error('Existing LAN configuration differs; it was preserved. Review it before migration.');
    }
    validateConfig(previous, { bootstrap: true });
    return false;
  }
  writeFileSync(file, Object.entries(cfg).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  return true;
}

export const lanStagingScript = `#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
source=$1
signature=$2
target=/srv/office-ai
[[ "$signature" =~ ^[a-f0-9]{64}$ && -f "$source/compose.yaml" ]] || exit 1
if [[ -e "$target" ]]; then
  [[ -d "$target" && ! -L "$target" && -f "$target/.lan-source" && "$(cat "$target/.lan-source")" == "$signature" ]] || { echo 'Existing LAN deployment differs; no files overwritten. Review backup/migration first.' >&2; exit 1; }
else
  install -d -m 700 "$target"
  tar -C "$source" --exclude='./.env' --exclude='./.env.*' --exclude='./secrets' --exclude='./state' --exclude='./artifacts' --exclude='./node_modules' --exclude='./.git' --exclude='./.codex' --exclude='./.agents' --exclude='./backups' -cf - . | tar -xpf - -C "$target"
  cp -- "$source/.env.example" "$target/.env.example"
  printf '%s\\n' "$signature" > "$target/.lan-source"
fi
`;

function sourceSignature() {
  const hash = createHash('sha256');
  const files = ['compose.yaml', 'compose.gpu.yaml', 'infra/images.json', 'infra/node-runtime.json', 'infra/proxy/nginx.conf.template', ...readdirSync(path.join(root, 'infra/scripts')).filter(name => /\.(mjs|sh)$/.test(name)).map(name => `infra/scripts/${name}`)].sort();
  for (const file of files) { hash.update(file); hash.update('\0'); hash.update(readFileSync(path.join(root, file))); }
  return hash.digest('hex');
}

export function prepareLan(args, { platform = process.platform, invoke = runWsl, log = console.log } = {}) {
  const cfg = lanConfiguration(args);
  if (platform === 'win32') {
    const source = invoke(['-d', 'Ubuntu', '--exec', 'wslpath', '-a', '-u', path.resolve(root).replace(/[\\/]$/, '')]);
    if (!source.startsWith('/') || /[\r\n\0]/.test(source)) throw new Error('Invalid WSL source path');
    // Reuse installed Ubuntu tooling; preparation never installs drivers or tools.
    invoke(['-d', 'Ubuntu', '--exec', 'bash', '-n'], { input: lanStagingScript });
    invoke(['-d', 'Ubuntu', '-u', 'root', '--exec', 'bash', '-s', '--', source, sourceSignature()], { input: lanStagingScript, stream: true });
    invoke(['-d', 'Ubuntu', '-u', 'root', '--exec', '/usr/local/bin/node', '/srv/office-ai/infra/scripts/prepare-lan.mjs', ...args], { stream: true });
    return cfg;
  }
  checkDeploymentHost();
  if (process.getuid() !== 0 || path.resolve(root) !== '/srv/office-ai') throw new Error('Prepare the separate /srv/office-ai Linux deployment as root; the local pilot is never modified.');
  runDoctor();
  writeLanConfiguration(root, cfg);
  log(`LAN configuration prepared, not started. Planned client address: https://${cfg.OFFICE_HOSTNAME}`);
  log(`Configure private DNS ${cfg.OFFICE_HOSTNAME} -> ${cfg.LAN_BIND_IP}, trusted internal TLS and reviewed firewall/egress policy. Follow docs/lan-setup.md; NETWORK_POLICY_REVIEWED remains false.`);
  return cfg;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { prepareLan(process.argv.slice(2)); }
  catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
