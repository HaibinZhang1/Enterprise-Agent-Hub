# P1 foundation loop verification path

Generated: 2026-04-11T23:20:15.910Z
Mode: strict release gate
Overall status: **PASS**

## Summary

- Artifact checks: 12 pass, 0 pending, 0 fail
- Generated artifact checks: 1 pass, 0 pending, 0 fail
- Command checks: 11 pass, 0 pending, 0 fail
- Acceptance scenarios covered by spec: 13/13

## Artifact checks

| Status | ID | Owner | Path |
| --- | --- | --- | --- |
| pass | root-workspace-manifest | worker-1 | `package.json` |
| pass | shared-contracts-package | worker-1 | `packages/shared-contracts/src/index.ts` |
| pass | api-package | worker-2 | `apps/api/package.json` |
| pass | desktop-package | worker-3 | `apps/desktop/package.json` |
| pass | tauri-manifest | worker-4/worker-5 | `apps/desktop/src-tauri/Cargo.toml` |
| pass | tool-adapter-fixtures | worker-5 | `packages/tool-adapter-fixtures` |
| pass | server-prod-compose | worker-2 | `infra/docker-compose.prod.yml` |
| pass | server-env-example | worker-2 | `infra/env/server.env.example` |
| pass | server-up-script | worker-2 | `deploy/server-up.sh` |
| pass | server-check-script | worker-2 | `deploy/server-check.sh` |
| pass | fixture-acceptance-report | worker-6 | `docs/Verification/p1-fixture-acceptance-report.md` |
| pass | packaging-evidence-doc | worker-6 | `docs/Verification/p1-packaging-deployment-evidence.md` |

## Generated artifact checks

| Status | ID | Disallowed globs | Tracked paths |
| --- | --- | --- | --- |
| pass | tracked-generated-artifacts | `node_modules/**`<br>`*/node_modules/**`<br>`packages/*/dist/**`<br>`apps/*/dist/**`<br>`apps/*/build/**`<br>`coverage/**`<br>`*/coverage/**` |  |

## Command checks

| Status | ID | Command | Notes |
| --- | --- | --- | --- |
| pass | workspace-typecheck | `npm run typecheck` | exit=0 |
| pass | workspace-test | `npm test` | exit=0 |
| pass | api-test | `npm test --workspace apps/api` | exit=0 |
| pass | desktop-frontend-test | `npm test --workspace apps/desktop` | exit=0 |
| pass | cargo-check | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | exit=0 |
| pass | cargo-test | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | exit=0 |
| pass | fixture-transform-check | `npm test --workspace packages/tool-adapter-fixtures` | exit=0 |
| pass | docker-config-prod | `docker compose -f infra/docker-compose.prod.yml config` | exit=0 |
| pass | docker-config-legacy | `docker compose -f infra/docker-compose.legacy.yml config` | exit=0 |
| pass | deploy-script-syntax | `bash -n deploy/server-up.sh deploy/server-down.sh deploy/server-check.sh deploy/load-offline-images.sh` | exit=0 |
| pass | w6-acceptance-matrix-test | `node --test tests/smoke/p1-acceptance-matrix.test.mjs` | exit=0 |

## Acceptance coverage

| Status | Scenario ID |
| --- | --- |
| covered | bootstrap-login-p1-navigation |
| covered | market-search-filter-sort |
| covered | restricted-detail-no-leakage |
| covered | install-hash-success-central-store |
| covered | install-hash-failure-preserves-state |
| covered | update-local-hash-change-warning |
| covered | enable-codex-symlink-success |
| covered | enable-symlink-failure-copy-fallback |
| covered | disable-preserves-central-store |
| covered | uninstall-managed-targets-with-confirmation |
| covered | offline-enable-disable-queue-restart |
| covered | local-events-idempotent-sync |
| covered | notifications-read-offline-cache |

## Failed command output

No failed command output captured.

## Release gate usage

Run `node scripts/verification/p1-verify.mjs --strict` after all worker lanes are integrated. Strict mode fails on pending required artifacts, pending required commands, missing acceptance scenarios, or failed commands.

