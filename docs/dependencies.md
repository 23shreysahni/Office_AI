# Dependency and version matrix

Research date: 19 October 2026. Phase 1 image references are pinned in `infra/images.json` and Compose. No production containers or models were installed; candidate rows for later phases remain unselected. Resolve exact patches, platform-specific image digests, licences and security advisories before Phase 1 deployment. No floating `latest` production references.

| Component | Proposed line / observed release | Evidence and outstanding verification |
|---|---|---|
| Windows / WSL 2 / Docker Desktop | Initial host route; exact versions pending | Check [Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/), Desktop licence and Ubuntu integration; use Linux containers and record reboot, network, offline and restore acceptance |
| Ubuntu Server | Supported LTS; exact release pending host discovery | Check [Docker Ubuntu support](https://docs.docker.com/engine/install/ubuntu/) and GPU driver support together |
| Node.js | Windows development runtime 24.15.0; Ubuntu prerequisite installer pins 24.22.0 | `infra/node-runtime.json` records official archive checksums for x64/arm64. [Official release schedule](https://nodejs.org/en/about/previous-releases); selected Ubuntu runtime still needs live installation/compatibility evidence |
| npm | Local 11.12.1 | Pin with chosen Node toolchain; commit lockfiles and use `npm ci` |
| Express | 5.2.1 exact for the local read-only review; business API still unimplemented | Root lockfile pins the review dependencies. [Support policy](https://expressjs.com/en/support/); re-review supported patches/advisories before a production custom API |
| Docker Engine / Compose plugin | Local CLI 29.5.3 / 5.1.4; production versions pending | CLI availability does not prove daemon or target Linux/GPU availability; pin compatible host packages |
| Nginx | 1.30.6-alpine, digest pinned in `infra/images.json` | [Stable releases](https://nginx.org/en/download.html); registry digest resolved; actual Linux runtime and TLS acceptance pending |
| Ollama | 0.40.6; digest pinned | [Release](https://github.com/ollama/ollama/releases/tag/v0.40.6); candidate only, verify image exists, digest, model loading and GPU support on target |
| Open WebUI | 0.12.3; digest pinned | [Release](https://github.com/open-webui/open-webui/releases/tag/v0.12.3); review image, licence, effective persisted settings, auth and offline operation |
| Qwen3.5 | `qwen3.5:9b`, installed digest pending | [Catalogue](https://ollama.com/library/qwen3.5:9b), [model licence](https://huggingface.co/Qwen/Qwen3.5-9B); tag exists upstream, local compatibility unverified |
| PostgreSQL / pgvector | Supported compatible pair; versions pending Phase 2/3 | Review [PostgreSQL support](https://www.postgresql.org/support/versioning/) and [pgvector compatibility](https://github.com/pgvector/pgvector) before selecting; not a Phase 1 dependency |
| Embeddings | Local model; candidate `nomic-embed-text` | Verify language quality, licence, vector dimensions and digest in Phase 3; no automatic download during operation |
| decimal.js | Exact version pending Phase 5 | [API](https://mikemcl.github.io/decimal.js/); bounded precision and rounding require explicit financial policy and independent tests |
| OIDC, validation, parsers, SQL and job libraries | Not yet selected | Finalise against relevant phase spec; no speculative installs or extra services |

## Required installation manifest

Record exact host OS/packages, CPU architecture, GPU driver/toolkit, image names/tags/full digests, model tags/full digests/quantisation, npm and runtime versions, lockfile hashes, upstream licence notices, vulnerability review date and any accepted exceptions. Include context/concurrency limits and a checksum-verified offline archive inventory. Keep credentials and sensitive host inventory outside Git.

An upstream release page is availability evidence, not a compatibility test or a security endorsement. This matrix is deliberately incomplete where host access or runtime testing is required; those items remain deployment blockers rather than invented pins.
