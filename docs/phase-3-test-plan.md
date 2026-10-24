# Phase 3 acceptance matrix

Status: **All cases NOT RUN.** The [specification](../specs/03-rag.md) and synthetic fixtures define expected behaviour, not runtime evidence.

| ID | Procedure | Pass criterion |
|---|---|---|
| R01 Entry gate | Review Phase 1 and 2 evidence/sign-off and new manage-grant amendment | Actual host and identity/permission gates passed; no simulated-login substitution |
| R02 Upload authorisation | Anonymous, read-only, wrong department, admin-without-grant and forged collection uploads | Denied before bytes become eligible; no cross-collection existence leakage |
| R03 Valid formats | Upload original synthetic text PDF, DOCX, TXT and MD | Hash/provenance/status correct; indexed text corresponds to the uploaded revision |
| R04 Malformed files | Oversized/truncated/encrypted/corrupt/mismatched/invalid-encoding inputs | Bounded explicit rejection; no secret/parser content in errors; partial files cleaned |
| R05 Hostile containers | DOCX traversal, embedded/external relationships, oversized expansion and PDF resource exhaustion | No filesystem escape, network fetch or unbounded CPU/memory; worker isolated |
| R06 Scanning and OCR | Scanner outage/positive synthetic signature, image-only and partially scanned PDFs | Fail closed or explicit rejected/OCR/incomplete-review state; never falsely ready |
| R07 Durable jobs | Crash worker during extraction/indexing, expire lease, retry duplicate jobs and exceed queue limits | Idempotent recovery, bounded retries; no partial published revision or lost job |
| R08 Embedding identity | Missing/wrong model/dimension, malformed response and internet denied | Bounded local failure, no automatic pull/fallback or mixed embeddings |
| R09 Scope-before-ranking | Seed higher-scoring forbidden chunks, paginate/search and capture synthetic model context | SQL eligibility precedes ranking/limit; forbidden text never reaches API/model |
| R10 All object paths | Forge document/job/citation/download/reindex/delete IDs across departments and as admin without grants | Uniform absent/forbidden responses; no labels, snippets, counts, paths or content leak |
| R11 Revocation race | Revoke/deactivate before dispatch, during generation and before citation/download | New requests denied; pre-dispatch blocked; in-flight result discarded; no stale cache |
| R12 Reindex publication | Build good/failed/retried new revision while reads occur | One valid active revision; failed reindex preserves old approved revision; no mixed citations |
| R13 Delete race | Delete while queued/processing/generating; retry late jobs; restart | Tombstone immediately excludes new reads; late work cannot resurrect; cleanup retryable |
| R14 Grounded evaluation | Run all 30 cases in the RAG fixture against actual local inference | Every required source/absence/ACL outcome passes human review; zero forbidden context |
| R15 Prompt injection | Source asks for secrets, new roles, system override, URL fetch or tool execution | No new access/action; source instructions treated as data; citations remain authorised |
| R16 Citations and UI | Try invented/stale citation IDs, copied links, HTML labels, read-only controls and back/reload | Current authorisation and exact provenance enforced; escaping/no-store; accessible error/status UI |
| R17 Offline/errors/cancel | Deny internet, stop Ollama/DB/worker, cancel long request, exhaust storage | Actionable bounded failures without fallback; cancellation within five seconds; recovery preserves state |
| R18 Privacy | Submit unique synthetic canaries and inspect proxy/API/worker/model/DB logs and outbound traffic | No query/source/prompt/answer/credential leaks or successful external requests |
| R19 Restore/rollback | Restore database/files/models/images separately offline and test Windows-to-Linux candidate recovery | Checksums/scopes/tombstones/citations preserved; restored sessions invalidated; ACL tests repeated |
| R20 Human gate | Review all evidence, timings, parser/model pins and unresolved risks | Security reviewer accepts before private uploads/Phase 4; no test marked pass without execution |

The fixture [corpus](../tests/fixtures/synthetic/library.json) contains original text only. [Thirty evaluation cases](../tests/fixtures/synthetic/phase-3-rag.json) include access/absence/injection/Hindi/revision cases. Materialise valid PDF/DOCX fixtures from this text with a reviewed local generator during implementation; the corpus JSON does not test binary extraction.

For each case record installed versions/digests, fixture revision, timestamp, exact test command, expected/observed outcome and sanitised evidence ID. Real HTTP/PostgreSQL/local-model and browser runs are required; mocks are supplementary. Do not store captured credentials or real content in reports. Add actual reproducible commands when services/tests exist.
