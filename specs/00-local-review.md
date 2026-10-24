# Local review interface

Status: Implement under the user's request for a link to check the current project. This is a read-only development review tool, not a completed phase or staff-facing deployment.

## Scope

Run a portable Node.js/Express 5 process on `127.0.0.1` only. Provide a responsive browser interface with current phase status, original synthetic source examples, review-only assistant instructions and a clear list of unavailable capabilities. Provide links to selected specifications through a fixed file allow-list. No login simulation, role switching, generation, uploads, financial calculation, messages or external requests. Never read `.env`, secrets, state or host inventory for the interface.

The interface uses loopback HTTP solely for public-source/synthetic review content. It is not the platform's authenticated HTTPS LAN entry point. No preview server/proxy/port is added to the production Compose stack. The production identity, confidentiality, HTTPS and phase acceptance gates remain unchanged.

## Behaviour and verification

### Redesign acceptance (21 October 2026)

- Replace the visual shell and all five existing pages with a responsive monochrome workspace; add Appearance settings and a clearly labelled login design preview with disabled credential fields and no submission/session behaviour. This is an explicit design-only exception to the previous exclusion of login presentation, not permission to simulate authentication.
- Bundle React, Radix, shadcn-style owned components, Origin-inspired fields, Magic-inspired grid decoration and Framer Motion locally. Keep the static asset allow-list and restrictive CSP; no runtime internet calls.
- Offer Light/Dark/System from every page; persist only the validated theme enum, handle blocked storage, track OS changes only in System mode and apply appearance before rendering. No theme flash from a later asynchronous fetch.
- Verify search, department filters, source dialog Escape/focus restoration, assistant keyboard tabs, routing, empty/error states, appearance persistence and OS changes. Check desktop/mobile, contrast and reduced motion; distinguish automated checks from browser inspection.
- Keep all recorded phase statuses and synthetic labels, denied HTTP mutations, host/origin restrictions and source allow-list. Add regression tests for new assets and login/auth-route refusal. Run the existing suite and record unavailable host-dependent checks honestly.


- Use exact locked Express dependencies; no CDN, analytics, web fonts or cloud services.
- Listen on the literal loopback address; validate Host and reject cross-origin/cross-site access. Disable proxy trust and content-bearing logs.
- Allow only GET/HEAD. POST/PUT/PATCH/DELETE/OPTIONS never mutate anything and return 405. No broad filesystem/static directory access or caller-selected paths.
- Escape source/instruction text through DOM text operations. Apply restrictive CSP, no framing, no-store and MIME-sniffing protection. Do not show restricted/deleted synthetic canaries as ordinary review documents.
- Display current statuses honestly: foundation implementation prepared but not accepted; Phases 2–4 specified but not implemented; Phases 5/6 not implemented. Show that synthetic samples do not prove ingestion, permissions or inference.
- Verify actual HTTP responses, denied mutation/origin/path attempts, sanitised fixture output and local static asset delivery. Run the foundation regression suite after adding the preview.
- Start the server and verify its URL responds before giving the link. If browser automation is available, inspect desktop/mobile layout and navigation. Record any unavailable checks.

## Operation

After implementation: `npm ci --ignore-scripts` with the lockfile, `npm run preview` to start, `npm test` to verify; use `npm.cmd` on Windows. Default URL `http://127.0.0.1:4173`. Stop with Ctrl+C. It requires no Docker, model, database or real credentials and persists no user content. Remove the preview process to roll it back; it does not migrate production state.
