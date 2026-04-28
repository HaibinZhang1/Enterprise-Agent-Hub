# Architecture Overview

EnterpriseAgentHub is an internal Agent Skill marketplace and desktop distribution system.

## Current runtime shape

- Monorepo managed by npm workspaces
- Desktop client: Electron + React + Vite
- Desktop local capability boundary: Electron main/preload IPC plus Node local handlers; standalone helper binaries are allowed only by documented exception
- Server: NestJS modular monolith
- Server data: PostgreSQL
- Background and packaging support: Redis/BullMQ + MinIO
- Shared API/Desktop contract source: `packages/shared-contracts`

## System layers

### Shared Contracts

- Location: `packages/shared-contracts`
- Owns enums, error codes, route constants, DTOs, and shared command contracts
- Must not depend on any app-local code

### Desktop

- `domain`: front-end extensions around shared contracts
- `state`: workspace facade plus domain state slices
- `services`: API client and Electron desktop bridge
- `src-electron/main`: app lifecycle, windows, packaging-time security policy, and handler registration
- `src-electron/preload`: narrow contextBridge surface; no raw Electron or Node APIs exposed to renderer
- `src-electron/local-runtime`: local Store, scan, package, extension, notification, and update handlers
- `ui`: pages, modals, presentation
- `utils`: pure helpers

### API

- `controller`: HTTP surface only
- `service`: application orchestration facade
- `query` / `repository`: SQL shape and persistence
- `policy`: rules, routing, workflow decisions
- `mapper`: DTO mapping
- `utils`: pure helpers

## Architectural intent

- Keep behavior-compatible facades at app boundaries
- Preserve the existing React UI, API routes, shared DTOs, and P1 business semantics during runtime migration
- Move business rules and data access into explicit, testable units
- Keep renderer code unprivileged; all filesystem, process, dialog, window, and installer operations cross typed IPC
- Preserve SQL-first data access and modular-monolith deployment
- Prefer additive structure over sweeping rewrites
