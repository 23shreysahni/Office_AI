# Phase 4 preparation and verification

Status: **Draft specification, instructions and evaluation inputs prepared; runtime implementation/acceptance NOT RUN.**

Prepared the [department-assistant specification](../specs/04-department-assistants.md), three review-only [Editorial](assistants/editorial.md), [HR](assistants/hr.md) and [Sales](assistants/sales.md) instruction drafts and [30 Editorial plus 10 HR/Sales evaluation cases](../tests/fixtures/synthetic/phase-4-assistants.json).

Phase 3 has no runtime implementation or acceptance evidence; Phase 1/2 gates remain open. No assistant instructions were installed in Open WebUI/Ollama, no profile grants were created, no staff/private documents imported and no model answers generated. No drafting, sending, CRM/ERP action or employee-record modification occurred. Static fixture integrity checks are not factual-grounding/usefulness or no-leakage evidence.

Executed Node.js static consistency checks: exactly 30 Editorial, five HR and five Sales cases; unique case IDs, valid actor/source/section references, active evidence with declared scope eligibility and profile/department alignment. Hindi source/questions were verified as UTF-8 Devanagari. Repository documentation checks covered 33 Markdown files, 118 local links and balanced fences. All 40 evaluation outcomes remain NOT RUN; no local-model, HTTP or browser evaluation was performed. No foundation test rerun was needed for these documentation/fixture-only changes.

Remaining: complete prerequisite phases sequentially, approve profile/source bindings, implement the reviewed answer-API amendment and authenticated UI, execute D01–D10 and all 40 cases with actual local-model/HTTP/browser evidence, test offline recovery and obtain department/security review. Phase 4 is not accepted; Phase 5 remains closed.
