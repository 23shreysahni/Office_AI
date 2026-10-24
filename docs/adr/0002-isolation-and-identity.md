# ADR 0002: Isolated foundation and explicit identity boundary

Date: 19 October 2026

Status: Foundation implementation approved by the user; live security review remains pending. Nginx selection is recorded in ADR 0004.

## Context

LAN users are not inherently trusted. Open WebUI authentication and collection controls do not automatically protect an Express service. Hardware, identity provider and pinned-version behaviour remain unverified.

## Decision

Use a Nginx HTTPS entry point using an internal-CA certificate with managed client trust, separated proxy/UI and UI/inference networks and no host-published internal service ports. Deny production internet egress at the host/network boundary after provisioning. Retain only approved local inference models.

Limit Phase 1 to a named administrator and synthetic chat, with restricted bootstrap and disabled registration, uploads and integrations. Do not introduce the custom API, department access or accounts before their phase gates.

Prefer shared internal OIDC for later user identity, with independent token validation and current server-side grants in Express. Exact provider/integration remains subject to discovery and Phase 2 specification. Do not trust caller-supplied identity or department headers. If upstream collection controls cannot pass negative tests, keep private uploads disabled pending a reviewed authorised retrieval integration or department isolation.

## Consequences

CA distribution and effective persisted settings need operational tests. Offline operation depends on reachable internal DNS/time/identity services. Department separation is not claimed until tests prove it. This approach adds review gates but prevents an early chat pilot from becoming an unreviewed private-document system.

## Alternatives

Direct LAN exposure of Ollama/UI, authentication bypass and cloud fallback violate the requirements. Building a custom chat UI now would expand the foundation scope; reconsider only through an approved specification change.
