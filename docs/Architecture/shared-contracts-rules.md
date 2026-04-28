# Shared Contracts Rules

`packages/shared-contracts` is the single source of truth for API/Desktop shared contracts.

## What belongs in shared-contracts

- enums
- error codes
- route constants
- DTOs shared by server and desktop
- shared command request/response types

## What does not belong there

- app-local UI state
- server-only persistence records
- SQL row types
- Tauri runtime implementation details

## Evolution rules

1. Add or change shared fields in `packages/shared-contracts` first.
2. Then update API/Desktop compatibility layers.
3. Preserve JSON field names and route names unless a deliberate breaking change is approved.
4. Prefer additive fields over renames.
5. Local extensions must be explicit via `extends`, `Omit`, or wrapper types.

## Compatibility layers

- API compatibility layer: `apps/api/src/common/p1-contracts.ts`
- Desktop compatibility layer: `apps/desktop/src/domain/p1.ts`

These layers may adapt mutability or local convenience shapes, but must not become new sources of truth.
