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
- `apps/web` — React management UI shell manifest
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

## Notes
This is still not the full product. The repository proves the contract-first runtime slices for Phase 1 and Phase 2, but it does not yet ship real HTTP adapters, durable service layers, live SSE transport, or end-user UI flows.

For a concrete Phase 1 / Phase 2 audit of the current repository state, see [`docs/phase-1-2-review.md`](./docs/phase-1-2-review.md).
