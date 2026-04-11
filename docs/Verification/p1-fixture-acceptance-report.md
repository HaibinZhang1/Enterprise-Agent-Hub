# P1 Adapter Fixture Acceptance Report

## Purpose

This report is the Worker 6 acceptance surface for Tool Adapter fixture validation. Worker 5 owns the fixture implementation under `packages/tool-adapter-fixtures/**`; Worker 6 owns this report, the verification runner, and the release-gate evidence expectations.

## Required fixture targets

| Target | Required evidence | Status before W5 integration |
| --- | --- | --- |
| Codex | Converts a Skill package into Codex skill layout and enables by symlink-first/copy-fallback distribution. | Pending product-lane fixture |
| Claude | Converts into `.claude/skills` compatible layout with managed target metadata. | Pending product-lane fixture |
| Cursor | Converts into `.cursor/rules` compatible layout with managed target metadata. | Pending product-lane fixture |
| Windsurf | Converts into Windsurf skill layout with managed target metadata. | Pending product-lane fixture |
| opencode | Converts into `.opencode/skills` compatible layout with managed target metadata. | Pending product-lane fixture |
| custom_directory | Preserves user-selected path validation and managed target cleanup semantics. | Pending product-lane fixture |

## Release gate

Run the release gate after Worker 5 fixture implementation is integrated:

```bash
node scripts/verification/p1-verify.mjs --strict
```

The gate expects `fixture-transform-check` to execute:

```bash
npm test --workspace packages/tool-adapter-fixtures
```

That package-level test must prove:

1. Built-in tools do not silently fall back to raw copy-only directory distribution.
2. Transform outputs are deterministic golden fixtures.
3. Enable attempts default to `requestedMode=symlink`.
4. Successful symlink records `resolvedMode=symlink` and no `fallbackReason`.
5. Simulated symlink failure records `resolvedMode=copy` with a structured `fallbackReason`.
6. Disable removes only managed symlink/copy targets and never deletes Central Store artifacts.

## Evidence checklist

| Check | Required result |
| --- | --- |
| `packages/tool-adapter-fixtures` exists | Fixture package is integrated. |
| `npm test --workspace packages/tool-adapter-fixtures` | Passes in the integrated workspace. |
| Fixture outputs committed | Golden outputs for Codex, Claude, Cursor, Windsurf, opencode and custom directory are versioned or generated deterministically from committed inputs. |
| Fallback scenario captured | Test output names the simulated symlink failure and asserts `fallbackReason`. |
| Disable/uninstall safety captured | Test output proves managed target cleanup without Central Store deletion on disable. |

## Current W6 baseline

The repository branch available to Worker 6 at the time this report was created contained only docs and `ui-prototype/`; fixture artifacts were not yet present. The report is therefore a release-gate template plus executable evidence contract, not a final product acceptance sign-off.

## Integration hygiene addendum

The final integration branch must not keep tracked generated artifacts such as `node_modules/` or package `dist/` outputs. The W6 verification runner includes `tracked-generated-artifacts` to fail release sign-off if those paths are tracked; cleanup remains leader-owned if the artifacts land from another worker lane.
