# Phase 1 implementation and verification

## Automatic compute and central LAN preparation, 24 October 2026

Implemented the foundation amendment and ADR 0011: validated auto/nvidia/cpu modes, explicit NVIDIA flag compatibility, bounded offline probing using the pinned cached image, known-absence CPU fallback, fail-closed infrastructure errors, recorded lifecycle selection, CPU/GPU backend environment controls, Docker memory budget checks and synthetic generation/actual residency before LAN publication. Added a guarded Windows-to-WSL `/srv/office-ai` preparation helper, preserving the existing `/srv/office-ai-local` pilot and refusing configuration/source drift. Updated `solution.md`, architecture, deployment/runbook, README and the new `docs/lan-setup.md` instructions. No staff identity service or later phase was implemented.

Verification: `npm.cmd test` with `NGINX_BIN`, `NGINX_TEST_CERT` and `NGINX_TEST_KEY` set to the existing synthetic fixtures passed **49 tests, zero failed/cancelled/skipped**. This includes real CPU/GPU Compose parsing and real Nginx API boundary checks, plus compute classification, mode conflicts, memory rejection, saved selection, model residency validation and preparation preservation tests. Most new detection/preparation branches use injected synthetic command results, not live GPU inference.

Actual read-only discovery found a GT 730 (not RTX 3050), 16,967,540,736 bytes physical RAM, Docker memory 8,219,881,472 bytes and Ethernet `192.168.29.141/24`. The separate LAN deployment was absent; the isolated local deployment was present. The running temporary Ollama instance listed no installed models at inspection. `node infra/scripts/compute.mjs --auto` was run outside the sandbox using a temporary network-isolated cached-image probe and returned `cpu` with reason `NVIDIA container support unavailable or unsupported`. No download, persistent state mount or LAN listener was created by that probe. The default 12g + 4g limits exceed this Docker allocation, and the new test verifies rejection of that actual allocation.

The initial ad-hoc `node --input-type=module -e` probe failed due to PowerShell argument quoting before running any detection; the direct module CLI above then ran successfully. No RTX availability, 9B loading, throughput, Windows firewall/DNS/CA changes, trusted LAN URL or phase acceptance is claimed. The server choice and actual network/security review remain required before publishing LAN HTTPS. No other running project or existing pilot state was modified. Rollback means reverting source/configuration before deployment; later deployment rollback uses the existing matching-image/encrypted-state runbook, never volume removal.

## Windows loopback port publication follow-up

The user reports that Ollama successfully completed synthetic inference, but Windows `Test-NetConnection 127.0.0.1 -Port 8443` failed. Docker showed host configuration `127.0.0.1:8443` but active `NetworkSettings.Ports` as an empty list; `docker ps` displayed only container `443/tcp`, with no host mapping. Inspection found the published Nginx service attached only to the internal `frontend` bridge. Docker documents that internal networks have no external connection; Docker's network guidance and Moby issue #36174 describe port publication as unavailable from internal-only bridges.

Added a dedicated Docker bridge `ingress` used only by Nginx/bootstrap, with bridge IP masquerading disabled. Nginx retains its existing internal connection to WebUI; WebUI/Ollama remain on the existing internal frontend/inference networks. The policy validator enforces service/network membership and the non-NAT bridge option. The existing recovery launcher now upgrades only the known prior Compose and validator files after verifying the previous source signature and all unchanged runtime files; it creates separate original-file backups, preserves all model/config/secret/chat data, and supports interrupted retries. It resumes the normal startup, inference and HTTPS validation flow.

Verification: real local Compose parsing/policy tests cover CPU/GPU and exact ingress options; all **35 tests passed** after the ingress change. Synthetic recovery tests confirm only the two known runtime files change, backups are preserved, and configuration/secrets/model/chat markers remain intact. The new user-side recovery, active Docker host-port mapping, Windows HTTPS, CA trust and browser login have **not yet been reported successful**. Do not claim the chat is reachable until `docker ps` shows `127.0.0.1:8443->443/tcp` and Windows can connect.

