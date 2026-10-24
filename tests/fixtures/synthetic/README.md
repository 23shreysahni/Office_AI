# Original synthetic evaluation inputs

These files contain original fictional text only. They are review/test inputs, not an implemented application, ingested files or passing model results. No staff identity, bank record or textbook has been imported.

- `library.json`: ten fictional sources with section provenance, active/superseded/deleted states, collection keys and synthetic actor role/grant definitions.
- `phase-3-rag.json`: 30 question/denial scenarios with expected source sections, facts and adversarial/race conditions.
- `phase-4-assistants.json`: 30 Editorial plus five HR and five Sales tasks with human-review rubrics.

Fixture actor/collection/document keys are local test references. The future isolated seed tool must map them to actual database UUIDs and verified test identities; no production endpoint may accept a fixture actor key or simulate login through a header. Document UUIDs here are synthetic. A profile is an additional scope restriction and never supplies a role/grant.

Materialise valid PDF/DOCX/TXT/MD inputs from this original text using a reviewed local generator before extraction tests. A JSON section locator establishes expected provenance for the fixture, not a PDF page number. Supply separate malformed/encrypted/image-only/decompression/traversal/scan-signature fixtures in the isolated security suite; these JSON files do not exercise binary parsers or scanning.

For an answer case, verify authorisation, selected source sections, actual outbound local-model context, factual support, current citations and output privacy. For a deny case, verify no context is dispatched and no source/existence detail is disclosed. For abstention, verify no invented fact/citation. Apply revoke/delete/revision scenarios through real API/database operations, not merely by changing an in-memory expected flag.

The global forbidden markers in the RAG fixture apply to its defined cases, none of which authorises the restricted Accounts note or deleted source. They are synthetic canaries, not secrets. Correct fact substrings alone cannot prove grounding, absence of additional false claims or permission enforcement; human review and negative HTTP/database/browser tests are required.

Store actual run outcomes separately with test commands, versions/digests, source/profile revisions, timestamps and reviewer outcomes. Keep these input fixtures labelled `NOT RUN`; do not turn their expected results into reported successes. Do not capture real tokens, private content or raw production logs. See [Phase 3](../../../specs/03-rag.md) and [Phase 4](../../../specs/04-department-assistants.md).
