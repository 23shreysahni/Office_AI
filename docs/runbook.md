# Foundation operator runbook

Run these commands in the reviewed Linux deployment under `/srv/office-ai`, inside Ubuntu WSL 2 on the initial Windows host or on native Ubuntu Server. See [Windows host operations](windows.md) for Desktop startup, Windows firewall, CA trust and reboot checks. Keep `.env`, state, backups, archives and secrets outside Git. Do not paste Docker inspection output or content-bearing logs into public reports. [Deployment](deployment.md) describes setup and first-user isolation.

The [local review](local-review.md) is a separate loopback development process; it is not operated through the production Compose stack. Offline root dependency/test installation now requires the reviewed npm recovery cache described in deployment; include `--cache /mnt/office-ai-recovery/npm-cache` with the offline `npm ci` command after restoring. Do not assume the default user cache or ignored development artefacts are backed up.

## Start, inspect and stop

```sh
cd /srv/office-ai
sudo node infra/scripts/stack.mjs check
sudo node infra/scripts/stack.mjs start
sudo node infra/scripts/stack.mjs status
sudo node infra/scripts/stack.mjs inspect
sudo node infra/scripts/stack.mjs stop
```

Use `COMPUTE_MODE=auto` to re-probe on controlled starts, or explicit `nvidia`/`cpu` configuration. The existing `--gpu` flag requires NVIDIA. Status/inspect/stop reuse `state/compute.json`; stop before editing an explicit compute mode. Do not use `docker compose up` directly to bypass configuration, network or bootstrap checks. Never use `down -v`, prune, `pull` or model downloads in offline production. Stop/start preserves state. `inspect` requires running backends; `check` does not require a daemon. See [LAN setup](lan-setup.md) for preparation, CPU fallback and actual GPU verification.

For missing-model or offline failures, check bounded health status locally, available disk, the installed digest and Ollama readiness. Restore the local artefact/archive during maintenance if absent. No cloud endpoint or model-download route is exposed to the browser. Browser missing-model and cancellation behaviour remains an actual-host acceptance case.

## Offline smoke and persistence

1. Finish provisioning and obtain baseline smoke success. Record exact image/model identity, synthetic history marker and reviewed settings.
2. The administrator applies the reviewed host/container internet-deny policy while preserving LAN DNS/time/identity dependencies. From the server and representative container namespace, demonstrate an external connection cannot succeed. Capture firewall counters/flow evidence covering the UI and inference networks. A failed connection on just the client or host is insufficient.
3. From a second LAN client, run the authenticated smoke command in `deployment.md`, load the chat UI, stream a synthetic answer and cancel a second generation. Inspect browser requests for external assets or providers.
4. Run `sudo node infra/scripts/stack.mjs stop` followed by `sudo node infra/scripts/stack.mjs start` (add `--gpu` if applicable). Repeat login, smoke and browser checks. Confirm history marker, model digest and disabled signup persist without downloads.
5. Record sanitised F07/F08 evidence, including where egress was blocked, observations, timestamps and test settings. Production remains internet-denied. Any temporary rule rollback must use the network administrator's recorded procedure.

Observe attempted egress as well as successful traffic: unexpected attempts require investigation even if blocked. Do not record raw prompt/response bodies. UI and container logs are restricted diagnostics; use a synthetic canary to check F10 because upstream error paths can log more than successful requests.

## Benchmark

Use the protocol in [discovery](discovery.md): one cold and 20 warm sequential synthetic requests capped at 250 output tokens, one active user, fixed context/thinking/sampling settings. Record actual output token counts, first-token and total latency, p95 total latency, tokens/sec and peak RAM/VRAM; monitor with `docker stats --no-stream` and `nvidia-smi` where applicable. Under 20 seconds is a measured pilot target, not a hardware promise. Failure requires reviewed remediation before expansion. Do not use the short smoke greeting as the performance benchmark.

## Encrypted consistent backup

Mount an approved separate backup destination. Import and independently verify the recipient's GPG public key/fingerprint; the decryption key must have a separate custodian and tested recovery access. Back up the full model volume for offline recovery. Ensure enough destination capacity and an approved maintenance window.

```sh
cd /srv/office-ai
sudo bash infra/backup/backup.sh /mnt/office-ai-backups FULL_GPG_RECIPIENT_FINGERPRINT
```

