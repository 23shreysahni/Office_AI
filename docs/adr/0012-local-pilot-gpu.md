# ADR 0012: NVIDIA compute for the local pilot

Date: 24 October 2026. Status: authorised and verified on the local Windows/WSL pilot.

The initial localhost pilot ran on CPU although an RTX 3050 with 8 GiB VRAM is visible in WSL. Use the existing supported `COMPUTE_MODE=nvidia` deployment setting and `compose.gpu.yaml`; no application source migration or model change is needed. Keep the historical CPU default for deployments without an explicit selection.

Probe the pinned cached Ollama image without networking or state mounts, back up `.env`, stop the pilot with its recorded CPU selection, set NVIDIA mode, then bootstrap through the existing orchestration. Bootstrap must verify generation and positive GPU residency before opening HTTPS. Preserve secrets, chats, model digest and resource/network limits. Rollback stops with NVIDIA selection and restores the prior configuration before CPU bootstrap. Do not delete volumes or change Windows certificate trust as part of compute configuration.

Verification: the container probe passed; `.env.before-nvidia` preserves the original configuration in the Linux deployment. `stack.mjs bootstrap` passed synthetic inference with `gpu:true`; `ollama ps` reported `100% GPU`, context 4096, unchanged model ID `d8b0f5e9760c`. Docker inspection showed one NVIDIA GPU allocation. All three containers became healthy, only `127.0.0.1:8443` was published, and Windows HTTPS health passed using the pilot CA with certificate verification enabled. `node --test tests/compute.test.mjs tests/local-chat.test.mjs` passed all 13 tests, including real Compose parsing, without skips. This is GPU bring-up evidence, not a warm performance benchmark or full phase acceptance.
