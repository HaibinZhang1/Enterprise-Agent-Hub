# Desktop Release Runbook

This runbook defines the minimum release path for the Windows-first intranet Desktop production deployment. `apps/desktop` is the maintained product/demo surface for this release; `apps/web` is historical/non-product code and must not be used as release evidence.

## Release scope
- Required client flows: login, visible API connection status, configured server URL, My Skill, market/search/browse, and notifications/status where the API already exposes it.
- Desktop publish/review workbench scope: publish submission plus review claim/approve actions stay on the maintained Desktop surface. `apps/web` remains historical/non-product, and Windows package/runtime evidence remains the release gate.
- Required server topology: one intranet host running PostgreSQL, API, nginx/reverse proxy, and durable package artifact storage.
- Required artifact: Windows Desktop package evidence (`.exe`, `.msi`, or another explicitly documented Tauri Windows package type).
- Preferred runtime proof: Windows install/start/connect/login/My Skill/market smoke on Windows hardware, Windows VM, or Windows CI runner.

## Preconditions
- Node 24+
- pnpm 10+
- Rust toolchain (`cargo`, `rustc`)
- Platform-native packaging prerequisites for Tauri 2 on the target OS
- For Windows packaging: a Windows runner/VM/hardware with Tauri prerequisites, WebView2 support, and the packaging toolchain needed by the selected Tauri bundle target
- For intranet runtime verification: operator-selected LAN base URL or an explicit localhost-fallback decision

## Release inputs
- Workspace verification: `pnpm verify`
- Production asset verifier: `pnpm verify:production`
- Production runtime verifier: `pnpm verify:production:runtime`
- Desktop package configuration: `apps/desktop/src-tauri/tauri.conf.json`
- Desktop Tauri manifest: `apps/desktop/src-tauri/Cargo.toml`
- Production backend assets under `infra/`
- Seed/test credentials or operator-provisioned login credentials

## Build steps
1. Verify workspace health:
   ```bash
   pnpm verify
   ```
2. Ensure Rust is available:
   ```bash
   cargo --version
   rustc --version
   ```
3. Build the Desktop release artifact on the target runner:
   ```bash
   pnpm --filter @enterprise-agent-hub/desktop tauri:build
   ```
4. Record the build runner and command in release evidence.

## Expected output
- Tauri bundle output under `apps/desktop/src-tauri/target/`
- Required Windows artifact evidence, for example:
  - `apps/desktop/src-tauri/target/release/bundle/nsis/*.exe`
  - `apps/desktop/src-tauri/target/release/bundle/msi/*.msi`
  - `apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe`
- Supporting macOS artifact evidence, when built locally, remains development-only and is not a substitute for Windows release proof.

For each Windows artifact, record:
- path
- artifact type (`nsis-exe`, `msi`, or named Tauri-supported package type)
- size
- modified time
- build command
- runner/OS used

## Intranet server deployment sequence
1. Copy and edit the production environment file:
   ```bash
   cp infra/.env.production.example infra/.env.production
   $EDITOR infra/.env.production
   ```
2. Set operator values, including database credentials, image mirrors/preloaded images if needed, and LAN-facing host/base URL notes.
3. Start the single-host stack:
   ```bash
   docker compose --env-file infra/.env.production -f infra/docker-compose.production.yml up --build
   ```
4. Confirm nginx exposes `/api/` on the selected intranet port and preserves SSE-safe buffering behavior.
5. Back up the PostgreSQL volume and `package_artifacts` volume before destructive redeploys.

## Runtime verification
Run local fallback verification when no LAN URL is available:
```bash
pnpm verify:production:runtime
```

When an intranet URL is available, configure the verifier with the operator-selected base URL before running the runtime check:
```bash
INTRANET_BASE_URL=http://agent-hub.lan pnpm verify:production:runtime
```

The runtime evidence must report whether it ran in `intranet-url` mode or `localhost-fallback` mode and include health, login, market, and My Skill checks through nginx.

## Windows runtime smoke
Run on Windows hardware, Windows VM, or Windows CI runner when available:
1. Install or launch the produced Windows package.
2. Configure the Desktop server/API URL to the intranet base URL.
3. Start Desktop.
4. Verify the UI shows the configured server URL or connection status.
5. Log in with seed/test credentials.
6. Verify My Skill loads.
7. Verify market/search/browse loads.
8. Verify notifications/status where available.
9. Capture logs and/or screenshots where practical.

If Windows runtime validation is unavailable, release evidence must explicitly include:
- `windowsRuntimeValidated: false`
- `windowsRuntimeValidationMode: "not-run"`
- residual-risk reason
- Windows artifact path
- statement that install/start runtime readiness has not been fully proven

## Backend image fallback
If the default base image `node:24-alpine` cannot be fetched from Docker Hub in the release environment, set `API_BASE_IMAGE` in `infra/.env.production` to a mirrored or preloaded compatible Node 24 image before running:

```bash
docker compose --env-file infra/.env.production -f infra/docker-compose.production.yml build api
```

If the default PostgreSQL image is also unavailable from the registry, set `POSTGRES_IMAGE` to a mirrored or preloaded compatible PostgreSQL image before running the production compose stack.
If the default Node runtime image is unavailable, set `NODE_RUNTIME_IMAGE` to a mirrored or preloaded compatible Node image that can provide the runtime binaries copied into the API image.
If the default nginx image is unavailable from the registry, set `NGINX_IMAGE` to a mirrored or preloaded compatible nginx image.
If the chosen API base image already contains the PostgreSQL client, set `API_HAS_POSTGRES_CLIENT=1` to skip the `apk add postgresql-client` step during image build.
If the release environment already has the workspace source plus required workspace packages available and you need to avoid `pnpm install` inside the image build, set `API_OFFLINE_WORKSPACE=1` to use the repository contents directly for the API runtime layer.
If migrations are executed out-of-band (for example by an operator against the production database before starting the API container), set `SKIP_MIGRATIONS=1` for the API service.
If npm registry access is restricted or slow in the release environment, set `PNPM_REGISTRY_URL` to a reachable npm mirror before building the API image.

## Rollback and redeploy notes
- Keep the previous Windows installer/package until the new artifact passes the required evidence tier.
- Keep the previous `.env.production` values for rollback.
- Before a destructive redeploy, back up the PostgreSQL data volume and `package_artifacts` volume.
- To roll back a failed server deploy, stop the current stack, restore the prior env/image tags/volumes if changed, and restart the previous known-good compose configuration.
- To roll back a client release, redistribute the previous Windows package and record the rollback artifact path in release notes.

## Current known blocker / residual risk language
A macOS-only workstation can prove code health and supporting macOS packaging, but it cannot by itself prove Windows installer/runtime readiness. A release without Windows runtime smoke may only claim Windows artifact production when a Windows artifact exists and the residual risk fields above are present.
