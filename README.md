# Enterprise Agent Hub

Enterprise Agent Hub is a Windows-first intranet desktop marketplace for enterprise Agent Skills.  
For the current release path, `apps/desktop` is the maintained product/demo surface, backed by the connected `apps/api` service, PostgreSQL, nginx, Desktop-local SQLite, and SSE.

## Current product boundary

### Maintained release surface
- `apps/desktop` — maintained Windows-first Tauri Desktop client
- `apps/api` — connected backend API entrypoint
- PostgreSQL — server source of truth
- nginx — intranet reverse proxy
- SQLite — desktop-local cache/state store
- SSE — realtime notification and queue/status updates

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
- `packages/contracts` — frozen shared contracts and fixtures
- `packages/migrations` — PostgreSQL / SQLite migration runners
- `infra` — deployment scaffolding for Compose + nginx
- `docs` — requirement, design, runbook, and review documents

## Desktop frontend refactor track

The maintained Desktop UI target is now a modular shell rather than a long stacked dashboard. The planned product shape for `apps/desktop` is:

- persistent left navigation
- top bar with search, connection state, notifications, and account entry
- a single active first-level page viewport
- centralized login / dialog host
- explicit guest, authenticated, and admin route handling

The maintained first-level page map is:

- `home` — summary only
- `market`
- `my-skill`
- `review` — admin only
- `management` — admin only
- `tools`
- `projects`
- `notifications`
- `settings`

Top-bar search should route intent into `market`, and protected actions should resolve to guarded page states or an immediate login prompt rather than scattered request failures.

## Current implementation baseline

The repository already contains the first phase of this refactor under `apps/desktop/ui`:

- shell-oriented primitives in `ui/core/*`
- navigation and top-bar components in `ui/components/*`
- per-domain data modules in `ui/features/*`

Code-quality review of the current baseline:

- `ui/core/page-registry.js` is the current source of truth for route visibility, badges, and admin gating
- `ui/components/nav.js` and `ui/components/topbar.js` already express the intended shell composition
- `ui/features/notifications.js` and `ui/features/settings.js` already model the PRD-required mutation surfaces
- `ui/app.js` is still the main extraction target and currently retains most render/orchestration ownership
- `ui/index.html` and the overlapping `ui/style.css` / `ui/styles.css` layers still carry legacy stacked-layout assumptions and should be treated as finish-pass cleanup targets

For the maintained architecture and documentation boundary, see `docs/DetailedDesign/desktop/frontend-shell-refactor.md`.

## Desktop scope still pending

The following Desktop-first capabilities are still incomplete and remain active follow-up work within the refactor track:

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

This approved slice extends the maintained Desktop shell with `Tools`, `Projects`, and `Settings` while preserving the already-shipped publish workbench and review workbench. The documentation and verification boundary for this slice is:

- preserve the current publish workbench and review workbench surfaces while the new local-control-plane pages land
- keep SQLite built in and hidden from normal product UI; do not add a user-editable database path field
- preserve `/health` and `DESKTOP_SQLITE_PATH` as operational smoke/dev contracts
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

## OMX / Codex workflow setup

This repo is maintained with oh-my-codex (`omx`) project/runtime artifacts under `.omx/` and workspace guidance through `AGENTS.md`.

Validated baseline:

- `oh-my-codex` / `omx`: `0.12.4`

Recommended local setup:

```bash
omx --version
omx setup --force --scope user --verbose
omx doctor
```

Expected result:

- `omx --version` reports `oh-my-codex v0.12.4`
- `omx doctor` passes with Codex home, skills, prompts, hooks, state dir, and MCP server checks green

Useful `0.12.4` operator commands:

```bash
omx state
omx notepad
omx project-memory
omx trace
omx code-intel
```

These CLI surfaces now mirror the MCP-backed OMX state/memory/trace/code-intel tools, which makes local inspection and recovery easier during long-running planning or execution sessions.

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

1. Finish extracting `apps/desktop/ui/app.js` into page-owned modules while keeping `ui/core/*` as the shared shell/runtime layer
2. Replace the long stacked `ui/index.html` structure with a single-page shell outlet and centralized dialog host
3. Harden route guards, login/logout invalidation, and connection/error handling across guest/user/admin flows
4. Complete page-separated delivery for `home`, `market`, `my-skill`, `notifications`, `review`, `management`, `tools`, `projects`, and `settings`
5. Collapse overlapping style layers and remove obsolete DOM anchors/selectors after page migration is complete
6. Keep browser UI out of scope unless product requirements explicitly reopen it

## Key docs
* `docs/RequirementDocument/index.md`
* `docs/DetailedDesign/README.md`
* `docs/DetailedDesign/architecture/01_system_architecture.md`
* `docs/DetailedDesign/desktop/README.md`
* `docs/DetailedDesign/desktop/frontend-shell-refactor.md`
* `docs/desktop-release-runbook.md`
* `docs/phase-1-2-review.md`

## Notes

This repository should now be understood as:

* **current product path:** `apps/api` + PostgreSQL + nginx + `apps/desktop`
* **current client surface:** Desktop-only
* **browser UI scope:** removed from the workspace unless future product requirements explicitly reopen it
