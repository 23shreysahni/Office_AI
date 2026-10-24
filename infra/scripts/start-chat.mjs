import { createHash, X509Certificate } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { setupWsl, runWsl } from './setup-wsl.mjs';

const sourceRoot = fileURLToPath(new URL('../../', import.meta.url));
export const stagingScript = `#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
source=$1
signature=$2
target=/srv/office-ai-local
[[ "$signature" =~ ^[a-f0-9]{64}$ && -f "$source/compose.yaml" ]] || { echo 'Invalid source or signature' >&2; exit 1; }
if [[ -e "$target" ]]; then
    [[ -d "$target" && ! -L "$target" && -f "$target/.local-chat-source" && "$(cat "$target/.local-chat-source")" == "$signature" ]] || { echo 'Existing local deployment is different or incomplete. It was not overwritten; review/backup it before an update.' >&2; exit 1; }
    echo 'Reusing matching local deployment; configuration, secrets and state preserved.'
else
    install -d -m 700 "$target"
    tar -C "$source" --exclude='./.env' --exclude='./.env.*' --exclude='./secrets' --exclude='./state' \\
        --exclude='./artifacts' --exclude='./node_modules' --exclude='./.git' --exclude='./.codex' \\
        --exclude='./.agents' --exclude='./backups' -cf - . | tar -xpf - -C "$target"
    cp -- "$source/.env.example" "$target/.env.example"
    printf '%s\\n' "$signature" > "$target/.local-chat-source"
fi
`;

function signature() {
  const files = ['compose.yaml', 'compose.gpu.yaml', 'infra/images.json', 'infra/node-runtime.json', 'infra/proxy/nginx.conf.template', ...readdirSync(path.join(sourceRoot, 'infra/scripts')).filter(name => /\.(mjs|sh)$/.test(name)).map(name => `infra/scripts/${name}`)].sort();
  const hash = createHash('sha256');
  for (const file of files) { hash.update(file); hash.update('\0'); hash.update(readFileSync(path.join(sourceRoot, file))); }
  return hash.digest('hex');
}

export function provisionFromWindows({ invoke = runWsl, installTools = setupWsl, platform = process.platform, log = console.log, source = sourceRoot, sourceSignature = signature(), certificateFromPem = pem => new X509Certificate(pem) } = {}) {
  if (platform !== 'win32') throw new Error('Run this command with Windows Node.js in your normal PowerShell window.');
  installTools({ invoke, platform, log });
  const memory = Number(invoke(['-d', 'Ubuntu', '--exec', 'docker', 'info', '--format', '{{.MemTotal}}']));
  if (!Number.isSafeInteger(memory) || memory < 7.5 * 1024 ** 3) throw new Error('The local 4B pilot requires at least 7.5 GiB allocated to the Linux engine; no model-fit guarantee is made. Review Docker/WSL resources.');
  log('Using the specified qwen3.5:4b fallback for this loopback-only pilot. A real generation test must pass.');
  const linuxSource = invoke(['-d', 'Ubuntu', '--exec', 'wslpath', '-a', '-u', path.resolve(source).replace(/[\\/]$/, '')]);
  if (!linuxSource.startsWith('/') || /[\r\n\0]/.test(linuxSource)) throw new Error('Cannot resolve the Windows source directory inside Ubuntu.');
  invoke(['-d', 'Ubuntu', '--exec', 'bash', '-n'], { input: stagingScript });
  invoke(['-d', 'Ubuntu', '-u', 'root', '--exec', 'bash', '-s', '--', linuxSource, sourceSignature], { input: stagingScript, stream: true });
  invoke(['-d', 'Ubuntu', '-u', 'root', '--exec', '/usr/local/bin/node', '/srv/office-ai-local/infra/scripts/local-chat.mjs'], { stream: true, timeout: 7_200_000 });
  const pem = invoke(['-d', 'Ubuntu', '-u', 'root', '--exec', 'cat', '/srv/office-ai-local/secrets/tls/root.crt']);
  const certificate = certificateFromPem(pem);
  if (!certificate.ca || !certificate.verify(certificate.publicKey) || Date.parse(certificate.validTo) <= Date.now()) throw new Error('Invalid pilot root certificate; Windows trust was not changed.');
  return { pem, fingerprint: certificate.fingerprint256, thumbprint: certificate.fingerprint.replaceAll(':', ''), url: 'https://localhost:8443' };
}

export function verifyHttps(pem) {
  return new Promise((resolve, reject) => {
    const req = https.get({ hostname: '127.0.0.1', servername: 'localhost', port: 8443, path: '/health', ca: pem, rejectUnauthorized: true, headers: { Host: 'localhost:8443' }, timeout: 15_000 }, res => {
      let body = '';
      res.on('data', part => { body += part; if (body.length > 16_384) req.destroy(new Error('Health metadata exceeded its limit')); });
      res.once('end', () => {
        try { if (res.statusCode !== 200 || JSON.parse(body).status !== true) throw new Error(); resolve(true); }
        catch { reject(new Error('Local HTTPS health failed')); }
      });
      res.once('error', reject);
    });
    req.once('timeout', () => req.destroy(new Error('Local HTTPS health timed out')));
    req.once('error', reject);
  });
}

function powershell(script, env) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30_000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Windows certificate-store operation failed. No certificate-warning bypass is permitted.');
  return result.stdout.trim();
}

async function main() {
  if (process.argv.length !== 2) throw new Error('Usage: node infra/scripts/start-chat.mjs');
  const result = provisionFromWindows();
  await verifyHttps(result.pem);
  const directory = path.join(sourceRoot, 'artifacts'); mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'local-chat-root.crt'); writeFileSync(file, result.pem);
  const env = { OFFICE_AI_CERT_THUMBPRINT: result.thumbprint, OFFICE_AI_CA_PATH: file };
  const check = "@(Get-ChildItem Cert:\\CurrentUser\\Root | Where-Object Thumbprint -eq $env:OFFICE_AI_CERT_THUMBPRINT).Count";
  if (powershell(check, env) !== '1') {
    console.log(`Local HTTPS and inference verified. New pilot CA SHA-256 fingerprint:\n${result.fingerprint}`);
    console.log('Trusting this root allows certificates signed by this pilot CA for your Windows user. Its private key stays in Ubuntu.');
    const input = createInterface({ input: process.stdin, output: process.stdout });
    let choice;
    try { choice = await input.question('Type TRUST to install this displayed CA in your current-user Windows Root store, or press Enter to stop: '); }
    finally { input.close(); }
    if (choice.trim() !== 'TRUST') { console.log('Windows trust was not changed. Services remain loopback-only; complete reviewed CA trust before opening chat.'); return; }
    powershell("$ErrorActionPreference='Stop'; Import-Certificate -FilePath $env:OFFICE_AI_CA_PATH -CertStoreLocation Cert:\\CurrentUser\\Root | Out-Null", env);
    if (powershell(check, env) !== '1') throw new Error('The pilot CA was not found in the Windows user trust store.');
  }
  console.log(`Open WebUI: ${result.url}\nCreate your named administrator account there and select qwen3.5:4b. Enter the password yourself; do not paste it into chat.\nThis is a local synthetic pilot. Browser chat, cancellation, offline restart and full phase acceptance still need verification.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(`FAIL: ${error.message}`); process.exitCode = 1; });
}
