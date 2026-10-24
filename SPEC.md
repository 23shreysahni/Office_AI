# Local Office AI Platform — Product and Engineering Specification

**Status:** Ready for phased implementation with Codex  
**Version:** 1.2  
**Date:** 19 October 2026  
**Deployment:** Self-hosted on a local office server (LAN/VPN only)  
**Primary language:** British English  
**Fine-tuning:** Explicitly OUT OF SCOPE for v1

## 1. Goal

Build a secure, self-hosted AI assistant for authorised employees of an educational publishing company. Staff can ask questions about approved company documents, draft and review content, and undertake controlled accounts workflows. Company data remains on company-controlled infrastructure; do not use external inference APIs or cloud storage by default.

**Guiding principle:** A useful, verifiable local AI system first. No training/fine-tuning, no autonomous accounting changes, and no unrestricted access to company records.

## 2. Baseline decisions and assumptions

- **Default LLM:** `qwen3.5:9b` in Ollama. Qwen3.5-9B is an Apache-2.0 licensed open-weight multimodal model, but v1's first RAG pipeline handles text extracted from files. Do not claim that arbitrary scanned PDFs work without implementing OCR/extraction.
- **Fallback for constrained servers:** `qwen3.5:4b`; **higher-capacity candidate:** `qwen3.5:27b`, benchmarked before adoption. Check available tags, compatibility, and licence at installation.
- **Inference:** Ollama, pinned stable release; pull model once at provisioning, record its model digest, and prevent accidental production upgrades.
- **Deployment:** Portable Linux-container Compose stack, initially on Windows with Docker Desktop's WSL 2 Linux backend and an Ubuntu WSL deployment shell; also deployable on Ubuntu Server LTS with Docker Engine/Compose. Keep the application and state in the Linux filesystem. Reverse proxy with HTTPS (Nginx) and private DNS/VPN as needed. Host-specific networking, boot recovery and offline restore must pass acceptance on each target OS; see `docs/windows.md`.
- **UI:** Open WebUI, pinned release, for AI chat and RAG. **Important:** Validate its specific version's role/collection access controls before enabling user uploads. If adequate document ACLs cannot be demonstrated, use the bespoke API's authorised retrieval endpoint or isolate department instances.
- **Custom application stack:** JavaScript (ES modules) on a supported Node.js LTS release, with Express 5 for the business API and Node.js for background workers. Use server-side schema validation, strict authorisation and auditable workflows. No custom Python/FastAPI services are planned.
- **Dependency management:** npm with committed `package-lock.json`; use `npm ci` for reproducible installation. Pin exact runtime, package and container versions during Phase 0 compatibility review before deployment.
- **Financial arithmetic:** `decimal.js` for deterministic decimal calculations and PostgreSQL `NUMERIC` for persisted amounts. Parse and serialise monetary values as decimal strings; never convert them through JavaScript `Number`, `parseFloat` or floating-point SQL types. Define currency scale, precision limits and rounding explicitly; validate results with independent reconciliation tests.
- **Database:** PostgreSQL for app data; pgvector for the custom, ACL-filtered retrieval service when introduced. Use a local embeddings model (for example `nomic-embed-text` subject to compatibility and language testing).
- **Object storage:** Encrypted local filesystem volumes initially; optional MinIO only if justified.
- **Users:** Initial pilot 3–5, expand after load testing. Assume unknown RAM/GPU/user concurrency until discovery.
- **Authentication:** Named user accounts, deny-by-default RBAC, admin-managed provisioning, no public sign-up. Prefer existing OIDC/SSO if available; avoid implementing passwords from scratch.
- **Accounts:** Only approved data imports; all calculations deterministic and reconciled. AI explains or proposes, never posts transactions automatically.

### Hardware discovery gate

Before deployment, collect: CPU, RAM, NVIDIA GPU and VRAM, disk capacity, operating system, concurrent users, backup destination, network addressing, and available identity provider. Run one representative benchmark with the 9B model. **Do not promise throughput, memory fit, or context length before measurement.** If the 9B model cannot meet targets, select a smaller quantisation/model or propose a hardware upgrade.

## 3. Scope

### In scope for v1

