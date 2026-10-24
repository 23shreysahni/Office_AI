# Windows-first installation and recovery

Status: Windows host route prepared; live Windows/WSL acceptance NOT RUN. Use synthetic data only. The same application runs on Windows through WSL 2 Linux containers and on native Ubuntu Server. This guide adds host setup to [deployment](deployment.md); it does not replace F01–F14 or W01–W04 in the [foundation spec](../specs/01-foundation.md).

## One-command local chat pilot

If the local pilot stops with either `invalid mount path: 'mode=1777'` or `ECONNREFUSED 127.0.0.1:8443`, run this targeted recovery from Windows PowerShell:

```powershell
node "D:\websites\office-ai-spec\infra\repair-tmpfs.js"
```

It verifies the known deployment source and runtime files, backs up the Compose file and network-policy validator, adds a dedicated non-NAT bridge for the HTTPS proxy, updates the source marker and resumes the normal launcher. Docker cannot publish a port from an internal-only bridge; the dedicated bridge enables loopback port forwarding while keeping inference/UI networks internal and disabling outbound address masquerading on that bridge. It preserves downloads, configuration, keys and chats. Unexpected source/backup differences cause a refusal. Follow the resumed launch output; verify that Docker shows `127.0.0.1:8443->443/tcp` before opening the chat.

If Open WebUI loads but the signed-in screen spins and the browser console shows `403` for profile image, banners, tools listing, pinned notes, folders or timezone update, run this targeted policy update from Windows PowerShell:

```powershell
node "D:\websites\office-ai-spec\infra\repair-webui-policy.js"
```

It verifies the exact deployed source marker and unchanged runtime files, backs up only the prior Nginx template, permits authenticated GET requests needed by the Open WebUI shell, updates the source marker, resumes the normal launcher and explicitly restarts the bootstrap proxy so Nginx loads the new mounted configuration. It preserves the administrator, model and chats; unexpected source or backup differences cause a refusal. It does not enable uploads, tool/function installation, public signup or other blocked API routes.

For this workstation, Docker works in Ubuntu but Node is missing. Run the following in your ordinary **Windows PowerShell**, with Docker Desktop running and its Ubuntu integration enabled:

```powershell
node "D:\websites\office-ai-spec\infra\scripts\start-chat.mjs"
```

Windows Node is required to launch it. No repository npm installation is needed for this command. The launcher installs the pinned Ubuntu Node/toolchain described below, stages source without Windows secrets/state into `/srv/office-ai-local`, generates a new session secret and pilot TLS certificates, and provisions the pinned containers. Initial provisioning needs internet, several GB of downloads and at least 16 GiB free Linux filesystem space; check free Windows space for Docker/WSL too. Leave the PowerShell window open while downloads and the generation test run.

The user reported approximately 7.66 GiB allocated to Docker. This route requires at least 7.5 GiB and selects the specified `qwen3.5:4b` fallback with 5 GiB Ollama and 2 GiB UI limits. These are candidate limits, not measured capacity. It must complete a synthetic generation within four minutes; failure stops the pilot. The regular LAN deployment still requires the 9B baseline and network/admin review. Do not increase limits beyond available resources to work around a failure.

After internal inference and Windows-to-proxy HTTPS checks succeed, the launcher displays the public root certificate fingerprint and asks you to type `TRUST` before importing that certificate into `Cert:\CurrentUser\Root`. Trusting a root allows certificates signed by its key for your Windows user. Only the public certificate is copied to `artifacts/local-chat-root.crt`; the CA key, server key and session secret stay in Ubuntu. Pressing Enter leaves Windows trust unchanged. Do not bypass browser certificate errors.

After successful setup, open **https://localhost:8443**, create your named administrator account yourself, and select `qwen3.5:4b`. Keep passwords out of this conversation. This is a loopback-only, synthetic chat pilot; it creates no staff accounts and accepts no private document uploads. The agent cannot access WSL/Docker from its restricted session, so this launcher and real chat remain unrun on the host until you execute it.

Rerun the same command to resume a matching deployment or start it after Docker Desktop is ready following a reboot. Existing configuration, keys, account and conversation state are preserved. A changed source signature or unexpected deployment/configuration causes a refusal rather than an overwrite; review and back up the Linux deployment before updates. Successful reruns with a recorded model digest do not intentionally download images/models or run package updates when prerequisites remain available. This still needs an actual offline-restart test.

To stop the local pilot without deleting anything, run in PowerShell:

```powershell
wsl -d Ubuntu -u root --exec /usr/local/bin/node /srv/office-ai-local/infra/scripts/stack.mjs stop
```

