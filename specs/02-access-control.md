# Phase 2: Authentication and permissions

Status: **Review draft; implementation and acceptance NOT RUN.** The user requested Phase 2 on 19 October 2026. The recorded Phase 1 Windows-host acceptance and security review remain incomplete; this request is not evidence that those tests passed. This specification prepares the next phase without changing the deployed foundation or its security controls.

Parent requirements: [SPEC.md](../SPEC.md), [architecture](../docs/architecture.md), [identity proposal](../docs/adr/0006-phase-2-identity.md). Review the [API contract](02-access-control.openapi.json), [test matrix](../docs/phase-2-test-plan.md) and [verification record](../docs/phase-2-verification.md) together.

## Entry conditions and assumptions

1. Record successful Phase 1 F01–F14 and Windows W01–W04 evidence and human security review. Resolve the current WSL access-denied and unavailable Docker daemon conditions; local configuration tests are insufficient.
2. Confirm an internally reachable OIDC provider, its issuer, client registration, certificate trust, offline operation and account owner. Prefer an existing internal provider. If none exists, propose a local Keycloak deployment, with its own pinned image/database, restricted bootstrap, backup and upgrade review. No cloud identity dependency is assumed.
3. Review the identity integration against the exact pinned Open WebUI release. Its administrator role must not be treated as a confidential-document entitlement. Do not trust an upstream token, role or collection permission without verification.
4. Record the PostgreSQL/runtime/package pins, licence/advisory review and migration/restore plan before adding services. No password implementation, temporary shared login or automatic first-administrator route is permitted.
5. Use synthetic identities and department fixtures until this phase is accepted. Windows deployment uses the same Linux containers inside WSL as described in [Windows setup](../docs/windows.md).

The user has requested Phase 2 work; another generic implementation approval is not the missing prerequisite. The unresolved items are actual-host evidence and the identity/security decisions above.

## Scope and deliverables

- A JavaScript ES-module Express 5 API and a same-origin, keyboard-usable administration/access portal, behind internal HTTPS. Add no public API or host-published database port.
- OIDC authorisation-code login with PKCE, verified identity, server-side sessions, logout, expiry, CSRF protection and rate limits. Staff passwords remain with the identity provider.
- Administrator-controlled application enrolment, deactivation, role assignment and explicit collection grants. Identity-provider account creation remains an administrator operation in that provider; application enrolment does not create an IdP account.
- PostgreSQL identities, sessions, roles, collections, grants and content-free audit events, with ordered migrations, least-privilege runtime access and transactional security changes.
- Department-scoped collection metadata and a portal showing only currently authorised collections. No uploads, chunking, vector index, document contents, retrieval or accounts business operations in Phase 2.
- HTTP integration/security tests, browser tests, offline smoke procedure and reproducible backup/restore/rollback instructions for the added database and any local identity provider.

Protected synthetic department fixtures exercise the permission boundary before Phase 3. Passing these tests proves only the implemented Phase 2 paths. Actual document search/download/citation and model-context isolation must be proved again in Phase 3 before private documents are enabled.

## Identity and session contract

Identify a person by the exact `(issuer, subject)` pair from validated OIDC claims, mapped to an immutable local UUID. Email and display name are not identity keys. The provider must be internal and reachable with public internet denied. Do not auto-enrol unknown subjects, infer roles from an email domain, or let login claims overwrite local grants.

Use maintained OIDC/JWT libraries, not handwritten protocol/cryptographic validation. Validate the configured issuer, exact redirect URI, intended audience, signature/allowed algorithms, expiry and nonce; apply the provider's required authorised-party checks. Pin the provider and client configuration server-side. Reject caller-selected issuers, discovery URLs, token endpoints and key URLs. TLS verification remains enabled, including internal CA validation. No password grant or implicit flow.

Login state, nonce and PKCE verifier have a five-minute lifetime and a one-use browser-bound transaction. Reject missing/mismatched/replayed state, nonce and code. Redirect only to the fixed portal location after success; do not accept arbitrary return URLs. Bound discovery/token/JWKS requests and response size; fail closed on an unavailable provider or untrusted certificate. Never print a token response or callback query to logs.

