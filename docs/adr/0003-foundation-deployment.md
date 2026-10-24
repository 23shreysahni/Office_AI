# ADR 0003: Foundation deployment and bootstrap

Date: 19 October 2026. Status: Implementation decision under user-approved Phase 1 scope; actual-host security acceptance pending.

Use digest-pinned Nginx 1.30.6-alpine, Open WebUI v0.12.3 and Ollama 0.40.6. Registry manifest digests were resolved directly over authenticated read-only registry requests; runtime compatibility remains to be tested. Start with a CPU baseline; opt into an NVIDIA Compose override only after driver/toolkit discovery.

Keep state in ignored bind-mounted directories for consistent stopped-service snapshots, including private TLS files. Store the stable session key in an ignored file mounted as a Compose secret, using the upstream `WEBUI_SECRET_KEY_FILE` mechanism. Use upstream application authentication rather than implementing accounts in Phase 1.

Provide distinct bootstrap and LAN proxy profiles. Bootstrap publishes only `127.0.0.1:8443`; it permits first-user signup. The wrapper stops the opposite proxy before starting a profile and does not accept profile overrides. LAN publishes only approved-IP port 443 and blocks signup permanently, including the upstream first-account exception. Preflight rejects missing pins/inputs/secrets, unsafe hostnames and public bind addresses. Startup verifies a provisioned account and installed model digest before opening the LAN proxy.

Disable persistent UI configuration, external integrations and automation features. Apply a proxy API allow-list as an extra boundary, because administrators can bypass ordinary UI user-permission flags. Retain upstream authentication for allowed protected routes. Do not claim body validation or department isolation: Phase 1 is a trusted administrator's synthetic chat pilot. Browser flows, cancellation and upstream feature flags require F01–F14 evidence against the exact images.

All orchestration and smoke tooling is JavaScript using Node.js built-ins. Container health checks may invoke the upstream image's existing Python runtime; no custom Python application is introduced. Do not implement the Express business service before Phase 2.

Backups use a stopped-service snapshot encrypted to an operator-provided GPG recipient on a separate destination. Restore prior images together with matching state and secrets. No automated host-firewall changes, destructive volume removal, remote deployment or fabricated hardware defaults.

References: [upstream config](https://github.com/open-webui/open-webui/blob/v0.12.3/backend/open_webui/config.py), [auth routes](https://github.com/open-webui/open-webui/blob/v0.12.3/backend/open_webui/routers/auths.py), [startup](https://github.com/open-webui/open-webui/blob/v0.12.3/backend/start.sh).
