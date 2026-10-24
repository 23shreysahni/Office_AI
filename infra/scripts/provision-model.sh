#!/bin/sh
set -eu
# Controlled provisioning only; this container has no published ports or UI volume.
ollama serve >/dev/null 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT INT TERM
attempt=0
until ollama list >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    [ "$attempt" -lt 30 ] || { echo 'Local model service did not become ready' >&2; exit 1; }
    sleep 1
done
ollama pull "$1"
