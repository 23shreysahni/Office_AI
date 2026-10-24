import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkDeploymentHost, runDoctor } from '../infra/scripts/doctor.mjs';

const native = { platform: 'linux', release: '6.8.0-generic', directory: '/srv/office-ai' };
const wsl = { ...native, release: '6.6.87.2-microsoft-standard-WSL2' };
const options = () => ({ host: wsl, nodeVersion: '24.15.0', env: {}, run(command, args) {
  if (command === 'docker') {
    if (args[0] === 'context') return '"unix:///var/run/docker.sock"';
    if (args[0] === 'info') return 'linux';
    if (args[0] === 'compose') return '5.1.4';
  }
  return 'installed';
} });

test('container provisioning and Linux recovery scripts keep LF endings on Windows checkouts', () => {
  for (const file of ['../infra/scripts/provision-model.sh', '../infra/backup/backup.sh']) {
    const script = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.equal(script.includes('\r'), false, file);
    assert.ok(script.startsWith('#!'), file);
  }
  assert.match(readFileSync(new URL('../.gitattributes', import.meta.url), 'utf8'), /^\*\.sh text eol=lf$/m);
});

test('deployment permits Linux and WSL Linux storage, with a useful Windows instruction', () => {
  assert.doesNotThrow(() => checkDeploymentHost(native));
  assert.doesNotThrow(() => checkDeploymentHost(wsl));
  assert.throws(() => checkDeploymentHost({ ...native, platform: 'win32' }), /Ubuntu WSL 2/);
  assert.throws(() => checkDeploymentHost({ ...native, platform: 'darwin' }), /reviewed Linux host/);
  for (const directory of ['/mnt/c/office-ai', '/mnt/d', '/mnt/D/office ai']) {
    assert.throws(() => checkDeploymentHost({ ...wsl, directory }), /Linux filesystem/);
  }
});

test('doctor checks WSL and native Linux prerequisites without application configuration', () => {
  for (const host of [wsl, native]) {
    const report = runDoctor({ ...options(), host });
    assert.equal(report.status, 'passed');
    assert.ok(report.checks.includes('linux-docker-daemon'));
    assert.ok(report.checks.includes('gpg'));
    assert.match(report.limitations, /not proof/);
  }
});

test('doctor refuses Windows containers and remote or malformed Docker endpoints', () => {
  for (const endpoint of ['"ssh://server"', '"tcp://127.0.0.1:2375"', 'null', 'private-canary']) {
    const opts = options(), original = opts.run;
    opts.run = (command, args) => args[0] === 'context' ? endpoint : original(command, args);
    assert.throws(() => runDoctor(opts), error => !error.message.includes('private-canary'));
  }
  const opts = options(), original = opts.run;
  opts.run = (command, args) => args[0] === 'info' ? 'windows' : original(command, args);
  assert.throws(() => runDoctor(opts), /Linux-container/);
});

test('doctor refuses unsupported Node and Docker overrides before issuing commands', () => {
  for (const extra of [{ nodeVersion: '22.0.0' }, { env: { DOCKER_HOST: 'tcp://private-canary' } }, { env: { DOCKER_CONTEXT: 'remote' } }]) {
    let called = false;
    assert.throws(() => runDoctor({ ...options(), ...extra, run() { called = true; } }));
    assert.equal(called, false);
  }
});

test('doctor reports daemon/tool failures without leaking upstream output or context', () => {
  for (const unavailable of ['docker', 'bash', 'openssl', 'gpg', 'tar', 'sha256sum', 'realpath']) {
    const opts = options(), original = opts.run;
    opts.run = (command, args) => {
      if (command === unavailable) throw new Error('private-canary host/user/token');
      return original(command, args);
    };
    assert.throws(() => runDoctor(opts), error => !error.message.includes('private-canary'));
  }
  const opts = options(), original = opts.run;
  opts.run = (command, args) => args[0] === 'compose' ? 'private-canary' : original(command, args);
  assert.throws(() => runDoctor(opts), /Compose version/);
});
