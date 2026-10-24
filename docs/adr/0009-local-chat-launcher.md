# ADR 0009: Assisted local chat bring-up

Status: Implementation for the requested local chat pilot; actual host execution and phase acceptance pending.

The user can access Docker Desktop and Ubuntu from ordinary PowerShell, while the restricted agent cannot access the engine/WSL. Combine tool installation and existing foundation orchestration into one user-run Windows command. Use a separate Linux filesystem deployment at `/srv/office-ai-local`, loopback-only HTTPS and the existing pinned images/security controls. No LAN exposure, unverified identity bridge or real documents are introduced.

The user reports about 7.66 GiB Docker memory. Select the already specified `qwen3.5:4b` fallback for this local pilot, preserve the production 9B baseline and require a real bounded generation test. Candidate container limits are 5 GiB inference and 2 GiB UI; stop on failed inference rather than claiming the model fits. A local pilot is not the benchmark/release gate.

A fresh pilot gets a new private CA/session key on the Linux filesystem. Export only the public root, verify the localhost certificate/HTTPS health with that root, display its fingerprint and request an explicit Windows current-user trust choice. The user creates their named administrator/password through the actual Open WebUI bootstrap UI. Never bypass a certificate warning or publish signup on the LAN.

Repeat starts reuse matching configuration, images/models, certificates and state; they do not update a copied deployment automatically or repeat downloads once its model digest is recorded. Stop on unexpected state/source changes. Normal LAN startup rejects the special loopback settings and remains subject to discovery/network/security acceptance. Root CA trust is a Windows user action with the displayed fingerprint; no trust or runtime changes occur merely from creating this launcher in the repository.

References: [4B model](https://ollama.com/library/qwen3.5:4b), [Ollama tag/digest contract](https://docs.ollama.com/api/tags), [generation contract](https://docs.ollama.com/api/generate).
