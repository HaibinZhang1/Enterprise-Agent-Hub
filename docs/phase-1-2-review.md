# Phase 1 / Phase 2 scaffold review

Reviewed on April 6, 2026 against the current repository state in `Enterprise-Agent-Hub/`.

> Current release note (April 9, 2026): this review is historical Phase 1 / Phase 2 evidence. The Windows-first intranet production release is Desktop-only, and current product-facing UX and release evidence must stay on `apps/desktop`.

## Review scope
- Phase 1 target: auth / org / audit / notify governance rails and management flows
- Phase 2 target: package / skill / review / minimal search / notify publish-review loop
- Evidence sources:
  - `apps/api/src/modules/**`
  - `apps/api/src/workflows/**`
  - `apps/desktop/src/modules/**`
  - `packages/contracts/src/**`
  - `test/*.test.js`
  - `tests/verification/*.py`
  - `pnpm verify`

## Review verdict
- **Scaffold quality:** approve
- **Current phase status:** Phase 0 / 0.5 are complete, and the repo now includes executable Phase 1 and Phase 2 in-memory runtime slices on top of the frozen contracts
- **Current documentation risk:** do not reinterpret this historical review as approval to widen the current product surface beyond `apps/desktop`.

## What is implemented today

### Foundation and contract freeze
- The workspace, manifests, migration runners, and frozen fixtures for auth, convergence, install/reconcile, SSE payloads, and the source-of-truth matrix are present and green under `pnpm verify`.
- The shared contract package remains the canonical source for frozen cross-surface contracts.

### Phase 1 coverage present in code
- `apps/api/src/modules/auth/core/access-policy.js` encodes fail-closed handling for frozen accounts, `AUTHZ_RECALC_PENDING`, and stale `authz_version` tokens.
- `apps/api/src/modules/auth/core/{bootstrap-policy,credential-policy,session-policy,user-lifecycle-policy}.js` capture bootstrap, password, lockout, session rotation, freeze/unfreeze, and reset rules from the approved auth baseline.
- `apps/api/src/modules/org/core/{scope-policy,scope-governance}.js`, `apps/api/src/modules/audit/core/{log-policy,log-entry}.js`, and `apps/api/src/modules/notify/core/{badge-policy,notification-center}.js` now provide behavior-bearing governance helpers instead of manifest-only placeholders.
- `apps/api/src/workflows/admin-governance-runtime.js` proves the minimal Phase 1 loop end to end: provision -> reassign -> fail closed during convergence -> converge -> freeze/unfreeze -> reset -> audit/notify output.
- `test/auth-policy.test.js`, `test/governance-and-publish-flow.test.js`, and `test/phase-flows.test.js` lock these Phase 1 behaviors with executable checks.

### Phase 2 coverage present in code
- `apps/api/src/modules/package/core/validation-report.js` validates package contents and hashes the submitted artifact set.
- `apps/api/src/modules/review/core/ticket-policy.js` and `apps/api/src/modules/skill/core/{catalog-policy,publish-workflow}.js` implement review ticket creation/claim/approval plus the publish transition.
- `apps/api/src/modules/search/core/{skill-search,skill-search-policy}.js` preserve the required permission-filter-before-rank behavior and summary-vs-detail visibility handling.
- `apps/api/src/workflows/publish-review-runtime.js` proves the Phase 2 anchor loop end to end: upload -> review -> publish -> visible-in-search -> notify badge loop.
- `test/governance-and-publish-flow.test.js`, `test/phase-2-marketplace.test.js`, and `test/phase-flows.test.js` verify the publish/review/search/notify slice against the frozen contracts.

## What is still missing before the platform can be called complete

### Remaining Phase 1 product work
- No NestJS controllers, repositories, or real persistence-backed auth/org/audit/notify services exist yet.
- At the time of this review there was no production SSE transport.
- Deployment and observability rails exist as planned boundaries, but not as fully wired operational services.

### Remaining Phase 2 product work
- File upload storage, background validation execution, and reviewer workbench persistence are still ahead.
- Desktop install/sync execution remains Phase 3 work even though the authority contracts are already frozen.

## Code-quality observations
- **Strengths**
  - The contract-first structure is holding: fixtures, manifests, policies, runtimes, and tests all align to the same frozen package.
  - The new runtime modules make the Phase 1 and Phase 2 acceptance loops executable without breaking the shared-contract freeze.
  - Verification is practical and repeatable: `pnpm verify` is still the single repository gate.
- **Medium-risk follow-up**
  - Parallel helper variants currently exist in a few domains (`audit`, `org`, `search`) to support both scaffold-facing and runtime-facing tests. They are aligned today, but should eventually be consolidated or clearly separated by adapter/runtime intent when real service layers land.
  - The repo still mixes manifest-level scaffolding with behavior-bearing modules, so status updates must distinguish “runtime slice proven” from “full product shipped”.
  - Release docs must continue to distinguish historical scaffold evidence from the current Desktop-only product boundary.

## Recommended next implementation order
1. Keep the connected API + persistence adapters as the server authority for the Desktop release.
2. Keep publish/review route coverage as backend regression evidence, not Desktop release UX.
3. Focus current product-facing work on `apps/desktop`: login, connection status, My Skill, market/search/browse, and notifications/status.
4. Preserve the current contract freeze while install/desktop execution work adopts the existing authority matrix and SSE payloads.

## Verification entrypoint
Run the full repository gate from the repo root:

```bash
pnpm verify
```
