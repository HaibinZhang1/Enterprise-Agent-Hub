# P1 Packaging and Deployment Evidence

## Purpose

This document records the current P1 delivery evidence for service deployment, Desktop/API connectivity, and Tauri packaging.

## Verified Commands

| Area | Command | Result |
| --- | --- | --- |
| Deploy script syntax | `bash -n deploy/server-up.sh` | Pass. |
| Deploy script syntax | `bash -n deploy/server-down.sh` | Pass. |
| Deploy script syntax | `bash -n deploy/server-check.sh` | Pass. |
| Deploy script syntax | `bash -n deploy/load-offline-images.sh` | Pass. |
| Docker prod config | `docker compose -f infra/docker-compose.prod.yml config` | Pass. |
| Docker legacy config | `docker compose -f infra/docker-compose.legacy.yml config` | Pass. |
| Workspace typecheck | `npm run typecheck` | Pass. |
| Workspace tests | `npm test` | Pass. |
| API tests | `npm test --workspace apps/api` | Pass. |
| Desktop frontend tests | `npm test --workspace apps/desktop` | Pass. |
| Static real-delivery regression | `node --test tests/smoke/p1-real-delivery-static.test.mjs` | Pass. |
| Rust cargo check | `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | Pass. |
| Rust cargo tests | `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | Pass. |
| Tauri compile without bundling | `npm run tauri:build --workspace apps/desktop -- --no-bundle` | Pass; output at `apps/desktop/src-tauri/target/release/enterprise-agent-hub-desktop`. |
| Windows NSIS installer attempt | `npm run tauri:build:windows --workspace apps/desktop` | Environment-blocked on macOS host: Tauri CLI only exposes `ios`, `app`, and `dmg` bundle values on this host. |

## Deployment Evidence

- Compose now includes PostgreSQL, Redis, MinIO, API, `api-migrate`, `api-seed`, and `minio-init` for the production path.
- Legacy Compose avoids v2-only `depends_on.condition` while still defining explicit one-shot migrate/seed/bucket initialization services for `COMPOSE_IMPL=legacy`.
- `deploy/server-up.sh` now waits for PostgreSQL, Redis, and MinIO host ports before one-shot tasks and requires `/health` to return `status: "ok"` instead of accepting any HTTP 200.
- API production scripts run compiled JavaScript: `npm run migrate` maps to `node dist/scripts/migrate.js`, and `npm run seed` maps to `node dist/scripts/seed.js`.

Docker runtime blocker on this machine:

```text
docker info
failed to connect to the docker API at unix:///Users/zhb/.docker/run/docker.sock
```

Because the Docker daemon socket is absent, this host could validate Compose syntax but could not run `./deploy/server-up.sh`, build the API image, or capture a live `/health` response.

## Desktop/API Connectivity Evidence

- Desktop API default is `http://127.0.0.1:3000`, not `/api/v1`.
- Login stores the real API base URL and Bearer token, then calls `/auth/login` and `/desktop/bootstrap`.
- Skills, notifications, mark-read, star, and local-events now call real endpoints and throw visible errors on request failure.
- Tauri local command mocks are only allowed behind `VITE_P1_ALLOW_TAURI_MOCKS=true`; otherwise browser-only mode fails visibly instead of pretending local Store/Adapter operations succeeded.

## Packaging Evidence

- Tauri config exists at `apps/desktop/src-tauri/tauri.conf.json`.
- Rust binary entrypoint exists at `apps/desktop/src-tauri/src/main.rs`.
- Required command names are registered: `get_local_bootstrap`, `install_skill_package`, `update_skill_package`, `uninstall_skill`, `enable_skill`, `disable_skill`, `list_local_installs`, and `detect_tools`.
- Windows installer intent is configured as NSIS with `tauri:build:windows`; actual `.exe` installer generation still requires a Windows-capable Tauri bundling host.

## Remaining Risks

- Live Docker deployment and `/health status=ok` are not proven on this machine because Docker daemon is not running.
- Windows `.exe` installer generation is not proven on this macOS host because NSIS bundling is not exposed by the local Tauri CLI.
- Tauri command registration is in place, but install/update/enable/disable commands still return explicit integration errors until the frontend passes real downloaded package paths and SQLite-backed target state into the Rust Store/Adapter boundary.
