# ADR 0006: Phase 2 identity and authorisation proposal

Date: 19 October 2026. Status: **Proposed, not implemented or accepted.** Requires the Phase 1 host/security gate and provider discovery. See [Phase 2 specification](../../specs/02-access-control.md).

Use an internal OIDC provider to authenticate staff, keeping passwords outside the custom API. Prefer an existing internally available provider; otherwise propose a self-hosted Keycloak deployment with separately reviewed pins, restricted bootstrap, PostgreSQL, backups and offline recovery. Do not silently introduce internet-dependent identity or implement a password database.

Use maintained OIDC/JWT libraries for authorisation code with PKCE, state/nonce and strict token validation. Map the verified issuer/subject to an explicitly enrolled local user. A same-origin Express portal uses opaque hashed server-side sessions with secure cookies and CSRF controls. PostgreSQL owns current roles, grants, revocation and audit; provider claims do not automatically grant department access.

Separate platform administration from data permissions. Department reads require both the matching role and an explicit collection grant, checked within the database query. Application administrators receive no implicit document access. Security mutations and audit records commit together; deactivation/revocation take effect on the next application request. Explicitly review IdP-only deactivation and upstream session behaviour rather than assuming federation makes them immediate.

Open WebUI and the custom API are distinct relying parties. Sharing an issuer does not make their tokens interchangeable. Validate its shared-login configuration against the pinned release before staff rollout, and keep private uploads disabled. The upstream documentation describes administrator privileges and group permissions; those must not be assumed to satisfy the application's stronger administrator/data separation requirements.

This proposal adds an identity-provider dependency and database operations. Both must remain usable without public internet. Windows and native Linux retain the same Linux-container architecture; host firewall, trust, reboot and restore evidence is still required. No runtime service or dependency is added by this ADR.

References: [Keycloak OIDC endpoints](https://www.keycloak.org/securing-apps/oidc-layers), [Open WebUI SSO](https://docs.openwebui.com/features/authentication-access/auth/sso/), [Open WebUI roles](https://docs.openwebui.com/features/authentication-access/rbac/roles/), [Express 5 application settings](https://expressjs.com/en/5x/api/application/).
