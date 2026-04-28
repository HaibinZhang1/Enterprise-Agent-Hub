# Extension Points

Only extension points with clear near-term use are documented here.

## New tool adapter

Touchpoints:

- Desktop path and transform helpers
- Tauri bridge commands
- Rust adapter/runtime layer
- shared contract fields if a new capability changes command payloads

Checklist:

1. Add tool identifier and display metadata
2. Add path resolution strategy
3. Add transform strategy
4. Add scan support
5. Add install/enable compatibility test
6. Update architecture docs if the adapter changes boundary assumptions

## New platform path strategy

Touchpoints:

- desktop platform path helpers
- local-sync/runtime slice
- Rust validation/adapter commands when platform-specific

Rule: path strategy must stay in path/runtime layers, not leak into page components.

## New review rule

Touchpoints:

- publishing review policy
- reviewer routing service
- workflow tests

Rule: new review rules must live in policy/service units with direct behavior tests.

## New precheck rule

Touchpoints:

- publishing precheck helper/policy
- package storage or manifest readers when needed
- review workflow tests

Rule: precheck rules should be pure or near-pure and should not directly update persistence.

## New notification source

Touchpoints:

- desktop local-sync merge policy
- server notification service
- shared notification source/type fields if shared semantics expand

Rule: source-specific merge logic belongs in notification merge helpers, not page components.

## New admin module

Touchpoints:

- `apps/api/src/admin/<module>`
- desktop admin/review slice or a new admin slice when justified
- shared contracts only if the module has desktop-visible DTOs

Rule: add a new admin module only when it owns a clear administrative use case, not as a generic dumping ground.
