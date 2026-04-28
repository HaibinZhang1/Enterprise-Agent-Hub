# Tauri → Electron Migration Map

## Purpose

This map is the release checklist for replacing the former Tauri desktop host with Electron while preserving the existing React UI, API routes, shared DTOs, local Store semantics, and P1 client-update behavior. It is intentionally historical: source columns name the former Tauri/Rust locations so reviewers can verify that every capability has an Electron target or an explicit release blocker.

## Non-goals and constraints

- Do not redesign the product UI or information architecture as part of the runtime migration.
- Do not change server API routes, shared-contract DTO field names, Skill package rules, or P1 business behavior unless a separate requirement approves it.
- Do not add new product capabilities beyond Electron runtime parity, Windows packaging reliability, and equivalent local-command behavior.
- Prefer Electron/Node TypeScript handlers. A Rust helper may remain only as a standalone helper, outside `src-tauri`, when parity or safety is materially stronger than a Node rewrite.
- Renderer code must stay unprivileged: no raw `ipcRenderer`, no Node globals, no arbitrary channel invocation, and no direct filesystem writes.

## Target bridge rules

| Rule | Target requirement |
| --- | --- |
| Renderer API | `window.desktopBridge` exposed by preload with one method per approved command. |
| Channel naming | Use stable `p1:<command>` or equivalent names derived from `P1_LOCAL_COMMANDS`; window/update commands must also be in the allowlist. |
| Validation | Validate request objects before handler execution; response shapes must match `LocalCommandResponseMap` or the existing client-update bridge types. |
| Security | `contextIsolation: true`, `nodeIntegration: false`, sender-origin validation, denied unexpected navigation/windows/permissions, and http/https-only external URL opening. |
| Migration evidence | Every row below needs a parity test or a documented release blocker before deleting the former runtime path. |

## Former runtime command map

