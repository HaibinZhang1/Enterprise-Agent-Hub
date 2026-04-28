# Tool Adapter Fixtures

Golden fixture set for the P1 Tool Adapter lane.

- `source/example-skill/` is the Central Store input shape owned by Store APIs.
- `golden/codex/` and `golden/claude/` preserve `SKILL.md` and resources.
- `golden/cursor/` emits a Cursor `.mdc` rule from `SKILL.md`.
- `golden/windsurf/` emits a Windsurf markdown rule from `SKILL.md`.
- `golden/opencode/` preserves `SKILL.md` and supporting assets because OpenCode scans `SKILL.md` as the skill entry point.
- `golden/custom_directory/` preserves the generic directory layout.

All golden targets include `.enterprise-agent-hub-managed.json`; disable/uninstall logic may remove only targets with this marker or symlinks created by the distribution layer.
