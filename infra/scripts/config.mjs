import { readFileSync, statSync } from 'node:fs';
import { isIP } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const pins = JSON.parse(readFileSync(new URL('../images.json', import.meta.url), 'utf8'));
const keys = ['OFFICE_HOSTNAME', 'LAN_BIND_IP', 'LAN_ALLOWED_CIDRS', 'COMPOSE_PROJECT_NAME', 'MODEL_NAME', 'MODEL_DIGEST', 'OLLAMA_MEMORY', 'WEBUI_MEMORY', 'OLLAMA_CPUS', 'WEBUI_CPUS', 'NETWORK_POLICY_REVIEWED', 'COMPUTE_MODE'];
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^([A-Z][A-Z0-9_]*)=([^\r\n]*)$/.exec(line);
    requireThat(match && keys.includes(match[1]) && !Object.hasOwn(result, match[1]), 'Invalid, unknown or duplicate .env setting');
    const value = match[2].trim();
    requireThat(!/["'`$\\\x00-\x1f]/.test(value), 'Use plain unquoted .env values without expansion');
    result[match[1]] = value;
  }
  return result;
}

function ipNumber(ip) {
  requireThat(isIP(ip) === 4, 'Expected an IPv4 address');
  return ip.split('.').reduce((a, b) => (a * 256) + Number(b), 0);
}
function privateAddress(n) {
  return (n >= 0x0a000000 && n <= 0x0affffff) || (n >= 0xac100000 && n <= 0xac1fffff) || (n >= 0xc0a80000 && n <= 0xc0a8ffff);
}
export function privateIPv4(ip) {
  try { return privateAddress(ipNumber(ip)); } catch { return false; }
}
export function cidrRange(cidr) {
  const match = /^([0-9.]+)\/(\d{1,2})$/.exec(cidr);
  requireThat(match && Number(match[2]) <= 32, 'Invalid LAN CIDR');
  const n = ipNumber(match[1]);
  const size = 2 ** (32 - Number(match[2]));
  const start = Math.floor(n / size) * size;
  const end = start + size - 1;
  requireThat(n === start && privateAddress(start) && privateAddress(end), 'CIDRs must be canonical private IPv4 networks');
  return [start, end];
}

export function validateConfig(cfg, { bootstrap = false } = {}) {
  for (const key of keys.filter(key => key !== 'COMPUTE_MODE')) requireThat(Object.hasOwn(cfg, key) && (cfg[key] || ['MODEL_DIGEST'].includes(key)), `Set ${key} in .env`);
  requireThat(cfg.COMPUTE_MODE === undefined || ['auto', 'nvidia', 'cpu'].includes(cfg.COMPUTE_MODE), 'COMPUTE_MODE must be auto, nvidia or cpu');
  const host = cfg.OFFICE_HOSTNAME;
  const local = bootstrap && host === 'localhost' && cfg.LAN_BIND_IP === '127.0.0.1' && cfg.LAN_ALLOWED_CIDRS === '127.0.0.1/32' && cfg.NETWORK_POLICY_REVIEWED === 'false';
  requireThat(local || (host.length <= 253 && host.includes('.') && !isIP(host) && host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))), 'OFFICE_HOSTNAME must be a plain internal DNS hostname');
  if (!local) {
    requireThat(privateIPv4(cfg.LAN_BIND_IP), 'LAN_BIND_IP must be an explicit private IPv4 address');
    const ranges = cfg.LAN_ALLOWED_CIDRS.split(/ +/).map(cidrRange);
    const bind = ipNumber(cfg.LAN_BIND_IP);
    requireThat(ranges.some(([a, b]) => bind >= a && bind <= b), 'LAN bind address must belong to an approved LAN CIDR');
  }
  requireThat(/^[a-z][a-z0-9-]{0,40}$/.test(cfg.COMPOSE_PROJECT_NAME), 'Invalid Compose project name');
  requireThat(cfg.MODEL_NAME === 'qwen3.5:9b' || (local && cfg.MODEL_NAME === 'qwen3.5:4b'), 'Only the approved baseline or loopback-pilot fallback is enabled');
  requireThat((bootstrap && !cfg.MODEL_DIGEST) || /^sha256:[a-f0-9]{64}$/.test(cfg.MODEL_DIGEST), 'Set the complete installed MODEL_DIGEST');
  for (const key of ['OLLAMA_MEMORY', 'WEBUI_MEMORY']) requireThat(/^[1-9]\d{0,2}g$/.test(cfg[key]), `Set a bounded ${key} in gigabytes`);
  for (const key of ['OLLAMA_CPUS', 'WEBUI_CPUS']) requireThat(/^[1-9]\d?$/.test(cfg[key]) && Number(cfg[key]) <= 64, `Set ${key} between 1 and 64`);
  requireThat(['true', 'false'].includes(cfg.NETWORK_POLICY_REVIEWED), 'NETWORK_POLICY_REVIEWED must be true or false');
  requireThat(bootstrap || cfg.NETWORK_POLICY_REVIEWED === 'true', 'Review host ingress, Docker forwarding and egress policy before LAN start');
  return cfg;
}

