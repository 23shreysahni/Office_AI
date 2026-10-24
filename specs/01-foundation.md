# Phase 1: Local model foundation

Status: **Foundation design approved for Phase 1 implementation** by the user's instruction, “now impleant phase 1”, on 19 October 2026. Runtime acceptance and release review remain outstanding. Parent requirements: [SPEC.md](../SPEC.md), architecture: [docs/architecture.md](../docs/architecture.md).

## Objective and scope

Provide administrator-only, authenticated HTTPS chat on the office LAN/VPN using Open WebUI and local Ollama with a locally stored approved model. Operate offline after provisioning and preserve state across restart. Synthetic prompts only.

No custom Express API, departmental documents/RAG, accounts processing, staff rollout, fine-tuning, cloud inference, external tools, web search or outbound messages. Custom services in later phases use JavaScript/Node.js/Express as specified in ADR 0001.

## Preconditions

- Record foundation approval below before coding deployment services.
- Complete host, network, DNS, certificate and backup discovery; agree benchmark settings and designated operator.
- Resolve exact supported image versions/digests and model artefact identity from the dependency matrix; review licences/advisories and GPU/runtime compatibility.
- Confirm restricted bootstrap procedure and safe download window. No open first-user registration on the LAN.

## Deliverables

Compute/LAN amendment (24 October 2026): implement optional `COMPUTE_MODE=auto|nvidia|cpu` (default auto) for the regular 9B foundation deployment. Preserve the existing isolated 4B launcher. Probe the pinned, locally cached image with no network or state mounts before choosing NVIDIA; known unsupported/missing GPU support may select CPU in auto mode, but daemon, permission, malformed output and timeout failures must stop startup. Explicit NVIDIA mode must fail without verified GPU access and real GPU model residency. Never change models implicitly or retry partly streamed requests. Resolve compute once per start and record it for later inspection/stop without probing again. Offline Compose checks must remain daemon-independent. Test mode validation/conflicts, bounded offline probes, failure classification, CPU/GPU overrides, saved selection, real generation evidence and LAN boundaries before claiming acceptance. This amendment does not authorise staff rollout before the existing identity/security gates.

Mount regression acceptance: the resolved proxy/bootstrap tmpfs array must contain exactly `/tmp:size=32m,mode=1777` as one absolute-target entry. A targeted user-run repair may back up and replace only the known defective Compose file in the local pilot, after verifying the existing source marker and every hashed runtime file against the expected old/new source signature. Preserve all configuration, keys, models and chats; reject unrelated source changes and test both repeat execution and refusal paths before offering recovery.

Local bring-up amendment: provide one Windows launcher for an administrator-only loopback pilot in a separate `/srv/office-ai-local` deployment. Use HTTPS `https://localhost:8443`, private backend networks, new Linux-owned state/session/TLS files and the existing signup-blocked UI controls. The local bootstrap may use exact `localhost`, `127.0.0.1/32` and the specified `qwen3.5:4b` fallback, with candidate 5 GiB inference/2 GiB UI limits for the user-reported 7.66 GiB engine. This is not a model-fit guarantee; require a bounded real generation check and stop services on failure. Normal LAN start must continue rejecting this loopback configuration. Copy only source on initial staging; never overwrite an existing deployment's code/configuration/state automatically. Reuse artefacts offline after provisioning. Show and verify the new CA fingerprint before an explicit current-user Windows trust choice; never bypass browser certificate warnings or create a user password automatically. Account creation and actual-host acceptance remain human steps. All model digest comparisons must accept documented bare SHA-256 API digests and the canonical `sha256:` configuration representation without accepting abbreviated/invalid hashes.

Port publication constraint discovered during actual Windows acceptance: Docker does not publish ports from an internal-only bridge. Attach only the Nginx proxy/bootstrap to a dedicated bridge with bridge IP masquerading disabled; keep proxy-to-UI and UI-to-inference paths on the existing internal networks. The automated policy validator must enforce these network attachments/options and the loopback-only published bootstrap binding. Actual Windows port reachability and egress policy remain acceptance checks.

Windows bring-up helper: provide a dependency-free Windows Node.js launcher that installs a fixed, checksum-pinned Node.js 24 Linux runtime and Ubuntu recovery tools through the user's existing WSL distribution. Reuse Docker Desktop integration; never install another Docker daemon. Validate the distribution/engine/architecture and shell syntax before mutation, refuse to overwrite another Node installation, verify the installed runtime as the ordinary Ubuntu user, and report prerequisite success separately from actual chat readiness. Unit-test orchestration failures; actual Ubuntu installation remains a user-host check when the agent cannot access WSL.

