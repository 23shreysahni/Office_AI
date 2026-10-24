# Infrastructure discovery

Status: Target-office-server facts pending. Record operational details in a restricted administrator inventory; never add credentials, private addresses requiring confidentiality, or real personal/financial data to this repository.

## Required before deployment

| Fact | Current evidence | Decision needed |
|---|---|---|
| CPU architecture/model/cores | Unknown | Confirm supported image architecture and benchmark CPU fallback |
| RAM and swap | Unknown | Measure model plus UI/OS headroom; establish limits |
| GPU model, VRAM, driver | Unknown | Check pinned Ollama hardware compatibility and container GPU runtime |
| Disk type/free capacity | Unknown | Budget models, uploads, indices, logs and backup staging with headroom |
| Server OS | Windows initially, using Docker Desktop/WSL 2 + Ubuntu; native Ubuntu Server also planned | Confirm supported Windows edition/build, WSL/Ubuntu/Desktop versions and licensing, virtualisation, maintenance/access owner and reboot/startup schedule |
| LAN/VPN ranges and server address | Unknown | Approve ingress allow-list; check Docker forwarding paths |
| Internal hostname/DNS | Unknown | Resolve privately and distribute trusted CA certificates |
| Identity provider | Unknown | Internal OIDC preferred; document offline dependencies |
| Pilot/concurrency | 3–5 staff proposed; Phase 1 administrator only | Confirm one-user baseline and later concurrent workload |
| Backup location/key custodian | Unknown | Separate failure domain, encryption, restore access |
| Retention and recovery objectives | Unknown | Owner to approve chat/audit/upload retention, RPO and RTO |
| Maintenance window/operator | Unknown | Approve installation, backup and rollback procedure |

## Read-only discovery on the target Linux host

Run these on the office server when access is available, inside the Ubuntu WSL shell for Windows. Also collect `wsl --status` and `wsl --list --verbose` from Windows PowerShell and the Desktop version. Do not assume local development-machine output describes that server. Redact hostnames/usernames before sharing reports.

```sh
uname -m
cat /etc/os-release
lscpu
free -h
df -h
nvidia-smi
docker --version
docker compose version
```

`nvidia-smi` is applicable only if NVIDIA hardware/driver exists. Missing hardware is an explicit outcome, not a reason to install drivers automatically.

## Model compatibility and benchmark protocol

The [Ollama catalogue](https://ollama.com/library/qwen3.5:9b) lists the planned tag. The [upstream model card](https://huggingface.co/Qwen/Qwen3.5-9B) declares Apache-2.0. This does not verify a local pull, quantisation, runtime compatibility or performance. Consult [Ollama hardware support](https://docs.ollama.com/gpu) for the actual GPU and driver.

After foundation approval, provision using the reviewed pinned runtime. Pull the approved tag only during the controlled download window, inspect it locally and record the complete model digest, artefact size, quantisation and runtime version. Do not use an abbreviated catalogue hash as the installed digest. Archive the selected artefacts for offline recovery.

Use only synthetic prompts. Record context limit, output-token cap, thinking setting, temperature and GPU/CPU offload. Start conservatively with a 4,096-token context candidate, verifying support before adoption. Run one cold request and 20 warm sequential requests with one active user, requesting a short answer capped at 250 output tokens; retain timings, actual token counts, time to first token, total latency, tokens/sec and peak RAM/VRAM. Measure p95 total latency against the product's under-20-second pilot target; report the cold start separately. Do not pass the target by silently changing token/settings or counting only first-token latency.

If memory or latency fails, benchmark the approved smaller model/quantisation and record a reviewed change, or propose hardware changes. Never switch to cloud inference. Repeat offline after provisioning and separately test later concurrency before staff expansion.
