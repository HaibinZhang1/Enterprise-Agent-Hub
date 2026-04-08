# Enterprise Agent Hub Workspace Scaffold

This repository now contains the executable Phase 0 / Phase 0.5 foundation slice plus verified Phase 1 governance runtimes and the Phase 2 publish/review/search/notify runtime loop from the approved detailed-design package.

## What this slice delivers
- a pnpm workspace that separates `apps/*` from `packages/*`
- shared contract fixtures for the approval gate (`AUTHZ_RECALC_PENDING`, auth/org convergence, install authority, SSE payloads, source-of-truth matrix)
- buildable manifests for the planned API, web, and desktop surfaces
- auth policy primitives for fail-closed access, bootstrap, credential, session, and managed-user lifecycle behavior
- executable Phase 1 governance coverage via `apps/api/src/workflows/admin-governance-runtime.js`
- executable Phase 2 marketplace coverage via `apps/api/src/workflows/publish-review-runtime.js`
- Phase 1 / Phase 2 review notes that explain what is proven today versus what still needs real adapters and UI execution
- dry-run migration runners for PostgreSQL and desktop SQLite
- verification scripts that catch cross-surface contract drift early

## Workspace layout
- `apps/api` — NestJS-aligned service skeleton plus in-memory governance / publish-review runtimes
- `apps/web` — React + Vite Management UI shell (Apple-style design) wrapping mock execution bindings
- `apps/desktop` — Tauri desktop shell manifest
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

## Running the connected API + Desktop MVP
The current safest-path MVP uses:
- `apps/api` as the real API entrypoint
- PostgreSQL as the server source of truth
- `apps/desktop` as the primary client shell
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

The desktop shell stores session + list cache state in SQLite under `apps/desktop/.data/` and now proxies these connected flows:
- login
- market list/search
- notifications + SSE
- user management list
- skill management list
- my-skill list
- review queue list
- publish
- claim
- approve

The desktop shell accepts `DESKTOP_API_BASE_URL` (preferred) and still falls back to `API_BASE_URL` for compatibility.

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

### 6. Desktop release packaging foundation
The repository now includes the minimum Tauri packaging skeleton:
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src-tauri/capabilities/default.json`
- `apps/desktop/src-tauri/tauri.conf.json`

Release command:
```bash
pnpm --filter @enterprise-agent-hub/desktop tauri:build
```

Current macOS artifact path:
`apps/desktop/src-tauri/target/release/bundle/macos/Enterprise Agent Hub Desktop.app`

Detailed release steps are documented in [`docs/desktop-release-runbook.md`](./docs/desktop-release-runbook.md).

Production asset verification:
```bash
pnpm verify:production
```

Production runtime verification with the local fallback deploy path:
```bash
pnpm verify:production:runtime
```

## Running the Web Frontend MVP
The `apps/web` application remains runnable as a reference UI surface.
```bash
pnpm --filter @enterprise-agent-hub/web dev
```
Navigate to `http://localhost:5173`. You can log in using Username: `admin` and Password: `<any_string>`.

## Notes
The repository now proves two different surfaces:
- the original Web MVP (`apps/web`) still demonstrates the in-memory/UI reference flow
- the new connected MVP path (`apps/api` + `apps/desktop`) proves real HTTP, PostgreSQL persistence, desktop-side SQLite state, and realtime notification transport

The connected path is no longer read-only: it now includes real package upload/report retrieval plus publish/review write routes, and the desktop shell can exercise upload -> submit -> claim -> approve against the live API.

For a concrete Phase 1 / Phase 2 audit of the current repository state, see [`docs/phase-1-2-review.md`](./docs/phase-1-2-review.md). For UI details, see [`docs/frontend-mvp-implementation.md`](./docs/frontend-mvp-implementation.md).