Windows-first portability amendment, requested by the user on 19 October 2026: retain one Linux-container stack and the same Node.js orchestration on Windows through Ubuntu in WSL 2 with Docker Desktop integration, and on native Ubuntu Server. Native Windows containers are not the deployment runtime. Keep deployment state on the WSL Linux filesystem, rather than an NTFS bind mount. Provide a bounded, read-only host prerequisite check with redacted failures, Windows setup/CA trust/network/reboot/recovery instructions and automated negative prerequisite tests before deployment changes. macOS and other hosts require their own acceptance evidence before being declared supported.

Additional Windows acceptance cases (all initially NOT RUN):

| ID | Procedure | Pass criterion |
|---|---|---|
| W01 Runtime and storage | Run the host prerequisite check inside Ubuntu WSL; inspect Compose mounts and Docker server type | Local Linux Docker engine, required offline tools available, state and keys on the restricted Linux filesystem; no Windows-container backend |
| W02 Windows boundaries | Repeat F02/F03/F07 from another LAN client with the reviewed Windows firewall, Docker Desktop backend and internal CA trust | Only approved HTTPS accessible; trusted hostname; host and container internet denial demonstrated without trusting forwarded identity/IP headers |
| W03 Host reboot | Reboot the Windows host during maintenance, follow the recorded operator startup sequence and repeat F04/F06/F08/F14 offline | Desktop/WSL/stack recover with existing model, history and authentication; no assumption of unattended startup before login |
| W04 Portable recovery | Execute F12/F13 into a separate empty Linux-filesystem deployment, recording source/target OS and architecture | Encrypted state and exact archived images restore offline, permissions and security controls persist; validate a Windows-to-Ubuntu migration before claiming that migration path accepted |

Implementation details agreed for this phase: CPU baseline with optional NVIDIA override; digest-pinned upstream images; bind-mounted state under `state/`; file-mounted session secret; separate Compose profiles for loopback-only bootstrap and LAN HTTPS. The proxy permits only chat/login/history/read-only model paths and denies other API paths, including signup in LAN mode. No secret values are stored in Compose or `.env`. A fresh upstream database still permits its first administrator despite signup being disabled, so bootstrap isolation and proxy denial are mandatory. Host ingress/egress rules must be supplied and reviewed for the actual server, rather than applying guessed firewall rules remotely.

Before runtime acceptance, run Node tests covering configuration rejection, profile/network policy, anonymous access, redacted failures, missing/wrong model digests, streaming completion and timeouts. Compose validation is a local check; it does not satisfy live F02–F14.

- `compose.yaml` with pinned Nginx, Open WebUI and Ollama, separated private networks, explicit volumes, health checks, resource/restart policies and only LAN HTTPS exposed.
- `infra/proxy/` with internal HTTPS configuration and CA trust instructions.
- `.env.example` containing placeholders only, `.gitignore` excluding secrets/data/archives, and installation/backup manifests without credentials.
- `infra/scripts/smoke.mjs` using Node.js for automated non-sensitive service/network assertions; authenticated browser checks where API coverage is insufficient. Return non-zero on failure, enforce bounded timeouts and never print prompts or tokens.
- `docs/deployment.md` and `docs/runbook.md` with exact pinned setup, effective-setting inspection, offline test, snapshot, restore and rollback commands.
- A sanitised test report identifying versions, settings, host class, commands, outcomes and unresolved risks.

## Required behaviour

1. Fail startup/preflight clearly when pins, approved bind address or required secrets are absent; no insecure defaults.
2. Publish only port 443 on the approved LAN interface. UI and model ports remain internal. Never bind a database or model endpoint to the LAN.
3. Require named administrator login; disable public signup and anonymous chat after restricted bootstrap. Session secret persists outside Git, cookies are secure, and expiry is documented and verified.
4. Configure only the local Ollama endpoint and approved locally installed models. Disable cloud providers, telemetry, browsing, tools and uploads using controls verified against the pinned release and actual persisted configuration.
5. Apply approved context/concurrency/resource limits. Stream responses and permit cancellation. Display a review warning and clear offline/missing-model errors, with no fallback.
6. Persist UI state and model artefacts. Health checks report unavailable inference honestly, without leaking configuration or document content.
7. Internet denial must preserve needed internal DNS, time and identity access. Verify at the host/network boundary, not solely through application settings.

## Acceptance tests

Live target-host acceptance cases remain **NOT RUN**. Local configuration/tooling results are recorded in [the verification report](../docs/phase-1-verification.md). Record command/tool, timestamp, installed digests and sanitised outcome for each. Every required case must pass before declaring the phase complete; human review remains mandatory.