## Actual-host mount failure and targeted recovery

The user reports successful image/model provisioning, including model SHA-256 verification and manifest creation, followed by a Docker startup failure: `invalid mount path: 'mode=1777' mount path must be absolute`. This is user-side evidence of downloads, not inference or chat acceptance. The YAML flow sequence `tmpfs: [/tmp:size=32m,mode=1777]` incorrectly produced two entries. Quoted the full mount in `compose.yaml`; the existing real Compose CPU/GPU tests now assert the exact resolved single-element tmpfs array for both proxy profiles. Prior successful syntax/policy checks did not cover that resolved mount invariant.

Added `infra/repair-tmpfs.js` outside the runtime-signature script set so the known deployed version can be identified precisely. Its targeted recovery verifies the old/new marker and all hashed runtime files, backs up only the known Compose contents, performs the correction, updates the marker and resumes the existing launcher. It refuses unrelated changes or a conflicting backup. Windows setup instructions and the foundation acceptance specification include this recovery.

Verification: `npm.cmd test` with the documented real Nginx fixture environment passed **35 tests, zero failed/cancelled/skipped**. New recovery tests exercise the actual file operation in synthetic temporary deployments, including repeat execution, preservation of configuration/secrets/model/chat markers, and refusal on changed code, marker or backup. The user-side WSL repair and subsequent service/generation/browser checks remain pending. The agent has not accessed or changed the user's Linux deployment.

## Latest local-chat launcher verification

19 October 2026: added `infra/scripts/start-chat.mjs` (Windows entry point) and `infra/scripts/local-chat.mjs` (fixed Linux pilot provisioner), with the scope and acceptance amendment in `specs/01-foundation.md` and [ADR 0009](adr/0009-local-chat-launcher.md). Updated configuration to permit an exact isolated localhost bootstrap with the specified 4B fallback; ordinary LAN `start` still rejects this configuration. Fixed model verification to canonicalise Ollama's complete bare SHA-256 API digests into the prefixed stored format without accepting partial hashes. Updated the Windows guide, README and architecture with start/stop, trust, persistence and failure behaviour.

`npm.cmd test` with the real Nginx fixture environment documented below passed **32 tests, zero failures, cancellations or skips**. Five added tests cover the exact bootstrap-only configuration boundary, real Compose loopback/backend isolation, complete model digest equivalence, Windows orchestration order and public-certificate-only export, and refusal on resource/path/syntax/generation/certificate failures. WSL operations and generation outcomes in orchestration tests are simulated; they do not establish successful host provisioning. Earlier test counts below are historical.

The real command `node infra/scripts/start-chat.mjs` was attempted from this restricted session. It exited non-zero at the first Ubuntu Docker check, before installation, staging, certificate creation or container provisioning. This session's WSL access restriction remains unresolved; the user must run the documented command from normal PowerShell. No root trust, account, real inference or reachable Open WebUI endpoint is claimed. The intended URL after successful user-side launch is `https://localhost:8443`.

Remaining actual-host work: execute the launcher, explicitly review/trust the displayed pilot CA, create the named administrator, verify authenticated browser chat/streaming/cancellation and complete F01–F14/W01–W04 as applicable before LAN/staff rollout. The 4B memory limits are candidates, not a benchmark result. Later phases remain unimplemented runtime work behind the Phase 1 gate.

Date: 19 October 2026. Status: Implementation prepared; live office-host acceptance pending. The user's explicit Phase 1 request approved implementation, and the subsequent Nginx request is reflected in code, requirements and ADR 0004. No later phase was implemented.

## Delivered