| Capability / former command | Former source | Target Electron IPC / handler | Decision | Required parity evidence / deletion blocker | Rationale |
| --- | --- | --- | --- | --- | --- |
| Window minimize: `p1_window_minimize` | `apps/desktop/src-tauri/src/main.rs` | `window.minimize` / `BrowserWindow.minimize()` | Node/Electron rewrite | Window-control IPC test; renderer no direct runtime invoke | Native Electron window API is direct and safer than renderer access. |
| Window maximize: `p1_window_maximize` | `apps/desktop/src-tauri/src/main.rs` | `window.toggleMaximize` / `BrowserWindow.maximize/unmaximize()` | Node/Electron rewrite | Window-control IPC test | Preserve current toggle semantics. |
| Window close: `p1_window_close` | `apps/desktop/src-tauri/src/main.rs` | `window.close` / `BrowserWindow.close()` | Node/Electron rewrite | Window-control IPC test | Direct Electron API. |
| Window drag: `p1_window_start_dragging` | `apps/desktop/src-tauri/src/main.rs` | CSS draggable region or `window.startDrag` fallback | Node/Electron rewrite | Manual/dev smoke for topbar dragging | Prefer CSS drag regions where possible. |
| External URL open: `p1_open_external_url` | `apps/desktop/src/services/externalLinks.ts` (renderer invoked this legacy command name; no registered command was found in `main.rs`) | `shell.openExternal` after URL validation | Node/Electron rewrite | Protocol allow/deny tests for http/https/file/javascript/custom | Keeps renderer from opening arbitrary schemes. |
| App version: `get_client_app_version` | `apps/desktop/src-tauri/src/commands/client_updates.rs` | `app.getVersion()` plus `process.platform/arch` | Node/Electron rewrite | Unit test for version/platform payload | Does not require helper code. |
| Client update download: `download_client_update` | `apps/desktop/src-tauri/src/commands/client_updates.rs` | `clientUpdates.download` handler | Node/Electron rewrite; Rust helper only if Windows signing validation needs it | Download-ticket flow, size mismatch, hash mismatch, metadata write tests | Must preserve P1 manual update semantics. |
| Client update verify: `verify_client_update` | `apps/desktop/src-tauri/src/commands/client_updates.rs` | `clientUpdates.verify` handler | Node/Electron rewrite with Windows Authenticode check; helper allowed by exception | SHA-256 valid/invalid; Windows valid/invalid signature; non-Windows skipped tests | Signature verification is the only likely helper candidate. |
| Client installer launch: `launch_client_installer` | `apps/desktop/src-tauri/src/commands/client_updates.rs` | `clientUpdates.launchInstaller` handler | Node/Electron rewrite | Launch requires `userConfirmed`; rejects before ready-to-install; event report test | User confirmation is mandatory; no silent install. |
| Local bootstrap: `get_local_bootstrap` | `apps/desktop/src-tauri/src/commands/local_state.rs` | `local.getBootstrap` | Node/Electron rewrite unless local DB parity blocks | Fresh install and migrated-data bootstrap tests | First-launch data continuity is release critical. |
| Tool detection: `detect_tools` | `apps/desktop/src-tauri/src/adapters/detection.rs`; `main.rs` | `local.detectTools` | Node/Electron rewrite | Golden path/default/marker detection tests by tool | Node can probe filesystem/process paths; Windows registry may require a small helper only if needed. |
| Save tool config: `save_tool_config` | `apps/desktop/src-tauri/src/commands/local_state/configuration.rs` | `local.saveToolConfig` | Node/Electron rewrite | DTO validation and SQLite persistence test | Contract already defined in shared types. |
| Delete tool config: `delete_tool_config` | `apps/desktop/src-tauri/src/commands/local_state/configuration.rs` | `local.deleteToolConfig` | Node/Electron rewrite | Delete/idempotency test | Preserve current local state behavior. |
| Save project config: `save_project_config` | `apps/desktop/src-tauri/src/commands/local_state/configuration.rs` | `local.saveProjectConfig` | Node/Electron rewrite | Save/path validation/persistence test | Node filesystem APIs are sufficient. |
| Delete project config: `delete_project_config` | `apps/desktop/src-tauri/src/commands/local_state/configuration.rs` | `local.deleteProjectConfig` | Node/Electron rewrite | Delete/idempotency test | Preserve current local state behavior. |
| Validate target path: `validate_target_path` | `apps/desktop/src-tauri/src/commands/path_validation.rs` | `local.validateTargetPath` | Node/Electron rewrite | Invalid/missing/unwritable/conflict tests | Keep path traversal and writeability checks centralized in main process. |
| Pick project directory: `pick_project_directory` | `apps/desktop/src-tauri/src/commands/project_directory.rs` | `dialog.showOpenDialog` | Node/Electron rewrite | Dialog cancellation and selected-path normalization test | Direct Electron dialog API. |
| Scan local targets: `scan_local_targets` | `apps/desktop/src-tauri/src/commands/local_state/scan.rs` | `local.scanTargets` | Node/Electron rewrite | Scan summary and issue-count tests | Read-only local inventory. |
| List local installs: `list_local_installs` | `apps/desktop/src-tauri/src/commands/local_state/query.rs` | `local.listInstalls` | Node/Electron rewrite | SQLite query response-shape test | Needed for offline/home state. |
| Install skill package: `install_skill_package` | `apps/desktop/src-tauri/src/commands/local_state/package_lifecycle.rs`; store modules | `packages.installSkill` | Node/Electron rewrite; helper allowed only for archive/path safety if parity is weaker | Download-ticket, size/hash/file-count, Central Store write, SQLite update tests | Central Store remains the only source of truth. |
| Update skill package: `update_skill_package` | `apps/desktop/src-tauri/src/commands/local_state/package_lifecycle.rs` | `packages.updateSkill` | Node/Electron rewrite | Replace-version and rollback-on-failure tests | Must preserve update semantics and conflict handling. |
| Import local skill: `import_local_skill` | `apps/desktop/src-tauri/src/commands/local_state/package_lifecycle.rs` | `packages.importLocalSkill` | Node/Electron rewrite | Import/rename/replace conflict tests | Local-only import remains a Store operation. |
| Enable skill: `enable_skill` | `apps/desktop/src-tauri/src/commands/local_state/distribution_lifecycle.rs`; adapters | `packages.enableSkill` | Node/Electron rewrite; helper only if symlink/copy safety cannot be matched | Symlink-first, copy fallback, fallback reason, target drift tests | This is the highest-risk parity path after updates. |
| Disable skill: `disable_skill` | `apps/desktop/src-tauri/src/commands/local_state/distribution_lifecycle.rs` | `packages.disableSkill` | Node/Electron rewrite | Symlink/copy target cleanup safety tests | Must avoid deleting unmanaged user files. |
| Uninstall skill: `uninstall_skill` | `apps/desktop/src-tauri/src/commands/local_state/package_lifecycle.rs` | `packages.uninstallSkill` | Node/Electron rewrite | Central Store deletion, partial target failure, event tests | Partial success reporting is required. |
| List local extensions: `list_local_extensions` | `apps/desktop/src-tauri/src/commands/local_state/extension_lifecycle.rs` | `extensions.list` | Node/Electron rewrite | Extension inventory response test | P0 extension inventory is local state. |
| Scan extension targets: `scan_extension_targets` | `apps/desktop/src-tauri/src/commands/local_state/scan.rs` | `extensions.scanTargets` | Node/Electron rewrite | Read-only scan tests for all P0 extension kinds | Non-file-backed types remain audit/precheck only. |
| Import local extension: `import_local_extension` | `apps/desktop/src-tauri/src/commands/local_state/extension_lifecycle.rs` | `extensions.importLocal` | Node/Electron rewrite | file-backed-only write gate tests | Must not expand write surface. |
| Enable extension: `enable_extension` | `apps/desktop/src-tauri/src/commands/local_state/extension_lifecycle.rs` | `extensions.enable` | Node/Electron rewrite | file-backed allow; non-file-backed deny; overwrite tests | Preserve P0 governance boundary. |
| Disable extension: `disable_extension` | `apps/desktop/src-tauri/src/commands/local_state/extension_lifecycle.rs` | `extensions.disable` | Node/Electron rewrite | Disable idempotency and target safety tests | Local governance state only. |
| Upsert local notifications: `upsert_local_notifications` | `apps/desktop/src-tauri/src/commands/local_state/notification_sync.rs` | `notifications.upsertLocal` | Node/Electron rewrite | Merge/dedupe tests | Needed for offline event and notification continuity. |
| Mark local notifications read: `mark_local_notifications_read` | `apps/desktop/src-tauri/src/commands/local_state/notification_sync.rs` | `notifications.markRead` | Node/Electron rewrite | all/selected mark-read tests | Preserve local notification state. |
| Mark offline events synced: `mark_offline_events_synced` | `apps/desktop/src-tauri/src/commands/local_state/notification_sync.rs` | `offline.markEventsSynced` | Node/Electron rewrite | Accepted IDs and idempotency tests | Offline replay must not duplicate. |