| ID | Procedure | Pass criterion |
|---|---|---|
| F01 Pins and validation | Inspect manifest and run `docker compose config --quiet` with documented secrets handling | Valid configuration; all images exact and digest-pinned, no `latest`, required inputs checked |
| F02 Network isolation | From a second authorised LAN host, probe HTTPS and host ports 8080, 11434, 5432; inspect host bindings and both firewall paths | Only approved HTTPS reachable; UI/model/database unavailable directly; non-allow-listed ingress denied |
| F03 TLS | Open internal hostname on a managed client and inspect certificate | Trusted internal certificate, hostname matches, no warning bypass; no public certificate dependency |
| F04 Authentication | Attempt anonymous chat, signup, API and WebSocket access; log in as provisioned admin | Anonymous application access denied apart from required login/static assets/non-sensitive health; signup disabled; admin chat works |
| F05 Session controls | Inspect cookies, test expiry/logout and forged proxy identity headers | Secure session controls; expired/logged-out session denied; headers grant no identity; repeat after restart |
| F06 Local inference | Inspect active backend/model, send synthetic prompt, cancel another streamed response | Approved local digest used, response streams, cancel terminates request within documented timeout; no external provider |
| F07 Offline smoke | Apply administrator-managed internet deny rule while preserving LAN; verify external canary cannot connect; chat from LAN and observe egress | Chat succeeds, no internet dependency or successful internet-bound requests; UI assets available offline |
| F08 Persistence | Record model digest and synthetic conversation marker; restart services, then repeat offline login/chat | Model digest and authorised history persist; no re-download and signup remains disabled |
| F09 Failure handling | Stop Ollama or select a deliberately absent test model, then restore | Visible bounded error, unhealthy inference state, no cloud fallback; successful recovery without data loss |
| F10 Privacy | Submit synthetic unique canary; inspect proxy/UI/runtime logs and browser network activity in restricted environment | No prompt canary, credentials or content in application logs; no remote telemetry/provider traffic |
| F11 Benchmark | Run cold plus 20 warm one-user synthetic requests per discovery protocol | Record p95, token counts, throughput and memory; under-20-second pilot target measured or explicit reviewed remediation before expansion |
| F12 Backup/restore | Quiesce state, encrypt snapshot and restore to separate test volumes/host with archived images/models and no internet | Offline login/chat, same model digest, history and auth settings restored; record elapsed recovery time and compare agreed RPO/RTO |
| F13 Rollback | Snapshot before controlled upgrade trial, then restore previous pinned images with matching snapshot | Previous offline chat and auth behaviour restored; no volume deletion or assumed reverse migration |
| F14 Scope restriction | Inspect UI capabilities, endpoints and configuration after restart | Uploads, tools, external providers, signup and web search remain unavailable; no real data present |

## Offline smoke procedure to implement

1. Pre-fetch reviewed images, model and client assets; record digests and archive checksums while internet access is authorised.
2. Establish baseline login and synthetic chat, persist one synthetic marker and record configured model identity.
3. Have the administrator block server internet egress, preserving LAN and essential internal dependencies; verify denial with an external connectivity canary and firewall evidence. Do not merely disconnect the test browser.
4. Run bounded smoke checks from an allowed LAN client; log in, stream/cancel chat, restart services and repeat. Inspect attempted/blocked traffic and confirm no successful internet requests.
5. Restore the prior firewall policy only through documented operator steps; production continues with internet egress denied. Save sanitised pass/fail evidence without prompt bodies or tokens.

The implemented JavaScript smoke script and exact execution command are documented in [deployment](../docs/deployment.md). It does not prove egress denial or replace the browser/restore acceptance cases. Negative document-permission and ingestion cases belong to Phase 2/3, and must pass before private uploads.

## Migration, rollback and risks

Initial deployment has no existing application schema to migrate. Upstream UI migrations must be documented per pinned release. Take an encrypted consistent snapshot before upgrades; test restoration before promotion. Roll back using archived prior images, configuration, secrets and matching snapshot. Preserve the failed state for restricted investigation; never use destructive volume removal as rollback.

Risks remain: unknown hardware/model fit, unverified release compatibility, persisted UI settings, certificate trust distribution, bootstrap exposure and backup-key loss. Track them in discovery and the phase report. Document exact setup/test/rollback commands as implementation is created; do not invent commands for files that do not yet exist.

## Approval record

- Foundation design/spec approver: User, via explicit Phase 1 implementation request
- Approval date and scope: 19 October 2026; foundation implementation only, no later phase or production release approval
- Target-host discovery and image/model manifest: Pending
- Acceptance evidence: Not run
- Phase 1 completion and security review: Pending
