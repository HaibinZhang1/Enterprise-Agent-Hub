# Desktop frontend shell refactor

## Purpose

This document turns `.omx/plans/prd-desktop-frontend-refactor.md` into a maintained implementation-facing reference for `apps/desktop/ui`.
It captures the route contract, current code-quality baseline, and the documentation rules that should stay aligned while the refactor lands.

## Related references

- source PRD: `.omx/plans/prd-desktop-frontend-refactor.md`
- original refactor brief: `docs/前端重构要求`
- page-level contracts: `docs/DetailedDesign/frontend-pages/*.md`

## Maintained shell contract

The maintained Desktop UI target is a modular shell with:

- persistent left navigation
- top bar for search, connection state, notifications, and account entry
- one active first-level page at a time
- centralized modal / dialog host for login and preview-confirm flows

The maintained first-level routes are:

| Route | Audience | Notes |
| --- | --- | --- |
| `home` | guest-safe | summary only; not a dumping ground for other workflows |
| `market` | guest-safe | receives global search intent from the top bar |
| `my-skill` | authenticated | protected page with visible guarded state or login prompt |
| `review` | admin only | admin review workspace |
| `management` | admin only | department / user / skill management tabs |
| `tools` | guest-safe shell / local-safe | keeps local preview-confirm constraints |
| `projects` | guest-safe shell / local-safe | keeps single-target project actions |
| `notifications` | guest-safe shell | badge-aware page; auth-required actions remain guarded |
| `settings` | guest-safe shell | connection / preferences / language / update / about |

## Current repository baseline

The repository already contains the first layer of this refactor:

- `apps/desktop/ui/core/page-registry.js`
  - current source of truth for page metadata, badges, and admin gating
- `apps/desktop/ui/components/nav.js`
  - current left-nav rendering primitive
- `apps/desktop/ui/components/topbar.js`
  - current top-bar rendering primitive with search, connection pill, notifications, and account actions
- `apps/desktop/ui/features/*.js`
  - domain fetch/mutation wrappers for market, my-skill, review, management, tools, projects, notifications, and settings

## Code-quality review summary

### Strengths already present

- Route visibility is centralized in `ui/core/page-registry.js`, which is the right ownership boundary for nav visibility and safe fallback behavior.
- The shell composition is already separated into reusable components (`nav.js`, `topbar.js`, dialogs, preview panel, shared states).
- Notifications and settings already expose dedicated feature modules and match the PRD direction better than the old monolithic fetch flow.

### Follow-up work still required

- `apps/desktop/ui/app.js` remains large (currently ~1300 lines) and still owns most page render/orchestration logic; it should continue to shrink toward bootstrap-only ownership.
- `apps/desktop/ui/index.html` still includes long-page structural remnants and should not be treated as the final maintained shell shape.
- `apps/desktop/ui/style.css` and `apps/desktop/ui/styles.css` overlap; the finish pass should collapse them into one documented hierarchy.
- The PRD’s final `pages/*` split has not landed yet; until it does, page ownership must keep moving away from `app.js` instead of re-concentrating there.

## Documentation alignment rules

While implementation continues, keep these documentation rules stable:

1. Treat `apps/desktop` as the only maintained product/demo UI for the current release.
2. Describe the Desktop UI as a shell with first-level routes, not as a long stacked dashboard.
3. Keep page docs under `docs/DetailedDesign/frontend-pages/*.md` interpreted inside their own route boundary, not as home-page sections.
4. Keep `apps/web` documented as historical/non-product unless scope is explicitly reopened.
5. Keep local-control-plane actions (`tools`, `projects`) single-target and preview-confirm in V1 docs.

## Acceptance-critical reminders

- Search must route into `market` or an explicitly documented safe fallback.
- Protected routes/actions must show guarded states or login prompts, never blank pages.
- `review` and `management` remain admin-only.
- `notifications` and `settings` must ship as real page surfaces, not empty shells.
- Documentation must stay consistent with the maintained shell route map above.
