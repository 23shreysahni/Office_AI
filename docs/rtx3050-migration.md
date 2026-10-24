# Move to an RTX 3050 Windows server

This guide assumes the new computer runs supported Windows 11, has an RTX 3050 **8 GB**, and will host both the browser application and Ollama. Run commands on the computer and in the shell specified. Initial downloads require internet; production inference stays local. These instructions have not been executed on the new machine.

## 1. Preserve the old computer

Leave its source, `/srv/office-ai-local`, models, accounts and chats intact until the new server passes testing. Copying the Windows code folder does not copy Linux deployment state or Docker volumes.

The numbered setup below creates a **fresh separate 9B deployment**, with a new administrator, certificates and session key. It does not migrate old chats/accounts automatically. If those need preserving, take the encrypted backup described at the end before doing anything to old state. Do not import the old 4B localhost `.env` into the new LAN deployment.

## 2. Transfer the source

On the old computer, copy the current `D:\websites\office-ai-spec` source to an approved USB drive or private transfer location. Include `infra`, `docs`, `specs`, `tests`, `package.json`, `package-lock.json`, `.env.example`, `.gitattributes`, `SPEC.md`, `AGENTS.md`, `solution.md`, and the remaining application/review source.

Exclude `.env`, other actual environment files, `secrets`, `state`, `backups`, `artifacts`, `node_modules`, `.git`, `.codex`, `.agents`, `.aws` and any private local files. Transfer any required existing deployment backup separately as an encrypted archive; never mix keys/state into the source package.

Place the source on the new computer, for example at:

```text
C:\office-ai-spec
```

Windows is a source staging location. The preparation helper later puts the live deployment and its state in Ubuntu's `/srv/office-ai` Linux filesystem. Do not move Docker's live disk files between running machines.

## 3. Install the new Windows prerequisites

Install the supported NVIDIA Windows driver for the RTX 3050, then reboot if requested. Install Windows Node.js 24 LTS and the reviewed Docker Desktop version. Record the actual versions. GPU containers on Windows require Docker Desktop's WSL 2 backend and a compatible Windows GPU driver: [Docker GPU prerequisites](https://docs.docker.com/desktop/features/gpu/).

In **Administrator PowerShell**, install Ubuntu if missing:

```powershell
wsl --install -d Ubuntu
```

Follow any requested restart, open Ubuntu and create its Linux username/password yourself. Then in PowerShell:

```powershell
wsl --update
wsl --list --verbose
nvidia-smi
node --version
```

Ubuntu must show version `2`; `nvidia-smi` must identify the RTX 3050. Use `wsl --set-version Ubuntu 2` if an existing Ubuntu installation uses version 1. See [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install).

