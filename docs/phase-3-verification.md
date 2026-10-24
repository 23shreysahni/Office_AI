# Phase 3 preparation and verification

Status: **Draft specification and synthetic evaluation inputs prepared; runtime implementation/acceptance NOT RUN.**

Prepared [RAG specification](../specs/03-rag.md), [API contract](../specs/03-rag.openapi.json), [retrieval ADR](adr/0007-authorised-rag.md), [R01–R20 acceptance matrix](phase-3-test-plan.md), original [synthetic corpus](../tests/fixtures/synthetic/library.json) and [30-case evaluation](../tests/fixtures/synthetic/phase-3-rag.json).

Phase 1 live acceptance remains open and Phase 2 has no runtime identity/API/database implementation. No ingestion, parser, scanner, embeddings, retrieval, model answer, citation UI or worker was installed or exercised. No upload restriction, proxy rule, provider or real document changed. JSON/static fixture checks cannot prove extraction, grounding, ACL enforcement or prompt-injection resistance.

Static checks executed with Node.js built-in filesystem/assertion tools: 33 Markdown files, 118 resolving local links and balanced fences; draft library OpenAPI JSON with eight paths, ten unique operations, complete path parameters, session/CSRF/Origin on mutations and 86 resolving internal references. The ten-source corpus and all 30 RAG cases passed fixture-reference, current-source, declared actor/scope and expected-fact consistency checks. Hindi text/questions were explicitly checked for preserved Devanagari UTF-8 after correcting Windows pipeline encoding during preparation. These checks do not validate a real tokeniser, parser, database query or model response; no full OpenAPI schema validator was run. Foundation tests were not rerun for documentation/fixture-only changes.

Remaining: complete prerequisite gates; approve the manage-grant/schema and custom retrieval integration; pin/review dependencies/models; implement one testable unit at a time; run R01–R20 and all 30 questions with actual HTTP/database/local-model/browser evidence; test offline recovery; obtain human review before private documents or Phase 4. All runtime results remain NOT RUN.
