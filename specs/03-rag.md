# Phase 3: Document ingestion and authorised retrieval

Status: **Review draft; implementation and live acceptance NOT RUN.** Requested by the user with Phase 4. Prepare this phase first; do not implement or accept it before [Phase 2](02-access-control.md) identity/permission acceptance. Phase 1 actual-host acceptance also remains open. The synthetic evaluation fixtures below are test inputs, not passing model results.

Parent requirements: [SPEC.md](../SPEC.md), [architecture](../docs/architecture.md), [proposed retrieval boundary](../docs/adr/0007-authorised-rag.md). API contract: [draft OpenAPI](03-rag.openapi.json). Acceptance: [test matrix](../docs/phase-3-test-plan.md). Evidence: [preparation report](../docs/phase-3-verification.md).

## Entry conditions and scope

- Phase 1 F01–F14/W01–W04 and Phase 2 A01–A24 have actual-host evidence and the required human review. An API design or simulated identity is not a substitute.
- Confirm database/pgvector, extraction, scanning, Node.js and model/runtime pins, licence/advisory review, language coverage and offline archives. Reuse the approved OIDC session/current grants; no alternate password login or trusted department header.
- Approve the custom authorised-retrieval route in ADR 0007. Keep native Open WebUI file ingestion, arbitrary tools and external providers disabled. Use the authenticated same-origin application portal for document/search/answer operations until an upstream integration passes equivalent negative tests.
- Use original synthetic PDF/DOCX/TXT/MD fixtures. No real employee, bank, publisher or textbook material is authorised by this task. No spreadsheet imports, OCR implementation, remote URL ingestion, accounts calculations, training or outbound actions.

Deliver JavaScript/Express upload/document/search/answer routes, a bounded Node.js worker, PostgreSQL/pgvector metadata/index and encrypted local originals. Deliver a document-status and citation UI, tombstone/delete/reindex, safe failures, negative HTTP/database/browser tests, 30-question grounded retrieval evaluation, and offline restore/rollback instructions. Every custom service gets a lockfile and exact reproducible commands when implemented.

## Permission extension

Reads require the active session/user, matching department role, explicit active collection grant and active collection from Phase 2. No administrator bypass. Search results, totals, job status, snippets, filenames, citations, original downloads and answer context all require authorisation.

Proposed Phase 3 migration: extend each collection grant with `can_manage`, default **false** for existing/new grants. Upload, delete and reindex additionally require that flag. The reviewed administrative grant endpoint must explicitly accept this field and audit changes; a platform administrator cannot assign it to themselves. A grant-management capability is not a content-read bypass. Do not change collection ownership through document metadata or accept an unauthorised `collectionId`. No scope-changing document endpoint in this phase; moving a document requires a separately reviewed re-ingestion operation.

This extension is proposed, not silently present in the Phase 2 contract. Finalise its migration and API amendment before implementation. A worker revalidates the initiating user's active manage grant when claiming work and before publishing a revision. Revocation or a document tombstone cancels work rather than publishing stale results.

## Upload and processing contract

Accept exactly one file and an authorised collection UUID. Allow text PDFs, DOCX, TXT and Markdown only. Check extension, claimed MIME and actual signature/container/text encoding; reject ambiguous or mismatched formats, encrypted/corrupt files, unsupported encodings and executable/container content masquerading as text. Reject DOC/DOCM, archives other than validated DOCX, CSV/XLSX and URLs. DOCX external relationships/embedded objects/macros are rejected and never fetched or executed; render Markdown/HTML as escaped text.

Initial pilot limits, to be measured and approved on the actual host:

| Limit | Candidate |
|---|---|
| File bytes | 20 MiB; multipart envelope at most 21 MiB |
| Files per upload | Exactly one |
| Extracted text | 2 million Unicode code points per source |
| DOCX expanded bytes | 100 MiB total, bounded entry count and paths; reject traversal/symlinks |
| DOCX compression ratio | At most 100:1; enforce before unbounded expansion |
| PDF pages | 500 maximum |
| Extraction wall time | 60 seconds in an isolated child process with memory/CPU limits |
| Worker concurrency | One extraction; durable queue with bounded retries and capacity |

