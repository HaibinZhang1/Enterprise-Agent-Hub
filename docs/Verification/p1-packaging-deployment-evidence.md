# P1 Packaging and Deployment Evidence

## Purpose

This document defines the Worker 6 packaging/deployment evidence contract for P1 基础闭环. It should be completed after product lanes are integrated and before final release sign-off.

## Required commands

Run the full verification gate from the repository root:

```bash
node scripts/verification/p1-verify.mjs --strict
```

The gate writes:

- `verification/reports/p1-verification-report.md`
- `verification/reports/p1-verification-report.json`

## Evidence matrix

| Area | Gate command or artifact | Required pass condition | Owner |
| --- | --- | --- | --- |
| Workspace typecheck | `npm run typecheck` | TypeScript typecheck passes across workspaces. | W1/W2/W3/W6 |
| Workspace tests | `npm test` | Root test suite passes. | All |
| API tests | `npm test --workspace apps/api` | Auth/bootstrap/skills/detail/download-ticket/notifications/local-events tests pass. | W2 |
| Desktop frontend tests | `npm test --workspace apps/desktop` | P1 navigation, market/detail, installed/tools/projects/notifications/settings UI boundaries pass. | W3 |
| Rust cargo check | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | Store/Adapter/Tauri command code compiles. | W4/W5 |
| Rust cargo tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | Store, SQLite, offline queue and distribution tests pass. | W4/W5 |
| Adapter fixtures | `npm test --workspace packages/tool-adapter-fixtures` | Built-in target transforms and symlink/copy fallback fixtures pass. | W5/W6 |
| Docker prod config | `docker compose -f infra/docker-compose.prod.yml config` | Compose file is syntactically valid. | W2/W6 |
| Docker legacy config | `docker compose -f infra/docker-compose.legacy.yml config` | Legacy compose validates when present. | W2/W6 |
| Deploy script syntax | `bash -n deploy/server-up.sh deploy/server-down.sh deploy/server-check.sh deploy/load-offline-images.sh` | Deployment shell scripts parse. | W2/W6 |
| W6 matrix self-test | `node --test tests/smoke/p1-acceptance-matrix.test.mjs` | Verification config and smoke/e2e matrix remain complete. | W6 |
| Tracked generated artifacts | Built-in `tracked-generated-artifacts` gate in `p1-verify.mjs` | No tracked `node_modules/**`, package `dist/**`, app build outputs, or coverage outputs remain in final integration. | W6/leader |

## Acceptance coverage required before sign-off

The smoke/e2e spec in `tests/smoke/p1-e2e-smoke-spec.json` covers the required P1 acceptance scenarios:

1. Bootstrap/login with P1-only navigation.
2. Market search/filter/sort.
3. Restricted detail without README/audit/package leakage.
4. Hash-verified install into Central Store and SQLite state.
5. Hash mismatch failure preserving existing state.
6. Local hash change warning before update overwrite.
7. Codex symlink enable success.
8. Symlink failure falling back to copy with `fallbackReason`.
9. Disable preserving Central Store.
10. Uninstall confirmation listing and removing managed targets.
11. Offline enable/disable queue surviving restart.
12. Idempotent `/desktop/local-events` sync without governance mutation.
13. Notification mark-read plus offline cache display.

## Packaging deliverables

| Deliverable | Required evidence |
| --- | --- |
| Windows exe installer | Tauri build artifact path, version, SHA-256 checksum, smoke install result on Windows. |
| Linux server deployment | `deploy/server-up.sh` run log, `/health` output, migration/seed exit codes. |
| PostgreSQL/Redis/MinIO env template | `infra/env/server.env.example` includes required variables without secrets. |
| Offline/legacy deployment | `deploy/server-check.sh` output and, when used, offline image checksum verification. |
| Seed data | Seed command output and deterministic IDs for installable, restricted, update-available and offline scenarios. |
| Adapter fixture report | Completed `docs/Verification/p1-fixture-acceptance-report.md`. |

## Current W6 baseline

At creation time, this W6 worktree had no root `package.json`, no `apps/**`, no `packages/**`, no `infra/**`, and no `deploy/**`. Use non-strict mode during parallel development to produce a pending report, then use strict mode after integration to fail on any missing product-lane artifact, failing command, or tracked generated artifact such as `node_modules/` or `packages/shared-contracts/dist/`.
