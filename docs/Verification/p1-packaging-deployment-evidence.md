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
- Skills, notifications, mark-read, star, `download-ticket`, package download, and local-events now call real endpoints and throw visible errors on request failure.
- Tauri local command mocks are only allowed behind `VITE_P1_ALLOW_TAURI_MOCKS=true`; otherwise browser-only mode fails visibly instead of pretending local Store/Adapter operations succeeded.
- `codex-review-helper@1.2.0` has a real seed package zip, seed metadata matches the package size/file-count/hash, and the API seed task uploads that object to MinIO when MinIO environment variables are present.
- Desktop install/update passes the full `downloadTicket` into Tauri. Tauri downloads the package, extracts it, validates SHA-256 and `SKILL.md`, writes Central Store + SQLite, and `list_local_installs` restores state from SQLite after restart.
- Tauri 本地状态已不只覆盖单一 `tool:codex` 纵向切片：当前实现包含项目配置持久化、项目级目标启用、停用、卸载、目标扫描、overwrite 确认，以及 `requestedMode` / `resolvedMode` / `fallbackReason` / pending local event 的 SQLite 落库。

## Packaging Evidence

- Tauri config exists at `apps/desktop/src-tauri/tauri.conf.json`.
- Rust binary entrypoint exists at `apps/desktop/src-tauri/src/main.rs`.
- Required command names are registered: `get_local_bootstrap`, `install_skill_package`, `update_skill_package`, `uninstall_skill`, `enable_skill`, `disable_skill`, `list_local_installs`, and `detect_tools`.
- `install_skill_package`, `update_skill_package`, `enable_skill`, `list_local_installs`, and `get_local_bootstrap` now call the SQLite/Central Store implementation instead of returning integration-required placeholders.
- Windows installer intent is configured as NSIS with `tauri:build:windows`; actual `.exe` installer generation still requires a Windows-capable Tauri bundling host.

## Remaining Risks

- Live Docker deployment and `/health status=ok` are not proven on this machine because Docker daemon is not running.
- Windows `.exe` installer generation is not proven on this macOS host because NSIS bundling is not exposed by the local Tauri CLI.
- Linux Docker live deployment remains unproven on this machine until Docker Engine is available and `./deploy/server-up.sh` can start PostgreSQL, Redis, MinIO, API, seed the package object, and return live `/health status=ok`.
- Windows NSIS `.exe` packaging remains unproven until repeated on a Windows host or CI runner with the `x86_64-pc-windows-msvc` Tauri target.
- Disable/uninstall、项目级目标和多 Adapter fixture 已进入代码与测试范围；当前剩余风险集中在目标环境实机部署、Windows 打包，以及本机通知持久化尚未接线。