1. Private browser chat with streamed local LLM responses.
2. Administrator-managed employee accounts, departmental roles, and audit trail.
3. Upload/search of approved PDF, DOCX, TXT and Markdown documents; support CSV/XLSX imports to specialised validated workflows rather than treating spreadsheets as plain RAG documents.
4. Department-level document segregation, citations (source filename/page or section), and explicit uncertainty when no supporting evidence exists.
5. Editorial assistant: British English, text-grounded corrections, chapter-based questions, style guidance.
6. HR assistant: draft notices and emails from approved non-confidential policy material.
7. Accounts assistant: read-only import and party-wise statement summaries; proposed bank reconciliation and vendor adjustment reports that require human approval.
8. Dashboard for uploads, processing failures, usage and access audit events.
9. Offline operation after packages/models are installed; no external analytics/telemetry or internet-bound model requests from production.
10. Tested backup and recovery procedure; administrator runbook.

### Out of scope for v1

- Fine-tuning, LoRA, QLoRA, training datasets or GPU training infrastructure.
- Automatic bank transactions, ERP postings, email sending or employee record modifications.
- Production-wide autonomous agents or unreviewed tool execution.
- Internet-facing unauthenticated access.
- Assuming that an LLM can perform authoritative arithmetic or compliance decisions.
- Importing live bank credentials or unapproved sensitive documents.

## 4. User roles and permissions

| Role | Chat | Department documents | Accounts reports | Admin |
|---|---|---|---|---|
| Platform admin | Yes | Explicitly granted only | Explicitly granted only | Users, models, system |
| Editorial user | Yes | Editorial | No | No |
| HR user | Yes | HR permitted collection | No | No |
| Sales user | Yes | Sales | No | No |
| Accounts user | Yes | Accounts | Read-only/propose | No |
| Accounts approver | Yes | Accounts | Review/approve exports | No |

- A system administrator is not automatically entitled to view confidential departmental documents; define controlled break-glass procedure with audit where feasible.
- Every document and derived chunk has a department/collection access scope. Filtering MUST occur at the data-retrieval layer BEFORE text reaches the LLM, not only in the UI.
- All API operations require server-side permission checks, including downloads, citations, import history, chat attachment references and exported files.
- Permissions changes immediately affect new retrieval requests. Test for tenant/department crossover and forged IDs.

## 5. Architecture

```text
Staff browser (office LAN / VPN)
       |
HTTPS reverse proxy (internal only)
       |
  +----+-----------------------+
  |                            |
Open WebUI                    Node.js / Express business service
  |                            |-- PostgreSQL (users/metadata/audit)
  |                            |-- pgvector (ACL-filtered retrieval)
  |                            |-- Local document storage
  |                            |-- Import/reconciliation workers
  +----------+-----------------+
             |
        Ollama inference
             |
       Qwen3.5 9B

All services run on internal Docker networks. No model or DB port is
published publicly. Only the authenticated HTTPS entry point is exposed.
```

**Integration caveat:** Open WebUI has its own auth and collection mechanics. Do not assume the bespoke Express service inherits its identity. Choose a verified shared OIDC provider or a trusted, documented token-exchange integration. Until this is working, keep the custom accounts module separately authenticated and unexposed to ordinary chat tools.

## 6. Repository structure (target)

```text
office-ai/
├── AGENTS.md
├── SPEC.md
├── README.md
├── .env.example
├── .gitignore
├── compose.yaml
├── infra/
│   ├── proxy/
│   ├── scripts/
│   └── backup/
├── services/
│   ├── api/
│   │   ├── src/{auth,documents,retrieval,accounts,audit}/
│   │   └── tests/
│   └── worker/
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── deployment.md
│   ├── runbook.md
│   └── adr/
├── specs/
│   ├── 01-foundation.md
│   ├── 02-access-control.md
│   ├── 03-rag.md
│   ├── 04-department-assistants.md
│   ├── 05-accounts.md
│   └── 06-operations.md
└── tests/
    ├── integration/
    ├── security/
    └── fixtures/synthetic/
```

