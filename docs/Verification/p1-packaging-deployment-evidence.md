# P1 Packaging and Deployment Evidence

## Purpose

This document records the **currently verifiable** P1 evidence for deployment readiness, Desktop/API connectivity, and desktop packaging intent. Host-specific transient blockers are intentionally excluded unless they are part of a reproducible project-level verification artifact.

Primary evidence sources:

- `infra/docker-compose.prod.yml`
- `infra/docker-compose.legacy.yml`
- `deploy/server-up.sh`, `deploy/server-down.sh`, `deploy/server-check.sh`, `deploy/load-offline-images.sh`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/package.json`

## Verified Commands

Strict verification reports are generated on demand by `node scripts/verification/p1-verify.mjs --strict` and now default to the local ignored directory `test-results/verification/`. They are runtime artifacts rather than repository evidence files.

| Area | Command | Result |
| --- | --- | --- |
| Workspace typecheck | `npm run typecheck` | Pass |
| Workspace tests | `npm test` | Pass |
| API tests | `npm test --workspace apps/api` | Pass |
| Desktop frontend tests | `npm test --workspace apps/desktop` | Pass |
| Tool adapter fixture tests | `npm test --workspace packages/tool-adapter-fixtures` | Pass |
| Rust cargo check | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | Pass |
| Rust cargo tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | Pass |
| Docker prod config | `docker compose -f infra/docker-compose.prod.yml config` | Pass |
| Docker legacy config | `docker compose -f infra/docker-compose.legacy.yml config` | Pass |
| Deploy script syntax | `bash -n deploy/server-up.sh deploy/server-down.sh deploy/server-check.sh deploy/load-offline-images.sh` | Pass |
| Acceptance matrix | `node --test tests/smoke/p1-acceptance-matrix.test.mjs` | Pass |
| Static delivery regression | `node --test tests/smoke/p1-real-delivery-static.test.mjs` | Pass |
| Browser governance closure | `npm run p1:ui-closure` | Pass |
| Native install closure | `npm run p1:native-closure` | Pass |
| Full closure | `npm run p1:full-closure` | Pass |

## Current Verifiable Facts

### Deployment shape

- Production Compose and legacy Compose files both parse successfully.
- Deployment scripts exist and pass shell syntax validation.
- Production deployment assets cover PostgreSQL, Redis, MinIO, API, migration, seed, and object-storage initialization paths.
- The repository contains a strict verification path (`node scripts/verification/p1-verify.mjs --strict`) that regenerates the full release-gate report locally.

### Desktop/API connectivity

- The latest strict verification report covers **19/19** acceptance scenarios.
- End-to-end evidence includes publish -> review -> market governance flow in browser closure.
- End-to-end evidence includes `download-ticket` -> package validation -> Central Store install -> tool/project enable -> restart restore -> uninstall in native closure.
- Full closure evidence exists as a single chained run through `npm run p1:full-closure`.

### Packaging intent

- Tauri desktop packaging configuration exists at `apps/desktop/src-tauri/tauri.conf.json`.
- The desktop package exposes a Windows NSIS build script: `tauri:build:windows`.
- Rust/Tauri entrypoints and tests are present and pass cargo verification.

## Current Evidence Boundaries

- This document proves repository-level verification, not target-environment signoff.
- A target Linux host run for live deployment and a target Windows host run for NSIS installer generation still need environment-specific evidence when release signoff requires it.
- Until those host runs are captured, the verified claim is: **configuration, scripts, tests, and full closure pass in the repository verification lane**.
