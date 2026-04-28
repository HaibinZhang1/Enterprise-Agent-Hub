# Architecture Overview

EnterpriseAgentHub is an internal Agent Skill marketplace and desktop distribution system.

## Current runtime shape

- Monorepo managed by npm workspaces
- Desktop client: Tauri + React + Vite
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
- `services`: API client and Tauri bridge
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
- Move business rules and data access into explicit, testable units
- Preserve SQL-first data access and modular-monolith deployment
- Prefer additive structure over sweeping rewrites
