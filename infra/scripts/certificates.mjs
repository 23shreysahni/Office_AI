import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, chmodSync, renameSync } from 'node:fs';
import path from 'node:path';
import { root, loadConfig } from './config.mjs';
import { checkDeploymentHost } from './doctor.mjs';

try {
  if (process.argv.length !== 2) throw new Error('Usage: sudo node infra/scripts/certificates.mjs');
  if (process.platform === 'linux') checkDeploymentHost();
  if (process.platform === 'linux' && process.getuid() !== 0) throw new Error('Generate Linux deployment certificates as root');
  const cfg = loadConfig({ bootstrap: true });
  const destination = path.join(root, 'secrets/tls');
  if (existsSync(destination)) throw new Error('TLS directory already exists; use the documented renewal process, never overwrite keys automatically');
  mkdirSync(path.join(root, 'secrets'), { recursive: true, mode: 0o700 });
  const stage = mkdtempSync(path.join(root, 'secrets/tls-staging-')); chmodSync(stage, 0o700);
  const file = name => path.join(stage, name);
  function openssl(args) {
    const result = spawnSync('openssl', args, { stdio: 'pipe', timeout: 60_000, windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('OpenSSL certificate creation failed; inspect restricted staging files and verify OpenSSL installation');
  }
  openssl(['req', '-x509', '-newkey', 'rsa:3072', '-sha256', '-nodes', '-days', '3650', '-subj', '/CN=Office AI Pilot Root', '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', file('root.key'), '-out', file('root.crt')]);
  chmodSync(file('root.key'), 0o600);
  openssl(['req', '-new', '-newkey', 'rsa:3072', '-sha256', '-nodes', '-subj', `/CN=${cfg.OFFICE_HOSTNAME}`, '-keyout', file('server.key'), '-out', file('server.csr')]);
  chmodSync(file('server.key'), 0o600);
  writeFileSync(file('server.ext'), `basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:${cfg.OFFICE_HOSTNAME}\n`, { mode: 0o600 });
  openssl(['x509', '-req', '-sha256', '-days', '365', '-in', file('server.csr'), '-CA', file('root.crt'), '-CAkey', file('root.key'), '-CAcreateserial', '-extfile', file('server.ext'), '-out', file('server.crt')]);
  renameSync(stage, destination);
  console.log('Private pilot CA and HTTPS certificate created. Distribute only root.crt after fingerprint verification; the CA key is never mounted into Nginx.');
} catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
