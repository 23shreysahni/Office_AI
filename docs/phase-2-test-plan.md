# Phase 2 acceptance and negative test matrix

Status: **Planned; every case NOT RUN.** No Phase 2 implementation exists. This plan belongs to [the Phase 2 specification](../specs/02-access-control.md), not to the current Phase 1 test suite.

Use synthetic, opaque identities: two platform administrators without department grants, two Editorial users, one HR user, one Sales user, one Accounts user, one Accounts approver, an inactive identity and an unenrolled provider identity. Include an explicitly authorised multi-role user. Create two collections per department plus an inactive collection. Record fixture IDs in isolated test state; do not place real employee data in the repository.

Use Node's test runner against an actual Express HTTP listener; isolate a real PostgreSQL test database for persistence/transaction tests and use a controlled local OIDC fixture for protocol attacks. Repeat provider/portal/upstream integration against the selected real IdP and exact Open WebUI image. Capture database or model-context evidence only in the authorised test environment without logging content or tokens.

| ID | Procedure | Required result |
|---|---|---|
| A01 Entry gate | Review Phase 1 F01–F14/W01–W04 results and security sign-off | All required evidence present; no configuration-only substitution |
| A02 Anonymous access | Request all protected API/portal and guessed admin endpoints without a session; try signup routes | No protected data; API 401, portal fixed login flow, no registration or anonymous chat |
| A03 OIDC validation | Try wrong issuer/audience/algorithm/signature, expired/future token, wrong nonce, wrong authorised party and malformed JWKS | Login denied; no session or enrolment created; redacted failure |
| A04 Login transaction | Replay code/state, remove browser transaction cookie, use a mismatched state/PKCE verifier and an arbitrary return URL | All denied; transaction one-use and expires within five minutes; no open redirect |
| A05 Enrolment | Sign in as an otherwise valid but unenrolled provider subject; alter email/name/department claims | No application account, role or grant created automatically; issuer/subject remains identity key |
| A06 Administrator provisioning | Bootstrap once locally; retry bootstrap; attempt HTTP first-admin/public signup; enrol duplicate subject | One explicit bootstrap only; later enrolment requires admin and CSRF; duplicates conflict without overwrite |
| A07 Session controls | Inspect cookie, rotate on login/privilege change; test idle/absolute expiry, logout, restart and session-ID fixation | Secure/HttpOnly/host-only/path/SameSite flags correct; expired/revoked/fixed session denied server-side |
| A08 CSRF and rate limits | Write without token, wrong token/Origin, cross-origin form/fetch; exceed configured login/write limits | Writes denied, no state change; bounded 429 and recovery; spoofed forwarding headers do not bypass limits |
| A09 Role matrix | For each synthetic user and each collection, test list/detail and forged object IDs directly over HTTP | Only matching role plus explicit grant succeeds; unrelated/no grant denied; absent/forbidden ID same 404 shape |
| A10 Admin/data separation | Try collection detail as each platform admin without grants, including via management/audit routes | Admin functions work; no department data/snippet/history exposed; admin role alone confers no read access |
| A11 Revocation | Keep sessions open while removing grant/role, deactivating user/collection and logging out | Next API/portal request denied; no positive-authorisation cache or stale browser response; after restart still denied |
| A12 ID/header tampering | Forge issuer/subject/user/department/request-ID/forwarding headers, role fields and session cookies | No identity or privilege change; caller cannot forge audit actor or trusted client address |
| A13 Privilege mutations | Non-admin changes users/grants; admin changes own entitlements; concurrent removal of final admins | All forbidden cases deny; at least one active admin preserved atomically; failed mutation leaves prior state |
| A14 Query scoping | Interleave authorised/forbidden collections across multiple pages, counts and search/order parameters | Database query includes scope predicates; no metadata/count leakage; no global top-page post-filter |
| A15 Payload/error handling | Unknown fields/roles, malformed UUID/JSON, oversized bodies, SQL strings, method mismatch and async failure | Bounded 4xx/5xx without stack/body/token leak; no unvalidated mutation or SQL injection |
| A16 Audit integrity | Review successful/denied operations; force audit insert failure during a grant/user mutation | Content-free attributable events; change and audit are atomic; read/update/delete audit access restricted |
| A17 Persistence/migrations | Apply ordered migrations on empty DB, repeat safely, restart and test constraints/concurrent updates | No reset/data loss; unique identities/grants and session revocation persist; restricted runtime cannot alter schema |
| A18 Portal enforcement | Use keyboard and copied/deep-linked admin/department URLs as each role; use back/reload after revocation | Clear accessible controls; server-enforced denial, no cached private data; hiding controls is not the sole check |
| A19 Open WebUI boundary | Test shared-provider login, no public signup, deactivation/expiry/logout and direct HTTP/WebSocket access | No API-token interchange/forged identity; upstream staff access remains closed until verified; uploads/tools disabled |
| A20 Offline/provider outage | Deny public internet for host/containers, retain approved internal IdP/DNS/time, then make provider unavailable | Internal login/authorised portal work offline; new login fails bounded/closed during provider outage; no fallback |
| A21 Privacy | Send unique synthetic login/error/resource canaries; inspect proxy/API/provider/DB/runtime logs and browser traffic | No passwords/tokens/cookies/claims/bodies/document content; no external telemetry or credentials in URLs/logs |
| A22 Recovery/rollback | Encrypt consistent DB/provider/state snapshot; restore separately offline; roll back matching images/state | Grants/users/audit preserved; restored sessions invalidated before reopening; permissions/anonymous denial retested |
| A23 Windows boot/network | Reboot Windows during maintenance; follow Desktop/WSL startup; test from second LAN host | No raw API/DB/provider management ports; trusted HTTPS, identity and grants survive; no model re-download |
| A24 Review gate | Collect all required outcomes and independently review identity, admin/data separation and remaining risks | Human sign-off before staff/private documents; Phase 3 acceptance still required for real document retrieval |

## Evidence format and execution order

For each case record timestamp, installed runtime/image/provider/database versions and digests, test command/tool, synthetic fixture revision, expected/observed result, sanitised evidence location and reviewer. Do not record credentials, callback queries or private host inventory in Git. `NOT RUN`, `FAIL` and `PASS` are distinct; an unexecuted case never inherits a related unit-test result.

Implement protocol validation and permission predicates first, then HTTP/database tests, then portal and upstream integration. Run A01 before introducing the new services. Verify A02–A17 on isolated synthetic state before A18–A23 on the approved host. Test document retrieval/citation/download/model-context canaries in Phase 3; no Phase 2 fixture result proves those unimplemented flows.

The Phase 2 implementation must document exact reproducible test/migration/seed/smoke commands when those files and services exist. The current root `npm test` runs foundation tests only and must not be described as passing this matrix.