Folder tree is an implementation target, not a claim that the application exists. Each custom service will have a `package.json`, committed `package-lock.json`, JavaScript source under `src/`, and tests. Open WebUI and Ollama remain upstream self-hosted services; the JavaScript requirement applies to custom application code. See `docs/adr/0001-javascript-stack.md` for the stack decision.

## 7. Functional requirements

### FR-01 Local model chat
- Admin selects locally installed approved Ollama model (default `qwen3.5:9b`).
- User sends a message and receives a streaming response; user can cancel generation.
- System prompt requires British English and concise, evidence-based answers; a department assistant may add narrower rules.
- Show a clear warning that generated content must be reviewed.
- Chat transcripts must follow configured retention and access permissions.

**Acceptance:** After disconnecting the internet, a permitted user can chat within LAN; no inference payload goes to an external API.

### FR-02 Accounts and access control
- Admin provision/deactivate users; no self-registration in production.
- Role changes enforced server-side on every request.
- Session expiry, secure cookies, CSRF protection where relevant, login rate limiting and audit events.
- Document upload/search/download restricted by access scope.

**Acceptance:** An Editorial user cannot retrieve, cite, download or infer any Accounts or HR restricted content, including via forged IDs or shared links.

### FR-03 Document ingestion and retrieval
- Accept PDF, DOCX, TXT, MD with size/type limits, magic-byte checks and antivirus scanning where feasible.
- Reject encrypted/corrupt files gracefully. Detect image-only PDF and mark `OCR required`; do not silently mark it indexed.
- Extract text and source locations; chunk with metadata; embed locally; store provenance and ACL metadata.
- Reindex/delete when source changes; deleted files and chunks must no longer be searchable.
- Search only chunks authorised for the current user; use citations and a 'not found in approved documents' response on insufficient evidence.
- Treat document content as untrusted. Do not follow embedded prompt instructions from retrieved documents.

**Acceptance:** A test answer cites a valid document/section; an unauthorised collection never appears in search results or model context.

### FR-04 Editorial assistant
- Apply British English spelling and publisher-defined approved style rules.
- For 'strictly according to text' exercises, answer only from authorised provided chapter text, do not invent missing facts.
- Draft questions/answers, grammar corrections and worksheets for human review.

**Acceptance:** Pass a 30-case synthetic editorial test covering spelling, factual grounding and formatting.

### FR-05 HR and sales assistants
- Draft but do not send external messages.
- Use approved policies/catalogue files only; distinguish draft text from authoritative HR/legal guidance.
- Respect collection permissions.

**Acceptance:** Draft output is editable, attributed to source where applicable, and cannot be sent automatically.

### FR-06 Accounts module (separate controlled workflow)
- Upload CSV/XLSX transaction exports or bank statement PDFs only after approval; preview parsed rows and make user confirm bank/date/currency/column mapping.
- Parse accounting data into typed records: date, narration, reference, debit, credit, balance, counterparty, source file/row.
- Maintain original file hash and immutable raw import; flag duplicate uploads and ambiguous rows.
- Calculate balances, totals, party-wise grouping and reconciliation differences via deterministic Node.js code using `decimal.js` and, where needed, PostgreSQL `NUMERIC`, never the LLM. Accept and return monetary amounts as validated decimal strings with explicit currency scale, precision limits and rounding. Reject malformed, non-finite and out-of-range amounts.
- LLM may recommend candidate matches and explain discrepancies, but show evidence, confidence, and unresolved items.
- Human approver must confirm adjustments; v1 generates a reviewable CSV/report only, NEVER posts to bank/ERP or modifies ledger balances.

**Acceptance:** For synthetic fixtures, debit/credit totals match exact expected results; missing/duplicate/ambiguous entries are flagged and nothing changes without approval.

### FR-07 Operations
- Structured application logs without raw prompts, bank account numbers, passwords or document contents.
- Health checks, disk thresholds, model response latency and ingestion failure metrics.
- Encrypted backups for database, document storage, app configurations and necessary secrets; tested restore.
- Defined retention, export and deletion procedures.

**Acceptance:** Restore to a clean server using written runbook; verify permissions and document index integrity.

## 8. Non-functional requirements

### Workspace design (requested 21 October 2026)