Use generated filesystem identifiers below a fixed quarantine root; never join a client filename to a storage path. Strip control characters from the display filename, bound its length, and do not use it as an identity or log field. Hash the original bytes with SHA-256 while streaming; abort oversized/interrupted uploads and clean partial files. A duplicate within an authorised collection returns the existing authorised document result; duplicates in inaccessible collections must not leak existence through a global deduplication response.

Scan locally before extraction with a pinned offline-capable scanner and recorded signature version. Scanner outage/timeouts fail closed for private ingestion; a synthetic fixture-only scanner stub cannot satisfy acceptance. Update signatures only during the controlled provisioning window. Extraction runs without network access, shell execution, Docker socket or write access beyond its isolated temporary directory. Enforce input/output/time limits even when the parser reports success.

Processing states: `quarantined` → `queued` → `processing` → `ready`; explicit terminal/review states `rejected`, `failed`, `ocr_required`, `deleting`, `deleted`. A bounded retry may requeue a transient failure; malformed inputs are not retried indefinitely. Record sanitised error codes, attempts, lease/heartbeat and expiry; crashed workers recover expired leases idempotently. Never expose parser diagnostics or text in status errors.

Image-only PDFs are `ocr_required`, not searchable/ready. Partially scanned PDFs report incomplete extraction and require operator review; do not silently claim full document coverage. Return known page/section provenance only; no invented PDF page numbers or DOCX pagination. TXT/MD/DOCX may use paragraph/heading or line-range locations. Empty or unextractable documents never receive a searchable ready revision.

## Revision, index and deletion semantics

Store generated document/revision/chunk IDs, original hash, collection, extraction/parser version, source locations, chunk order, text hash, embedding model name/full digest, dimensions and status. Embed only through the approved local model endpoint. A missing embedding model gives a bounded local failure, with no automatic internet pull or remote fallback. Benchmark English, Hindi and mixed-language fixtures before selecting the embeddings model. Reject dimension/digest mismatches rather than silently mixing embeddings.

Chunk using the approved model/tokeniser with recorded settings; candidate 384-token chunks with 48-token overlap. Preserve source boundaries and exact text offsets. Token counts must use a verified compatible tokeniser. Do not equate characters with tokens. Reject a single fragment that exceeds extraction/context limits rather than silently losing provenance.

Reindex builds a new non-visible revision and publishes it transactionally only after all chunks/vectors/provenance validate and current authorisation/document state is rechecked. Failed reindex leaves the old approved active revision searchable, with a visible failed-job status. Publish one active revision atomically; superseded revisions are not searched or used for new citation resolution.

Delete first tombstones the document transactionally, making every read/search/citation ineligible immediately for new requests; remove chunks/vectors/originals asynchronously with a retryable deletion job. Late extraction/reindex completion cannot resurrect it. Keep only content-free audit/tombstone metadata according to the approved retention policy. Deletion is not claimed to erase existing backups or text already delivered to an authorised browser; document backup expiry and restored-deletion reconciliation.

## Retrieval and model boundary

