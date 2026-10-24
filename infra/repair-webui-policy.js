import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runWsl } from './scripts/setup-wsl.mjs';

const sourceRoot = fileURLToPath(new URL('../', import.meta.url));
const additions = [
  '        ~^GET:/api/v1/ 1;\n'
];
const backupSuffix = '.before-openwebui-get-policy-fix';
const temporarySuffix = '.openwebui-get-policy-fixed';

function hashFiles(files, read) {
  const hash = createHash('sha256');
  for (const file of files) { hash.update(file); hash.update('\0'); hash.update(read(file)); }
  return hash.digest('hex');
}

export function repairPlan() {
  const files = ['compose.yaml', 'compose.gpu.yaml', 'infra/images.json', 'infra/node-runtime.json', 'infra/proxy/nginx.conf.template', ...readdirSync(path.join(sourceRoot, 'infra/scripts')).filter(name => /\.(mjs|sh)$/.test(name)).map(name => `infra/scripts/${name}`)].sort();
  const template = readFileSync(path.join(sourceRoot, 'infra/proxy/nginx.conf.template'), 'utf8');
  let previousTemplate = template;
  for (const line of additions) {
    if (previousTemplate.split(line).length !== 2) throw new Error('Expected Open WebUI route policy is unavailable.');
    previousTemplate = previousTemplate.replace(line, '');
  }
  const changed = ['infra/proxy/nginx.conf.template'];
  const common = files.filter(file => !changed.includes(file));
  const read = file => readFileSync(path.join(sourceRoot, file));
  const oldFiles = { [changed[0]]: Buffer.from(previousTemplate).toString('base64') };
  const newFiles = { [changed[0]]: read(changed[0]).toString('base64') };
  const commonSignature = hashFiles(common, read);
  return { files, common, commonSignature, changed, oldFiles, newFiles,
    oldSignature: hashFiles(files, file => oldFiles[file] ? Buffer.from(oldFiles[file], 'base64') : read(file)),
    newSignature: hashFiles(files, read) };
}

export function repairDeployment(directory, plan) {
  const marker = path.join(directory, '.local-chat-source');
  const stored = readFileSync(marker, 'utf8').trim();
  if (![plan.oldSignature, plan.newSignature].includes(stored)) throw new Error('Deployment source marker differs; no files changed.');
  if (hashFiles(plan.common, file => readFileSync(path.join(directory, file))) !== plan.commonSignature) throw new Error('Deployment runtime files differ; no files changed.');
  for (const file of plan.changed) {
    const target = path.join(directory, file), current = readFileSync(target).toString('base64');
    if (current !== plan.oldFiles[file] && current !== plan.newFiles[file]) throw new Error('An updated runtime file contains unexpected data; no files changed.');
    const backup = `${target}${backupSuffix}`;
    if (existsSync(backup) && !readFileSync(backup).equals(Buffer.from(plan.oldFiles[file], 'base64'))) throw new Error('Existing runtime backup differs; no files changed.');
    if (current === plan.newFiles[file] && !existsSync(backup)) throw new Error('Updated file has no verified original backup; no files changed.');
  }
  for (const file of plan.changed) {
    const target = path.join(directory, file), oldBytes = Buffer.from(plan.oldFiles[file], 'base64');
    const backup = `${target}${backupSuffix}`, temporary = `${target}${temporarySuffix}`;
    if (!existsSync(backup)) writeFileSync(backup, oldBytes, { flag: 'wx', mode: 0o600 });
    if (readFileSync(target).toString('base64') !== plan.newFiles[file]) {
      const newBytes = Buffer.from(plan.newFiles[file], 'base64');
      if (existsSync(temporary)) { if (!readFileSync(temporary).equals(newBytes)) throw new Error('Interrupted update file differs; no file overwritten.'); }
      else writeFileSync(temporary, newBytes, { flag: 'wx', mode: 0o600 });
      renameSync(temporary, target);
    }
  }
  const nextMarker = `${marker}.openwebui-get-policy-fixed`;
  if (existsSync(nextMarker)) { if (readFileSync(nextMarker, 'utf8').trim() !== plan.newSignature) throw new Error('Interrupted source marker differs; marker not overwritten.'); }
  else writeFileSync(nextMarker, `${plan.newSignature}\n`, { flag: 'wx', mode: 0o600 });
  renameSync(nextMarker, marker);
  return 'PASS: Authenticated Open WebUI GET policy installed; prior Nginx policy backed up. Model, secrets and chat state preserved.';
}

export function repairProgram(directory, plan) {
  return `import { createHash } from 'node:crypto';\nimport { readFileSync,writeFileSync,renameSync,existsSync } from 'node:fs';\nimport path from 'node:path';\nconst backupSuffix = ${JSON.stringify(backupSuffix)};\nconst temporarySuffix = ${JSON.stringify(temporarySuffix)};\n${hashFiles.toString()}\n${repairDeployment.toString()}\ntry { console.log(repairDeployment(${JSON.stringify(directory)}, ${JSON.stringify(plan)})); } catch(error) { console.error(error.message); process.exitCode=1; }\n`;
}

function main() {
  if (process.platform !== 'win32' || process.argv.length !== 2) throw new Error('Run this recovery command from normal Windows PowerShell without arguments.');
  const plan = repairPlan();
  const input = repairProgram('/srv/office-ai-local', plan);
  runWsl(['-d', 'Ubuntu', '-u', 'root', '--exec', '/usr/local/bin/node', '--input-type=module'], { input, stream: true });
  console.log('Restarting the local stack to apply the reviewed Nginx route policy. Existing account, model and chat data are retained.');
  const result = spawnSync(process.execPath, [path.join(sourceRoot, 'infra/scripts/start-chat.mjs')], { stdio: 'inherit', timeout: 7_200_000 });
  if (result.error || result.status !== 0) throw new Error('Chat launcher did not finish; share the preceding error output.');
  runWsl(['-d', 'Ubuntu', '--exec', 'docker', 'restart', 'office-ai-local-bootstrap-1'], { stream: true });
  console.log('PASS: Bootstrap proxy restarted and loaded the updated authenticated GET policy. Refresh https://localhost:8443.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
