# Local review interface

Open [Office AI local review](http://127.0.0.1:4173) on this computer while the preview process is running. It is a read-only development interface, with original synthetic examples and the recorded phase status. It is not the deployed AI platform, a login/permission demonstration or a substitute for phase acceptance. No private uploads or financial processing are available.

## Start and stop

From this repository on Windows:

```powershell
npm.cmd ci --ignore-scripts --cache ./artifacts/npm-cache
npm.cmd run preview
```

On Linux use `npm` instead of `npm.cmd`. Use the exact lockfile. The first installation requires the approved package-download window; once this cache is populated, use `npm.cmd ci --ignore-scripts --offline --cache ./artifacts/npm-cache` for reproducible offline installation. No model, account, database, Docker or `.env` is required for the review. Stop the foreground process with Ctrl+C. Restart with `npm.cmd run preview`. Port 4173 must be free; the process binds only to `127.0.0.1`.

Do not publish/tunnel this HTTP review server or treat it as the office LAN entry point. The production stack still requires its reviewed HTTPS/authentication/network controls. This preview serves fixed assets, a fixed specification allow-list and sanitised synthetic review data only; it does not serve the repository root, deployment secrets or state.

## What you can check

- Overview: seven synthetic source previews, three instruction drafts and 70 prepared model-evaluation cases. No model evaluations have run.
- Source examples: local search, department filters and a text viewer. These filters are not access controls. Restricted/deleted/superseded fixture sources are not exposed as ordinary examples.
- Assistant drafts: Editorial/HR/Sales instructions and manually written illustrative copy, explicitly labelled as not AI-generated.
- Accounts: an unavailable-state page identifying the financial gate. No imports, arithmetic, approval or external write-back.
- Readiness: all six implementation phases, their actual recorded status and selected specifications/setup evidence.

All data is read-only. No browser role switching, fake login, generation button, upload endpoint, send action or external asset/provider is present. Review/profile/source text is rendered as text, including prompt-injection fixtures, rather than executed HTML or fetched links.

## Verification record

The preview adds Express `5.2.1` with an exact npm lockfile. The three HTTP integration/security tests in `tests/review.test.mjs` exercise real loopback listeners, static assets/data and headers, forged Host, Origin/Fetch-Metadata checks, denied mutations and filesystem/production-route denial. A legitimate top-level link navigation is permitted; cross-site API reads and iframe entry remain denied. Raw HTTP is used for forged Host tests because Fetch can normalise that header.

Chrome verification confirmed that the overview loads, local search narrows seven examples to the pollen source, its modal displays the original sections, assistant tabs switch using mouse and arrow keys, and Accounts is visibly unavailable. The desktop layout was visually inspected. A separate mobile viewport, real identity/model integration and production acceptance were not tested.

The current Docker daemon is still unavailable. Launching the installed Docker Desktop application did not establish a working engine in this session. No WSL installation, Windows service/firewall/trust-store changes, production deployment, migration or secret creation was performed.

Passed: `npm.cmd ci --ignore-scripts --offline --cache ./artifacts/npm-cache`, then `npm.cmd test` with the documented `NGINX_BIN`, `NGINX_TEST_CERT` and `NGINX_TEST_KEY` synthetic fixtures set. **24 tests passed, zero failed/cancelled/skipped**, including real Compose CPU/GPU parsing, real Nginx boundary checks and the three new HTTP review tests. This is local tooling/review evidence, not production acceptance. Rolling back this review means stopping the process; it makes no production data/schema changes. Phase 1 actual-host acceptance and Phase 2 implementation still precede later feature delivery under `AGENTS.md`.
