# Phase 1 / Phase 2 scaffold review

Reviewed on April 6, 2026 against the current repository state in `Enterprise-Agent-Hub/`.

## Review scope
- Phase 1 target: auth / org / audit / notify governance rails and management flows
- Phase 2 target: package / skill / review / minimal search / notify publish-review loop
- Evidence sources:
  - `apps/api/src/modules/**`
  - `apps/web/src/pages/**`
  - `apps/desktop/src/modules/**`
  - `packages/contracts/src/**`
  - `test/*.test.js`
  - `tests/verification/*.py`
  - `pnpm verify`

## Review verdict
- **Scaffold quality:** approve
- **Phase completion:** not complete yet
- **Primary documentation risk fixed here:** the repository is easy to misread as Phase 0/0.5 only unless the auth policy primitives and Phase 1 / Phase 2 scaffolds are called out explicitly

## What is implemented today

### Foundation and contract freeze
- The workspace, manifests, migration runners, and frozen fixtures for auth, convergence, install/reconcile, SSE payloads, and the source-of-truth matrix are present and green under `pnpm verify`.
- The shared contract package remains the canonical source for frozen cross-surface contracts.

### Phase 1 coverage present in code
- `apps/api/src/modules/auth/core/access-policy.js` encodes fail-closed handling for:
  - frozen accounts
  - `AUTHZ_RECALC_PENDING`
  - `AUTHZ_VERSION_MISMATCH`
- `apps/api/src/modules/auth/core/bootstrap-policy.js`, `credential-policy.js`, `session-policy.js`, and `user-lifecycle-policy.js` capture the approved baseline rules for bootstrap, password, lockout, session rotation, freeze/unfreeze, and reset flows.
- `apps/api/src/modules/{auth,org,audit,notify}/module.js` and the corresponding web page manifests define the intended governance slice boundaries and UI surfaces.
- `test/auth-policy.test.js` and `test/workspace.test.js` protect the auth-policy primitives and scaffold contracts.

### Phase 2 coverage present in code
- `apps/api/src/modules/{package,skill,review,search}/module.js` define the marketplace and review domain boundaries.
- `apps/web/src/pages/{market,my-skill,review,notifications,skill-management}/page.js` preserve the Phase 2 page map and shared page states.
- `packages/contracts/src/notify.js`, `install.js`, and `source-of-truth.js` keep the minimal search/notify/install loop contracts frozen for later implementation.

## Gaps that remain before Phase 1 can be called complete
- The repo does **not** yet implement end-to-end auth, org, audit, or notify services/controllers beyond the auth policy primitives and manifests.
- There is no runnable login, bootstrap, manage-user, or SSE badge workflow yet.
- `org`, `audit`, and `notify` are still manifest-level boundaries rather than behavior-bearing modules.

## Gaps that remain before Phase 2 can be called complete
- The repo does **not** yet implement upload, validation, review ticketing, publish, authorized search visibility, or notification propagation workflows.
- `package`, `skill`, `review`, and `search` are still scaffold manifests, not end-to-end services.
- The web pages preserve route/page intent only; they do not yet execute the upload -> review -> publish -> visible-in-search -> notify badge loop.

## Code-quality observations
- **Strengths**
  - The scaffold is internally consistent: manifests, fixtures, migrations, and tests all align to the same contract package.
  - Auth policy code is small, explicit, and easy to verify.
  - The repository already has a useful verification entrypoint: `pnpm verify`.
- **Medium-risk gaps**
  - Documentation could be read as if only Phase 0/0.5 exists, even though some Phase 1 primitives and Phase 2 surface scaffolds already landed.
  - Most non-auth domains are still boundary declarations, so feature completeness should not be overstated in status updates.

## Recommended next implementation order
1. Finish Phase 1 behavior-bearing auth/org/audit/notify services on top of the frozen contracts.
2. Add end-to-end management flow coverage for login, bootstrap, freeze/unfreeze, reset, and notification/audit events.
3. Implement the minimal Phase 2 publish-review-search-notify loop before broadening install or desktop execution work.

## Verification entrypoint
Run the full repository gate from the repo root:

```bash
pnpm verify
```
