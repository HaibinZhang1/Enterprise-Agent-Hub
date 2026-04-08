# Desktop Release Runbook

This runbook defines the minimum repository steps required to produce a desktop release artifact for the current Tauri-based desktop shell.

## Preconditions
- Node 24+
- pnpm 10+
- Rust toolchain (`cargo`, `rustc`)
- Platform-native packaging prerequisites for Tauri 2 on the target OS

## Release inputs
- Connected API path already verified (`pnpm verify`)
- Desktop write flow already verified against the live API server surface
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src-tauri/Cargo.toml`
- Production backend assets under `infra/`

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
3. Build the desktop release artifact:
   ```bash
   pnpm --filter @enterprise-agent-hub/desktop tauri:build
   ```

## Expected output
- Tauri bundle output under `apps/desktop/src-tauri/target/`
- Release artifact for the current platform
- On macOS in this repository: `apps/desktop/src-tauri/target/release/bundle/macos/Enterprise Agent Hub Desktop.app`

## Release verification
- Confirm the installer/package exists under `src-tauri/target/`
- Confirm desktop shell can still reach the configured API base URL
- Confirm the release notes include:
  - required backend environment variables
  - package storage root expectation
  - rollback/redeploy notes

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

## Automated production runtime verification
To exercise the proven local fallback deploy path end to end:

```bash
pnpm verify:production:runtime
```

This script:
1. boots production Postgres,
2. applies the bundled migrations in-container,
3. builds the API image with the local fallback configuration,
4. starts API + nginx,
5. checks `/api/health`,
6. verifies production login through nginx,
7. then tears the stack down.

## Current known blocker
The repository now contains the required Tauri packaging skeleton, but if the execution environment lacks `cargo`/`rustc`, the final installer build cannot be produced until the Rust toolchain is installed. Backend container builds also depend on the configured base images being reachable or preloaded locally.
