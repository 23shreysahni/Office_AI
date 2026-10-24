import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runWsl } from './scripts/setup-wsl.mjs';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const after = "tmpfs: ['/tmp:size=32m,mode=1777']";
const oldNetworkDeclaration = 'networks: [frontend]';
const newNetworkDeclaration = 'networks: [frontend, ingress]';
const ingressBlock = '  # Docker cannot publish host ports from an internal-only bridge. Keep the\n  # backend path internal; attach only the TLS proxy to a non-NAT ingress bridge.\n  ingress:\n    driver: bridge\n    driver_opts:\n      com.docker.network.bridge.enable_ip_masquerade: "false"\n';

function hashFiles(files, read) {
  const hash = createHash('sha256');
  for (const file of files) { hash.update(file); hash.update('\0'); hash.update(read(file)); }
  return hash.digest('hex');
}

export function repairPlan() {
  const files = ['compose.yaml', 'compose.gpu.yaml', 'infra/images.json', 'infra/node-runtime.json', 'infra/proxy/nginx.conf.template', ...readdirSync(path.join(sourceRoot, 'infra/scripts')).filter(name => /\.(mjs|sh)$/.test(name)).map(name => `infra/scripts/${name}`)].sort();
  const current = readFileSync(path.join(sourceRoot, 'compose.yaml'), 'utf8');
  const currentConfig = readFileSync(path.join(sourceRoot, 'infra/scripts/config.mjs'), 'utf8');
  const oldPolicy = "  requireThat(doc.networks.ingress?.driver === 'bridge' && doc.networks.ingress.internal !== true && doc.networks.ingress.driver_opts?.['com.docker.network.bridge.enable_ip_masquerade'] === 'false', 'Published TLS proxy requires the restricted non-NAT ingress bridge');\n";
  const oldSegmentation = "  requireThat(networks('proxy') === 'frontend' && networks('bootstrap') === 'frontend' && networks('webui') === 'frontend,inference' && networks('ollama') === 'inference', 'Invalid network segmentation');";
  const newSegmentation = "  requireThat(networks('proxy') === 'frontend,ingress' && networks('bootstrap') === 'frontend,ingress' && networks('webui') === 'frontend,inference' && networks('ollama') === 'inference', 'Invalid network segmentation');";
  const declarations = current.split(newNetworkDeclaration).length - 1;
  if (current.split(after).length !== 2 || declarations !== 1 || current.split(ingressBlock).length !== 2 || currentConfig.split(oldPolicy).length !== 2 || currentConfig.split(newSegmentation).length !== 2) throw new Error('Expected published-ingress source is unavailable.');
  const previous = current.replace(newNetworkDeclaration, oldNetworkDeclaration).replace(ingressBlock, '');
  const previousConfig = currentConfig.replace(oldPolicy, '').replace(newSegmentation, oldSegmentation);
  const read = file => readFileSync(path.join(sourceRoot, file));
  const oldFiles = { 'compose.yaml': Buffer.from(previous).toString('base64'), 'infra/scripts/config.mjs': Buffer.from(previousConfig).toString('base64') };
  const newFiles = Object.fromEntries(Object.keys(oldFiles).map(file => [file, read(file).toString('base64')]));
  const changed = Object.keys(oldFiles).sort();
  const common = files.filter(file => !changed.includes(file));
  const commonSignature = hashFiles(common, read);
  return { files, common, commonSignature, changed, oldFiles, newFiles,
    oldSignature: hashFiles(files, file => oldFiles[file] ? Buffer.from(oldFiles[file], 'base64') : read(file)),
    newSignature: hashFiles(files, read) };
}

// Self-contained so the same guarded operation is tested locally and sent to
// the pinned Ubuntu Node runtime. No shell or deployment secrets are involved.
export function repairDeployment(directory, plan) {
  const marker = path.join(directory, '.local-chat-source');
  const stored = readFileSync(marker, 'utf8').trim();
  if (![plan.oldSignature, plan.newSignature].includes(stored)) throw new Error('Deployment source marker differs; no files changed.');
  const commonSignature = hashFiles(plan.common, file => readFileSync(path.join(directory, file)));
  if (commonSignature !== plan.commonSignature) throw new Error('Deployment runtime files differ; no files changed.');
  for (const file of plan.changed) {
    const target = path.join(directory, file), current = readFileSync(target).toString('base64');
    if (current !== plan.oldFiles[file] && current !== plan.newFiles[file]) throw new Error('An updated runtime file contains unexpected data; no files changed.');
    const backup = `${target}.before-ingress-network-fix`;
    if (existsSync(backup) && !readFileSync(backup).equals(Buffer.from(plan.oldFiles[file], 'base64'))) throw new Error('Existing runtime backup differs; no files changed.');
    if (current === plan.newFiles[file] && !existsSync(backup)) throw new Error('Updated file has no verified original backup; no files changed.');
  }
  for (const file of plan.changed) {
    const target = path.join(directory, file), oldBytes = Buffer.from(plan.oldFiles[file], 'base64');
    const backup = `${target}.before-ingress-network-fix`, temporary = `${target}.ingress-network-fixed`;
    if (!existsSync(backup)) writeFileSync(backup, oldBytes, { flag: 'wx', mode: 0o600 });
    if (readFileSync(target).toString('base64') !== plan.newFiles[file]) {
      const newBytes = Buffer.from(plan.newFiles[file], 'base64');
      if (existsSync(temporary)) { if (!readFileSync(temporary).equals(newBytes)) throw new Error('Interrupted update file differs; no file overwritten.'); }
      else writeFileSync(temporary, newBytes, { flag: 'wx', mode: 0o600 });
      renameSync(temporary, target);
    }
  }
  const nextMarker = `${marker}.ingress-network-fixed`;
  if (existsSync(nextMarker)) { if (readFileSync(nextMarker, 'utf8').trim() !== plan.newSignature) throw new Error('Interrupted source marker differs; marker not overwritten.'); }
  else writeFileSync(nextMarker, `${plan.newSignature}\n`, { flag: 'wx', mode: 0o600 });
  renameSync(nextMarker, marker);
  return 'PASS: Restricted ingress bridge update installed; original Compose and validator backed up. Model, secrets and chat state preserved.';
}

function main() {
  if (process.platform !== 'win32' || process.argv.length !== 2) throw new Error('Run this recovery command from normal Windows PowerShell without arguments.');
  const plan = repairPlan();
  const input = `import { createHash } from 'node:crypto';\nimport { readFileSync,writeFileSync,renameSync,existsSync } from 'node:fs';\nimport path from 'node:path';\n${hashFiles.toString()}\n${repairDeployment.toString()}\ntry { console.log(repairDeployment('/srv/office-ai-local', ${JSON.stringify(plan)})); } catch(error) { console.error(error.message); process.exitCode=1; }\n`;
  runWsl(['-d', 'Ubuntu', '-u', 'root', '--exec', '/usr/local/bin/node', '--input-type=module'], { input, stream: true });
  console.log('Resuming the normal chat launcher. Completed downloads will be reused.');
  const result = spawnSync(process.execPath, [path.join(sourceRoot, 'infra/scripts/start-chat.mjs')], { stdio: 'inherit', timeout: 7_200_000 });
  if (result.error || result.status !== 0) throw new Error('Chat launcher did not finish; share the preceding error output.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
