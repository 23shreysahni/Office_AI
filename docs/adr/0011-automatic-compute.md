# ADR 0011: automatic compute selection for the foundation server

Date: 24 October 2026. Status: implementation authorised; actual-host acceptance pending.

The regular foundation stack will accept auto, nvidia and cpu compute modes. Auto probes the pinned local Ollama image using the local Docker engine, no network, no state mounts and no implicit downloads. Known GPU absence/unsupported drivers allow CPU fallback with a reason; infrastructure failures stop startup. Explicit NVIDIA mode fails closed. The existing --gpu flag remains an explicit NVIDIA alias and conflicts with CPU configuration.

Ollama controls model placement; do not force a fixed CPU/GPU split or change the selected 9B model. Before LAN startup a short synthetic generation verifies the selected model and actual placement. No mid-stream retries or runtime container replacement are introduced. Lifecycle commands reuse recorded placement selection; fresh starts probe again. CPU configuration disables CUDA and Vulkan device selection, while the NVIDIA override enables its allocated device.

LAN service remains the existing named-login HTTPS foundation, with only Nginx published to a reviewed private address. Preserve the separate localhost pilot and its source-signature guards. Client devices need only a browser and CA trust. Deployment discovery, trusted TLS, firewall review, actual-host acceptance and later staff-account review remain required; automatic compute selection does not resolve those gates.
