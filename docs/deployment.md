# Phase 1 deployment

Status: Implementation provided; target-host acceptance pending. Use synthetic data only. [Foundation acceptance cases](../specs/01-foundation.md) remain the release gate. Do not run later-phase services.

## Prerequisites and limits

The separate local review interface adds locked npm dependencies to the root test suite. During the approved package-download window populate an archived recovery cache with `npm ci --ignore-scripts --cache /mnt/office-ai-recovery/npm-cache`. Use that same `--cache` path with `--offline` in the setup/test/recovery commands below. Preserve the cache with the independently verified recovery artefacts; `artifacts/` is excluded from application snapshots and is not a recovery-cache guarantee. No package downloads are permitted during offline production testing.

Initial deployment is Windows-first: follow [Windows setup](windows.md) to prepare Ubuntu in WSL 2 with Docker Desktop's Linux backend, then execute the commands below inside that Ubuntu shell. Native Ubuntu Server uses the same commands. Direct PowerShell is suitable for local tests and the smoke client, not for the Linux deployment/backup commands. Run `sudo node infra/scripts/stack.mjs doctor` before setup; it needs no `.env` or secrets and checks the local Linux engine and required recovery tools without changing the host.

Use the reviewed Ubuntu LTS host with Docker Engine/Compose, Node.js 24 LTS, npm, OpenSSL, Bash, GNU tar, GnuPG and sufficient measured storage/RAM. Record [discovery](discovery.md), support/licence/advisory reviews, network rules and RPO/RTO in the restricted inventory. The provided memory/CPU values are candidates, not a claim that a 9B model will fit. CPU is the baseline; `--gpu` adds one NVIDIA device only after driver/toolkit verification. Retain Open WebUI branding and comply with its upstream licence.

Only root-owned deployment/state directories in the Linux filesystem are currently supported because these upstream images run as root. This also applies inside WSL; NTFS-mounted deployment state is not supported. Containers drop capabilities and have no Docker socket. Non-root image builds are a future hardening task; root ownership, encrypted host disks and restricted operator access remain required. Secret files are plain host files protected by permissions and disk encryption, not an encrypted secrets service.

Place this source under `/srv/office-ai`. Use an administrative shell for the following commands. Do not paste secrets into chat, command arguments, Git or `.env`. No script changes host firewall rules automatically.

## 1. Configure and validate

```sh
cd /srv/office-ai
sudo cp .env.example .env
sudo chmod 600 .env
sudoedit .env
sudo node infra/scripts/stack.mjs init
npm ci --ignore-scripts --offline
npm test
sudo node infra/scripts/stack.mjs check
```

Set the real private `LAN_BIND_IP`, private DNS hostname, space-separated canonical `LAN_ALLOWED_CIDRS`, project name and reviewed resource limits. The CIDRs must include the server's bind address. Keep `MODEL_DIGEST` empty and `NETWORK_POLICY_REVIEWED=false` during isolated provisioning; LAN start refuses these values. Fallback models require a documented spec/config review; the baseline preflight allows only `qwen3.5:9b`.

`check` uses the real Compose parser and examines resolved policy without starting containers. It is also usable on Windows (`npm.cmd test`), where a Linux deployment is not attempted. The wrapper applies values read from `.env` explicitly so ambient Compose variables cannot silently replace this file's settings. Remote Docker contexts are unsupported: verify `docker context show` and use only the reviewed local daemon.

Before starting either proxy, install a company-internal-CA certificate and matching private key at `secrets/tls/server.crt` and `secrets/tls/server.key`, with the root certificate at `secrets/tls/root.crt`. The certificate must include the configured DNS hostname as a SAN. Protect the key with mode 0600; provide the full chain in `server.crt` if intermediates are used. Nginx mounts only the leaf certificate/chain and leaf private key.

If there is no company CA, create an isolated pilot CA with the installed OpenSSL tool:

```sh
sudo node infra/scripts/certificates.mjs
```

This creates a 3,072-bit RSA pilot root and a one-year server certificate in the ignored `secrets/tls` directory, refusing to overwrite an existing directory. Protect the CA key with host disk encryption and restricted access; it is never mounted into a container. `bootstrap` and `start` reject a mismatched hostname/key or a certificate with less than seven days remaining. Nginx does not issue or renew certificates automatically; see the renewal instructions in the runbook.

## 2. Provision artefacts during the approved internet window

```sh
sudo node infra/scripts/stack.mjs pull-images
sudo node infra/scripts/stack.mjs pull-model
```

Images are fixed by version and complete registry manifest digest in Compose and [infra/images.json](../infra/images.json). No floating image is used. Model provisioning runs a temporary Ollama container on the Docker bridge with only the model directory mounted; no UI data or published ports. It deliberately needs approved download egress. Stop the stack before provisioning. After completion, there is no internet-connected provisioner left running.

Inspect/review downloaded image licences/advisories and save image archives for offline recovery (use the exact references in `infra/images.json`):

```sh
sudo install -d -m 700 /mnt/office-ai-recovery/images
node --input-type=module -e 'import fs from "node:fs"; const p=JSON.parse(fs.readFileSync("infra/images.json")); for(const k of ["nginx","webui","ollama"]) console.log(p[k]);'
```