1. Validate the session and request, resolve current roles/grants server-side and intersect any requested collection UUIDs with them. Explicit unauthorised requested IDs are rejected uniformly, never silently expanded into additional access.
2. Query eligible active document revisions/chunks with scope predicates **inside the database query before ranking/limiting**. For the pilot use exact ranking over eligible candidates if necessary to avoid unsafe global nearest-neighbour shortlist/filter behaviour. Do not retrieve globally then remove forbidden rows. Explain/query-test the selected pgvector/index strategy before optimising.
3. Return at most eight bounded hits with exact source IDs/revision/locations. Query text/snippets are protected content and never go to logs, analytics or shared caches. Disable shared retrieval/answer caches initially.
4. Before model dispatch, recheck user/collection grants and all selected revisions/tombstones. A revocation/deletion between retrieval and dispatch removes the context and aborts/retries under current authority. Capture outbound context only in restricted synthetic tests to prove forbidden canaries never reach inference.
5. Assemble fixed system instructions and explicitly labelled untrusted source blocks; never merge source text into system/developer instructions. Disable tools, URL fetches and model-selected routes. Use only the approved locally installed generation model/digest.
6. Bound context with measured token counts: starting context 4,096, output cap 250, system budget 768, question 512, evidence at most 1,536, leaving a safety margin. Adjust only with reviewed benchmark evidence. No evidence/insufficient support produces an explicit 'not found in approved documents' answer, not unsupported general knowledge or a different provider.
7. Proposed first API is bounded non-streaming so current authorisation/citations can be checked again before returning the answer. Browser cancellation aborts downstream work within five seconds. Poll in-flight permission changes at most every second and discard the result when revoked. Document that already-dispatched text cannot be recalled from the local runtime; no newly unauthorised request may dispatch context.
8. Cite only source blocks actually selected and still authorised. The server validates cited IDs/revision/locations against that request's evidence set; invented, stale or unauthorised citation IDs invalidate the result. A model assertion is not proof that a claim is supported; evaluate grounding independently. Citation/download requests perform fresh authorisation.

Conflicting active sources are reported with citations and uncertainty; do not silently choose authority using arbitrary filenames or timestamps. Use explicit approved revision metadata. No answer claims full coverage of unprocessed/partially extracted material. Ordinary chat can remain separate; this retrieval route does not fall back to unrestricted chat on an error.

## API, UI and audit

Use the [draft `/api/library/` contract](03-rag.openapi.json), separate from upstream WebUI paths. Inherit secure server-side sessions, exact-Origin plus CSRF checks, bounded request parsing, deny-by-default permissions, rate limits, no-store responses and content-free audit from Phase 2. Recheck every object ID; absent and forbidden objects use the same 404 response. Never return raw storage paths, SQL/parser errors, model credentials or unrestricted signed links.

The portal shows authorised documents, processing/incomplete-extraction states, cancellation and actionable local failures. Source snippets/labels are escaped, downloads use attachment disposition and `nosniff`, and source resolution is authenticated. Users with read-only grants do not see management controls, and direct mutation requests are denied server-side. Reject unbounded pagination and exports. No arbitrary URL/browser rendering of originals.

Audit upload accepted/rejected, job outcome, revision publication, deletion, denied lookup and retrieval outcome using opaque IDs, counts and timings only. Exclude filenames, hashes if sensitive, queries, prompts, source text and answers. Persist security state changes with their audit record transactionally; audit failure must not publish a mutation.

## Migrations, offline operation and recovery

Add ordered migrations for documents, revisions, chunks/vectors, durable jobs, provenance and `can_manage`. Restrict the API/worker/migration database roles and generated storage roots separately. Retain exact supported schema/parser/model metadata; changing embedding dimensions or parser rules requires a new revision/reindex migration plan.

Before deployment provide actual setup/migration/seed/test/smoke commands, parser/model archives and checksums; do not invent commands for unimplemented services. Extend encrypted consistent backups to database, originals and exact locally archived runtime/embedding/generation artefacts. Restore into a separate empty Linux-filesystem target (WSL or native Ubuntu), preserving authoritative scopes and tombstones. Verify index/provenance/file checksums and repeat ACL/revocation tests offline. Roll back with matching images/configuration and pre-migration snapshot; do not downgrade against migrated data.

## Acceptance and evidence

Execute R01–R20 in [the test matrix](../docs/phase-3-test-plan.md), including actual HTTP/database/browser upload → extract → embed → retrieve → answer → cite and the complete [30-question fixture](../tests/fixtures/synthetic/phase-3-rag.json). All unauthorised-context/citation/download cases must show zero leakage. Every answerable case needs correct source support; every absent/forbidden case must abstain/deny as specified. Human review verifies factual grounding; keyword checks alone cannot pass the phase.

Current status: prerequisite gates open; retrieval/API/worker/database/UI implementation absent; fixtures prepared but no model/e2e evaluation run. Human security review is required before private uploads or [Phase 4](04-department-assistants.md). No production configuration changes accompany this draft.
