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

### P0/P1: task 12 local runtime scaffold needs path containment before integration release

Reviewed completed task 12 commit `e7a1892e` (`apps/desktop/src/electron/local/runtime.ts`, `dataMigration.ts`, tests). The runtime currently joins externally sourced IDs into filesystem paths and later removes paths recursively. In particular, `#uninstallSkill(skillID)` computes `path.join(this.#paths.centralStorePath, skillID)` and calls `rm(..., { recursive: true, force: true })`. Install/import paths also derive Central Store locations from `downloadTicket.skillID` / local import `skillID`.

Required before final integration/release:

- Validate `skillID`, `extensionID`, target IDs, and relative paths against shared slug/ID rules before using them in filesystem paths.
- Resolve every Central Store target path and assert it remains inside the configured Central Store root before `mkdir`, `write`, `cp`, or `rm`.
- Add regression tests for traversal inputs such as `../outside`, absolute paths, encoded separators, and nested traversal in IDs.

### P1: task 12 target path validation is permissive scaffold behavior

`#validateTargetPath` accepts any non-empty path, reports `writable: true`, and returns `canCreate: true` when `stat` fails. That is safe as a UI scaffold only if later Electron dialog/handler code constrains user-selected paths. Before release, it should either perform real writability/absolute-path checks or be clearly separated from privileged writes.

### P1: Electron IPC security gate is pending worker-1 output

No `apps/desktop/src-electron/main.ts`, `preload.ts`, or `ipc/policy.ts` exists in this worktree yet. The security policy gate should be rerun in strict mode after worker-1 integrates the Electron shell. Required proof points: sender-frame origin validation on every handler, channel allowlist, no raw `ipcRenderer` exposure, explicit CSP, denied navigation/new-window/permission requests, and safe external URL handling.


### P1: task 11 Electron shell needs two security-policy follow-ups

Reviewed completed task 11 commit `81628b03` against `verification/electron-security-policy.json` by extracting `apps/desktop/src-electron/{main,preload,ipcContract,security}.ts` into a temporary root and running `check-electron-security-policy.mjs --strict`. The strict policy correctly fails on two release follow-ups:

- `BrowserWindow` `webPreferences` sets `contextIsolation`, `nodeIntegration: false`, and `sandbox`, but does not explicitly set `webSecurity: true`. Electron defaults this to true, but the migration acceptance policy requires an explicit setting so future edits cannot silently weaken it.
- Preload exposes a generic `desktopBridge.invoke(command, args)` dispatcher. It is channel- and command-allowlisted, so it is not raw `ipcRenderer`, but the RALPLAN/PRD security boundary asks for explicit preload methods or generated per-command wrappers rather than a generic invoke surface.

Required before final release: either harden task 11 to satisfy strict policy, or record an explicit architecture exception for the generic local-command dispatcher with compensating tests.

### P1: task 14 legacy-runtime scan may conflict with worker-6 audit artifacts

Reviewed task 14 reported commit `54b28728` / equivalent checkpoint `2b58e877`. Its `scripts/verification/check-legacy-runtime-references.mjs` scans `verification/`, `scripts/`, and `tests/`, but only allowlists the migration map. Worker-6 intentionally added security gate files and this review report that contain historical migration terms. Integration should either switch the release scan to `scripts/checks/check-no-tauri-scan.mjs` + `verification/no-tauri-scan-allowlist.json`, or add worker-6 audit artifacts to the task 14 scanner allowlist. Otherwise the release scan will fail on the audit/gate files rather than active runtime code.

### P1: strict no-Tauri release gate is intentionally blocked during parallel migration

The current no-Tauri scan has no unclassified hits, but strict mode must still fail because active runtime/scripts/docs/tests still contain transition blockers. This is expected until workers 1, 3, 4, and 5 finish and integrate their lanes. Do not remove the strict blocker list without replacing each entry with Electron implementation or historical migration-map text.

## Pending reviews

- Task 11 (worker-1 runtime/IPC shell): not completed at this review point.
- Task 13 (worker-3 packaging/updater): not completed at this review point.
- Task 14 (worker-4 verification/test migration): not completed at this review point.
- Task 15 (worker-5 docs/migration map): not completed at this review point.

Worker-6 should run strict security/no-Tauri/Rust gates and update this report after those lane outputs are available in the integration branch.
