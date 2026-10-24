# Initial threat model

Status: Review draft. This is a design and test plan, not evidence of an audited deployment.

## Assets and trust boundaries

Protect document/chunk content, chat history, employee identities, financial imports, model context, approval records, session credentials and backups. Treat browsers, uploads and retrieved instructions as untrusted. LAN membership is not authentication. The reverse proxy, UI, custom API, worker, inference runtime, database and backup store are distinct boundaries. A host administrator can technically access server storage; application role separation cannot remove host-level trust. Record privileged access and restrict operators.

| Threat | Required control | Verification gate |
|---|---|---|
| LAN host bypasses proxy to access model/UI/database | Only HTTPS on approved LAN interface; firewall and container network isolation | Phase 1 scan from a second LAN host; direct service ports fail |
| Public registration or anonymous chat | Restricted bootstrap, named accounts, signup disabled, secure sessions | Phase 1 anonymous and signup negative tests, repeated after restart |
| Cloud endpoint or telemetry leaks content | Local endpoint allow-list, disabled integrations, deny internet egress | Phase 1 offline chat plus outbound firewall/DNS observation |
| Forged IDs, headers or shared links expose other departments | Server identity checks and database scope filters; repeat on citations/downloads | Phase 2/3 cross-department and admin-without-grant tests |
| Revoked grants leak through caches | Current-grant checks, tombstones and scoped cache invalidation | Phase 2/3 revoke while sessions remain active; model-context canary checks |
| Malicious source changes model instructions | Untrusted context, no executable tools, permission filtering before inference | Phase 3 injected-document fixtures; no unauthorised text in captured test context |
| Upload traversal, decompression bombs, corrupt documents | Generated storage paths, quarantine, type/size/time/decompression limits and scanning where feasible | Phase 3 malformed/oversized/path-traversal and worker-failure tests |
| Remote URL fetching enables SSRF | Disable URL ingestion initially, reject unapproved fetch destinations | Phase 3 loopback, metadata and internal-network fetch tests |
| Session theft, CSRF or spoofed proxy headers | TLS, secure cookies, CSRF where relevant, rate limiting; trust only known proxy | Phase 1 session review, Phase 2 expiry/CSRF/forged-header tests |
| Logs/backups expose secrets or contents | Content-free logs, restricted access, encrypted backups and separate keys | Each phase synthetic canary log inspection; Phase 6 restore/access test |
| Floating point or duplicate import changes financial totals | Decimal strings, explicit policy, immutable imports, idempotency and independent fixtures | Phase 5 exact totals, duplicates, rounding and ambiguous rows |
| AI bypasses approval or performs external writes | No bank/ERP/email execution tools; approval binds proposal version | Phase 5 role and stale-proposal tests; inspect routes/egress |
| Compromised dependencies or automatic upgrades | Reviewed versions/digests, lockfiles, vulnerability/licence review and offline archive | Foundation manifest review; scan before each upgrade |
| Model/worker exhaustion | Request, context, concurrency, disk and processing limits | Foundation resource benchmark; later cancellation and malformed-input tests |

## Release restrictions

Phase 1 permits only administrator synthetic chat. Phase 2 must pass identity/permission review before department access; Phase 3 must verify each retrieval path before private documents; Phase 5 requires accounts review before financial processing. Production release requires administrator approval, actual-host load tests and successful restore.

No arbitrary tool installation, public ingress, external LLM fallback, training, autonomous messages or write-backs. A failed security test closes the gate; do not weaken controls to make the smoke test pass.

## Outstanding security decisions

Confirm identity provider and offline availability, certificate trust owner, host administrator access, backup key custody, retention, break-glass procedure and approved network ranges. Review pinned upstream configuration and advisories: environment variables can be overridden by persisted UI settings. Do not claim the UI's collection permissions protect custom endpoints.
