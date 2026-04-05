# Enterprise Agent Hub Workspace Skeleton

This repository now contains the executable Phase 0 / Phase 0.5 foundation slice plus the first Phase 1 governance-policy primitives and Phase 2 surface manifests from the approved detailed-design package.

## What this slice delivers
- a pnpm workspace that separates `apps/*` from `packages/*`
- shared contract fixtures for the approval gate (`AUTHZ_RECALC_PENDING`, auth/org convergence, install authority, SSE payloads, source-of-truth matrix)
- buildable manifests for the planned API, web, and desktop surfaces
- auth policy primitives for fail-closed access, bootstrap, credential, session, and managed-user lifecycle behavior
- Phase 1 / Phase 2 review notes that explain what is scaffolded today versus what still needs end-to-end implementation
- dry-run migration runners for PostgreSQL and desktop SQLite
- verification scripts that catch cross-surface contract drift early

## Workspace layout
- `apps/api` — NestJS-aligned service skeleton manifest
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
- `pnpm test` runs workspace Node tests plus root scaffold tests
- `pnpm test:python` runs the document/scaffold verification suite

## Notes
This is still a scaffold-first package, not the full product. It creates the shared rails that later domain work can reuse without redefining enums, ownership rules, or migration entrypoints.

For a concrete Phase 1 / Phase 2 audit of the current repository state, see [`docs/phase-1-2-review.md`](./docs/phase-1-2-review.md).