For each printed reference, run `sudo docker image save --output /mnt/office-ai-recovery/images/COMPONENT.tar EXACT_REFERENCE`, then `sha256sum` the archive and store the checksum separately. Record OS/architecture, driver/toolkit, image IDs/repo digests and licence/advisory review. An image manifest digest is not evidence of model/runtime compatibility.

## 3. Bootstrap the administrator privately

```sh
sudo node infra/scripts/stack.mjs bootstrap
sudo docker compose --profile bootstrap ps
sudo install -m 644 secrets/tls/root.crt /tmp/office-ai-root.crt
```

Bootstrap publishes **only `127.0.0.1:8443`**. It stops the LAN proxy first. The UI and model ports are never published. Copy only `/tmp/office-ai-root.crt` to managed clients over your approved channel and verify its fingerprint with the administrator. Never copy the CA private key or the session secret. Distribute/trust the root through your managed OS/browser trust store; do not bypass TLS warnings. For Node smoke checks set `NODE_EXTRA_CA_CERTS` before launching Node.

From a managed workstation, an administrator may use `ssh -N -L 8443:127.0.0.1:8443 ADMIN@SERVER` and temporarily resolve the configured hostname to `127.0.0.1` on that workstation. Open `https://HOSTNAME:8443`, create the first **named administrator**, and sign in. After bootstrap, restore normal internal DNS resolution. The first-account exception is an upstream behaviour even with `ENABLE_SIGNUP=false`; only the isolated bootstrap path permits signup. The LAN proxy always denies that route.

Use a new state directory for this pilot, not a database imported from another Open WebUI installation. The proxy permits authenticated `GET` requests under `/api/v1/` so the pinned Open WebUI shell can load its model, profile, folder and navigation data; it retains explicit denials for chat-sharing routes and only permits specific state-changing methods for chat, sign-in, timezone and user settings. Configuration changes, function/tool installation, uploads and model mutation remain denied. Browser chat compatibility must pass F06 on the pinned image before acceptance.

Inspect model identity and provisioning status:

```sh
sudo node infra/scripts/stack.mjs inspect
```

The command prints only public auth flags and model names/full digests. Record the `qwen3.5:9b` digest as `MODEL_DIGEST` in `.env`. `onboarding` must be false and authentication true, signup false. Exactly one approved model must be installed. Confirm effective feature controls in the browser and after restart; do not rely solely on environment defaults.

## 4. Close the provisioning window and enable reviewed LAN ingress

Have the network administrator implement and review both host ingress and Docker-forwarded traffic rules: allow HTTPS only from approved LAN/VPN CIDRs, deny public/unapproved ingress, and deny production internet egress from host and container subnets while preserving approved internal DNS/time/identity traffic. Nginx additionally checks source CIDRs, but cannot replace the forwarding policy. Apply rules with console recovery available; this project does not guess interface names or remotely change firewall policy.

Record the reviewed rules and evidence, set `NETWORK_POLICY_REVIEWED=true`, then:

```sh
sudo node infra/scripts/stack.mjs start
sudo node infra/scripts/stack.mjs status
```

`start` stops both proxies, starts private backends, checks onboarding/auth flags and exact model digest, then starts LAN HTTPS with `--pull never`. Failed checks leave the public entry point stopped. Model process health is distinct from model availability; `ollama list` is only liveness, while startup/smoke checks verify the installed model and actual inference.

Use `COMPUTE_MODE=auto` for container-verified NVIDIA detection with explicit CPU fallback; `nvidia` requires GPU residency and `cpu` disables GPU selection. `--gpu` remains an explicit alias. Lifecycle commands reuse the recorded compute choice. Startup checks Docker memory against configured limits and verifies synthetic inference/placement before LAN publication. See [LAN setup](lan-setup.md). The CPU limits, 4,096-token context, one loaded model, one generation and queue of two are initial bounds; benchmark on actual hardware. Do not enlarge them without memory and latency evidence.

## 5. Verify from another LAN client

Use a temporary administrator session token obtained from your signed-in browser's local session, saved in a restricted file through a local editor. Do not put its value in a shell argument or screenshot. This is a short-lived existing session, not an API key; API key creation is disabled. Copy the source and a restricted `.env` with the same non-secret configuration to the client if needed.

```sh
chmod 600 /secure/office-ai-smoke-token
NODE_EXTRA_CA_CERTS=/secure/office-ai-root.crt SMOKE_TOKEN_FILE=/secure/office-ai-smoke-token node infra/scripts/smoke.mjs
```

The script checks trusted HTTPS, anonymous/forged-header denial, disabled signup/uploads/model downloads, administrator identity, exact local model digest, a streamed synthetic answer, an explicitly missing model and closed direct-service ports. It does not print generated text, credentials or upstream errors. Non-zero exit means failure. Remove the temporary token file and sign out after testing. Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0`.

Complete all browser/manual F01–F14 cases: cookie flags/expiry/logout, WebSocket authentication, stream cancellation, privacy canaries, offline restart persistence, benchmark, encrypted restore and rollback. The script alone cannot establish phase acceptance. Follow the [runbook](runbook.md), record sanitised evidence and stop at the Phase 1 human review gate.