- Windows-first portable deployment route through Docker Desktop/Ubuntu WSL 2, using the same Linux containers and recovery scripts as native Ubuntu. Added read-only `doctor`, WSL deployment-path guards, LF shell-script checkout policy and Windows-specific acceptance cases W01–W04. See [Windows setup](windows.md) and [ADR 0005](adr/0005-portable-windows-host.md).
- Digest-pinned Nginx, Open WebUI and Ollama Compose with isolated networks, LAN/bootstrap profiles, bounded resources, state mounts, session/TLS secret files and optional NVIDIA override.
- JavaScript configuration validation, guarded lifecycle/model provisioning, certificate checks, OpenSSL pilot-CA generation and a bounded authenticated smoke script.
- Nginx method/path restrictions, private CIDR allow-list, disabled signup in LAN mode, login rate limiting, streamed responses and WebSocket forwarding.
- Locked dependency-free Node.js tooling and tests; deployment, offline smoke, encrypted backup/restore and rollback instructions; stopped-service GPG backup script.
- Updated `SPEC.md`, `AGENTS.md`, architecture, dependency matrix, foundation spec and decision records. The exact runtime image references are in `infra/images.json`.

## Commands and local evidence

```powershell
npm.cmd install --package-lock-only --ignore-scripts --offline
$env:NGINX_BIN = (Resolve-Path 'artifacts/nginx/bin/nginx-1.30.6/nginx.exe').Path
$env:NGINX_TEST_CERT = (Resolve-Path 'artifacts/nginx/agent1-cert.pem').Path
$env:NGINX_TEST_KEY = (Resolve-Path 'artifacts/nginx/agent1-key.pem').Path
npm.cmd test
```

