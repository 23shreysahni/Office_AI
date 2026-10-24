# Solution: automatic local compute selection and central LAN hosting

Date: 24 October 2026
Status: foundation compute selection and LAN preparation implemented in source; automated verification passed. Live RTX/9B and LAN acceptance remain pending. The original design below is retained as the requirements record; see current implementation notes immediately below.
Scope: Phase 1 foundation, synthetic testing first. Existing phase and human security-review gates remain in force.

## Current implementation (24 October 2026)

- `infra/scripts/compute.mjs`: bounded offline NVIDIA detection, explicit CPU fallback, mode conflict checks, persisted selection, model residency evidence and Docker memory budget checks.
- `infra/scripts/stack.mjs`: auto/nvidia/cpu selection for regular startup, recorded selection for lifecycle commands and synthetic generation before LAN publication.
- `infra/scripts/prepare-lan.mjs`: guarded separate Windows/WSL staging and validated LAN configuration; never self-approves firewall review or exposes a listener.
- CPU/GPU Compose settings disable unwanted backends; the selected model stays 9B. The existing isolated 4B launcher remains unchanged in purpose; its upgrade guards are retained.
- [LAN setup](docs/lan-setup.md) gives exact preparation, bootstrap, client DNS/CA, reviewed firewall, offline smoke and rollback instructions. [ADR 0011](docs/adr/0011-automatic-compute.md) records the decision.
- Local automated tests cover compute failure classification, memory capacity, persistence, preparation preservation, real CPU/GPU Compose parsing and real Nginx boundaries. Actual RTX model residency, performance, multi-client queue behaviour and full host security acceptance are still required.
- Observed host: GT 730, about 16 GB RAM, Docker about 7.66 GiB, LAN interface 192.168.29.141/24. This is not the proposed RTX 3050 server. Default 9B memory limits exceed this Docker allocation; startup must refuse them.

No working LAN URL is claimed. The intended hostname becomes usable only after the chosen server, memory budget, model artefact, trusted TLS, private DNS and host/container network review are complete. General staff access remains behind the existing identity gate.

## Requested outcome

Run `qwen3.5:9b` on one server, initially an NVIDIA RTX 3050 8 GB, with one active generation at a time. Use available supported GPU acceleration, allow CPU participation when the model does not fit entirely in VRAM, and provide authenticated browser access from approved LAN computers. Clients need no GPU, Ollama installation or model download.

