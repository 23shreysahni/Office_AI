# Architecture

Status: Approved for Phase 1 implementation by the user's request on 19 October 2026; live security acceptance pending. Authoritative requirements: [SPEC.md](../SPEC.md). Decisions: [stack](adr/0001-javascript-stack.md), [isolation and identity](adr/0002-isolation-and-identity.md), [Nginx](adr/0004-nginx-proxy.md).

Compute amendment (24 October 2026): the regular foundation deployment now selects auto/nvidia/cpu compute, verifies container access and actual model residency before LAN startup, and preserves the selected 9B model. The separate LAN preparation helper stages source/configuration without opening ingress. See [ADR 0011](adr/0011-automatic-compute.md) and [LAN setup](lan-setup.md). Client browsers use only server compute; actual RTX and LAN acceptance remain pending.

## Foundation boundary

For initial Windows workstation chat, the [local launcher](windows.md#one-command-local-chat-pilot) provisions a separate `/srv/office-ai-local` deployment, bound only to `127.0.0.1:8443` with a localhost certificate. It uses the specified 4B fallback and requires an internal generation test and Windows HTTPS verification before offering current-user CA trust. The user creates the first named administrator directly in Open WebUI. This pilot cannot pass the regular LAN startup guard and does not imply phase acceptance; see [ADR 0009](adr/0009-local-chat-launcher.md).

A separate [read-only local review interface](local-review.md) now runs directly on Windows/Linux Node.js, limited to loopback and synthetic/public-source review material. [ADR 0008](adr/0008-local-review.md) distinguishes it from the production stack: no identity, upload, retrieval, inference or financial service is added and no phase acceptance is implied.

Phase 1 contains only an internal HTTPS reverse proxy, authenticated Open WebUI, Ollama, local model storage and operational scripts. Synthetic chat only; disable document ingestion, tools, external providers, web search and public registration. No custom Express service or Accounts module is deployed in this phase.

Use one Windows host initially, with Docker Desktop's WSL 2 Linux backend and an Ubuntu LTS deployment shell; retain native Ubuntu Server as a portable deployment option, subject to [hardware discovery](discovery.md). The current workspace is not assumed to be an accepted production server. Store state in the Linux filesystem and execute the same orchestration/backup tools on both routes. See [ADR 0005](adr/0005-portable-windows-host.md) and [Windows setup](windows.md). No capacity or model-fit guarantee is made.

```text
Office browser / approved VPN
           |
   LAN allow-list + HTTPS :443
           |
    Nginx reverse proxy
           |
    Open WebUI (login required)
           |
      Ollama (internal only)
           |
    Qwen3.5 local model volume
```

Nginx is the user-selected proxy. Mount a certificate from an internal CA and managed trust distribution; never require staff to bypass certificate errors. Only port 443 binds to the approved LAN address. Use local/internal DNS; no public certificate challenge or public DNS requirement. Host firewall and Docker forwarding rules must both be verified from another LAN machine. Administrative SSH is a separately controlled management path.

Separate proxy-to-UI and UI-to-inference networks. The proxy cannot reach Ollama directly. No host-published UI, inference or database ports, Docker socket mounts, or privileged application containers. Production internet egress is denied at the host/network boundary while approved LAN DNS, time and identity dependencies remain reachable. An internal Docker network alone is not sufficient evidence of egress prevention.

## Authentication

Phase 1 is an administrator-only synthetic pilot. Provision the first named administrator through a restricted bootstrap path, then disable signup before making the LAN endpoint available. Verify effective persisted UI configuration after restarts; environment defaults alone do not establish security. Back up the stable session secret outside Git and require secure cookies and session expiry. Other users and private documents remain disabled until Phase 2 permission review.

Prefer existing internal OIDC for Phase 2. Open WebUI sessions are not automatically valid Express credentials. The Express service will independently verify issuer, audience, expiry and signatures against the approved identity provider, resolve local grants, and deny requests on invalid identity. Shared login design remains pending identity discovery; do not invent a trusted department header or enable an unauthenticated bridge.

## Later custom services

The [Phase 2 access-control draft](../specs/02-access-control.md) and [proposed identity ADR](adr/0006-phase-2-identity.md) detail the next phase. They are not implemented; Phase 1 actual-host acceptance and provider discovery remain open.

The [Phase 3 retrieval draft](../specs/03-rag.md), [retrieval ADR](adr/0007-authorised-rag.md) and [Phase 4 assistant draft](../specs/04-department-assistants.md) prepare later review work. They propose a custom authorised document/answer portal while keeping upstream native uploads disabled; none is deployed or accepted.

These are design boundaries, not authorisation to implement later phases now:

- Express API: JavaScript ES modules, schema validation, identity verification, permissions, request IDs, controlled errors and content-free audit events. Publish an OpenAPI contract before implementation.
- Node.js workers: bounded extraction/import jobs, size/time limits, durable job state and retries. Jobs carry document IDs and scope references, not caller-selected access grants. Use PostgreSQL-backed job state initially; review any queue dependency before adoption.
- PostgreSQL: application identities/grants, metadata, chunks/pgvector, imports and audit. Use parameterised queries, a restricted runtime role and separate migration credentials. Open WebUI retains its supported separate data store; do not share its internal tables as an identity integration.
- Local encrypted filesystem: quarantined uploads and approved originals under generated paths, never user-supplied filesystem paths. Store provenance, source hash and scope with each document/chunk. Backups require separately managed encryption keys.
- Inference: only local allow-listed model endpoints. No arbitrary URL fetches, outbound messaging, executable model tools or bank/ERP connectors.

## Authorised retrieval flow

1. Verify identity and current server-side collection grants.
2. Query active documents/chunks with scope predicates inside the database retrieval query, before ranking results reach the application or model. Never search globally and filter only the returned top results.
3. Recheck document state and current grants before assembling context; prevent stale cross-user retrieval caches. Cache keys must include identity/scope and permission version, or disable retrieval caching initially.
4. Send only authorised text to Ollama, treating it as untrusted evidence. Return source IDs and locations; source downloads and citation resolution repeat authorisation.
5. Revocation/deletion removes eligibility immediately for new requests; tombstone first and clean up asynchronously. Revalidate before model dispatch; define cancellation of in-flight requests during Phase 2/3 review.

Private RAG stays disabled unless pinned Open WebUI controls pass negative permission tests. If they fail, review integration with the custom authorised retrieval service or isolated departmental instances before enabling uploads. Prompt wording is not an access control.

## Accounts boundary

Accounts remain a separately authenticated workflow. In Phase 5, original imports are immutable and hashed; validated mappings produce typed records, decimal strings and PostgreSQL `NUMERIC` values. Node.js `decimal.js` uses explicit precision, currency scale, range and rounding policies. Independently calculated fixtures verify totals and reconciliation. No AI prose is authoritative for amounts. Approvals bind to an exact proposal revision/hash and produce only reviewed reports/exports, never ledger writes.

## Operations and failure handling

Persist UI data, session secrets and model artefacts across restarts. Record container and model digests in an installation manifest. Restrict log fields to request/event IDs, timing, status and actor/object IDs; exclude prompts, source text, tokens and financial records. Restrict even this metadata to operators with a defined retention policy.

Health checks distinguish process liveness, model availability and user-visible readiness. Missing models or unavailable Ollama must show an actionable local error without fallback. Add startup timeouts, resource limits and tested restart behaviour after the target host benchmark. Later uploads explicitly report corrupt/encrypted files, inaccessible sources and OCR-required PDFs.

Back up consistent UI/database state, documents, manifests and required secrets with encryption. Decide whether model blobs are backed up or restored from an offline checksum-verified archive. Stop or quiesce writers for consistent snapshots. Verify restore on a separate target before release. Rollback restores the previous images and matching data snapshot; do not assume an upstream database migration is reversible.
