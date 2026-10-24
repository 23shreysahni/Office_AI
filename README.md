# Local Office AI

Private LAN/VPN office assistant using local Ollama inference. Windows-first deployment through Docker Desktop/WSL 2, with the same Linux-container stack on Ubuntu Server. Custom application services will use JavaScript, Node.js and Express. No cloud LLM fallback or fine-tuning.

**Current state:** Phase 1 deployment implementation provided with Nginx, Open WebUI and Ollama. Foundation implementation was approved by the user; office-server runtime acceptance is pending. No production deployment or later-phase Express business API is claimed. This workspace is not currently a Git repository.

**Start real local chat on Windows:** With Docker Desktop and Ubuntu integration running, execute this in normal PowerShell:

```powershell
node "D:\websites\office-ai-spec\infra\scripts\start-chat.mjs"
```

The launcher installs the missing Ubuntu runtime, stages a separate Linux deployment, downloads the pinned images and 4B fallback, and requires successful local inference and HTTPS checks. It asks before trusting its displayed pilot CA for your Windows user. After success, open [Open WebUI](https://localhost:8443) and create your administrator account. This endpoint is **not yet verified running** from this restricted agent session. See the [local chat instructions](docs/windows.md#one-command-local-chat-pilot).

The separate [read-only review](http://127.0.0.1:4173), started with `npm run preview`, contains synthetic examples and specifications. It has no live chat. See [review instructions](docs/local-review.md).

## Phase 1

For 9B on a central server, use the [LAN setup guide](docs/lan-setup.md). The new preparation helper stages a separate deployment without exposing it. Regular startup selects verified NVIDIA acceleration or CPU fallback and checks actual model placement before enabling reviewed HTTPS. Client browsers use server compute. The intended hostname is usable only after actual server provisioning, DNS/CA/firewall setup and security acceptance; general staff accounts remain behind Phase 2.

- [Windows-first setup, host networking and reboot recovery](docs/windows.md)
- [Setup and private administrator bootstrap](docs/deployment.md)
- [Offline checks, encrypted backup/restore and rollback](docs/runbook.md)
- [Verification results and remaining acceptance work](docs/phase-1-verification.md)
- [Phase 2 access-control specification](specs/02-access-control.md), [API contract](specs/02-access-control.openapi.json) and [preparation status](docs/phase-2-verification.md) — draft only; Phase 1 live acceptance remains the entry gate
- [Phase 3 RAG specification](specs/03-rag.md), [library API contract](specs/03-rag.openapi.json) and [preparation status](docs/phase-3-verification.md) — draft and 30 synthetic cases; no ingestion/retrieval service implemented
- [Phase 4 department-assistant specification](specs/04-department-assistants.md) and [preparation status](docs/phase-4-verification.md) — review-only instructions and 40 synthetic cases; no assistants deployed
- [Digest-pinned Compose deployment](compose.yaml) and [optional NVIDIA override](compose.gpu.yaml)
- [Nginx decision](docs/adr/0004-nginx-proxy.md)

Local development checks need Node.js 24 and Docker Compose CLI (a daemon is not needed to parse configuration):

```sh
npm ci --ignore-scripts
npm test
```

On Windows use `npm.cmd`. The optional real Nginx integration test requires `NGINX_BIN`, `NGINX_TEST_CERT` and `NGINX_TEST_KEY`; without them it is explicitly skipped. Use synthetic test certificate fixtures, never production keys. See the verification report for commands actually run.

The review interface pins Express 5.2.1; populate/archive an approved npm cache during provisioning before using `npm ci --ignore-scripts --offline`. This session used `--cache ./artifacts/npm-cache`; that cache is ignored development material, not a committed dependency. The production foundation scripts do not use Express, but the full test suite includes the review's HTTP tests and needs the locked packages installed.

For deployment, start with the Windows guide or use a reviewed native Ubuntu host. Run `node infra/scripts/stack.mjs doctor` in the Linux deployment shell, then follow the setup guide. Fill `.env.example` into an ignored `.env`, initialise state/session secrets, provision certificates and pinned artefacts, create the administrator on loopback, then use the guarded JavaScript startup command after network review. Raw model/UI ports are never published. All Phase 1 acceptance cases must pass before staff rollout or Phase 2.

## Review package

- [Product requirements](SPEC.md) and [repository instructions](AGENTS.md)
- [Architecture](docs/architecture.md)
- [Infrastructure discovery checklist](docs/discovery.md)
- [Threat model](docs/security.md)
- [Dependency and version matrix](docs/dependencies.md)
- [Implementation sequence](docs/implementation-plan.md)
- [Phase 1 foundation specification and acceptance tests](specs/01-foundation.md)
- [Phase 0 evidence and limitations](docs/phase-0-review.md)
- [JavaScript stack decision](docs/adr/0001-javascript-stack.md)
- [Isolation and identity decision](docs/adr/0002-isolation-and-identity.md)

Complete outstanding discovery and actual-host acceptance in the foundation specification. Later phases remain subject to their own acceptance gates; the remaining target folder tree in `SPEC.md` is a roadmap.
