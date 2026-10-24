import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lanConfiguration, writeLanConfiguration, prepareLan, lanStagingScript } from '../infra/scripts/prepare-lan.mjs';

const args = ['--hostname', 'office-ai.internal', '--ip', '192.168.50.10', '--cidrs', '192.168.50.0/24'];
test('LAN preparation validates private addresses and never approves its own firewall review', () => {
  const cfg = lanConfiguration(args);
  assert.equal(cfg.MODEL_NAME, 'qwen3.5:9b');
  assert.equal(cfg.COMPUTE_MODE, 'auto');
  assert.equal(cfg.NETWORK_POLICY_REVIEWED, 'false');
  for (const bad of [[], [...args, '--reviewed', 'true'], [...args, '--compute', 'bad'], [...args, '--ip', '10.0.0.1'], ['--hostname', 'localhost', '--ip', '0.0.0.0', '--cidrs', '0.0.0.0/0']]) assert.throws(() => lanConfiguration(bad));
});
test('LAN configuration refuses migration drift and preserves recorded digest and review state', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'office-lan-'));
  try {
    const cfg = lanConfiguration(args);
    assert.equal(writeLanConfiguration(directory, cfg), true);
    const file = path.join(directory, '.env');
    writeFileSync(file, readFileSync(file, 'utf8').replace('MODEL_DIGEST=\n', `MODEL_DIGEST=sha256:${'a'.repeat(64)}\n`).replace('NETWORK_POLICY_REVIEWED=false', 'NETWORK_POLICY_REVIEWED=true'));
    const previous = readFileSync(file, 'utf8');
    assert.equal(writeLanConfiguration(directory, cfg), false);
    assert.equal(readFileSync(file, 'utf8'), previous);
    assert.throws(() => writeLanConfiguration(directory, { ...cfg, LAN_BIND_IP: '192.168.50.11' }));
    assert.equal(readFileSync(file, 'utf8'), previous);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('Windows preparation checks shell syntax before staging and never exposes a listener or copies secrets', () => {
  const calls = [];
  prepareLan(args, { platform: 'win32', log() {}, invoke(command, options) { calls.push({ command, options }); return command.includes('wslpath') ? '/mnt/d/synthetic-source' : ''; } });
  assert.ok(calls[1].command.includes('-n'));
  assert.ok(calls[2].command.includes('root'));
  assert.ok(calls[3].command.includes('/srv/office-ai/infra/scripts/prepare-lan.mjs'));
  assert.ok(!calls.some(call => call.command.includes('start')));
  assert.match(lanStagingScript, /--exclude='\.\/secrets'/);
  assert.match(lanStagingScript, /--exclude='\.\/state'/);
  assert.match(lanStagingScript, /! -L/);
  assert.throws(() => prepareLan(args, { platform: 'win32', invoke: () => 'bad-source' }));
});