## Shared local-command contract coverage

The following `P1_LOCAL_COMMANDS` entries must be registered in the Electron IPC allowlist and covered by request/response parity tests before the former runtime is deleted:

```text
get_local_bootstrap
detect_tools
save_tool_config
delete_tool_config
save_project_config
delete_project_config
validate_target_path
install_skill_package
update_skill_package
import_local_skill
enable_skill
disable_skill
uninstall_skill
list_local_extensions
scan_extension_targets
import_local_extension
enable_extension
disable_extension
upsert_local_notifications
mark_local_notifications_read
mark_offline_events_synced
scan_local_targets
list_local_installs
pick_project_directory
```

Window controls, external URL opening, app version, and client-update commands are also release-blocking even though they are not all part of `P1_LOCAL_COMMANDS`.

## Deletion gate

Delete or quarantine the former runtime files only after all of these are true:

1. Electron main/preload/renderer boots the existing React UI in dev and packaged modes.
2. Every row above has an implemented handler or an explicitly documented non-release blocker.
3. The legacy user-data migration preserves `skills.db` and `central-store` without deleting source data.
4. Client updates pass ticket/download/size/hash/signature/manual-launch/event-reporting tests.
5. Static scans find no active product dependency on the former runtime in package scripts, runtime code, verification gates, or active docs.
6. Windows installer evidence exists, or the release notes include an explicit environment-gated `Not-tested` entry for Windows signing/real-machine packaging.
