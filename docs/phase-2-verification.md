# Phase 2 preparation and verification

Date: 19 October 2026. Status: **Specification prepared; runtime implementation and acceptance NOT RUN.**

The user requested Phase 2. Repository instructions require actual-host Phase 1 acceptance and human security review before progression. The [Phase 1 report](phase-1-verification.md) still records unexecuted live checks, unavailable Docker and denied WSL access. No new evidence has been supplied to change that status. This preparation does not waive or satisfy that gate.

## Prepared files

- [Phase 2 specification](../specs/02-access-control.md): identity, provisioning, sessions/CSRF, roles/grants, administration portal, auditing, persistence, recovery and scope boundaries.
- [OpenAPI contract](../specs/02-access-control.openapi.json): proposed same-origin session and administrative/collection endpoints; not an implemented API.
- [Identity ADR](adr/0006-phase-2-identity.md): internal OIDC proposal with explicit Open WebUI/API and administrator/data separation.
- [Acceptance matrix](phase-2-test-plan.md): A01–A24, including protocol attacks, cross-department negative HTTP/browser tests, revocation, audit failures and Windows/offline recovery.

## Current evidence and limitations

No Express API, PostgreSQL service/migration, identity provider, employee account, departmental grant, portal or proxy integration was installed or changed for Phase 2. No Phase 2 runtime, HTTP, database, security or browser test has been run. Existing foundation test outcomes are not Phase 2 evidence.

Executed a read-only Node.js consistency check using built-in filesystem/assertion tools: all 23 repository Markdown files had balanced fenced blocks and 68 resolving local links. The draft OpenAPI JSON parsed successfully, with 15 paths, 18 unique operations and 103 resolving internal references. Path-parameter declarations and session/CSRF/Origin requirements on each mutation were checked. These are static integrity checks, not a full OpenAPI schema-validation result or runtime security evidence. Foundation tests were not rerun for these documentation-only changes.

The existing README, architecture and implementation-plan documents now link to the draft while retaining the Phase 1 entry gate. No architecture proposal is labelled implemented or accepted.

The provider remains unconfirmed. An existing internal OIDC provider is preferred; a new local provider is a proposal if none exists. Provider availability, client registration, certificate trust, account administration, back-channel logout and Open WebUI compatibility need actual review. No cloud fallback, password implementation, signup relaxation or private uploads were introduced.

## Remaining work

1. Complete and review Phase 1 F01–F14 and Windows W01–W04, supplying sanitised actual-host evidence.
2. Confirm internal identity provider and account owner; review the Phase 2 identity/API proposal and dependency/runtime pins.
3. Implement migrations and the smallest testable identity/permission unit, then HTTP/database/UI integrations according to the specification.
4. Run A01–A24 with sanitised evidence, extend/test encrypted offline recovery, and complete the human permission gate before staff access. Phase 3 remains closed.
