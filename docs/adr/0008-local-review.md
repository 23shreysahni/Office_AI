# ADR 0008: Read-only local review interface

Status: Implemented for development review under the user's request for a checkable link; no production phase accepted.

Provide a Node.js/Express 5 review process on literal `127.0.0.1:4173`, with local static assets and original synthetic fixture previews. Expose only fixed specification keys and sanitised review data. No production routes, credentials, persisted user content, role/login simulation, model calls, uploads or accounting operations are introduced.

Loopback HTTP is used for this non-sensitive development review surface. It is not added to Compose or the LAN Nginx policy and is not the platform entry point. The office platform retains authenticated HTTPS, local inference, scope enforcement and human phase gates. Do not tunnel or publish the review process.

Reject forged Host, cross-origin API/asset access, cross-site embedded entry and non-GET/HEAD methods; permit normal top-level navigation to the review link. Serve no repository-wide static directory. Apply CSP, no-store/no-sniff/no-frame controls and render variable text with DOM text operations.

This gives the user an inspectable interface while unavailable host prerequisites and unimplemented identity/retrieval/accounts workflows remain explicitly visible. UI examples are labelled illustrative, with no claim that an LLM generated them or that fixture integrity proves department isolation. See [operation and evidence](../local-review.md).
