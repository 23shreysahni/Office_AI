# ADR 0001: JavaScript application stack

Date: 19 October 2026

Status: Accepted stack preference requested by the user. Foundation and security gate approval remain outstanding.

## Context

The original specification selected Python/FastAPI for custom services. The user requested JavaScript with Node.js and Express. This change updates the planned application stack; no services have been implemented.

## Decision

- Write custom APIs and background workers in JavaScript with ES modules on a supported Node.js LTS release. Use Express 5 for HTTP APIs.
- Retain PostgreSQL/pgvector, local storage, Ollama and Open WebUI. The JavaScript requirement covers custom code, rather than upstream service internals.
- Use npm lockfiles and `npm ci`. Record exact compatible runtime, dependency and container versions in the Phase 0 matrix before implementation; this ADR does not claim those versions have been selected or tested.
- Validate incoming payloads and enforce identity and document permissions server-side before retrieval reaches the model. Centralise asynchronous error handling and isolate processing jobs in workers.
- Use `decimal.js` and PostgreSQL `NUMERIC` for financial values. Transfer amounts as decimal strings, define supported currency scale, precision and rounding, and reject invalid or out-of-range values. Do not use JavaScript floating-point arithmetic for money. Independently verify reconciliation results with synthetic fixtures.
- Use the Node.js test runner and HTTP integration/security tests, including negative department-permission tests. Specify exact commands when implementation begins.

## Consequences and review

Parser, database, identity and worker libraries still require compatibility, licence and offline-operation review in Phase 0. Keep OpenAPI as the explicit API contract, with schema validation verified against it. Select a supported Node.js release rather than treating Express's minimum runtime as a deployment recommendation.

No deployment code, package installation or progression to a later phase is authorised by this documentation update. Complete the architectural plan and foundation specification, then obtain foundation approval before coding deployment services.

## References

- [Express 5 API](https://expressjs.com/en/5x/api.html)
- [Node.js release policy](https://nodejs.org/en/about/previous-releases)
- [decimal.js API and precision rules](https://mikemcl.github.io/decimal.js/)
