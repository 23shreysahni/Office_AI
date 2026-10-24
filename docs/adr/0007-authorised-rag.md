# ADR 0007: Authorised retrieval boundary proposal

Status: **Proposed; not implemented or accepted.** Phase 2 identity/security acceptance is required first. Details: [Phase 3 specification](../../specs/03-rag.md).

Use the custom Express API and PostgreSQL scope-aware retrieval service for departmental files. Its own authenticated same-origin portal handles uploads, document status, search, answers and citation resolution. Node.js workers perform bounded extraction and local embedding. Open WebUI retains its foundation synthetic-chat role; its native uploads and file/RAG APIs remain disabled until a separately verified integration exists.

This avoids assuming that upstream administrator privileges or collection controls satisfy the stronger requirement that platform administrators have no automatic departmental entitlement. It also avoids granting Open WebUI a service account with unrestricted access to every collection. An upstream integration must preserve a verified end-user identity/current grants on each retrieval, never a caller-supplied department header.

Store scope on originals, revisions and chunks. Authorisation predicates constrain eligible database rows before ranking/limiting. Recheck permission/revision state before model dispatch and response/citation delivery. Use a transactionally published active revision, tombstones for immediate new-request deletion and lease-based idempotent background jobs. Disable positive authorisation/retrieval caches initially.

Only the approved local embedding and generation artefacts are used. Retrieved text is untrusted evidence, with no executable tools or remote fetching. Use validated source IDs/locations and abstention when support is absent. Start with bounded non-streaming answers; add streaming only after equivalent revocation, cancellation and citation tests are defined and passed.

Consequences: a new document/answer portal and worker/database migrations are required; the existing foundation UI does not gain private-document access automatically. This proposal changes neither current Compose/proxy routes nor actual permissions. Benchmark and review exact retrieval/index/tokenisation choices before deployment on either Windows/WSL or native Linux.
