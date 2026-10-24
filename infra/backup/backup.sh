#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Linux host only. No environment file is sourced as executable shell code.
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd -P)
[[ $# == 2 ]] || { echo 'Usage: bash infra/backup/backup.sh EXISTING_DESTINATION GPG_RECIPIENT_FINGERPRINT' >&2; exit 1; }
destination=$(realpath -e -- "$1")
[[ -d "$destination" && "$destination" != "$root" && "$destination" != "$root/"* ]] || { echo 'Backup destination must be an existing directory outside the deployment' >&2; exit 1; }
[[ "$2" =~ ^([A-Fa-f0-9]{40}|[A-Fa-f0-9]{64})$ ]] || { echo 'Use a full reviewed GPG recipient fingerprint' >&2; exit 1; }
for tool in node docker tar gpg sha256sum; do command -v "$tool" >/dev/null || { echo "Missing required tool: $tool" >&2; exit 1; }; done
gpg --batch --list-keys "$2" >/dev/null 2>&1
cd -- "$root"
node infra/scripts/stack.mjs check
compose=(docker compose --env-file "$root/.env" -f "$root/compose.yaml" --profile '*')
running_text=$("${compose[@]}" ps --status running --services)
running=()
if [[ -n "$running_text" ]]; then mapfile -t running <<< "$running_text"; fi
partial=$(mktemp "$destination/office-ai-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX.gpg.partial")
restart() {
    result=$?
    trap - EXIT
    if ((${#running[@]})); then
        "${compose[@]}" start "${running[@]}" || { echo 'Service restart needs operator attention' >&2; result=1; }
    fi
    [[ ! -f "$partial" ]] || rm -f -- "$partial"
    exit "$result"
}
trap restart EXIT
trap 'exit 130' INT TERM
"${compose[@]}" stop --timeout 60
[[ -z "$("${compose[@]}" ps --status running --services)" ]] || { echo 'Snapshot refused: a service is still running' >&2; exit 1; }

# Archive state, CA, session key, pinned deployment source and .env consistently.
# Encrypt directly; do not create an unencrypted archive on disk.
tar --exclude='./.git' --exclude='./node_modules' --exclude='./artifacts' \
    --exclude='./backups' --exclude='./.codex' --exclude='./.agents' \
    -C "$root" -cf - . |
    gpg --batch --yes --encrypt --recipient "$2" --output "$partial"
archive=${partial%.partial}
mv -n -- "$partial" "$archive"
(cd -- "$destination" && sha256sum "$(basename -- "$archive")") > "$archive.sha256"
echo 'Encrypted snapshot and checksum created. Verify restoration on a separate target.'