After verified login and current application-enrolment checks, create a cryptographically random opaque session identifier, storing only its hash in PostgreSQL. Rotate it on login and privilege changes. Use a `__Host-office_session` cookie with `Secure; HttpOnly; Path=/; SameSite=Lax`, with no Domain attribute. Lax allows the top-level OIDC callback; protect writes independently with CSRF. Store secrets and any necessary provider credentials/tokens encrypted or in file-mounted secret storage, outside Git and diagnostic output.

Initial limits: 15-minute idle expiry and one-hour absolute lifetime. Server-side checks are authoritative. Logout revokes the local session immediately and expires its cookie; local revocation must succeed independently of provider logout availability. Role changes, grant revocation and application deactivation affect the next request, including existing sessions. Do not cache positive authorisation decisions across requests.

IdP-only suspension is not assumed to terminate an application session. Implement and test the selected provider's signed back-channel logout/revocation integration, or require the documented deactivation operation to revoke the application identity/sessions first and then disable the provider account. Document the chosen revocation guarantee and test provider-side suspension before claiming it is immediate.

The custom API does not accept Open WebUI JWTs, forwarded usernames, caller-supplied department headers or model-generated identity assertions. Open WebUI integration needs a separately verified shared OIDC configuration. An Open WebUI login is not proof of API authentication.

## Provisioning and permission policy

Public signup stays disabled at the provider, Open WebUI, API and proxy. Unknown OIDC identities receive no application access. An authorised operator provisions the initial application administrator using an explicit local command and approved issuer/subject; it is audited, refuses a repeat bootstrap and exposes no first-user HTTP registration path.

Subsequent platform administrators may enrol approved subjects, deactivate users and assign reviewed roles and collection grants through the portal/API. Do not receive or store staff passwords. Require a separate administrator to alter an administrator's own roles/grants or activation state. Preserve at least one active platform administrator using a transaction/locking constraint, including under simultaneous requests. Duplicate subjects conflict rather than overwrite existing accounts. No default departmental grants.

| Role | Application capabilities | Departmental access |
|---|---|---|
| `platform_admin` | Manage users/roles/grants, collection metadata and audit | None automatically; explicit grant and appropriate departmental role required |
| `editorial_user` | Eligible for Editorial collection reads | Explicit Editorial grants only |
| `hr_user` | Eligible for HR collection reads | Explicit HR grants only |
| `sales_user` | Eligible for Sales collection reads | Explicit Sales grants only |
| `accounts_user` | Eligible for Accounts collection reads | Explicit Accounts grants only; future propose/report operations remain disabled |
| `accounts_approver` | Eligible for Accounts collection reads | Explicit Accounts grants only; future financial approvals remain disabled |

A user may hold more than one explicitly assigned role. A collection read requires an authenticated, active, unexpired session, an active enrolled user, the matching departmental role and an explicit active grant for that collection. Granting an unrelated department role is insufficient. Unknown roles, invalid IDs, inactive collections and absent grants deny access. An application administrator cannot read department resources merely through administrative metadata endpoints; those endpoints return configuration metadata only.

Query authorised collections using scope predicates in the database query, including list/count/pagination. Do not retrieve all collections and filter a page afterwards. Return the same `404` shape for a missing and an unauthorised collection ID. Apply authorisation to every route and object lookup, including portal requests; hiding a menu is not enforcement. Protected responses use `Cache-Control: no-store`. Do not expose document snippets, counts, history or content-bearing metadata through management/audit responses.

## Request and audit requirements

Follow the [OpenAPI contract](02-access-control.openapi.json) before implementing routes. Reject extra payload fields, invalid UUIDs/issuer-subject/roles/departments and oversized JSON; use documented validation errors without echoing input. No wildcard CORS. Trust no caller-provided identity, forwarding or request-ID header. Configure proxy trust only for the verified deployment path and test it on Windows/Desktop networking.

The proposed `/api/access/` namespace avoids collisions with Open WebUI's existing `/api/` endpoints. It is not enabled by the current Nginx allow-list. Set a restrictive content-security policy, no framing, MIME-sniffing protection and no-store headers on the portal; serve scripts locally and render untrusted labels as text. No internet assets are needed.

