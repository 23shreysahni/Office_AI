import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pins } from './config.mjs';

export function computeMode(configured, flags = []) {
  if (flags.some(flag => !['--gpu', '--cpu', '--auto'].includes(flag)) || flags.length > 1) throw new Error('Use at most one of --gpu, --cpu or --auto');
  const explicit = { '--gpu': 'nvidia', '--cpu': 'cpu', '--auto': 'auto' }[flags[0]];
  if (configured !== undefined && !['auto', 'cpu', 'nvidia'].includes(configured)) throw new Error('Invalid compute mode');
  if (explicit && configured && configured !== 'auto' && explicit !== configured) throw new Error('Compute flag conflicts with COMPUTE_MODE');
  return explicit || configured || 'auto';
}

function execute(args) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024, windowsHide: true });
}

export function selectCompute(mode, { run = execute } = {}) {
  if (!['auto', 'cpu', 'nvidia'].includes(mode)) throw new Error('Invalid compute mode');
  if (mode === 'cpu') return { mode: 'cpu', reason: 'CPU explicitly selected' };
  const info = run(['info', '--format', '{{.OSType}}']);
  if (info.error || info.status !== 0 || info.stdout?.trim() !== 'linux') throw new Error('Compute detection requires a working local Linux Docker engine');
  const image = run(['image', 'inspect', pins.ollama, '--format', '{{.Id}}']);
  if (image.error || image.status !== 0) throw new Error('Pinned Ollama image unavailable locally; provision images in the controlled download window first');
  const result = run(['run', '--rm', '--pull', 'never', '--network', 'none', '--read-only', '--cap-drop', 'ALL',
    '--security-opt', 'no-new-privileges:true', '--gpus', 'all', '--entrypoint', 'nvidia-smi', pins.ollama,
    '--query-gpu=compute_cap', '--format=csv,noheader']);
  if (result.error) throw new Error('GPU probe failed or timed out; check Docker and the driver before restarting');
  if (result.status === 0) {
    const capabilities = result.stdout.trim().split(/\r?\n/).map(value => value.trim());
    if (!capabilities.length || capabilities.some(value => !/^\d+\.\d+$/.test(value))) throw new Error('GPU probe returned invalid capability data');
    // The override selects the first GPU; do not validate a different device.
    if (Number(capabilities[0]) >= 5) return { mode: 'nvidia', reason: 'Container NVIDIA capability verified' };
    if (mode === 'nvidia') throw new Error('The first NVIDIA GPU is unsupported by the reviewed Ollama CUDA path');
    return { mode: 'cpu', reason: 'First GPU has unsupported CUDA capability' };
  }
  const failure = `${result.stderr || ''}\n${result.stdout || ''}`;
  // Never treat permission/daemon errors or arbitrary runtime errors as absence.
  if (/permission denied|access is denied|cannot connect|connection refused/i.test(failure)) throw new Error('GPU probe infrastructure or permission failure');
  const absent = /could not select device driver.*capabilities.*gpu|no (?:cuda-capable device|devices were found)|driver not loaded|driver version is insufficient|unsatisfied condition: cuda|not at least one TCC device|no adapters were found/i.test(failure);
  if (mode === 'auto' && absent) return { mode: 'cpu', reason: 'NVIDIA container support unavailable or unsupported' };
  throw new Error('NVIDIA container probe failed; inspect local driver/runtime configuration (upstream output withheld)');
}

export function saveCompute(directory, selection) {
  if (!['cpu', 'nvidia'].includes(selection.mode)) throw new Error('Invalid saved compute selection');
  const file = path.join(directory, 'compute.json');
  writeFileSync(`${file}.next`, JSON.stringify({ ...selection, checkedAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
  renameSync(`${file}.next`, file);
}

export function savedCompute(directory, requested) {
  const file = path.join(directory, 'compute.json');
  if (!existsSync(file)) return requested === 'nvidia';
  let result;
  try { result = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('Invalid recorded compute selection; review state/compute.json'); }
  if (!['cpu', 'nvidia'].includes(result.mode)) throw new Error('Invalid recorded compute selection');
  if (requested !== 'auto' && requested !== result.mode) throw new Error('Requested compute differs from running selection; stop with the recorded mode before changing it');
  return result.mode === 'nvidia';
}

// Runs only against the private inference service, via the pinned WebUI image.
// Emit metadata only; never model output, prompts, credentials or raw errors.
export function inferenceProbeCode(model) {
  return `import json,urllib.request
body=json.dumps({'model':${JSON.stringify(model)},'prompt':'Synthetic readiness test: reply with a greeting.','stream':False,'think':False,'options':{'num_ctx':4096,'num_predict':16,'temperature':0}}).encode()
req=urllib.request.Request('http://ollama:11434/api/generate',data=body,headers={'Content-Type':'application/json'})
raw=urllib.request.urlopen(req,timeout=240).read(1000001)
assert len(raw)<=1000000
data=json.loads(raw)
assert data.get('done') is True and data.get('response','').strip()
running=json.load(urllib.request.urlopen('http://ollama:11434/api/ps',timeout=10))
models=[m for m in running.get('models',[]) if m.get('name')==${JSON.stringify(model)} or m.get('model')==${JSON.stringify(model)}]
assert len(models)==1
print(json.dumps({'generation':'passed','gpu':models[0].get('size_vram',0)>0,'outputTokens':data.get('eval_count'),'durationNs':data.get('total_duration')}))`;
}

export function validateInference(evidence, gpu) {
  if (evidence?.generation !== 'passed' || typeof evidence.gpu !== 'boolean') throw new Error('Invalid inference verification evidence');
  if (evidence.gpu !== gpu) throw new Error(gpu ? 'Model loaded on CPU despite NVIDIA selection; LAN entry remains stopped' : 'Unexpected GPU residency in CPU mode');
  return evidence;
}

export function checkMemoryBudget(cfg, bytes) {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw new Error('Cannot identify Docker memory capacity');
  const required = (Number(cfg.OLLAMA_MEMORY.slice(0, -1)) + Number(cfg.WEBUI_MEMORY.slice(0, -1))) * 1024 ** 3 + 512 * 1024 ** 2;
  if (required > bytes) throw new Error('Docker memory is below the configured Ollama + WebUI limits and 512 MiB proxy/headroom allowance. Review host resources and measured model capacity; do not increase limits beyond available RAM.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = computeMode(undefined, process.argv.slice(2));
    if (process.env.DOCKER_HOST || process.env.DOCKER_CONTEXT) throw new Error('Remove Docker endpoint/context overrides before probing');
    const context = execute(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']);
    if (context.error || context.status !== 0 || !/^(unix:\/\/|npipe:\/\/)/.test(JSON.parse(context.stdout))) throw new Error('Compute probe requires a reviewed local Docker socket');
    console.log(JSON.stringify(selectCompute(mode), null, 2));
  } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
