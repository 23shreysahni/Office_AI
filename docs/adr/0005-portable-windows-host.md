# ADR 0005: Windows-first portable container deployment

Date: 19 October 2026. Status: User requested Windows as the initial OS and OS portability; runtime acceptance pending.

Keep Nginx, Open WebUI and Ollama as the same pinned Linux containers on every deployment. Initially use a supported Windows desktop host with Docker Desktop's WSL 2 Linux backend and an Ubuntu WSL distribution. Execute deployment, certificate and backup tools inside that distribution. Native Ubuntu Server uses the same source, Node.js commands, Compose files and encrypted archive format. No Windows-specific application fork, native Windows Ollama instance or second data store is introduced.

Store the deployment at `/srv/office-ai` in the WSL Linux filesystem. The Windows checkout is a development/source copy, not production state. This preserves Linux permissions and the existing Bash/OpenSSL/GPG stopped-service backup procedure. Protect the Windows system and WSL virtual disk with reviewed disk encryption and host access controls. WSL and Docker administrators can access application data and are trusted operators.

Add a read-only prerequisite command before deployment. It requires a Linux execution environment, local Docker socket, a Linux daemon, Compose and the existing recovery tools; Windows invocation returns instructions to use the WSL shell. Each subprocess is bounded and failures reveal no raw upstream output. Configuration tests and the HTTPS smoke client remain usable directly on Windows.

Windows firewall and Docker Desktop networking differ from native Linux Docker forwarding. Review both host and backend traffic and verify LAN source-address behaviour on the real host. Do not broaden the Nginx allow-list to a NAT subnet or trust caller-supplied forwarded headers to make a failed test pass. Use an approved Linux VM/host if the required boundary cannot be demonstrated.

Docker Desktop availability after reboot may depend on operator login and startup settings. Document and test the operator recovery sequence; do not claim an unattended Windows service. Windows Server requires a separately reviewed Linux VM/host route; Docker Desktop is not a Windows Server deployment assumption. Review Desktop licensing for the organisation. macOS remains a candidate requiring discovery and acceptance.

Portability means the source and recovery format can move between reviewed Linux container engines. Image architecture, hardware/GPU, CA trust, DNS, firewall and encrypted restore still require destination testing. F01–F14 and Windows W01–W04 remain open until observed and reviewed.

References: [Docker Windows installation](https://docs.docker.com/desktop/setup/install/windows-install/), [WSL backend](https://docs.docker.com/desktop/features/wsl/), [Desktop networking](https://docs.docker.com/desktop/features/networking/).
