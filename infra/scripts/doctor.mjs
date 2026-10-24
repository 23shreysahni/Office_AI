import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { root } from './config.mjs';

export function checkDeploymentHost({ platform = process.platform, release = os.release(), directory = realpathSync(root) } = {}) {
  if (platform !== 'linux') throw new Error('Run deployment inside Ubuntu WSL 2 on Windows, or on the reviewed Linux host. Native Windows can run configuration tests and the HTTPS smoke client.');
  if (/microsoft/i.test(release) && /^\/mnt\/[a-z](?:\/|$)/i.test(directory)) throw new Error('Move the deployment and state to the WSL Linux filesystem, for example /srv/office-ai; do not deploy from a mounted Windows drive.');
}

function execute(command, args) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15_000, maxBuffer: 1024 * 1024, windowsHide: true
  });
  if (result.error || result.status !== 0) throw new Error('Prerequisite command failed');
  return result.stdout.trim();
}

export function runDoctor({ run = execute, host = {}, env = process.env, nodeVersion = process.versions.node } = {}) {
  checkDeploymentHost(host);
  if (nodeVersion.split('.')[0] !== '24') throw new Error('Use the reviewed Node.js 24 LTS toolchain inside the deployment environment.');
  if (env.DOCKER_HOST || env.DOCKER_CONTEXT) throw new Error('Remove Docker endpoint/context overrides and select the reviewed local Docker context.');
  const checks = ['linux-deployment-filesystem', 'node-24'];
  const call = (command, args, label) => {
    try { return run(command, args); }
    catch { throw new Error(`Prerequisite unavailable: ${label}. Check the installation, permissions and local service; upstream output is withheld.`); }
  };
  let endpoint;
  try { endpoint = JSON.parse(call('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], 'local Docker context')); }
  catch { throw new Error('Cannot inspect the local Docker context; check Docker Desktop WSL integration or native Docker access.'); }
  if (typeof endpoint !== 'string' || !endpoint.startsWith('unix://')) throw new Error('Deployment requires a local Unix Docker socket inside Linux; remote contexts are unsupported.');
  checks.push('local-docker-context');
  const type = call('docker', ['info', '--format', '{{.OSType}}'], 'Docker daemon');
  if (type !== 'linux') throw new Error('Select the Linux-container Docker backend before deployment.');
  checks.push('linux-docker-daemon');
  const compose = call('docker', ['compose', 'version', '--short'], 'Docker Compose');
  if (!/^v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/.test(compose)) throw new Error('Cannot identify the Docker Compose version.');
  checks.push('docker-compose');
  for (const [command, args] of [['bash', ['--version']], ['openssl', ['version']], ['gpg', ['--version']], ['tar', ['--version']], ['sha256sum', ['--version']], ['realpath', ['--version']]]) {
    call(command, args, command);
    checks.push(command);
  }
  return {
    status: 'passed', checks,
    limitations: 'Prerequisites only; not proof of model fit, licence/advisory review, LAN isolation, TLS trust, offline chat, reboot recovery or phase acceptance.'
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node infra/scripts/doctor.mjs');
    console.log(JSON.stringify(runDoctor(), null, 2));
  } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