The launcher saves content-free internal-generation evidence in `/srv/office-ai-local/state/local-chat-evidence.json`. It does not certify authenticated browser streaming/cancellation, offline behaviour, backup/restore, or LAN isolation. Complete the phase acceptance checks before staff rollout. The manual LAN deployment below uses the separate `/srv/office-ai` directory; do not promote the localhost configuration with the regular `start` command. See [ADR 0009](adr/0009-local-chat-launcher.md).

## Host and runtime

Use a supported Windows desktop release with hardware virtualisation, current WSL 2, an Ubuntu LTS WSL distribution, Docker Desktop with the WSL 2 **Linux-container** backend and WSL integration enabled for that distribution. Check the current [Windows prerequisites and licence terms](https://docs.docker.com/desktop/setup/install/windows-install/) and [WSL integration instructions](https://docs.docker.com/desktop/features/wsl/). Record exact approved versions before deployment. Windows Server needs a separately reviewed Linux VM/host arrangement; do not assume Docker Desktop supports it. GPU use is optional and requires separate driver/WSL/Ollama compatibility and benchmark evidence.

In an administrator PowerShell session, inspect WSL and, if not already installed, install it during the authorised provisioning window:

```powershell
wsl --status
wsl --list --verbose
# Installation only if required; follow the requested reboot.
wsl --install -d Ubuntu
```

Install the reviewed Docker Desktop release, select WSL 2/Linux containers, enable Ubuntu integration and start Desktop. Do not enable an unauthenticated TCP Docker API. Enter the Ubuntu shell with `wsl -d Ubuntu`. The remaining service commands run **inside Ubuntu**, rather than PowerShell. Configuration tests and the HTTPS smoke client can also run directly in PowerShell.

Inside Ubuntu install the reviewed Node.js 24 LTS/npm toolchain and Bash, OpenSSL, GNU tar/coreutils and GnuPG during provisioning. Node installed on Windows is a separate executable and does not establish that the Linux toolchain exists. Record package versions and retain approved offline recovery packages. Confirm `node --version`, `npm --version`, `docker version` and `docker compose version` work in the Ubuntu shell. The prerequisite checker verifies tool availability; it does not install packages or modify Windows/WSL settings.

If Docker already works in Ubuntu but Node is missing, use the repository's prerequisite launcher from ordinary **Windows PowerShell**:

```powershell
node "D:\websites\office-ai-spec\infra\scripts\setup-wsl.mjs"
```

It checks the existing Ubuntu/Docker integration, syntax-checks a fixed installer, then runs that installer as the Ubuntu root user. It installs Ubuntu packages for certificate/download/recovery tooling and Node.js `v24.22.0` from a fixed official Linux archive with a pinned SHA-256 from [the vendor checksum manifest](https://nodejs.org/download/release/v24.22.0/SHASUMS256.txt). The pins are recorded in `infra/node-runtime.json` for x64/arm64. It does not pipe a remote installer into a shell, install Docker again or change Windows settings. It refuses a different existing Node installation rather than overwriting it, and verifies the installed binary as the ordinary Ubuntu user before reporting success. It needs internet for this provisioning step. This does not create chat services, certificates, accounts or a `.env`; continue the deployment steps after prerequisite success. Archive/checksum verification here is not a claim of independent PGP verification.

## Files, configuration and certificates

Keep one deployment in `/srv/office-ai` on Ubuntu's Linux filesystem. Windows source such as `D:\websites\office-ai-spec` is for development. Do not deploy under `/mnt/c`, `/mnt/d`, a Windows share or a synced folder. Linux permissions and file operations differ on Windows mounts; Docker also recommends storing bind-mounted source in the Linux filesystem for WSL [performance](https://docs.docker.com/desktop/features/wsl/).

To stage this workspace's source from the Ubuntu shell, replace the source path if needed. The destination must be new; no existing state is overwritten:

```sh
test ! -e /srv/office-ai && sudo install -d -m 700 /srv/office-ai
```

Only after that command succeeds, copy source excluding development state and secrets:

```sh
set -o pipefail
tar -C /mnt/d/websites/office-ai-spec --exclude='./.env' --exclude='./.env.*' \
    --exclude='./secrets' --exclude='./state' --exclude='./artifacts' \
    --exclude='./node_modules' --exclude='./.git' --exclude='./.codex' \
    --exclude='./.agents' --exclude='./backups' -cf - . |
    sudo tar -xpf - -C /srv/office-ai
# The exclusion above intentionally omits environment files; copy only the template.
sudo cp /mnt/d/websites/office-ai-spec/.env.example /srv/office-ai/.env.example
cd /srv/office-ai
sudo node infra/scripts/stack.mjs doctor
```

Do not proceed if copying or prerequisite checks fail. `.gitattributes` preserves LF shell-script endings for future Git checkouts; staging this existing checkout must also preserve the LF bytes. Never reuse development certificates or session keys as production secrets.

Follow steps 1–3 in [deployment](deployment.md) inside Ubuntu, including new `.env`, session key, internal TLS certificate and image/model provisioning. Use the **Windows host's approved private LAN IPv4 address** as `LAN_BIND_IP`, rather than a transient WSL address or `0.0.0.0`. Confirm the actual Docker binding from a second LAN client before enabling the pilot. Node tools do not set firewall policy automatically.

For local first-administrator bootstrap on this Windows machine, use a managed Windows browser, temporarily resolve the configured hostname to `127.0.0.1`, trust the pilot/company root and open `https://HOSTNAME:8443`. If local forwarding does not work, investigate Desktop/WSL networking; never publish bootstrap on the LAN to work around it. Restore ordinary internal DNS resolution after bootstrap. Bootstrap remains loopback-only.

To trust the public CA in the current Windows user's certificate store, copy **only** `secrets/tls/root.crt` to an approved Windows staging location. Verify its fingerprint with the administrator, then run:

```powershell
Import-Certificate -FilePath 'C:\approved-path\office-ai-root.crt' -CertStoreLocation Cert:\CurrentUser\Root
```

For managed staff clients, use the organisation's certificate deployment process. Never export the CA key, server key or session secret. For a smoke client launched in Ubuntu use `NODE_EXTRA_CA_CERTS=/secure/root.crt`; in PowerShell set `$env:NODE_EXTRA_CA_CERTS` before launching Node. TLS warnings must not be bypassed.

## Windows networking, offline operation and reboot

Have the administrator review Windows firewall inbound and outbound policy, Docker Desktop backend/WSL traffic, private DNS and VPN paths before setting `NETWORK_POLICY_REVIEWED=true`. Desktop routes container traffic through its backend; see [Docker's networking documentation](https://docs.docker.com/desktop/features/networking/). A Linux-only forwarding rule or a disabled browser internet connection is insufficient evidence. Preserve the approved LAN and internal DNS/time/identity dependencies when denying internet egress.

Confirm Nginx observes acceptable source addresses on the actual LAN path. If Desktop NAT prevents the configured client CIDRs being enforced, leave LAN access closed and review the host boundary. Do not trust `X-Forwarded-For` from clients or allow an entire backend subnet as a shortcut. Complete F02/F07/W02 before acceptance.

With the reviewed policy active, follow deployment steps 4–5 to start and smoke-test. Run tests from a **second Windows or Linux LAN client** as well as the local machine; localhost success does not prove LAN availability or isolation. Validate secure cookies, logout/expiry, streaming cancellation and privacy logs in the browser.

During maintenance, test a full Windows reboot. Record whether an operator must sign in/start Docker Desktop. Once Desktop's Linux engine and WSL integration are ready, run in Ubuntu:

```sh
cd /srv/office-ai
sudo node infra/scripts/stack.mjs doctor
sudo node infra/scripts/stack.mjs start
sudo node infra/scripts/stack.mjs status
```

Repeat offline login, chat/history/model identity and disabled-signup checks without downloading anything. Container restart policies do not start a stopped Desktop/WSL runtime. Unattended Windows boot operation is not claimed. Disable host sleep during the approved service window and verify the agreed operating schedule.

## Backups and portability

Run the existing [encrypted backup/restore and rollback procedure](runbook.md) in Ubuntu. Use a mounted, approved backup destination outside `/srv/office-ai`, in a separate failure domain. The tar stream preserves Linux file permissions **inside the encrypted archive**, including when the encrypted file is stored on a Windows/external volume. Test destination access, capacity, GPG key recovery and the checksum independently. Do not copy live SQLite/state directories in Explorer as a backup.

Protect both the Windows host disk (including the WSL virtual disk) and recovery media with the reviewed encryption/access policy. Do not unregister Ubuntu, reset Docker Desktop or delete its virtual disks as cleanup; doing so can destroy stored models and chats. A WSL export is not a replacement for the quiesced encrypted application snapshot and image archives.

Restore into a separate empty Linux-filesystem directory on WSL or native Ubuntu using the same source/archives and matching image architecture. Review the destination hostname, CA, interface/CIDRs, engine/GPU and firewall policy before starting. Complete F12/F13/W04 there before switching the live endpoint. macOS and additional runtimes need their own host discovery and acceptance; portability alone is not evidence of a successful deployment.
