# ADR 0013: local 9B pilot and longer answers

Date: 24 October 2026. Status: user-authorised; local GPU inference verified.

The host has approximately 16 GiB RAM and an RTX 3050 with 8 GiB VRAM. Increase the WSL memory ceiling to 10 GiB, leaving approximately 6 GiB for Windows. This is a ceiling, not preallocation. The NVIDIA 9B pilot uses seven GiB Ollama/two GiB WebUI limits, 4096 context and one request at a time. Check Docker's actual memory after restart before starting. GPU fit and speed require measurement; allow Ollama to choose CPU offloading without implying full GPU residency.

Permit only two exact local profiles: historical 4B with five GiB inference, or explicitly NVIDIA 9B with seven GiB inference. Retain the 4B model for rollback and validate the selected model's full digest among installed models. Back up configuration and verify all signed source files before applying the reviewed source change and updating the deployment marker. No secrets, account or chat migrations are required.

Increase the generation ceiling to 1536 tokens and request enough explanation to answer the question. This permits longer answers rather than forcing padding. Existing conversations or saved user/model overrides may retain different settings; test a new chat after changing the default.

Rollback: stop the pilot using its recorded compute selection, restore `.env.before-9b`, and run `stack.mjs bootstrap` with NVIDIA. Retain compatible updated source and both model artefacts. The historical 4B launcher's model-set check still requires only 4B, so use direct bootstrap for this rollback while 9B remains installed. Before this change there was no `.wslconfig`; reverting the memory ceiling means removing the added `memory=10GB` setting, preserving any subsequently added settings, then restarting WSL/Docker. Never delete state or volumes.

## Verification on the initial host

Docker reported 10,429,968,384 bytes after WSL/Docker restart. The 9B download passed Ollama checksum verification and provisioning recorded digest `sha256:56671c2ab9385f9cfcb404638e32cd62d88e3501d44822208363c010179a3c90`. The first synthetic generation took 65.26 seconds including cold startup. `ollama ps` reported 100% GPU at context 4096. The API reported 5,606,337,412 bytes model residency in VRAM; NVIDIA reported approximately 7,811 MiB total usage of 8,192 MiB including other GPU allocations. Keep concurrency/context bounded because VRAM headroom is tight.

A synthetic streamed long answer completed naturally at 646 output tokens, taking 30.056 seconds with first token at 0.838 seconds and 22.11 generated tokens/second. Two warm 128-token probes took 6.043/6.090 seconds, first tokens at 0.309/0.262 seconds and generation at 22.33/21.97 tokens/second. Those short probes intentionally reached their 128-token test limits; deployed defaults allow 1536. Benchmark calls disabled thinking explicitly; user-selected reasoning or saved parameters can change latency and output length. Metadata only is recorded in ignored `artifacts/9b-benchmark.json`; no prompts or generated text are saved in the report.

Container environment inspection confirmed default 9B, output ceiling 1536, context 4096 and the fuller-explanation system instruction. Windows HTTPS health passed using the verified pilot CA. `node --test tests/foundation.test.mjs tests/compose.test.mjs tests/compute.test.mjs tests/local-chat.test.mjs tests/setup-wsl.test.mjs` passed all 30 tests with no failures or skips. Real Compose CPU/GPU parsing and selected-digest/invalid-profile negative tests passed. No authenticated browser chat, 20-request performance acceptance, offline isolation or complete phase gate is claimed by these checks.

The normal Windows launcher provisioning path was rerun successfully: it verified matching source signatures, reused the pinned installed 9B model without an intentional image/model download, confirmed GPU inference, and passed Windows HTTPS health. Certificate trust was unchanged. The healthy HTTPS entry remains published only at `127.0.0.1:8443`; upstream model/UI ports remain internal.
