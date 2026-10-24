# ADR 0004: Use Nginx for the foundation proxy

Date: 19 October 2026. Status: User-requested decision accepted during Phase 1 implementation. Runtime acceptance remains pending.

Use Nginx as explicitly requested by the user. This supersedes the earlier proxy proposal. Keep all other Phase 1 isolation and authentication boundaries.

Pin `nginx:1.30.6-alpine` by its complete registry manifest digest. Render Nginx configurations from validated JavaScript configuration, with explicit bootstrap/LAN signup policy, private CIDR ingress rules, a method/path allow-list, bounded timeouts, no request access logs, disabled buffering for streamed inference and explicit WebSocket upgrade forwarding.

Mount only the server certificate/chain and leaf private key. Prefer the company's internal CA. If unavailable, use the provided OpenSSL-based pilot-CA generation tool on the host, protect its root key outside containers and distribute only the root certificate through managed trust channels. Certificate renewal is an explicit operator task. Startup checks hostname, expiry and key matching; client trust remains an acceptance test.

No public ACME challenge, public DNS or certificate-authority internet connection is required. Back up TLS files in the encrypted state snapshot and verify offline restoration.

References: [Nginx stable release](https://nginx.org/en/download.html), [HTTPS configuration](https://nginx.org/en/docs/http/configuring_https_servers.html), [WebSocket forwarding](https://nginx.org/en/docs/http/websocket.html).

## Authenticated Open WebUI shell compatibility follow-up

The first live browser sign-in exposed additional authenticated shell requests for profile images, banners, tool listing, pinned notes, folders, model lists, knowledge/prompt/skill lists and groups. The proxy now permits authenticated `GET` requests under `/api/v1/`; it retains explicit chat-sharing denials and a narrow allow-list for state-changing requests. Configuration changes, installation, uploads and model mutation remain denied. A focused browser test must confirm the pinned UI loads and synthetic chat works after applying the policy update.
