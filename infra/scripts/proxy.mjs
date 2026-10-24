import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { X509Certificate, createPrivateKey, createPublicKey } from 'node:crypto';
import path from 'node:path';
import { root, validateConfig } from './config.mjs';

export function renderProxy(cfg, { bootstrap = false } = {}) {
  validateConfig(cfg, { bootstrap: true });
  const allow = bootstrap ? 'allow all;' : cfg.LAN_ALLOWED_CIDRS.split(/ +/).map(cidr => `allow ${cidr};`).join('\n        ');
  return readFileSync(path.join(root, 'infra/proxy/nginx.conf.template'), 'utf8')
    .replaceAll('__HOSTNAME__', cfg.OFFICE_HOSTNAME)
    .replace('__SIGNUP_ALLOWED__', bootstrap ? '1' : '0')
    .replace('__ALLOW_RULES__', allow);
}
export function writeProxy(cfg) {
  const dir = path.join(root, 'state/nginx'); mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const bootstrap of [false, true]) writeFileSync(path.join(dir, bootstrap ? 'bootstrap.conf' : 'lan.conf'), renderProxy(cfg, { bootstrap }), { mode: 0o600 });
}
export function checkCertificates(cfg) {
  try {
    const crt = new X509Certificate(readFileSync(path.join(root, 'secrets/tls/server.crt')));
    const keyPath = path.join(root, 'secrets/tls/server.key');
    const key = createPrivateKey(readFileSync(keyPath));
    const now = Date.now();
    if (!crt.checkHost(cfg.OFFICE_HOSTNAME, { subject: 'never' }) || Date.parse(crt.validFrom) > now || Date.parse(crt.validTo) < now + 7 * 86400_000 || !crt.publicKey.equals(createPublicKey(key))) throw new Error();
    if (process.platform !== 'win32' && (statSync(keyPath).mode & 0o077) !== 0) throw new Error();
  } catch { throw new Error('Provide a matching TLS certificate/key for OFFICE_HOSTNAME, valid for at least seven days, with a private 0600 key'); }
}