The optional Nginx checks use the official [Windows 1.30.6 package](https://nginx.org/en/download.html), downloaded over HTTPS into ignored `artifacts/`, and publicly supplied synthetic certificate/key fixtures from Node.js v24.15.0. No production key is used. These artefacts are not application dependencies or committed source. The observed Windows archive SHA-256 is `c6ee35edb0a861063323f709192ae50d1eefaf2ea7d00678bd2b22d8542dc61e`; this records the download, not independent PGP verification.

The real Nginx test parses both generated TLS configurations using synthetic certificates, then starts temporary loopback HTTP listeners with a synthetic upstream to verify method/path restrictions and bootstrap-only signup. It does not perform trusted-client HTTPS or exercise a real Open WebUI installation. The actual Compose CLI parses both CPU and GPU configurations without a running daemon and validates resolved pins, profiles, networks, backend port isolation and secret/state mounts.

Unit tests cover unsafe/missing configuration, public binds and broad CIDRs, hostname injection, model digests, changed image pins, unsafe networking, protected/anonymous smoke paths, streamed output completion, redacted errors, response limits and timeouts. Final test count/result is recorded below after the last verification run.

`docker info` failed because the local Docker daemon pipe is unavailable. Therefore no image containers, model pull, real inference, GPU benchmark or production endpoint was launched. OpenSSL/GPG backup tooling and Linux ownership behaviours cannot be exercised in this Windows workspace; they require target-host testing. Root-owned upstream containers and manually reviewed host/container firewall policy are explicit limitations.

## Acceptance status

| Cases | Evidence | Status |
|---|---|---|
| F01 | Real Compose parser, full registry digests, resolved-policy tests; target-host manifest/review still pending | Partial local verification |
| F02, F04, F14 | Synthetic Nginx route tests and configuration checks only | Live network/UI acceptance not run |
| F03, F05 | Nginx TLS syntax, configured cookie/expiry/auth controls and restricted bootstrap | Trusted-client TLS/session acceptance not run |
| F06, F09 | Mocked smoke streaming/missing-model tests and bounded error paths | Live model/chat/cancellation not run |
| F07, F08 | Offline/restart procedure and persistence configuration provided | Actual offline restart not run |
| F10 | Content-free script failures and proxy access logs disabled | Upstream privacy-canary inspection not run |
| F11 | Benchmark protocol and bounded initial resource settings provided | Office-hardware benchmark not run |
| F12, F13 | Encrypted consistent snapshot script, separate restore and matching-state rollback procedure provided | Encrypted restore/rollback drill not run |

## Remaining work and risks

The user subsequently selected Windows as the initial host. The Linux shell/runtime is provided by Ubuntu WSL 2 with Docker Desktop integration. This changes the host plan; it does not satisfy runtime acceptance. Record the supported Windows edition/build, WSL/Ubuntu/Desktop versions/licence, Linux filesystem location, Windows/backend firewall policy, CA distribution and operator boot-recovery procedure. F01–F14 and W01–W04 remain required; native Ubuntu remains the portable alternative.

Supply office hardware/OS, private hostname/address/ranges, internal CA/identity dependencies, backup location/key custody and RPO/RTO. Review image licences/advisories and collect actual platform/model digests. Provision on the approved Linux host and run F01–F14 with sanitised evidence. Some non-chat upstream UI panels are intentionally denied; verify the exact pinned browser chat flow before acceptance. Certificate creation/renewal, upstream logging, WebSocket authentication and cancellation require live checks.

Phase 1 is not marked accepted, and Phase 2 remains closed. The workspace has no Git repository, so no commit/diff is claimed. Rollback for a future deployment is documented in `runbook.md`; no current production migration or destructive cleanup occurred.

## Final local result

Passed: `npm.cmd ci --ignore-scripts --offline`; **15 tests, 15 passed, zero failed or skipped**, with the Nginx integration variables set as above. Both real Compose variants and both real Nginx profiles were checked. A separate local check passed for 17 Markdown files, 35 resolving local links, balanced fenced blocks and eight JavaScript files via `node --check`. A source search found no remaining references to the replaced proxy outside ignored development artefacts. Backup/provision shell execution, certificate generation and live office-host F01–F14 acceptance remain unrun.

## Windows portability follow-up, 19 October 2026

Local prerequisites observed: Node.js `v24.15.0`, npm `11.12.1`, Docker Compose `v5.1.4`. `npm.cmd ci --ignore-scripts --offline` succeeded again before the portability edits. After all JavaScript changes, `npm.cmd test` with the Nginx variables above passed **21 tests, zero failed, cancelled or skipped**. This includes both real Compose configurations and both real Nginx profile checks; prerequisite success cases use simulated Linux/WSL tool results. All JavaScript files under `infra/` and `tests/` passed `node --check`; 19 Markdown files had balanced fenced blocks and 46 resolving local links. The preceding 15-test result is historical.

Read-only runtime discovery failed: `docker info` could not find the local Docker daemon named pipe; Docker also reported access denied to its user configuration. `wsl --status` and `wsl --list --quiet` both returned `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`. No Docker/WSL services, packages, firewall rules, trust stores or production state were changed. The native Windows invocation `node infra/scripts/stack.mjs doctor` correctly exited non-zero with instructions to use Ubuntu WSL 2. This expected guard result is not a successful WSL prerequisite run.

New automated coverage exercises Linux and WSL prerequisite success using simulated tool results, native-Windows guidance, mounted-Windows-drive rejection, unavailable daemon/recovery tools, remote contexts, Windows-container engines, unsupported Node versions, redacted failure output and LF shell scripts. Real WSL prerequisite success, OpenSSL/GPG execution and actual Windows deployment/boot/restore remain NOT RUN. No claim of OS-wide acceptance or Phase 1 completion is made.

## Chat bring-up attempt after Docker Desktop was opened

The user started Docker Desktop. A fresh check now observes its backend processes, and the default engine connection has changed from a missing pipe to **permission denied** on `npipe:////./pipe/docker_engine`. The agent also cannot read Docker's user configuration/context metadata, and `wsl --list --verbose` still returns `Wsl/EnumerateDistros/Service/E_ACCESSDENIED`. Docker Desktop opening alone has not established access from this restricted session.

The Windows WSL service reports running. Starting the Docker helper service from this session failed because it cannot be opened; no service state was changed. A stopped Docker helper service is not by itself proof that the WSL backend is unavailable. No ACL/group changes, unauthenticated TCP Docker endpoint, WSL reset, certificate-trust change or firewall change was attempted. The user has been asked to run the read-only engine/type and WSL-list commands in their normal PowerShell session to distinguish host readiness from agent access restrictions.

Node.js hardware discovery observes x64, 12 available logical CPUs and approximately 16 GiB host RAM. GPU, Docker/WSL memory allocation and model fit remain unverified. The example 12 GiB Ollama plus 4 GiB UI limits cannot be treated as a measured fit for this Windows host; inspect the actual Linux engine resources and benchmark before provisioning limits/model changes.

No deployment `.env`, Linux state, production certificates, administrator account, container images or local model were provisioned in this bring-up attempt. The intended next operation is real foundation bootstrap, not another review interface. There is still no verified Open WebUI chat URL.

## User-side Ubuntu prerequisite discovery

The user reports `linux` from Docker both in Windows PowerShell and via `wsl -d Ubuntu --exec docker info --format '{{.OSType}}'`. The reported engine memory is `8219885568` bytes (approximately 7.66 GiB). The ordinary Ubuntu user cannot yet execute Node (`execvpe(node) failed: No such file or directory`). These are user-supplied prerequisite results, not chat/acceptance evidence. The agent's own WSL/Docker restrictions remain separate from those successful user-side checks.

Added `infra/scripts/setup-wsl.mjs` and `infra/node-runtime.json` to make the missing tool installation one Windows command. The launcher checks the Linux engine/architecture, asks Ubuntu Bash to check the installer syntax before privileged execution, uses fixed Node `v24.22.0` Linux archive URLs and SHA-256 pins, installs Ubuntu prerequisites, refuses an unrelated existing runtime and verifies Node as the ordinary user. Its root installer is not executed from the restricted agent session. The official version-specific checksum endpoint returned HTTP 200 and agreed with both x64/arm64 pins; no archive signature or actual Ubuntu install is claimed verified.

Verification: `npm.cmd test` with the previously documented real Nginx fixture variables passed **27 tests, zero failed/cancelled/skipped**. Three new orchestration tests simulate user-side WSL results and cover supported architectures, ordinary-user verification, refusing an unsupported host/engine/architecture, stopping on syntax/install failures and withholding success for the wrong installed version. `node --check infra/scripts/setup-wsl.mjs` passed. The generated Bash syntax check and actual root installation still need execution through the user-side launcher; mocked orchestration does not establish those results.

## Windows local chat UI follow-up, 19 October 2026

The user reports that the pinned local containers are healthy, Ollama inference succeeds, `https://localhost:8443/api/config` returns 200, and Windows reaches the HTTPS proxy. Their signed-in browser console showed 403 responses for Open WebUI profile image, banner, tool-list, pinned-note, folder-list and timezone endpoints. These paths were missing from the Nginx method/path allow-list; null sidebar data caused the reported indefinite loading. Updated the policy for those exact authenticated requests and added `infra/repair-webui-policy.js`, a guarded Windows-to-Ubuntu update that verifies the existing deployment marker/runtime, backs up the prior Nginx template, preserves account/model/chat state, updates the marker and resumes the launcher. The update remains unrun on the user's host at this point.

Focused verification: `node --test tests/proxy.test.mjs tests/openwebui-policy-repair.test.mjs` passed **3 tests, 0 failures**; the optional real-Nginx integration case was skipped because its Nginx/certificate fixture variables were not set in this session. The user's 401 results came from unauthenticated PowerShell probes and are distinct from the browser's Nginx 403. Browser loading/chat acceptance and the repair command still require user-side execution.

The subsequent browser console exposed additional shell GETs (`models/list`, `knowledge/search`, `prompts/list`, `skills/list`, `tools/list`, `groups`, functions/skills and model profile images) still returning 403. Expanded the policy to permit authenticated GET requests under `/api/v1/` while preserving explicit chat-sharing denials and the existing write-method restrictions. The guarded policy updater now upgrades from the prior narrow-policy marker, creates a separate verified backup and restarts the loopback bootstrap proxy to load the mounted config. Full `node --test`: **36 passed, 0 failed, 1 optional real-Nginx integration test skipped**. This second policy update and browser chat response remain pending user-side verification.
