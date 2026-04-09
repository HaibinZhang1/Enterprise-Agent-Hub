# Enterprise Agent Hub Workspace Scaffold

This repository is now aligned to the Windows-first intranet Desktop production path. `apps/desktop` is the maintained product/demo surface for this release, backed by the connected `apps/api` service, PostgreSQL, nginx, and Desktop-local SQLite. Historical web code remains in-tree for prior Phase 1 / Phase 2 memory-runtime evidence only; it is not the maintained product UI for the current release.

## What this slice delivers
- a pnpm workspace that separates `apps/*` from `packages/*`
- shared contract fixtures for the approval gate (`AUTHZ_RECALC_PENDING`, auth/org convergence, install authority, SSE payloads, source-of-truth matrix)
- buildable manifests for API, historical web scaffolding, and the Windows-first Desktop surface
- auth policy primitives for fail-closed access, bootstrap, credential, session, and managed-user lifecycle behavior
- executable Phase 1 governance coverage via `apps/api/src/workflows/admin-governance-runtime.js`
- executable Phase 2 marketplace coverage via `apps/api/src/workflows/publish-review-runtime.js` as backend regression evidence
- Phase 1 / Phase 2 review notes that explain historical runtime coverage while keeping current release positioning Desktop-only
- dry-run migration runners for PostgreSQL and desktop SQLite
- verification scripts that catch cross-surface contract drift early

## Workspace layout
- `apps/api` — connected API entrypoint plus governance / publish-review backend regression runtimes
- `apps/desktop` — maintained Windows-first Tauri Desktop product/demo shell for this release
- `apps/web` — historical React + Vite memory-runtime UI; do not use as the maintained product/demo/reference UI for this release
- `packages/contracts` — shared phase-gate fixtures and contract exports
- `packages/migrations` — SQL foundations plus PostgreSQL/SQLite migration runners
- `infra` — deployment scaffolding for Compose + Nginx

## Verification
```bash
pnpm install
pnpm verify
```

For narrower checks:
- `pnpm test` runs workspace Node tests plus root scaffold/runtime tests
- `pnpm test:python` runs the document/scaffold verification suite
- `pnpm typecheck` validates the workspace TypeScript config

## Running the Windows-first Desktop intranet path
The current release path uses:
- `apps/api` as the real API entrypoint
- PostgreSQL as the server source of truth
- nginx as the intranet reverse proxy for the single-host deployment
- `apps/desktop` as the only maintained product/demo client
- SQLite as the desktop-local cache/state store
- SSE for realtime notification updates

### 1. Start PostgreSQL
Use any reachable PostgreSQL instance and export `DATABASE_URL`.

Example local URL:
```bash
export DATABASE_URL=postgresql://enterprise_agent_hub@127.0.0.1:56432/enterprise_agent_hub
```

### 2. Start the API
```bash
PORT=8788 pnpm --filter @enterprise-agent-hub/api dev
```
Health check:
```bash
curl http://127.0.0.1:8788/api/health
```

### 3. Prove desktop SQLite viability
```bash
pnpm --filter @enterprise-agent-hub/desktop smoke:sqlite
```

### 4. Start the desktop shell
```bash
DESKTOP_API_BASE_URL=http://127.0.0.1:8788 DESKTOP_PORT=4781 pnpm --filter @enterprise-agent-hub/desktop dev
```
Open `http://127.0.0.1:4781` in your browser to use the desktop shell harness.

Seed credentials:
- Username: `admin`
- Password: `admin`

The desktop shell stores session + list cache state in SQLite under `apps/desktop/.data/` and the release UI must center these connected flows:
- login
- visible API connection status and configured server URL
- market list/search/browse
- notifications + SSE status where available
- my-skill list

Backend publish/review routes and tests remain valid regression coverage, but publish/review are deferred from this Desktop release's UX and exit criteria. Do not present upload, claim, or approve as required Desktop release actions unless a later PRD explicitly reopens that scope.

The desktop shell accepts `DESKTOP_API_BASE_URL` (preferred) and still falls back to `API_BASE_URL` for compatibility. For intranet validation, point it at the nginx/LAN base URL rather than a developer-only localhost URL.

### 5. Production-like backend deploy assets
The repository now includes a first production deploy path for the API:
- `apps/api/Dockerfile`
- `infra/docker-compose.production.yml`
- `infra/.env.production.example`

Example:
```bash
cp infra/.env.production.example infra/.env.production
$EDITOR infra/.env.production
docker compose --env-file infra/.env.production -f infra/docker-compose.production.yml up --build
```

The production compose path mounts durable package artifact storage at `/var/lib/enterprise-agent-hub/package-artifacts` and expects the API to bind on `0.0.0.0:8787`.
If Docker Hub is not reachable in the release environment, set `NODE_RUNTIME_IMAGE`, `API_BASE_IMAGE`, `POSTGRES_IMAGE`, and/or `NGINX_IMAGE` in `infra/.env.production` to mirrored or preloaded compatible images before building the production stack. If the chosen API base image already includes `psql`, also set `API_HAS_POSTGRES_CLIENT=1`. If you must avoid `pnpm install` during image build, set `API_OFFLINE_WORKSPACE=1`. If migrations are run externally before container startup, set `SKIP_MIGRATIONS=1`. If npm registry access is slow or blocked, set `PNPM_REGISTRY_URL` to a reachable mirror.

### 6. Windows Desktop release packaging foundation
The repository includes the Tauri packaging skeleton used for Desktop artifacts:
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src-tauri/capabilities/default.json`
- `apps/desktop/src-tauri/tauri.conf.json`

Release command:
```bash
pnpm --filter @enterprise-agent-hub/desktop tauri:build
```

Required Windows artifact evidence must report an NSIS `.exe`, MSI `.msi`, or another explicitly documented Tauri Windows package path such as:
- `apps/desktop/src-tauri/target/release/bundle/nsis/*.exe`
- `apps/desktop/src-tauri/target/release/bundle/msi/*.msi`
- `apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`

The existing macOS `.app` bundle is supporting development evidence only and must not be used as Windows-first release proof.

Detailed release steps are documented in [`docs/desktop-release-runbook.md`](./docs/desktop-release-runbook.md).

Production asset verification:
```bash
pnpm verify:production
```

Production runtime verification with the local fallback deploy path:
```bash
pnpm verify:production:runtime
```

For intranet validation, configure the runtime verifier with the operator-selected LAN base URL when available (for example `INTRANET_BASE_URL=http://agent-hub.lan`). If no LAN URL is provided, the verifier may only claim localhost fallback coverage.

## Historical Web MVP boundary
`apps/web` remains in the repository as historical/non-product code from the Phase 1 / Phase 2 memory-runtime MVP. It must not be described, demoed, or verified as the maintained product UI for the current Windows-first Desktop release. Do not add new current-release feature work to `apps/web` unless a later user-approved plan explicitly changes that boundary.

## Notes
The current release proves the connected Desktop path: `apps/api` + PostgreSQL + nginx + `apps/desktop` with Desktop-local SQLite state and realtime notification transport. Publish/review backend routes can remain under regression tests, but the Desktop release target is read/use-oriented: login, connection status, My Skill, market/search/browse, and notifications/status.

For a concrete Phase 1 / Phase 2 historical audit, see [`docs/phase-1-2-review.md`](./docs/phase-1-2-review.md). For the historical web MVP notes, see [`docs/frontend-mvp-implementation.md`](./docs/frontend-mvp-implementation.md). For current release operations, use [`docs/desktop-release-runbook.md`](./docs/desktop-release-runbook.md).
