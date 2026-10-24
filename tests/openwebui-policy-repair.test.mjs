import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { repairPlan, repairDeployment, repairProgram } from '../infra/repair-webui-policy.js';
import { root } from '../infra/scripts/config.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'office-ai-webui-policy-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const plan = repairPlan();
  for (const file of plan.files) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), plan.oldFiles[file] ? Buffer.from(plan.oldFiles[file], 'base64') : readFileSync(path.join(root, file)));
  }
  writeFileSync(path.join(directory, '.local-chat-source'), `${plan.oldSignature}\n`);
  for (const file of ['.env', 'secrets/webui_session_key', 'state/ollama/model', 'state/webui/chat']) {
    mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
    writeFileSync(path.join(directory, file), 'synthetic-preservation-marker');
  }
  return { directory, plan };
}

test('authenticated GET policy repair backs up only Nginx policy and preserves deployed model, secrets and chats', t => {
  const { directory, plan } = fixture(t);
  assert.match(repairDeployment(directory, plan), /^PASS:/);
  assert.equal(readFileSync(path.join(directory, 'infra/proxy/nginx.conf.template')).toString('base64'), plan.newFiles['infra/proxy/nginx.conf.template']);
  assert.equal(readFileSync(path.join(directory, 'infra/proxy/nginx.conf.template.before-openwebui-get-policy-fix')).toString('base64'), plan.oldFiles['infra/proxy/nginx.conf.template']);
  assert.equal(readFileSync(path.join(directory, '.local-chat-source'), 'utf8').trim(), plan.newSignature);
  for (const file of ['.env', 'secrets/webui_session_key', 'state/ollama/model', 'state/webui/chat']) assert.equal(readFileSync(path.join(directory, file), 'utf8'), 'synthetic-preservation-marker');
  assert.match(repairDeployment(directory, plan), /^PASS:/);
});

test('route policy repair refuses unknown or drifted deployments without changing the Nginx template', t => {
  const { directory, plan } = fixture(t);
  writeFileSync(path.join(directory, '.local-chat-source'), 'unknown');
  assert.throws(() => repairDeployment(directory, plan), /marker differs/);
  writeFileSync(path.join(directory, '.local-chat-source'), `${plan.oldSignature}\n`);
  writeFileSync(path.join(directory, 'compose.yaml'), 'unexpected');
  assert.throws(() => repairDeployment(directory, plan), /runtime files differ/);
  assert.equal(readFileSync(path.join(directory, 'infra/proxy/nginx.conf.template')).toString('base64'), plan.oldFiles['infra/proxy/nginx.conf.template']);
});

test('standalone WSL repair program carries all helper bindings and updates a verified fixture', t => {
  const { directory, plan } = fixture(t);
  const result = spawnSync(process.execPath, ['--input-type=module'], { input: repairProgram(directory, plan), encoding: 'utf8', timeout: 10_000, windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS: Authenticated Open WebUI GET policy installed/);
  assert.equal(readFileSync(path.join(directory, '.local-chat-source'), 'utf8').trim(), plan.newSignature);
});