export function loadConfig(options = {}) {
  let text;
  try { text = readFileSync(path.join(root, '.env'), 'utf8'); } catch { throw new Error('Copy .env.example to .env and supply the office configuration'); }
  return validateConfig(parseEnv(text), options);
}

export function checkSecret() {
  const file = path.join(root, 'secrets/webui_session_key');
  let stat, value;
  try { stat = statSync(file); value = readFileSync(file, 'utf8').trim(); } catch { throw new Error('Run stack.mjs init to create the session key'); }
  requireThat(stat.isFile() && /^[A-Za-z0-9_-]{64}$/.test(value), 'Invalid session key file');
  if (process.platform !== 'win32') requireThat((stat.mode & 0o077) === 0, 'Session key must have mode 0600');
}

export function validatePolicy(doc, cfg, expectedPins = pins) {
  requireThat(JSON.stringify(Object.keys(doc.services).sort()) === JSON.stringify(['bootstrap', 'ollama', 'proxy', 'webui']), 'Unexpected Compose services');
  for (const [name, service] of Object.entries(doc.services)) {
    requireThat(service.image === expectedPins[{ proxy: 'nginx', bootstrap: 'nginx' }[name] || name], 'Image pin mismatch');
    requireThat(!service.network_mode && !service.privileged && !service.build, 'Unsafe container mode');
    requireThat(!(service.volumes || []).some(v => JSON.stringify(v).includes('docker.sock')), 'Docker socket mount forbidden');
  }
  for (const name of ['frontend', 'inference']) requireThat(doc.networks[name]?.internal === true, 'Service networks must be internal');
  requireThat(doc.networks.ingress?.driver === 'bridge' && doc.networks.ingress.internal !== true && doc.networks.ingress.driver_opts?.['com.docker.network.bridge.enable_ip_masquerade'] === 'false', 'Published TLS proxy requires the restricted non-NAT ingress bridge');
  const networks = name => Object.keys(doc.services[name].networks || {}).sort().join(',');
  requireThat(networks('proxy') === 'frontend,ingress' && networks('bootstrap') === 'frontend,ingress' && networks('webui') === 'frontend,inference' && networks('ollama') === 'inference', 'Invalid network segmentation');
  for (const [name, ip, port] of [['proxy', cfg.LAN_BIND_IP, '443'], ['bootstrap', '127.0.0.1', '8443']]) {
    const service = doc.services[name];
    const p = service.ports;
    requireThat(p?.length === 1 && p[0].host_ip === ip && String(p[0].published) === port && p[0].target === 443 && p[0].protocol === 'tcp', 'Unsafe proxy port publication');
    requireThat(service.profiles?.length === 1 && service.profiles[0] === (name === 'proxy' ? 'lan' : 'bootstrap'), 'Proxy profile isolation missing');
  }
  requireThat(!doc.services.webui.ports?.length && !doc.services.ollama.ports?.length, 'Backend ports must never be published');
  const env = doc.services.webui.environment;
  for (const [key, value] of Object.entries({ WEBUI_AUTH: 'true', ENABLE_SIGNUP: 'false', ENABLE_PERSISTENT_CONFIG: 'false', ENABLE_OPENAI_API: 'false', OFFLINE_MODE: 'true', OLLAMA_BASE_URL: 'http://ollama:11434' })) requireThat(env[key] === value, `Unsafe UI setting: ${key}`);
}
