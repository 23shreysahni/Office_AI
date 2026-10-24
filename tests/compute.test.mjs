import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { computeMode, selectCompute, saveCompute, savedCompute, validateInference, inferenceProbeCode, checkMemoryBudget } from '../infra/scripts/compute.mjs';
import { parseEnv } from '../infra/scripts/config.mjs';

const ok = stdout => ({ status: 0, stdout, stderr: '' });
function probe(result) {
  const calls = [];
  return { calls, run(args) { calls.push(args); return calls.length === 1 ? ok('linux') : calls.length === 2 ? ok('sha256:local-image') : result; } };
}
test('compute configuration validates modes and conflicting flags', () => {
  assert.equal(computeMode(), 'auto');
  assert.equal(computeMode('auto', ['--gpu']), 'nvidia');
  assert.equal(computeMode(undefined, ['--cpu']), 'cpu');
  assert.equal(parseEnv('COMPUTE_MODE=auto').COMPUTE_MODE, 'auto');
  for (const [mode, flags] of [['cpu', ['--gpu']], ['nvidia', ['--auto']], ['bad', []], [undefined, ['--cpu', '--gpu']], [undefined, ['--unknown']]]) assert.throws(() => computeMode(mode, flags));
});
test('CPU selection needs no GPU probe', () => {
  assert.equal(selectCompute('cpu', { run() { throw new Error('Unexpected probe'); } }).mode, 'cpu');
});
test('memory budget rejects the observed undersized Docker allocation and unknown capacity', () => {
  const cfg = { OLLAMA_MEMORY: '12g', WEBUI_MEMORY: '4g' };
  assert.throws(() => checkMemoryBudget(cfg, 8219881472));
  assert.throws(() => checkMemoryBudget(cfg, NaN));
  assert.doesNotThrow(() => checkMemoryBudget(cfg, 17 * 1024 ** 3));
});
test('supported NVIDIA container selects GPU without downloads, networking or mounts', () => {
  const fixture = probe(ok('8.6\n'));
  assert.equal(selectCompute('auto', fixture).mode, 'nvidia');
  const args = fixture.calls[2];
  assert.equal(args[args.indexOf('--pull') + 1], 'never');
  assert.equal(args[args.indexOf('--network') + 1], 'none');
  assert.ok(args.includes('--read-only'));
  assert.ok(!args.includes('--mount') && !args.includes('-p'));
});
test('known GPU absence falls back only in auto; unsupported first device is not skipped', () => {
  const absent = { status: 1, stderr: 'could not select device driver "" with capabilities: [[gpu]]' };
  assert.equal(selectCompute('auto', probe(absent)).mode, 'cpu');
  assert.throws(() => selectCompute('nvidia', probe(absent)));
  assert.equal(selectCompute('auto', probe(ok('3.5\n8.6'))).mode, 'cpu');
  assert.throws(() => selectCompute('nvidia', probe(ok('3.5'))));
});
test('infrastructure failures, malformed data and timeouts never hide as CPU fallback', () => {
  for (const result of [ok(''), ok('N/A'), { status: 1, stderr: 'permission denied; no devices were found' }, { status: 1, stderr: 'unexpected runtime error' }, { error: new Error('timeout') }]) {
    assert.throws(() => selectCompute('auto', probe(result)));
  }
  assert.throws(() => selectCompute('auto', { run: () => ({ status: 1 }) }));
  assert.throws(() => selectCompute('auto', { run: args => args[0] === 'info' ? ok('linux') : ({ status: 1 }) }));
});
test('saved selection survives lifecycle operations and rejects tampering/conflicts', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'office-compute-'));
  try {
    assert.equal(savedCompute(directory, 'auto'), false);
    saveCompute(directory, { mode: 'nvidia', reason: 'synthetic test' });
    assert.equal(savedCompute(directory, 'auto'), true);
    assert.throws(() => savedCompute(directory, 'cpu'));
    assert.ok(JSON.parse(readFileSync(path.join(directory, 'compute.json'))).checkedAt);
    writeFileSync(path.join(directory, 'compute.json'), '{invalid');
    assert.throws(() => savedCompute(directory, 'auto'));
    writeFileSync(path.join(directory, 'compute.json'), '{"mode":"arbitrary"}');
    assert.throws(() => savedCompute(directory, 'auto'));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('GPU acceptance requires actual GPU residency; CPU mode cannot misreport GPU readiness', () => {
  assert.doesNotThrow(() => validateInference({ generation: 'passed', gpu: true }, true));
  assert.doesNotThrow(() => validateInference({ generation: 'passed', gpu: false }, false));
  for (const evidence of [{}, { generation: 'passed', gpu: false }, { generation: 'failed', gpu: true }]) assert.throws(() => validateInference(evidence, true));
  assert.throws(() => validateInference({ generation: 'passed', gpu: true }, false));
  const code = inferenceProbeCode('qwen3.5:9b');
  assert.match(code, /http:\/\/ollama:11434\/api\/generate/);
  assert.match(code, /\/api\/ps/);
  assert.match(code, /'num_ctx':4096/);
});
