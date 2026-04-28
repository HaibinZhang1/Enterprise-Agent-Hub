# Real Admin Workbench Merge-Readiness Evidence

## Purpose

This document is the acceptance-gate ledger for the real admin workbench upgrade described in `.omx/plans/prd-real-admin-workbench.md` and `.omx/plans/test-spec-real-admin-workbench.md`.

The gate deliberately preserves the PRD non-goals: no permission model redesign, no batch operations, no organization drag-reordering, no pagination/virtualization, no audit-history enhancement, no mobile adaptation, and no parallel replacement admin API/data model.

## Required Command Evidence

Run from the repository root after the contract/backend and frontend workstreams have been integrated:

| Area | Command | Expected result |
| --- | --- | --- |
| Static admin workbench guard | `node --test tests/smoke/real-admin-workbench-static.test.mjs` | Passes all contract, backend mapper/query, write-safeguard, and manage-pane source gates. |
| Workspace typecheck | `npm run typecheck` | Passes for shared contracts, API, desktop, and packages. |
| Workspace tests | `npm test` | Passes all workspace test suites. |
| API targeted tests | `npm test --workspace apps/api` | Passes contract/API coverage including enriched admin read DTOs and preserved write semantics. |
| Desktop targeted tests | `npm test --workspace apps/desktop` | Passes UI logic coverage for manage-pane derivations and inspector behavior. |
| Desktop lint | `npm run lint --workspace apps/desktop` | Passes modified desktop files. |
| API lint | `npm run lint --workspace apps/api` | Passes modified API files. |

## Acceptance Matrix

| Workbench slice | Merge-ready evidence required |
| --- | --- |
| Department contracts | `DepartmentNode.adminCount` exists across shared contracts, API DTO aliases, and desktop domain aliases. |
| Department backend | Repository query calculates `adminCount` from real admin users without changing existing `userCount` / `skillCount` semantics. Mapper emits `adminCount`. |
| Department UI | Nested tree is the primary browse surface; expand/collapse state is stable; selected department drives center workspace and right inspector from loaded admin users/skills. |
| Department writes | Create, rename, delete continue to call the existing admin effects and preserve existing scope/root/blocker safeguards. |
| User contracts | `AdminUser.departmentPath` and `AdminUser.lastLoginAt` exist across shared contracts, API DTO aliases, and desktop domain aliases. |
| User backend | Repository maps department path and derives `lastLoginAt` from latest successful `auth_sessions.created_at`; missing sessions map to `null`; deleted users remain excluded. |
| User UI | Search/filter toolbar operates on real admin user data; selected user drives governance inspector; create-user flow is separate from the inspector's primary governance role. |
| User writes | Create, update, freeze, unfreeze, and delete continue to use existing admin effects and preserve assignable-role, managed-user, self-protection, and session-revocation rules. |
| Skill contracts | `AdminSkill.description`, `category`, `currentVersionRiskLevel`, and `currentVersionReviewSummary` exist across shared contracts, API DTO aliases, and desktop domain aliases. |
| Skill backend | Repository and mapper populate enriched skill summary fields from the current skill/current-version schema. |
| Skill UI | Manage skills renders list plus right-side summary/inspector backed by enriched `AdminSkill` fields. |
| Skill writes | Delist, relist, and archive continue to call existing admin effects and preserve existing status transition rules. |

## Manual Manage-Page Validation

Capture one targeted validation path for each pane after automated checks pass:

### Departments

1. Open `管理 > 部门`.
2. Expand and collapse at least one nested branch.
3. Select two different departments and confirm center workspace plus inspector update from real loaded users/skills.
4. Execute an allowed create or rename path; attempt a blocked delete path if fixture data provides blockers.

### Users

1. Open `管理 > 用户`.
2. Search by display name, username, and department path.
3. Filter by role and status.
4. Select a user and verify department path plus last login state in the inspector.
5. Execute allowed create/update/freeze/unfreeze/delete paths against disposable fixture users only.

### Skills

1. Open `管理 > Skills`.
2. Select multiple rows and confirm the right-side summary updates.
3. Verify description, category, risk, and review summary come from loaded `AdminSkill` data.
4. Execute allowed delist/relist/archive transitions and confirm refreshed status in the inspector.

## Current Evidence Boundary

This file is a merge-readiness ledger. The static guard in `tests/smoke/real-admin-workbench-static.test.mjs` is expected to fail until the backend contract/query workstream and the frontend manage-pane workstream are integrated. Do not mark the PRD acceptance gate complete until all commands in the Required Command Evidence table pass and the manual manage-page validation notes are captured.
