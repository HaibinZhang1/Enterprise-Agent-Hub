# Enterprise Agent Hub

Enterprise Agent Hub is a Windows-first intranet desktop marketplace for enterprise Agent Skills.  
For the current release path, `apps/desktop` is the maintained product/demo surface, backed by the connected `apps/api` service, PostgreSQL, nginx, Desktop-local SQLite, and SSE. Historical web code remains in-tree for prior Phase 1 / Phase 2 memory-runtime evidence only; it is **not** the maintained product UI for the current release.

## Current product boundary

### Maintained release surface
- `apps/desktop` — maintained Windows-first Tauri Desktop client
- `apps/api` — connected backend API entrypoint
- PostgreSQL — server source of truth
- nginx — intranet reverse proxy
- SQLite — desktop-local cache/state store
- SSE — realtime notification and queue/status updates

### Historical / non-product surface
- `apps/web` — historical React + Vite memory-runtime UI kept only for prior scaffold/runtime evidence
- Do **not** position `apps/web` as the maintained product UI for the current release
- Do **not** add new current-release feature work to `apps/web` unless product scope is explicitly reopened

## What the repository delivers today

- pnpm workspace separating `apps/*` and `packages/*`
- shared phase-gate fixtures and cross-surface contracts
- connected Desktop + API runtime path
- PostgreSQL and desktop SQLite migration runners
- Windows-first desktop packaging skeleton
- production deploy assets for the backend stack
- verification scripts for workspace, product boundary, production assets, and runtime readiness

## Workspace layout

- `apps/api` — connected API entrypoint plus governance / publish-review backend runtime
- `apps/desktop` — maintained Windows-first Tauri Desktop product shell
- `apps/web` — historical non-product memory-runtime UI
- `packages/contracts` — frozen shared contracts and fixtures
- `packages/migrations` — PostgreSQL / SQLite migration runners
- `infra` — deployment scaffolding for Compose + nginx
- `docs` — requirement, design, runbook, and review documents

## Desktop scope implemented today

The connected Desktop shell currently exposes these user-facing flows:

- login
- visible API connection status and configured server URL
- market list / search / browse
- notifications and SSE/live event status
- My Skill list
- publish workbench:
  - package upload
  - review submission
- review workbench:
  - review queue
  - claim
  - approve
- skill management read surface for administrator sessions

## Desktop scope still pending

The following Desktop-first capabilities are still incomplete and remain the next major implementation target:

- Tools page
- Projects page
- Settings page
- local tool scanning UX
- tool path validation UX
- project-level skill enable/disable UX
- conflict resolution UX
- updater UX

These are already represented in the desktop/domain design, but are not yet finished as product-complete desktop surfaces.

## Approved local-control-plane slice guardrails

This approved slice extends the maintained Desktop shell with `Tools`, `Projects`, and `Settings` while preserving the already-shipped publish/review workbench. The documentation and verification boundary for this slice is:

- preserve the current publish and review surfaces while the new local-control-plane pages land
- keep SQLite built in and hidden from normal product UI; do not add a user-editable database path field
- preserve `/health` and `DESKTOP_SQLITE_PATH` as operational smoke/dev contracts
- keep `apps/web` historical/non-product during this slice
- keep V1 skill-management mutations single-target: no batch bind, batch enable/disable, or batch upgrade workflows ship in this slice. Future bulk workflows may be reserved in schema/UI extension points only; current Desktop actions must remain explicit preview-confirm operations for one skill/target decision at a time.

## Verification

From the repo root:

```bash
pnpm install
pnpm verify
```

Narrower checks:

```bash
pnpm test
pnpm test:python
pnpm typecheck
```

Production-oriented verification:

```bash
pnpm verify:production
pnpm verify:production:runtime
```

## Running the connected Desktop path

### 1. Start PostgreSQL

Export `DATABASE_URL` to a reachable PostgreSQL instance.

Example:

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

Open:

```text
http://127.0.0.1:4781
```

Seed credentials:

* Username: `admin`
* Password: `admin`

The desktop shell stores session and list-cache state in SQLite under:

```text
apps/desktop/.data/
```

## Desktop release intent

The current product direction is:

* Desktop-first
* intranet-first
* Windows-first
* connected to a real backend
* server remains the authority for market, review, auth, visibility, and version state
* desktop remains the execution surface for local user workflows

`apps/web` is intentionally retained as historical code, but it is not part of the current maintained product story.

## Production-like backend deploy assets

The repository includes a production deploy path for the backend stack:

* `apps/api/Dockerfile`
* `infra/docker-compose.production.yml`
* `infra/.env.production.example`

Example:

```bash
cp infra/.env.production.example infra/.env.production
$EDITOR infra/.env.production
docker compose --env-file infra/.env.production -f infra/docker-compose.production.yml up --build
```

The production compose path mounts durable package artifact storage at:

```text
/var/lib/enterprise-agent-hub/package-artifacts
```

## Windows Desktop packaging foundation

The repository includes the Tauri packaging skeleton used for desktop artifacts:

* `apps/desktop/src-tauri/Cargo.toml`
* `apps/desktop/src-tauri/src/main.rs`
* `apps/desktop/src-tauri/capabilities/default.json`
* `apps/desktop/src-tauri/tauri.conf.json`

Build command:

```bash
pnpm --filter @enterprise-agent-hub/desktop tauri:build
```

Windows artifact evidence should come from Windows package outputs such as:

* `apps/desktop/src-tauri/target/release/bundle/nsis/*.exe`
* `apps/desktop/src-tauri/target/release/bundle/msi/*.msi`
* `apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`

macOS `.app` output, if present, is development evidence only and must not be used as Windows-first release proof.

## Recommended next implementation order

1. Complete Desktop Tools surface
2. Complete Desktop Projects surface
3. Complete Desktop Settings surface
4. Wire desktop-local execution flows for scan / validate / path management / conflict presentation
5. Continue hardening install / enable / update / uninstall execution on the Desktop path
6. Keep `apps/web` frozen as historical/non-product code unless product scope explicitly reopens browser UI

## Key docs
* `docs/RequirementDocument/index.md`
* `docs/DetailedDesign/README.md`
* `docs/DetailedDesign/architecture/01_system_architecture.md`
* `docs/DetailedDesign/desktop/README.md`
* `docs/desktop-release-runbook.md`
* `docs/phase-1-2-review.md`

## Notes

This repository should now be understood as:

* **current product path:** `apps/api` + PostgreSQL + nginx + `apps/desktop`
* **historical evidence path only:** `apps/web`

If release scope changes in the future and a browser-based management UI is reopened, `apps/web` can be revived and realigned then. Until that happens, `apps/web` remains historical/non-product code and Desktop remains the only maintained product/demo surface.
