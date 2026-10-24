# Codex Repository Instructions — Local Office AI

## Mission
Build the private LAN-hosted AI platform described in `SPEC.md`. Prioritise confidentiality, correctness, incremental delivery and reproducible verification.

## Read before changing code
1. `SPEC.md` (product requirements and phase gates).
2. `docs/architecture.md` when available.
3. The relevant `specs/NN-*.md` for the current phase.

## Workflow: specification first
- Work on **one phase at a time** in the sequence given in `SPEC.md`.
- Start by checking whether phase specifications and acceptance tests exist. Write/update them before code.
- Explain assumptions and design decisions; record architecture changes in `docs/adr/`.
- Implement the smallest testable unit, then run tests and document results.
- Finish each phase with changed files, verification commands, test results, risks, and remaining work. Do not claim unrun tests passed.
- Require human review before progressing through security-sensitive or accounts gates.

## Application stack
- Use Nginx as the HTTPS reverse proxy, with internally trusted TLS certificates and LAN/VPN-only access.
- Use JavaScript (ES modules), a supported Node.js LTS release and Express 5 for custom HTTP APIs.
- Implement background workers in Node.js; retain Ollama and Open WebUI as upstream self-hosted infrastructure.
- Use npm, commit `package-lock.json`, install with `npm ci`, and pin dependency/runtime versions before deployment.
- Validate request payloads server-side and verify API behaviour with HTTP integration and security tests.

## Non-negotiable constraints
- No fine-tuning or training in v1.
- Self-hosted inference using Ollama and locally installed open-weight model; no external LLM API fallback.
- LAN/VPN-only access, authenticated HTTPS, no public sign-up.
- Enforce document scopes in retrieval BEFORE passing text to the model.
- Separate departmental permissions and validate them using negative tests.
- Never store secrets, real bank statements, employee personal data or private textbook files in git, tests or logs.
- Financial arithmetic must use deterministic Node.js code (`decimal.js`) and PostgreSQL `NUMERIC` where persisted, with independent reconciliation tests. Parse and serialise amounts as decimal strings, define precision/rounding explicitly, and never use JavaScript `Number` or `parseFloat` for monetary calculations; generated model prose is never authoritative for amounts.
- No autonomous bank/ERP write-backs, outbound messages, or approval bypass.
- Prefer pinned supported images/dependencies and documented migrations over floating `latest` in production.
- Prefer British English in comments, UI copy and documentation.

## Quality gates
- Add tests for every behavioural change; include integration and security tests for permissions and data flows.
- Provide a documented offline smoke test.
- Provide reproducible setup, migration, backup/restore and rollback instructions where relevant.
- Handle malformed uploads, inaccessible documents and offline errors explicitly.

## Default first task
Read `SPEC.md`; execute **Phase 0 only** and produce a reviewable architectural plan and `specs/01-foundation.md`. Do not start coding deployment services until the foundation spec is approved.

## Current progress

A separate read-only local review interface is available via `npm run preview` on `http://127.0.0.1:4173`. See `specs/00-local-review.md` and `docs/local-review.md`. This development-only interface serves synthetic examples and recorded status; it adds no production identity, ingestion, inference or accounts service and does not satisfy a phase gate. Do not expose/tunnel it to the LAN or public internet.

The user requested Windows as the initial host and OS portability on 19 October 2026. Follow `docs/windows.md` and ADR 0005: one Linux-container stack, deployed from Ubuntu WSL 2 with Docker Desktop on Windows or from native Ubuntu Server. Deployment state belongs in the Linux filesystem. Complete F01–F14 plus W01–W04 on the initial Windows host; do not interpret Windows support as evidence that live acceptance passed.
The default first task above applies to a fresh repository. The user approved Phase 1 implementation on 19 October 2026 and selected Nginx. Follow `specs/01-foundation.md` and `docs/phase-1-verification.md` for current scope/evidence. Complete outstanding actual-host acceptance before marking Phase 1 accepted or progressing to Phase 2.
