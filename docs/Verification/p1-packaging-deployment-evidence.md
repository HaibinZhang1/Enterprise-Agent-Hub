# P1 Packaging and Deployment Evidence

## Purpose

This document records the current repository-level evidence for deployment readiness, Desktop/API connectivity, and Electron desktop packaging.

Primary evidence sources:

- `infra/docker-compose.prod.yml`
- `deploy/server-up.sh`, `deploy/server-down.sh`, `deploy/server-check.sh`, `deploy/load-offline-images.sh`
- `apps/desktop/package.json`
- `apps/desktop/src-electron/**`
- `scripts/full-closure/run-electron-smoke.mjs`

## Verified Commands

Strict verification reports are generated on demand by `node scripts/verification/p1-verify.mjs --strict` and land under the ignored local output directory `test-results/verification/`.

| Area | Command | Result |
| --- | --- | --- |
| Workspace typecheck | `npm run typecheck` | Pass |
| Workspace tests | `npm test` | Pass |
| API tests | `npm test --workspace apps/api` | Pass |
| Desktop frontend + Electron tests | `npm run test --workspace @enterprise-agent-hub/desktop` | Pass |
| Desktop lint | `npm run lint --workspace @enterprise-agent-hub/desktop` | Pass |
| Electron closure gate | `npm run p1:electron-closure` | Pass |
| Docker prod config | `docker compose -f infra/docker-compose.prod.yml config` | Pass |
| Deploy script syntax | `bash -n deploy/server-up.sh deploy/server-down.sh deploy/server-check.sh deploy/load-offline-images.sh` | Pass |
| Static delivery regression | `node --test tests/smoke/p1-real-delivery-static.test.mjs` | Pass |
| Electron unpacked packaging | `npm run desktop:electron:package` | Pass |

## Current Verifiable Facts

### Deployment shape

- Production Compose files parse successfully.
- Deployment scripts exist and pass shell syntax validation.
- Production deployment assets cover PostgreSQL, Redis, MinIO, API, migration, seed, and object-storage initialization paths.
- The repository contains a strict verification path that regenerates the release-gate report locally.

### Desktop/API connectivity

- The Electron closure lane verifies desktop typecheck, Electron smoke tests, strict no-Tauri scan, Rust exception gate, Electron security policy, and static delivery assertions in one chained run.
- End-to-end evidence includes publish -> review -> market governance flow in the browser closure lane.
- End-to-end evidence includes `download-ticket` -> package validation -> Central Store install -> tool/project enable -> restart restore -> uninstall in the Electron native closure lane.

### Packaging evidence

- The desktop package exposes Electron build scripts for dev, unpacked packaging, and Windows NSIS intent.
- `npm run desktop:electron:package` successfully produces the current-platform unpacked Electron artifact through `electron-builder --dir`.
- The packaged runtime trusts only the bundled renderer entrypoint, not arbitrary local `file:` pages.
- On the current macOS 25.4.0 host, `npm run desktop:electron:build:windows` was attempted and reached `electron-builder`'s `unpack-electron` phase for `platform=win32 arch=x64`, producing `release/electron/win-unpacked` runtime files but not a final `Enterprise Agent Hub.exe` or NSIS installer. The host does not provide `wine` or `makensis`, so Windows NSIS signoff remains environment-specific.

## Current Evidence Boundaries

- This document proves repository-level verification, not target-environment signoff.
- Windows NSIS packaging is configured in `apps/desktop/package.json`, but cross-building it from the current macOS host is not treated as repository proof.
- The current host evidence for `npm run desktop:electron:build:windows` is: macOS 25.4.0, `wine` missing, `makensis` missing, and the build stopped after unpacking Windows runtime resources but before producing the branded executable or NSIS installer.
