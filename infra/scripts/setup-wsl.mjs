import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const runtime = JSON.parse(readFileSync(new URL('../node-runtime.json', import.meta.url), 'utf8'));

export function installationScript(architecture) {
  const arch = { x86_64: 'x64', aarch64: 'arm64' }[architecture];
  if (!arch || !/^v24\.\d+\.\d+$/.test(runtime.version) || !/^[a-f0-9]{64}$/.test(runtime.archives[arch])) throw new Error('Unsupported architecture or invalid Node runtime pin');
  const archive = `node-${runtime.version}-linux-${arch}`;
  return `#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run the installer through the Windows setup launcher.' >&2; exit 1; }
. /etc/os-release
[[ "$ID" == ubuntu ]] || { echo 'This installer requires the selected Ubuntu distribution.' >&2; exit 1; }
export PATH="/usr/local/bin:$PATH"
version='${runtime.version}'
destination='/opt/office-ai/${archive}'
existing=false
if command -v node >/dev/null 2>&1; then
    [[ "$(node --version)" == "$version" ]] || { echo 'Another Node version is installed; it was not changed. Review the runtime before proceeding.' >&2; exit 1; }
    existing=true
else
    [[ ! -e "$destination" && ! -L "$destination" ]] || { echo 'Runtime destination already exists; inspect it before retrying.' >&2; exit 1; }
    for tool in node npm npx; do
        [[ ! -e "/usr/local/bin/$tool" && ! -L "/usr/local/bin/$tool" ]] || { echo 'An existing runtime launcher will not be overwritten.' >&2; exit 1; }
    done
fi
echo 'Installing Ubuntu prerequisites; no Windows settings or Docker daemon will be changed.'
missing_tools=false
for tool in curl xz openssl gpg tar sha256sum realpath; do command -v "$tool" >/dev/null 2>&1 || missing_tools=true; done
[[ -r /etc/ssl/certs/ca-certificates.crt ]] || missing_tools=true
if [[ "$missing_tools" == true ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y --no-install-recommends ca-certificates curl xz-utils openssl gnupg tar coreutils
fi
if [[ "$existing" == false ]]; then
    install -d -m 700 /var/cache/office-ai
    install -d -m 755 /opt/office-ai
    stage=$(mktemp -d /var/cache/office-ai/node-stage.XXXXXXXX)
    cleanup() {
        [[ "$stage" == /var/cache/office-ai/node-stage.* && -d "$stage" ]] && rm -rf -- "$stage"
    }
    trap cleanup EXIT
    curl --fail --show-error --silent --location --proto '=https' --tlsv1.2 --connect-timeout 15 --max-time 300 \\
        'https://nodejs.org/download/release/${runtime.version}/${archive}.tar.xz' --output "$stage/node.tar.xz"
    printf '%s  %s\\n' '${runtime.archives[arch]}' "$stage/node.tar.xz" | sha256sum --check --status
    tar --extract --xz --no-same-owner --file "$stage/node.tar.xz" --directory "$stage"
    mv -T -- "$stage/${archive}" "$destination"
    for tool in node npm npx; do ln -s -- "$destination/bin/$tool" "/usr/local/bin/$tool"; done
fi
node --version
npm --version
echo 'Ubuntu prerequisites installed. Chat services are not started by this command.'
`;
}

export function runWsl(args, { input, stream = false, timeout = 900_000 } = {}) {
  const result = spawnSync('wsl.exe', args, {
    input, encoding: 'utf8', windowsHide: true, timeout,
    maxBuffer: 1024 * 1024, stdio: stream ? ['pipe', 'inherit', 'inherit'] : ['pipe', 'pipe', 'pipe']
  });
  if (result.error || result.status !== 0) throw new Error('Ubuntu setup command failed. Run this launcher from your normal Windows PowerShell with Ubuntu and Docker Desktop integration available.');
  return result.stdout?.trim() || '';
}

export function setupWsl({ invoke = runWsl, platform = process.platform, log = console.log } = {}) {
  if (platform !== 'win32') throw new Error('Run this launcher using Windows Node.js from PowerShell.');
  log('Checking Docker inside Ubuntu…');
  if (invoke(['-d', 'Ubuntu', '--exec', 'docker', 'info', '--format', '{{.OSType}}']) !== 'linux') throw new Error('Ubuntu must be connected to the Docker Desktop Linux engine.');
  const arch = invoke(['-d', 'Ubuntu', '--exec', 'uname', '-m']);
  const script = installationScript(arch);
  // Syntax is checked without privileges before executing the fixed installer.
  invoke(['-d', 'Ubuntu', '--exec', 'bash', '-n'], { input: script });
  log(`Installing Node.js ${runtime.version} and Ubuntu tools. This can take several minutes.`);
  invoke(['-d', 'Ubuntu', '-u', 'root', '--exec', 'bash', '-s'], { input: script, stream: true });
  const version = invoke(['-d', 'Ubuntu', '--exec', '/usr/local/bin/node', '--version']);
  if (version !== runtime.version) throw new Error('The ordinary Ubuntu user could not verify the pinned Node runtime.');
  log(`PASS: Ubuntu Node.js ${version} is available. Next step: configure and provision the local chat stack.`);
  return { version, chatReady: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw new Error('Usage: node infra/scripts/setup-wsl.mjs');
    setupWsl();
  } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1; }
}
