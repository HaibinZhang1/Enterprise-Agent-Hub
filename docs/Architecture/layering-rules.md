# Layering Rules

These rules are intended to be enforced by code review and the `check:boundaries` script.

## API layering

- Controllers may import:
  - application/facade services
  - auth decorators/guards
  - shared-contracts types
- Controllers must not import:
  - repositories
  - query services
  - policy services

- Repositories may import:
  - `DatabaseService`
  - local `types`
  - shared-contracts types
- Repositories must not import:
  - controllers
  - facade services
  - unrelated domain services

- Policy/query/mapper modules must be side-effect-light and testable in isolation.

## Desktop layering

- `ui` should talk to the workspace facade, not directly to low-level state slices unless there is a compelling local-only reason.
- `state/workspace/*` may import:
  - domain types
  - services
  - pure helpers
  - `workspaceTypes`
- `state/workspace/*` must not import:
  - `ui/*`
  - `useP1Workspace.ts`
  - other workspace hooks in a cyclic manner

## Naming conventions

- `*.service.ts`: application orchestration or externally consumed service
- `*.repository.ts`: SQL/persistence only
- `*.policy.ts`: business rules / decision logic
- `*.mapper.ts`: DTO/output mapping
- `*.query.ts`: SQL plan or query shape generation
- `*.types.ts`: local domain records, internal inputs, narrow helper types

## Prohibited patterns

- Reintroducing app-local duplicates of shared contracts
- Controllers assembling SQL
- Repositories deciding permissions
- UI components directly deciding backend workflow state transitions
- “Utility” modules that hide domain rules from tests