The RTX 3050 is supported by Ollama. This establishes compatibility, not measured 9B fit, speed or concurrency. The observed GT 730 workstation is not evidence that the proposed RTX server exists or has passed testing. See [Ollama hardware support](https://docs.ollama.com/gpu).

## Current gaps

- `compose.gpu.yaml` already requests one NVIDIA device; `stack.mjs` currently selects it only with `--gpu`.
- The Windows local-chat launcher fixes the model to 4B, CPU mode, 5 GiB inference RAM and localhost. It rejects unexpected configuration changes and must not be repurposed by editing its state behind those checks.
- The regular foundation stack already targets 9B and authenticated LAN HTTPS, but actual-host acceptance remains open.
- The most recently inspected temporary Ollama container had no GPU allocation and no loaded model. Preserve its state and identify ownership before replacing anything.

## 1. Automatic compute selection

The implemented deployment option is `COMPUTE_MODE=auto|nvidia|cpu`. Startup defaults to auto for the regular LAN foundation; the historical isolated local pilot retains CPU mode.

| Mode | Required behaviour |
|---|---|
| `auto` | Probe the reviewed local Linux Docker engine and supported NVIDIA availability. Verify container access with the already pinned Ollama image. Apply the GPU override only after a successful probe; otherwise use CPU with an explicit reason. |
| `nvidia` | Require successful GPU detection and real GPU model loading. Fail clearly if unavailable; do not silently pass this GPU-specific test on CPU. |
| `cpu` | Start without GPU allocation and ensure inference is CPU-only. |

Probes must be bounded, must not pull images implicitly, and must not publish ports, mount the Docker socket or print environment secrets. Distinguish a known absent/unsupported GPU from failed Docker permissions, unavailable daemon or invalid configuration: infrastructure failures stop startup rather than masquerading as CPU fallback. Do not install drivers automatically.

On Windows, use a supported NVIDIA Windows driver, Docker Desktop's WSL 2 Linux backend and Ubuntu integration. On native Ubuntu, use supported NVIDIA drivers and the NVIDIA container runtime/toolkit. Missing prerequisites produce actionable instructions. AMD, Intel, macOS and arbitrary operating systems are not automatically certified: use the reviewed CPU route where supported and define additional backends separately.

Keep one resolved compute choice for all Compose operations, including bootstrap, inspect, start, status and stop. Persist the selected mode and non-sensitive probe result separately from secrets. Re-probe at controlled starts; never change a running container's GPU assignment or restart it during a user's request. A CPU fallback preserves the selected 9B model; do not silently substitute 4B.

After container access is established, let Ollama select model placement using available resources. Do not hard-code a GPU-layer count or require simultaneous CPU/GPU utilisation: fully GPU-resident inference is desirable when it fits. A split between CPU and GPU is acceptable when needed. `ollama ps` reports model placement, not instantaneous utilisation percentages. See [Ollama placement guidance](https://docs.ollama.com/faq).

If a load fails, return a bounded error. Any automatic CPU retry must happen only before response streaming, at most once, for a classified compute failure, with an explicit degraded status and the same model/settings. Do not retry cancelled or partly streamed requests, authentication failures or arbitrary application errors. Mid-request seamless GPU failover is not promised.

## 2. RTX 3050 8 GB / 9B test profile

Initial test settings:

| Setting | Candidate |
|---|---|
| Model | `qwen3.5:9b`, approved quantisation and complete installed digest recorded |
| Context | 4,096 tokens; validate the effective request setting |
| Output cap | 250 tokens for comparable benchmark requests |
| Thinking | Disabled for the baseline; record separately if enabled later |
| Active generations | `OLLAMA_NUM_PARALLEL=1` |
| Loaded models | `OLLAMA_MAX_LOADED_MODELS=1` |
| Waiting queue | `OLLAMA_MAX_QUEUE=2`; verify overflow and cancellation behaviour |
| Compute test | Require NVIDIA mode for GPU acceptance; test auto/CPU separately |

8 GB VRAM is a constraint, not a guarantee of full model residency. Windows display usage, model artefacts, context cache and runtime overhead consume memory. Partial CPU offload can reduce speed. Measure host RAM, Docker/WSL memory and competing workloads before selecting container limits; do not carry over the old 5 GiB/2 GiB pilot limits or enlarge allocations beyond real capacity.

Load a synthetic prompt through the private service, then inspect the active model while it remains loaded:

```bash
# Inside the reviewed Linux deployment directory, for an NVIDIA installation:
docker compose --env-file .env -f compose.yaml -f compose.gpu.yaml exec -T ollama ollama ps
```

Record GPU identity, model digest, CPU/GPU placement, peak VRAM/RAM, cold-load latency, first-token latency, output tokens and total duration. Run one cold request and 20 sequential warm requests. Compare p95 total time with the existing under-20-second short-answer target; report failure honestly. Do not guarantee tokens/second before measurement. Inspect host GPU utilisation during generation as corroboration; a blank `ollama ps` means no model is loaded, not proof of a GPU fault.

## 3. Central server and LAN browser clients

```text
Approved LAN browsers (no local model or GPU needed)
                 |
       https://office-ai.internal:443
                 |
        Nginx + trusted internal TLS
                 |
          Open WebUI + named login
                 |
        Private Ollama container
                 |
        Server RTX GPU / server CPU
```

All inference uses server resources. A powerful client does not contribute its GPU. Several users may connect, but the first test profile processes only one generation at a time; waiting requests share a small server-side queue and overflow must return an understandable busy response. This is not evidence of production multi-user capacity.

Use a reserved server LAN IP and a private DNS record for the chosen hostname. Issue a matching internal-CA certificate and distribute only its public trust certificate to approved clients. Bind only Nginx HTTPS to the specific approved LAN address. Allow only approved LAN/VPN subnets through both the host firewall and effective Docker forwarding path. Do not publish Ollama 11434, WebUI 8080 or a database port. Never expose Docker management or create router port forwarding/public tunnels.

Use the existing private service networks and Nginx ingress architecture. Preserve host/container internet-denial requirements after controlled provisioning; neither a private IP nor an internal Docker network alone proves egress prevention. No external LLM fallback.

Use a separately reviewed `/srv/office-ai` LAN deployment with Linux-filesystem state, rather than exposing the existing `/srv/office-ai-local` pilot. Back up before migration; model artefacts may be imported from a verified offline archive, with digest checks. Do not copy the localhost certificate as a LAN certificate, reuse an unreviewed standalone container, overwrite existing state or expose the first-admin signup flow.

Bootstrap the administrator only through the restricted local path, disable signup and verify effective settings before enabling LAN HTTPS. Phase 1 permits administrator-only synthetic testing. General employee accounts, departmental permissions and private documents require Phase 1 completion followed by Phase 2 implementation/review. LAN connectivity alone must never grant chat or document access. This staged rollout follows [the foundation specification](specs/01-foundation.md).

Windows host availability also depends on power/sleep policy, Docker Desktop and WSL recovery after reboot. Document and test the operator startup sequence; do not promise unattended service recovery before Windows login. See [Windows deployment](docs/windows.md).

## 4. Implementation sequence

1. Amend `specs/01-foundation.md` with compute modes, fallback/error semantics and the tests below; record the compute-selection decision in a new ADR. Retain existing LAN/auth boundaries.
2. Implement a dependency-free Node.js compute probe and validated mode selection in the existing orchestration. Update `.env.example`, configuration/policy validation and lifecycle tests. Preserve explicit GPU selection compatibility and reject conflicting mode inputs.
3. Extend the isolated launcher through a reviewed configuration/migration path for an optional 9B GPU test profile. Update source-signature handling and preservation/refusal tests together. Do not disable existing staging guards.
4. Verify the RTX server's hardware, runtime, model digest, memory budget and actual GPU inference. Keep it synthetic and local while troubleshooting.
5. Prepare the existing LAN stack with the actual server address, DNS, certificate, firewall rules and backup configuration. Run second-client acceptance and obtain human security review before any staff rollout.
6. Complete remaining Phase 1 acceptance. Only then progress to Phase 2 accounts/access control; implement no later-phase services under this plan.

Missing deployment inputs: whether the RTX 3050 is installed on the intended server, host RAM/CPU/OS, reserved LAN IP and allowed subnets, internal DNS/CA administration, and backup destination. Discover available values locally; do not guess firewall rules or change router settings.

## 5. Acceptance tests before claiming success

| ID | Test | Pass condition |
|---|---|---|
| C01 | Auto mode, supported NVIDIA GPU | Container probe succeeds; GPU override selected; real 9B load shows GPU residency. |
| C02 | Auto mode, known absent/unsupported GPU | CPU mode and reason recorded; same 9B model works within measured resources or reports capacity failure. |
| C03 | Explicit NVIDIA mode with failed access | Bounded actionable failure; no claim of GPU success or silent CPU fallback. |
| C04 | Docker unavailable/permission denied/probe timeout | Correctly classified failure; no uncontrolled retries or infrastructure errors hidden as CPU-only readiness. |
| C05 | 9B exceeds VRAM | Real partial offload succeeds within RAM limits, or bounded capacity error; no OOM restart loop/model substitution. |
| C06 | Concurrent requests and cancellation | One active generation; bounded waiting queue; clear overflow; cancellation releases capacity and does not replay output. |
| C07 | Driver/reboot/offline changes | Controlled startup re-probes compute, preserves state/digests and works offline without pulling artefacts. |
| L01 | Second approved LAN client | Trusted hostname/certificate; authenticated streaming and cancellation work. |
| L02 | Anonymous/unapproved client and port probes | No anonymous chat/signup; disallowed ingress rejected; backend ports inaccessible. |
| L03 | LAN request with internet disconnected | Server-local inference succeeds; no client downloads or external inference requests. |
| L04 | TLS/login isolation | Wrong hostname/untrusted CA rejected; no certificate bypass; separate named sessions after account gate. |
| L05 | Backup/restore and rollback | Restore verified in a separate destination; configuration, model digest, history and authentication preserved. |

Automate configuration, probe classification, mode propagation, no-implicit-pull and state-preservation cases using synthetic fixtures. Run real Compose/policy and Nginx boundary tests. Use actual RTX hardware and a second LAN machine for live acceptance; mocked tests cannot satisfy those cases. Complete F01-F14 and W01-W04 as applicable, recording sanitised results in `docs/phase-1-verification.md`.

## Verification and rollback for this deliverable

The implementation changes source/configuration/tests and adds the guarded LAN preparation helper. It has not changed an existing deployed service, model, firewall, certificate, account or secret. Automated source checks passed and the actual offline compute probe on the GT 730 host selected CPU. RTX/9B inference, trusted second-client LAN access and phase acceptance remain unrun. See `docs/phase-1-verification.md` for commands and results.

For later implementation, back up configuration/state and archive matching pinned images before changes. On failure stop the new entry point and restore the prior compute configuration and matching encrypted snapshot through the existing runbook. Do not remove volumes, prune models, overwrite secrets or downgrade migrated UI state without its matching backup.

Remaining risks: unmeasured RTX capacity/latency, host RAM constraints, Windows/Docker network forwarding, queue behaviour in the pinned upstream release, trusted client certificate distribution, startup recovery and outstanding identity/security gates. This document does not mark either phase accepted.

## Primary references

- [Ollama supported GPUs](https://docs.ollama.com/gpu)
- [Ollama placement, memory and concurrency guidance](https://docs.ollama.com/faq)
- [Docker Desktop Windows GPU prerequisites](https://docs.docker.com/desktop/features/gpu/)
- [Existing architecture](docs/architecture.md), [deployment](docs/deployment.md), [runbook](docs/runbook.md)
