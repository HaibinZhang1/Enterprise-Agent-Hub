# Electron Migration Security Review — worker-6 interim report

Generated: 2026-04-28T12:25Z

## Current lane support committed

- Rust exception gate: `verification/rust-exception-gate.json` + `scripts/checks/check-rust-exception-gate.mjs` document that there are currently **zero approved retained Rust helpers**. Existing `apps/desktop/src-tauri` artifacts are tracked as release blockers, not approved exceptions.
- Electron security policy gate: `verification/electron-security-policy.json` + `scripts/checks/check-electron-security-policy.mjs` define the required IPC/browser boundary: `contextIsolation`, `nodeIntegration: false`, sandbox, web security, sender-frame origin validation, static channel allowlist, navigation/new-window/permission denial, CSP, and no raw IPC/Node exposure.
- No-Tauri scan support: `verification/no-tauri-scan-allowlist.json` + `scripts/checks/check-no-tauri-scan.mjs` classify current migration references. Non-strict mode tracks known transition blockers; strict mode rejects them for release.

## Current scan status

- `node scripts/checks/check-rust-exception-gate.mjs`: pass; 0 approved helper(s), 39 transitional legacy Rust artifact(s), 0 undocumented artifact(s).
- `node scripts/checks/check-electron-security-policy.mjs`: pass in non-strict mode with 3 pending Electron files (`apps/desktop/src-electron/main.ts`, `preload.ts`, `ipc/policy.ts`). Strict mode must fail until worker-1 output is integrated and proves all required controls.
- `node scripts/checks/check-no-tauri-scan.mjs`: pass in non-strict mode with 398 hit(s), 61 allowed historical hit(s), 337 transitional blocker hit(s), 0 unclassified hit(s). Strict mode remains blocked until migration lanes remove the listed transition files/references.

## Integration risks found so far

### RESOLVED follow-up: task 12 local runtime path containment

Initial review of task 12 commit `e7a1892e` found that externally sourced IDs were joined into Central Store paths and recursively removed without enough containment proof. Worker-2 followed up with `f11ec4bd` / integrated checkpoint `d438b73b`, adding `validateLocalID`, relative-path validation, Central Store containment checks, absolute/writable `validateTargetPath` behavior, and traversal regression tests.

Remaining note: this is sufficient for scaffold/integration readiness. Final release should still prefer shared slug/ID validators if the shared-contract package grows canonical runtime validators, but no open blocker remains from the worker-6 path-containment review.

### P1: Electron IPC security gate is pending worker-1 output

No `apps/desktop/src-electron/main.ts`, `preload.ts`, or `ipc/policy.ts` exists in this worktree yet. The security policy gate should be rerun in strict mode after worker-1 integrates the Electron shell. Required proof points: sender-frame origin validation on every handler, channel allowlist, no raw `ipcRenderer` exposure, explicit CSP, denied navigation/new-window/permission requests, and safe external URL handling.


### P1: task 11 Electron shell needs two security-policy follow-ups

Reviewed completed task 11 commit `81628b03` against `verification/electron-security-policy.json` by extracting `apps/desktop/src-electron/{main,preload,ipcContract,security}.ts` into a temporary root and running `check-electron-security-policy.mjs --strict`. The strict policy correctly fails on two release follow-ups:

- `BrowserWindow` `webPreferences` sets `contextIsolation`, `nodeIntegration: false`, and `sandbox`, but does not explicitly set `webSecurity: true`. Electron defaults this to true, but the migration acceptance policy requires an explicit setting so future edits cannot silently weaken it.
- Preload exposes a generic `desktopBridge.invoke(command, args)` dispatcher. It is channel- and command-allowlisted, so it is not raw `ipcRenderer`, but the RALPLAN/PRD security boundary asks for explicit preload methods or generated per-command wrappers rather than a generic invoke surface.

Required before final release: either harden task 11 to satisfy strict policy, or record an explicit architecture exception for the generic local-command dispatcher with compensating tests.

### RESOLVED follow-up: task 14 no-runtime scan coordination

Initial review of task 14 commit `54b28728` / equivalent checkpoint `2b58e877` found that its legacy runtime scanner could conflict with worker-6 audit artifacts. Worker-4 acknowledged and committed `221e755e` (also visible as `72a481a7` after integration), keeping the no-runtime scan aligned with transitional tests by extending the no-Tauri allowlist for the client-update flow test.

Remaining note: final integration should run one canonical no-Tauri release gate. Worker-6 recommends `scripts/checks/check-no-tauri-scan.mjs --strict` because it reports historical/audit allowances separately from active transitional blockers.

### P1: strict no-Tauri release gate is intentionally blocked during parallel migration

The current no-Tauri scan has no unclassified hits, but strict mode must still fail because active runtime/scripts/docs/tests still contain transition blockers. This is expected until workers 1, 3, 4, and 5 finish and integrate their lanes. Do not remove the strict blocker list without replacing each entry with Electron implementation or historical migration-map text.

## Pending reviews

- Task 11 (worker-1 runtime/IPC shell): not completed at this review point.
- Task 13 (worker-3 packaging/updater): not completed at this review point.
- Task 14 (worker-4 verification/test migration): not completed at this review point.
- Task 15 (worker-5 docs/migration map): not completed at this review point.

Worker-6 should run strict security/no-Tauri/Rust gates and update this report after those lane outputs are available in the integration branch.