The script validates configuration, stops all services, confirms none remain running and streams a complete state/configuration snapshot directly through GPG. It includes UI SQLite state, model blobs, internal CA keys, the session secret, `.env` and pinned source/configuration. Git, node_modules and artefact downloads are excluded. It creates an encrypted archive and SHA-256 sidecar outside the deployment, then restarts only services previously running even if backup fails. Investigate any reported restart failure. No plaintext tar is written. Preserve the checksum separately and copy the encrypted backup to the approved separate failure domain. Never store its contents in the repository.

Container images are archived separately as described in deployment. Retain their checksum-verified archives and compatible host/GPU prerequisites; a state snapshot alone cannot reconstruct the runtime offline. Record backup creation time, retention, checksum and restore drill result without secrets.

## Restore to a separate, empty target

Use a trusted snapshot and independently held checksum, a reviewed compatible Linux/Docker/Node host and a maintenance network with no public ingress. Verify the encrypted archive checksum before decrypting. Restore to a new, empty directory; do not overwrite an existing deployment. These commands use example paths that the operator must replace with the chosen archive and new directory:

```sh
(cd /mnt/office-ai-backups && sha256sum --check CHOSEN_ARCHIVE.gpg.sha256)
test ! -e /srv/office-ai-restore
sudo install -d -m 700 /srv/office-ai-restore
gpg --decrypt --output - /mnt/office-ai-backups/CHOSEN_ARCHIVE.gpg | sudo tar -xpf - -C /srv/office-ai-restore
```

Run the pipeline in a Bash shell with `set -o pipefail`; if decryption or extraction fails, do not start the restore. Extract only the trusted archive produced by this runbook. Re-establish root ownership and restrictive permissions on state/secrets; confirm `secrets/webui_session_key` is 0600. Reinstall npm's locked toolchain using `npm ci --ignore-scripts --offline`. Load each checksum-verified pinned image archive with `sudo docker image load --input /mnt/office-ai-recovery/images/COMPONENT.tar`.

Edit the restored `.env` for a distinct test Compose project and test IP/CIDRs. Retain the certificate's hostname in isolated test-client DNS, or issue a matching new leaf certificate before using a different hostname; do not change live DNS. Do not run it on a live endpoint or bootstrap port already used by another deployment. Keep egress denied and use the restored CA trust. After reviewing the test network policy, run:

```sh
cd /srv/office-ai-restore
sudo node infra/scripts/stack.mjs check
sudo node infra/scripts/stack.mjs start
```

Perform offline smoke, browser login, synthetic-history and model-digest checks. Record restore duration and recovered snapshot timestamp against the agreed RTO/RPO. Verify permissions and signup restrictions after restart. Retain F12 evidence before promoting any restore; database migrations are not assumed reversible.

## Upgrade and rollback

Renew TLS certificates before they enter the seven-day startup rejection window. Request a new hostname-matching leaf certificate from the internal CA, or sign a new CSR using the retained pilot CA in a restricted maintenance session. Keep the existing root trust where possible. Verify the new chain, SAN, validity and key match, take an encrypted snapshot, stop both proxy profiles, replace the leaf certificate/key atomically with a verified matching pair and restrictive permissions, then use the guarded `start` command and repeat HTTPS smoke. Do not run the pilot generation tool to overwrite an existing CA. If the root CA changes, distribute and verify the new trust anchor before switching the endpoint. For compromised keys, revoke/replace affected certificates and managed trust rather than simply renewing.

No automatic upgrades. Review proposed image versions/licences/advisories, record new immutable digests and migration notes, then take and verify an encrypted pre-upgrade snapshot plus previous image archives. Test new images with a restored copy on an isolated host first.

If the trial fails, stop it with `sudo node infra/scripts/stack.mjs stop`. Preserve the failed state for restricted investigation. Restore the last matching pre-upgrade snapshot into another empty directory as above, load the prior exact images, validate offline login/chat/settings and only then switch the reviewed internal hostname/IP during maintenance. Do not run old images against an already migrated UI database. No ledger changes or application schema migrations are introduced in Phase 1.

## Evidence and release gate

Use [Phase 1 verification](phase-1-verification.md) for the current result and F01–F14 evidence. Administrator review is required before calling the phase accepted or starting Phase 2. Remaining host facts, untested browser behaviour or unsuccessful restore are explicit open work.