Redesign the user panel, navigation, source library, assistants, Accounts unavailable states, readiness, settings and login presentation using a Vercel-inspired neutral visual language: near-black dark surfaces, white light surfaces, fine grey borders, compact controls and restrained accents. Reference: https://vercel.com/friendspublicationweb-3997s-projects (private workspace contents were not accessible during design).

Use locally bundled React components: shadcn/ui composition with Radix primitives; selected Origin UI field/layout patterns and Magic UI decorative patterns; Framer Motion for short, purposeful transitions. Document adapted sources and licences. No remote assets, fonts, telemetry or runtime CDN. Provide Light, Dark and System preferences, default System, persist only appearance locally, follow OS changes in System mode and initialise before first paint. Support keyboard operation, visible focus, readable contrast, mobile layouts and reduced motion.

The current deliverable is the loopback-only read-only review described in `specs/00-local-review.md`. A login design preview must be explicitly labelled, accept no credentials and establish no session. Production login, user administration and live data actions remain subject to the existing identity/security gates. Styling must never imply permission enforcement or completed acceptance. Upstream Open WebUI is retained; no unsupported upstream fork or production auth changes are authorised by this design request.


- **Privacy:** no cloud inference, no external telemetry by default; assess all container images and outbound requests.
- **Security:** TLS, least privilege, no Docker socket in application containers, secrets in environment/secret store not git, non-root where practicable, network segmentation, pinned image versions/digests, dependency scanning.
- **Reliability:** durable volumes, transactional imports, resumable ingestion, idempotent uploads and backups.
- **Performance:** first determine workload and hardware; pilot target p95 under 20 seconds for a short 250-token answer with one active user, measured rather than guaranteed; record tokens/sec and concurrency separately.
- **Language:** British English default; preserve Hindi and mixed-language source where asked.
- **Accessibility:** keyboard-usable chat and readable error messages.
- **Maintainability:** unit/integration/security tests and documented migrations; avoid unsupported forks unless necessary.

## 9. Technical API contract (v1 target)

These are illustrative protected backend endpoints, not public APIs. Finalise OpenAPI spec before implementation.

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Readiness (non-sensitive) |
| POST | `/api/documents` | Upload with collection and access scope |
| GET | `/api/documents` | List authorised documents |
| DELETE | `/api/documents/{id}` | Delete authorised document and index |
| POST | `/api/retrieval/search` | ACL-filtered text retrieval |
| POST | `/api/accounts/imports` | Create quarantined import |
| POST | `/api/accounts/imports/{id}/validate` | Validate mapping and totals |
| GET | `/api/accounts/imports/{id}/report` | Read-only report |
| POST | `/api/accounts/proposals/{id}/approve` | Authorised human approval |
| GET | `/api/admin/audit` | Restricted audit search |

Use Express middleware for request IDs, server-side schema validation, maximum payload limits, pagination, and documented errors. Centralise error handling, including asynchronous failures. Run extraction and reconciliation jobs in Node.js workers so they do not block API requests. Authorisation MUST be checked with authenticated identity, not caller-supplied department headers.

## 10. Development phases for Codex (strict sequence)

### Phase 0 — Discovery and architecture
Deliver: `docs/architecture.md`, hardware/infrastructure checklist, threat model, architecture decision records, dependency/version matrix. Verify Qwen3.5 9B's locally available tag and runtime requirements. **No production services yet.**

### Phase 1 — Local model foundation
Deliver: pinned Docker Compose for Ollama and Open WebUI, HTTPS reverse proxy, persistent storage, health checks, `README.md`, `.env.example`, offline smoke-test script, setup instructions. Use synthetic data only. **Gate:** local chat works with internet disconnected and model persists across restart.

### Phase 2 — Authentication and permissions
Deliver: identity architecture, disabled public signup, admin-led user provisioning, department roles, audit logs, permission tests. **Gate:** forbidden cross-department access blocked at API and UI layers.

### Phase 3 — Document ingestion and RAG
Deliver: approved document upload, extraction, retrieval, citation/source display, role-filtered index, delete/reindex, prompt-injection tests. **Gate:** 30-question grounded retrieval evaluation and negative ACL tests pass.

