import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { repairPlan, repairDeployment } from '../infra/repair-tmpfs.js';
import { root } from '../infra/scripts/config.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'office-ai-tmpfs-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = repairPlan();
  for (const file of plan.files) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), plan.oldFiles[file] ? Buffer.from(plan.oldFiles[file], 'base64') : readFileSync(path.join(root, file)));
  }
  writeFileSync(path.join(directory, '.local-chat-source'), plan.oldSignature + '\n');
  for (const file of ['.env', 'secrets/session-key', 'state/ollama/model', 'state/webui/chat']) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), 'synthetic-preservation-marker');
  }
  return { directory, plan };
}

test('known ingress repair backs up Compose and policy validator, then preserves deployment state on repeats', t => {
  const { directory, plan } = fixture(t);
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.match(repairDeployment(directory, plan), /^PASS:/);
    for (const file of plan.changed) {
      assert.equal(readFileSync(path.join(directory, file)).toString('base64'), plan.newFiles[file]);
      assert.equal(readFileSync(path.join(directory, `${file}.before-ingress-network-fix`)).toString('base64'), plan.oldFiles[file]);
    }
    assert.equal(readFileSync(path.join(directory, '.local-chat-source'), 'utf8').trim(), plan.newSignature);
    for (const file of ['.env', 'secrets/session-key', 'state/ollama/model', 'state/webui/chat']) assert.equal(readFileSync(path.join(directory, file), 'utf8'), 'synthetic-preservation-marker');
  }
});

test('ingress repair refuses an unrelated marker or changed runtime before modifying Compose', t => {
  const { directory, plan } = fixture(t);
  writeFileSync(path.join(directory, '.local-chat-source'), 'unknown');
  assert.throws(() => repairDeployment(directory, plan), /marker differs/);
  writeFileSync(path.join(directory, '.local-chat-source'), plan.oldSignature);
  writeFileSync(path.join(directory, 'infra/scripts/stack.mjs'), 'unexpected code');
  assert.throws(() => repairDeployment(directory, plan), /runtime files differ/);
  assert.equal(readFileSync(path.join(directory, 'compose.yaml')).toString('base64'), plan.oldFiles['compose.yaml']);
});

test('ingress repair preserves a conflicting backup and refuses to overwrite it', t => {
  const { directory, plan } = fixture(t);
  writeFileSync(path.join(directory, 'compose.yaml.before-ingress-network-fix'), 'different backup');
  assert.throws(() => repairDeployment(directory, plan), /backup differs/);
  assert.equal(readFileSync(path.join(directory, 'compose.yaml')).toString('base64'), plan.oldFiles['compose.yaml']);
  assert.equal(readFileSync(path.join(directory, 'compose.yaml.before-ingress-network-fix'), 'utf8'), 'different backup');
});
