# Central LAN server setup

Moving to another Windows computer with an RTX 3050? Follow the [numbered migration guide](rtx3050-migration.md), including separate source/state transfer, RAM sizing and GPU verification.

Phase 1 synthetic administrator testing only. Staff rollout still requires foundation acceptance and the Phase 2 identity/security review. Clients use a browser and trusted HTTPS; all model computation occurs on the server. No GPU is required on client PCs.

## Prepare on Windows

Run from the repository in ordinary PowerShell with Docker Desktop and Ubuntu WSL integration available. Use the actual reserved server address and approved network range; the following values are examples, not a claim that a link is live:

```powershell
node infra/scripts/prepare-lan.mjs --hostname office-ai.internal --ip 192.168.50.10 --cidrs "192.168.50.0/24" --compute auto
```

This stages source into the separate Linux directory `/srv/office-ai`, excludes secrets/state, writes a validated `.env` with network review false, and refuses to overwrite differing deployments/configuration. It never starts a service, changes DNS/firewalls, installs software or trusts a CA. It requires the existing Node 24/Ubuntu prerequisites documented in [windows.md](windows.md). A source change requires reviewed migration, not bypassing the marker. Native Ubuntu operators stage the same repository in `/srv/office-ai` and run the same preparation command there with `sudo node`.

The address discovered on the current development workstation on 24 October 2026 was `192.168.29.141/24`; confirm that this is the intended server and reserve the address before using it. Its GPU was a GT 730, not an RTX 3050. Docker had about 7.66 GiB available. The default 12g Ollama + 4g WebUI limits exceed that allocation and startup now refuses them, including 512 MiB for proxy/headroom. Do not allocate more than physical RAM permits or assume the 9B model fits. Benchmark and choose explicit limits with `--ollama-memory`/`--webui-memory` on the actual server. CPU fallback on this workstation may be too slow or too large; it is not an accepted RTX test.

## Bootstrap locally, then review LAN exposure

Inside Ubuntu, change to `/srv/office-ai`. Complete hardware/runtime discovery and follow [deployment.md](deployment.md) for provisioning, licences and backup arrangements:

```bash
sudo node infra/scripts/stack.mjs doctor
sudo node infra/scripts/stack.mjs init
sudo node infra/scripts/certificates.mjs
sudo node infra/scripts/stack.mjs check
# Controlled provisioning window only; these commands may download several GB.
sudo node infra/scripts/stack.mjs pull-images
sudo node infra/scripts/stack.mjs pull-model
sudo node infra/scripts/stack.mjs bootstrap
sudo node infra/scripts/stack.mjs inspect
```

Record the complete installed model digest as `MODEL_DIGEST` in the restricted `.env`. Create the first named administrator yourself using the restricted bootstrap path, as described in deployment.md. Do not send passwords in chat. No LAN endpoint is opened by bootstrap. With an internal hostname certificate, temporarily resolve that hostname to loopback on the bootstrap workstation or use the documented SSH tunnel; restore normal LAN resolution afterwards. Copy/distribute only the public CA certificate after verifying its fingerprint. Never bypass certificate warnings.

Have the responsible operator configure private DNS `office-ai.internal` to the reserved server IP, a matching trusted certificate, and host plus Docker forwarding/egress rules. Approve only HTTPS 443 from the selected LAN/VPN ranges, deny direct backend ports and production internet inference egress. Review the actual Windows and Docker paths with console recovery available. No router port forwarding or public tunnel. Record the reviewed policy and only then set `NETWORK_POLICY_REVIEWED=true`.

```bash
sudo node infra/scripts/stack.mjs start
sudo node infra/scripts/stack.mjs status
```

Only a successful start prints the configured LAN browser address. For this example it is **https://office-ai.internal**. It works on a client only after DNS/hosts resolution, CA trust, firewall rules and the authenticated application are ready; localhost never points to another computer's server. A raw IP URL will not match the hostname-only certificate.

## Compute behaviour and verification

`COMPUTE_MODE=auto` probes NVIDIA support inside the locally cached pinned image, without a network or downloads. Known missing/unsupported GPU support selects CPU and states the reason. Daemon/permission/timeout/unknown probe failures stop startup. `COMPUTE_MODE=nvidia` requires GPU support; `cpu` disables CUDA/Vulkan. Existing `--gpu` remains an explicit NVIDIA alias; `--cpu` and `--auto` are available, and flags conflicting with explicit configuration are rejected.

Starts record `state/compute.json`. Status, inspect and stop reuse that choice, so GPU loss does not prevent stopping a running deployment. To change an explicitly configured mode, stop with the current mode before editing `.env`. Fresh starts probe again. The isolated historical 4B localhost launcher remains CPU-only and its staging guard remains intact; use the separate regular deployment for 9B.

Before LAN exposure, startup runs a short synthetic request on the private inference service and checks actual `/api/ps` GPU residency. It writes timing/token/placement metadata only to `state/compute-evidence.json`. A CPU-only load in NVIDIA mode is a failure; GPU residency can include partial CPU offload. No fixed GPU-layer count or automatic downgrade to 4B is applied. No mid-request retries are implemented.

For RTX acceptance use explicit NVIDIA mode, load 9B and inspect during generation:

```bash
sudo docker compose --env-file .env -f compose.yaml -f compose.gpu.yaml exec -T ollama ollama ps
```

One generation and one loaded model are configured, with two waiting requests. Verify busy/overflow/cancellation behaviour using synthetic clients on the pinned upstream version. A placement percentage in `ollama ps` is not live GPU utilisation. Run the existing one-cold/20-warm benchmark and record VRAM/RAM and p95 total latency; no throughput guarantee is made.

## Offline smoke, rollback and remaining gates

After provisioning, disconnect/deny internet while retaining approved LAN services. Restart with the same configuration, verify no downloads, authenticate from a second LAN client, run the existing authenticated `smoke.mjs` command in deployment.md and check streamed completion/cancellation. Probe that 11434/8080/database ports are unreachable, anonymous chat/signup are rejected, and unapproved ingress fails. Repeat after Windows reboot. Do not log prompts or credentials.

Back up state/configuration and exact images before migration. Keep `/srv/office-ai-local` untouched. Stop the new LAN stack on failure, restore matching state/images through [runbook.md](runbook.md) and revert the reviewed configuration. Never use `down -v` or prune as recovery. Complete F01-F14/W01-W04 and human review before marking the phase accepted; general staff accounts and documents remain behind Phase 2.
