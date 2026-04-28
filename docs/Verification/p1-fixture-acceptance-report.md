# P1 Adapter Fixture Acceptance Report

## Purpose

This report records the current P1 Tool Adapter fixture evidence for the symlink-first/copy-fallback delivery lane.

## Fixture Coverage

| Target | Required evidence | Status |
| --- | --- | --- |
| Codex | Converts a Skill package into Codex skill layout and supports symlink-first distribution. | Covered by `packages/tool-adapter-fixtures` and Rust adapter tests. |
| Claude | Converts into `.claude/skills` compatible layout with managed target metadata. | Covered by fixture acceptance metadata. |
| Cursor | Converts into `.cursor/rules` compatible layout with managed target metadata. | Covered by golden fixture test and Rust transform tests. |
| Windsurf | Converts into Windsurf skill layout with managed target metadata. | Covered by fixture acceptance metadata. |
| opencode | Converts into `.opencode/skills` compatible layout with managed target metadata. | Covered by copy-fallback fixture metadata. |
| custom_directory | Preserves user-selected path validation and managed target cleanup semantics. | Covered by fixture acceptance metadata and Rust cleanup tests. |

## Verified Commands

Run from repository root:

```bash
npm test --workspace packages/tool-adapter-fixtures
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
node --test tests/smoke/p1-real-delivery-static.test.mjs
```

Current result should be regenerated with `node scripts/verification/p1-verify.mjs --strict`; the verification report now lands in local ignored output under `test-results/verification/`.

## Evidence Checklist

| Check | Result |
| --- | --- |
| `packages/tool-adapter-fixtures` exists | Pass. |
| `npm test --workspace packages/tool-adapter-fixtures` | Pass. |
| Fixture outputs committed or deterministically described | Pass via `acceptance.json` and package tests. |
| Fallback scenario captured | Pass: simulated symlink failure asserts `resolvedMode=copy` and `fallbackReason`. |
| Disable/uninstall safety captured | Pass: Rust tests prove managed target cleanup refuses unmanaged directories and preserves Central Store. |

## Remaining Risk

The fixtures prove transformation and distribution semantics in the repository verification lane, but full Windows filesystem behavior still needs a Windows host run because symlink privilege and NSIS packaging are platform-dependent.
