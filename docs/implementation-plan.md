# Incremental implementation plan

The strict sequence in [SPEC.md](../SPEC.md) governs implementation. [Phase 1](../specs/01-foundation.md) has implementation and local verification; actual-host acceptance remains open. [Phase 2](../specs/02-access-control.md) has a draft specification, API contract and acceptance matrix without runtime services. [Phase 3](../specs/03-rag.md) now has a draft library API, retrieval/ingestion plan and 30 synthetic evaluation cases; [Phase 4](../specs/04-department-assistants.md) has draft instructions and 30 Editorial plus 10 HR/Sales evaluation cases. These requested review artefacts do not start or accept those phases. Implement and review each phase sequentially after its prerequisites pass. Phases 5/6 remain a roadmap.

| Phase | Smallest deliverable and verification | Stop condition |
|---|---|---|
| 0: discovery and architecture | Review these documents, resolve server/identity facts, complete dependency manifest prerequisites | Foundation spec reviewed and explicitly approved; unresolved deployment facts recorded |
| 1: foundation | Pinned proxy/UI/Ollama Compose, synthetic authenticated chat, persistence, offline and rollback scripts | All foundation acceptance cases have actual-host evidence and human review |
| 2: identity and permissions | Write access-control spec and OpenAPI first; add minimal JavaScript/Express auth/permissions/audit with migrations and HTTP negative tests | Human review of identity and department isolation before staff access |
| 3: ingestion and RAG | Write RAG spec first; bounded Node.js extraction worker, local embeddings and database-filtered search/citations | 30-case grounded evaluation, negative ACL and prompt-injection tests pass |
| 4: assistants | Write focused assistant spec before configuration; approved department instructions/collections and synthetic editorial evaluations | Staff review usefulness, grounding and segregation |
| 5: accounts | Write accounts spec and monetary policy first; implement decimal-safe import validation before summaries/proposals/approval/export | Independent reconciliation and audit tests; human financial approval; no write-backs |
| 6: release | Write operations spec first; actual-host load, retention, encrypted backup/restore and vulnerability review | Administrator release sign-off |

## Foundation implementation order after approval

1. Resolve host/network/DNS/CA facts and exact compatible image/model pins; prepare a restricted synthetic test environment.
2. Write Compose and proxy configuration with private networks, volumes, resource limits, readiness and LAN binding checks. Do not expose incomplete bootstrap to the LAN.
3. Provision the local model and restricted administrator, disable signup/integrations, capture effective settings and digests. Close the download window.
4. Implement offline smoke checks and explicit unavailable-model/error handling. Record baseline benchmark, restart persistence and negative access tests.
5. Document installation, encrypted consistent snapshots, restoration and rollback; verify on an isolated target. Record results and stop for review.

## Specification naming

Follow the numbered phase titles in `SPEC.md`. Existing example filenames omit the department-assistant phase; when later specs are created, name them consistently as `02-access-control.md`, `03-rag.md`, `04-department-assistants.md`, `05-accounts.md` and `06-operations.md`. The foundation specification remains `01-foundation.md`.