Every state-changing portal/API request needs the exact configured HTTPS Origin plus a server-session-bound CSRF token in `X-CSRF-Token`. OIDC callback validation is separate. Start with at most five login initiations per minute per validated client address and 60 authenticated API writes per minute per actor; bound limiter storage. A single-process in-memory limiter is allowed only for the reviewed one-instance pilot; multi-instance operation requires a shared limiter. Test spoofed forwarding headers and lockout recovery.

Audit successful/denied login, logout, provisioning, deactivation, role/grant changes, denied resource access and audit reads. Record server timestamp, generated request/event UUID, stable actor/target UUIDs, action and outcome. No names/emails, passwords, tokens, cookie values, callback parameters, prompts, document text or financial content. Do not log request/response bodies. Authenticate before recording an actor; never copy a caller-supplied ID into an actor field.

User/role/grant/session changes and their audit record commit in the same transaction. If audit persistence fails, security mutations fail without applying. Runtime audit privileges are append-only; a separate migration/maintenance role owns schemas and retention. Audit pagination is bounded, stable and restricted to platform administrators. Audit failure handling must not expose sensitive diagnostics or permit unaudited mutations.

## Data and migration plan

The implementation must add ordered SQL migrations for users (unique issuer/subject, status), user roles, collections (UUID/department/status), collection grants, hashed sessions (user/expiry/revocation), one-use login transactions and append-only audit events. Use foreign keys, uniqueness/check constraints and UTC timestamps. Opaque session/token data must not appear in database error output or reports. Database access is parameterised and credentials are file-mounted. No upstream Open WebUI database tables are used as an identity store.

Before deployment, supply actual migration/apply/status commands, locked dependencies, a restricted runtime database role and the operator bootstrap command. Stop at review if those commands are absent; this draft does not invent runnable commands for unimplemented tools. Deploy on isolated restored synthetic state first. Extend the stopped-service encrypted snapshot to include a consistent PostgreSQL backup, provider state if introduced, matching configuration, secrets and exact image archives. Test an offline restore before production promotion.

Rollback uses previous pinned images and the matching pre-migration snapshot in a separate directory/host. Never run old code against an assumed backwards-compatible migrated database, reset the database to bypass a migration error, or delete volumes. Revalidate sessions, deactivated accounts, grants and audit after recovery. Review whether restoring old state could resurrect revoked sessions; rotate/invalidate restored sessions before reopening the entry point.

## UI and upstream restrictions

The portal provides sign-in/out, current identity, authorised collection list/detail, and administrator-only user/role/grant/audit screens. Permission errors are clear and disclose no other department's resources. Revocation removes resources on the next server request; browser back/reload and copied URLs must not show cached content. Provide keyboard operation, labelled controls and review confirmation showing the exact target/role/grant for security changes. UI validation supplements server validation.

Keep Open WebUI uploads, external providers, tools and public signup disabled during this phase. Validate its shared-provider session/role changes independently and keep it administrator-only until those checks pass. Because upstream administrator bypasses can conflict with departmental confidentiality, no Open WebUI collection ACL claim follows from this API design. Select and review the Phase 3 authorised-retrieval or isolated-instance route before enabling private files.

## Acceptance and completion record

Execute every case in [the Phase 2 test matrix](../docs/phase-2-test-plan.md) on the exact selected versions. Include real Express HTTP tests, real PostgreSQL persistence/transaction tests and actual-browser/host tests; in-memory mocks do not replace them. Capture only sanitised case outcomes, versions, timestamps, command references and opaque evidence IDs.

- Phase 2 request: User, 19 October 2026.
- Phase 1 live acceptance and security review: Pending.
- Identity provider/integration decision: Pending user discovery; local provider proposed if no existing internal SSO is available.
- Detailed specification/API/security review: Pending.
- Runtime implementation and tests: NOT RUN; no Phase 2 services deployed.
- Phase 2 permission gate and human sign-off: Pending.
- Phase 3 and private uploads: Closed.