### Phase 4 — Department assistants
Deliver: editorial/HR/sales system instructions, separate approved collections, evaluation cases, usage guidance. **Gate:** staff validate useful and accurate responses; no confidential leakage.

### Phase 5 — Accounts read-only module
Deliver: sample CSV/XLSX/PDF import parsing, validation UI/API, `decimal.js` calculations, party-wise summary, proposed reconciliation, approval workflow and export. **Gate:** synthetic ledger invariants and audit tests pass; no write-backs possible.

### Phase 6 — Hardening and release
Deliver: load tests on actual office server, TLS, backups/restores, vulnerability scan, retention, disaster recovery, operational runbook and release checklist. **Gate:** administrator signs off.

## 11. Mandatory testing strategy

- JavaScript testing: use the Node.js test runner for unit tests and HTTP-level integration/security tests against Express; document exact npm scripts in each implementation phase.
- Unit tests: document parsers, amounts/`decimal.js`, party grouping, permission predicates. Independently derive expected financial totals; include fractional values, large amounts and rounding boundaries without reusing the production calculation logic.
- Integration tests: upload → extract → index → retrieve → cite; account import → validate → review → export.
- Security tests: horizontal privilege escalation, cross-department retrieval, malicious PDF prompts, forged document IDs, path traversal, oversized uploads, SSRF and broken session controls.
- Offline test: block server's internet, then run chat and retrieval using pre-fetched resources.
- Model evaluation: baseline answers from at least 30 approved synthetic tasks, track accuracy and unsupported claims.
- Restore test: simulate system loss and restore from backup; verify file checksums, login and retrieval.
- No real employee/bank data in automated tests or CI.

## 12. Definition of done

A phase is complete only when:

1. Source code, configuration, tests and documentation are committed together.
2. All declared acceptance criteria have reproducible test evidence.
3. No production secrets or personal data are in git or logs.
4. The phase passes its security and isolation checks.
5. Known limitations and manual steps are documented.
6. Codex provides exact commands to run, test and roll back the phase.
7. A human reviews any security-sensitive or financial functionality before release.

## 13. Codex execution rules

- Read `AGENTS.md` and this `SPEC.md` first.
- Do not implement every phase in one run. Start with Phase 0, then Phase 1 after architecture review.
- For each phase: (a) write detailed phase spec in `specs/`, (b) identify risks and tests, (c) implement minimally, (d) run tests, (e) report evidence, (f) stop at phase gate.
- Ask for input only when essential (server hardware, DNS, identity provider or incompatible design), and document safe defaults otherwise.
- Never silently substitute cloud APIs, enable public sign-up, or remove auth for convenience.
- Never expose Ollama, database, or raw document storage to the internet.
- No fine-tuning-related packages or jobs in v1.
- Implement custom services in JavaScript on Node.js with Express for HTTP APIs, npm lockfiles, server-side schema validation and decimal-safe financial arithmetic.
- Use synthetic fixtures until explicit authorisation for real data.

## 14. First Codex prompt

Copy into Codex after placing this document and `AGENTS.md` in a new repository:

> Read AGENTS.md and SPEC.md completely. We are building a private, self-hosted office AI platform with Qwen3.5 9B via Ollama, and NO fine-tuning. Follow specification-driven development. Begin with Phase 0 only: review the specification, identify missing deployment facts and security risks, verify version/model prerequisites, and create docs/architecture.md plus an implementation plan and Phase 1 spec with measurable acceptance tests. Do not install services, connect to cloud LLM providers, or work on later phases yet. Summarise assumptions, decisions and commands for review.

## 15. Relevant references

- Qwen3.5 Ollama model page: https://ollama.com/library/qwen3.5
- Qwen3.5-9B licence/model: https://huggingface.co/Qwen/Qwen3.5-9B
- Ollama installation: https://docs.ollama.com/
- Open WebUI documentation: https://docs.openwebui.com/
- Node.js release policy: https://nodejs.org/en/about/previous-releases
- Express 5 documentation: https://expressjs.com/en/5x/api.html
- decimal.js documentation: https://mikemcl.github.io/decimal.js/
- Codex development workflow: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex

**Change control:** New features, public access, identity architecture changes, bank integrations and any future fine-tuning require an approved spec change before implementation.