Open Docker Desktop and enable **Use the WSL 2 based engine** and **Resources > WSL Integration > Ubuntu**, then Apply/Restart. Use Linux containers. Do not install another Docker daemon inside Ubuntu. See [Docker WSL integration](https://docs.docker.com/desktop/features/wsl/).

In ordinary **Windows PowerShell**:

```powershell
docker version
wsl -d Ubuntu --exec docker info --format '{{.OSType}}'
```

The second command must print `linux`.

## 4. Check RAM and storage before choosing limits

8 GB GPU VRAM is separate from system RAM and Docker/WSL memory. A 9B model may use both. Keep ample SSD space for the pinned images, model, WSL disk and recovery archives; check both Windows free space and Ubuntu free space.

In **Windows PowerShell**:

```powershell
Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory
docker info --format '{{.MemTotal}}'
wsl -d Ubuntu --exec df -h /
```

The default app limits are 12 GiB Ollama + 4 GiB WebUI; startup requires at least **16.5 GiB Docker memory** including its minimum headroom check. This is an allocation check, not proof of model fit or sufficient remaining host memory.

For a dedicated **32 GB RAM** computer, a candidate is a 20 GB WSL memory cap, leaving capacity for Windows. Edit `%UserProfile%\.wslconfig` deliberately, preserving existing settings; the relevant section would be:

```ini
[wsl2]
memory=20GB
```

Apply WSL memory changes during maintenance: quit Docker Desktop, run `wsl --shutdown`, then reopen Docker Desktop and recheck `MemTotal`. This stops all WSL workloads. Do not apply 20 GB to a 16 GB computer. Microsoft documents the file in [WSL configuration](https://learn.microsoft.com/en-us/windows/wsl/wsl-config#configuration-settings-for-wslconfig).

For a **16 GB RAM** computer, the defaults cannot pass. A candidate test arrangement is a 12 GB WSL cap with 8g Ollama and 2g WebUI, leaving only about 4 GB for Windows. Use it only if other workloads and actual memory measurements permit; paging or model-load failure means stop and revise the budget. It is not a guaranteed 9B configuration. The preparation command in step 6 shows these optional limits.

## 5. Install the pinned Ubuntu tools

In ordinary **Windows PowerShell**:

```powershell
Set-Location C:\office-ai-spec
node infra/scripts/setup-wsl.mjs
```

This installs the pinned Linux Node/toolchain and required Ubuntu tools using the existing Docker integration. Windows Node and Ubuntu Node are separate. It refuses an incompatible existing Linux Node installation instead of overwriting it. Resolve any failure before continuing. Do not run `start-chat.mjs`: that starts the historical 4B localhost pilot.

## 6. Reserve the server address and prepare the deployment

Connect the new server to the intended office LAN, preferably Ethernet. In **Windows PowerShell**, run `ipconfig` and identify the physical adapter's private IPv4 address and subnet mask. Reserve that IP with the network administrator/router administrator. Do not use a Docker, WSL or VPN adapter address accidentally.

The commands below use **examples**: server `192.168.29.150`, subnet `192.168.29.0/24`, hostname `office-ai.internal`. Replace them with approved values. `/24` is appropriate only for a `255.255.255.0` subnet mask.

In **Windows PowerShell**, on the new server:

```powershell
Set-Location C:\office-ai-spec
node infra/scripts/prepare-lan.mjs --hostname office-ai.internal --ip 192.168.29.150 --cidrs "192.168.29.0/24" --compute nvidia
```

This uses the default 12g/4g limits. For the explicitly reviewed smaller RAM test budget from step 4, use this command instead on a fresh deployment:

```powershell
node infra/scripts/prepare-lan.mjs --hostname office-ai.internal --ip 192.168.29.150 --cidrs "192.168.29.0/24" --compute nvidia --ollama-memory 8g --webui-memory 2g
```

Run only the command matching your chosen budget. Preparation refuses differing existing configuration instead of overwriting it. It opens no port and leaves network policy review false. Explicit `nvidia` is intentional for this acceptance test: an accidental CPU-only setup must fail visibly.

## 7. Initialise and download the pinned model

Enter **Ubuntu as root** from Windows PowerShell:

```powershell
wsl -d Ubuntu -u root
```

All commands until step 9 now run in the **Ubuntu shell**:

```bash
cd /srv/office-ai
node infra/scripts/stack.mjs doctor
node infra/scripts/stack.mjs init
node infra/scripts/certificates.mjs
node infra/scripts/stack.mjs check
node infra/scripts/stack.mjs pull-images
node infra/scripts/stack.mjs pull-model
node infra/scripts/compute.mjs --gpu
```

The last command must report `nvidia`. Downloads may take time and several GB. Stop on any failed command. The probe itself uses the cached pinned image with no download. Generating certificates is for a new isolated pilot CA; if your organisation supplies a CA/certificate, follow [deployment.md](deployment.md) instead of creating another CA.

## 8. Bootstrap and record the model digest

Still in **Ubuntu**:

```bash
node infra/scripts/stack.mjs bootstrap
node infra/scripts/stack.mjs inspect
```

Bootstrap binds only server loopback port 8443. Inspection prints `qwen3.5:9b` and its complete digest. Edit the restricted configuration:

```bash
nano .env
```

Set `MODEL_DIGEST=sha256:` followed by the full 64 hexadecimal characters reported for the installed model. Keep `COMPUTE_MODE=nvidia` and `NETWORK_POLICY_REVIEWED=false` for now. Save and exit. `inspect` may report onboarding before the first administrator exists; that is expected at this point.

## 9. Trust HTTPS and create the first administrator locally

In **Ubuntu**, print the public root fingerprint and copy only its public certificate to the Windows source folder:

```bash
openssl x509 -in secrets/tls/root.crt -noout -fingerprint -sha256
install -m 644 secrets/tls/root.crt /mnt/c/office-ai-spec/office-ai-root.crt
```

On the server, verify that fingerprint before choosing to trust the CA. In **Windows PowerShell**:

```powershell
Import-Certificate -FilePath C:\office-ai-spec\office-ai-root.crt -CertStoreLocation Cert:\CurrentUser\Root
```

Only do this for your verified organisational/pilot CA. Never copy `root.key`, `server.key` or the session secret to clients.

On the server only, use Administrator Notepad to edit `C:\Windows\System32\drivers\etc\hosts`. Temporarily add:

```text
127.0.0.1 office-ai.internal
```

Open **https://office-ai.internal:8443** in that server's browser. Create your named administrator account and sign in. Enter passwords yourself, never in chat or configuration examples. Do not bypass a certificate warning or expose bootstrap to the LAN to work around an error.

## 10. Verify real GPU model placement

In **Ubuntu**, rerun bootstrap now that the digest is recorded:

```bash
cd /srv/office-ai
node infra/scripts/stack.mjs bootstrap
docker compose --env-file .env -f compose.yaml -f compose.gpu.yaml exec -T ollama ollama ps
```

The second bootstrap performs a short synthetic generation and checks actual GPU residency. It must pass in NVIDIA mode. Immediately inspect `ollama ps`: `100% GPU` or a CPU/GPU split demonstrates GPU residency. CPU participation is acceptable if needed for 9B; `100% CPU` is not a successful NVIDIA test. An empty list means no model is currently loaded; rerun the bounded readiness check rather than interpreting it as usage evidence.

Use only synthetic prompts, a 4,096-token context and one active generation for initial testing. Keep the existing single-generation, single-loaded-model and two-waiting-request settings. Full latency and memory benchmarking remains necessary; a short greeting is not a performance acceptance result.

## 11. Configure LAN DNS, certificates and firewall review

Have the responsible operator configure private DNS:

```text
office-ai.internal -> 192.168.29.150
```

Use the actual reserved server IP. For a small test without private DNS, add that mapping to each approved client's hosts file instead. On the server, replace the temporary loopback mapping from step 9 with the real server mapping, or remove it when private DNS is available. Never leave conflicting entries.

Distribute the verified **public** root certificate to each approved test browser/OS trust store. A raw IP URL will not match the generated hostname certificate.

Review host ingress, Docker forwarding and production egress policy with console recovery available: allow only TCP 443 from approved LAN/VPN ranges; keep 11434, 8080 and database ports inaccessible; block public/unapproved ingress and internet inference egress. Do not add router port forwarding or public tunnels. Windows Firewall alone is not evidence that Docker forwarding is restricted. [AGENTS.md](../AGENTS.md) requires human review before progressing through security-sensitive gates.

Only after the actual policy is implemented and reviewed, edit `/srv/office-ai/.env` in Ubuntu and set:

```text
NETWORK_POLICY_REVIEWED=true
```

## 12. Start and test the LAN endpoint

In **Ubuntu**:

```bash
cd /srv/office-ai
node infra/scripts/stack.mjs start
node infra/scripts/stack.mjs status
```

Startup must pass auth, model digest, memory and real inference checks before publishing LAN HTTPS. Only then use this example address from another approved LAN computer:

**https://office-ai.internal**

On that second computer, sign in for the administrator test, send a synthetic message, check streaming and cancellation, and confirm forbidden backend ports are unreachable. In Windows PowerShell, HTTPS reachability can be checked with `Test-NetConnection office-ai.internal -Port 443`; this alone does not test TLS trust or login. Use the browser for those checks. Clients do not install Ollama or use their own GPU.

Repeat the documented [offline smoke and restore checks](deployment.md). No employee rollout/private documents yet: Phase 1 is administrator-only, and employee accounts/permissions require the subsequent reviewed identity phase. Record F01-F14 and W01-W04 evidence before marking acceptance.

## 13. Switch to auto mode after the explicit GPU test

If you want supported NVIDIA selection with visible CPU fallback on later controlled starts, in **Ubuntu**:

```bash
cd /srv/office-ai
node infra/scripts/stack.mjs stop
nano .env
```

Change only `COMPUTE_MODE=nvidia` to `COMPUTE_MODE=auto`, then run:

```bash
node infra/scripts/stack.mjs start
```

This keeps 9B selected. Auto mode does not guarantee equal speed on another system; CPU fallback must still fit available memory. Keep `nvidia` if GPU failure should prevent startup. Do not change compute while requests are in progress.

## 14. Preserve or retire the old setup deliberately

If old accounts/chats/models must migrate, use the [encrypted backup and empty-target restore runbook](runbook.md#encrypted-consistent-backup) for the **actual old deployment directory**, not merely the Windows source folder. It includes protected state, session secrets, keys and model blobs. Container images require their separate checksum-verified offline archives. Stop writers for a consistent snapshot and keep decryption keys separately controlled.

Restore in an isolated empty destination with matching pinned versions. Reconcile the old 4B/localhost configuration, new 9B model/digest, hostname certificates and compute settings as an explicit migration. Do not overwrite the new deployment, copy a live SQLite file or delete an existing certificate directory to force the setup commands. The automated preparation path intentionally does not perform this state migration. Verify existing login/history and backup restoration before switching endpoints.

Keep the old deployment as the rollback copy until the new host passes acceptance. If testing fails, stop the new stack with `node infra/scripts/stack.mjs stop`; preserve its state for diagnosis. Do not prune images or delete volumes. Test restart after Windows reboot and document when Docker Desktop/WSL need operator login; prevent unintended sleep while serving users.

## Common stopping points

| Symptom | Next check |
|---|---|
| GPU probe fails | Windows NVIDIA driver, RTX identity, WSL 2 backend and Ubuntu Docker integration. |
| Memory budget rejected | Actual Docker `MemTotal`, chosen app limits and Windows headroom; VRAM does not replace RAM. |
| Existing deployment differs | Stop; preserve/backup it and review migration. Do not erase source markers. |
| `100% CPU` in NVIDIA test | Container GPU access, actual model residency, driver/runtime compatibility and available VRAM. |
| HTTPS certificate warning | Hostname, time, certificate validity and verified CA trust. |
| Server works, another PC cannot connect | DNS/hosts, real LAN IP binding and both host/Docker firewall paths. |
| Browser model missing | Installed approved 9B artefact and complete digest; no cloud fallback. |
