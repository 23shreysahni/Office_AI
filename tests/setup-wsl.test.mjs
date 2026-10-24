import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setupWsl, installationScript } from '../infra/scripts/setup-wsl.mjs';

function fixture({ engine = 'linux', architecture = 'x86_64', installed = 'v24.22.0', failSyntax = false, failInstall = false } = {}) {
  const calls = [], messages = [];
  return { calls, messages, platform: 'win32', log: value => messages.push(value), invoke(args, options = {}) {
    calls.push({ args, options });
    if (args.includes('docker')) return engine;
    if (args.includes('uname')) return architecture;
    if (args.includes('-n') && failSyntax) throw new Error('Syntax check failed');
    if (args.includes('root') && failInstall) throw new Error('Installation failed');
    if (args.includes('/usr/local/bin/node')) return installed;
    return '';
  } };
}

test('WSL setup checks syntax before privileged install and verifies the ordinary user separately', () => {
  for (const architecture of ['x86_64', 'aarch64']) {
    const config = fixture({ architecture });
    const report = setupWsl(config);
    assert.equal(report.chatReady, false);
    const syntax = config.calls.findIndex(c => c.args.includes('-n'));
    const install = config.calls.findIndex(c => c.args.includes('root'));
    assert.ok(syntax >= 0 && install > syntax);
    assert.ok(config.calls.at(-1).args.includes('/usr/local/bin/node'));
    assert.ok(!config.calls.at(-1).args.includes('root'));
    assert.equal(config.calls[install].options.input, config.calls[syntax].options.input);
  }
});

test('unsupported host, architecture, engine or invalid shell prevents privileged mutation', () => {
  for (const options of [{ platform: 'linux' }, { architecture: 'x86_64; touch /tmp/unsafe' }, { engine: 'windows' }, { failSyntax: true }]) {
    const config = fixture(options);
    if (options.platform) config.platform = options.platform;
    assert.throws(() => setupWsl(config));
    assert.ok(!config.calls.some(c => c.args.includes('root')));
  }
});

test('failed installation or a wrong installed version cannot report successful prerequisites', () => {
  for (const options of [{ failInstall: true }, { installed: 'v22.0.0' }]) {
    const config = fixture(options);
    assert.throws(() => setupWsl(config));
    assert.ok(!config.messages.some(message => message.startsWith('PASS:')));
  }
  assert.throws(() => installationScript('unknown'));
});
