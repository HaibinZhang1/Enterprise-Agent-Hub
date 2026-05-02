# Repository Guidelines

## Project Structure & Module Organization

This repository currently contains product documentation, a React/Electron desktop app, a NestJS API, shared contracts, deployment assets, and a static UI prototype.

- `docs/RequirementDocument/` holds the P1/P2/P3 requirements, page specs, data contracts, and glossary. Start with `docs/RequirementDocument/index.md`.
- `docs/DetailedDesign/` contains implementation-oriented design notes. Start with `docs/DetailedDesign/index.md` before adding architecture or deployment code.
- `apps/desktop/` is the real product UI and Electron client. It is the delivery and verification entrypoint for frontend work.
- `docs/design-ui/layout-prototype/` is a standalone design prototype: `index.html`, `app.js`, and `styles.css`. It is vanilla HTML/CSS/JavaScript and is not a delivery or integration entrypoint.
- `.omx/` is local orchestration state and should not be treated as product source.
- 如果本次修改涉及到需求上的变动，请同步修改'docs/RequirementDocument/'

## Agent Execution Principles

These rules adapt the core ideas from `multica-ai/andrej-karpathy-skills`: reduce hidden assumptions, avoid unnecessary complexity, keep diffs surgical, and make completion verifiable.

- Think before coding: state important assumptions, surface tradeoffs, and ask only when ambiguity cannot be resolved safely from repository context. If a simpler approach is available, prefer it or explain why it is insufficient.
- Simplicity first: implement the minimum code that satisfies the request. Do not add speculative features, one-off abstractions, unrequested configurability, or defensive handling for impossible states.
- Surgical changes: touch only files and lines required by the task. Match existing style even when a different style is tempting. Clean up unused code created by your own changes, but only mention unrelated dead code instead of deleting it.
- Goal-driven execution: translate work into explicit success criteria and verification steps. For bugs, prefer a reproducing test before the fix. For refactors, verify behavior before and after. For multi-step tasks, keep a short plan where each step has a check.
- Diff discipline: every changed line should trace directly to the user's request, a requirement document update, or a verification-driven cleanup caused by the change.
- Tradeoff: these principles bias toward caution for non-trivial work. For obvious one-line fixes, use judgment and keep the process lightweight.

## Build, Test, and Development Commands

Default frontend development entrypoint:

```sh
npm run desktop:dev
npm run desktop:electron:dev
```

Use `npm run desktop:electron:dev` for real desktop integration whenever possible. Do not start `docs/design-ui/layout-prototype/` unless the user explicitly asks to inspect the archived reference prototype.

Canonical workspace commands are defined in the root `package.json`, for example `npm run lint`, `npm run typecheck`, `npm test`, and `npm run p1:full-closure`.

## Coding Style & Naming Conventions

For `apps/desktop/`, follow the existing React/TypeScript/Electron patterns and match the surrounding file style. 

## Testing Guidelines

Automated tests and checks are configured through the root workspace scripts. For UI edits, run the relevant workspace checks and manually smoke-test the real `apps/desktop` entrypoint; use `docs/design-ui/layout-prototype/` only as a visual/reference prototype.

## Commit & Pull Request Guidelines

This checkout has no Git history to infer conventions from. Use imperative, intent-focused commit subjects that explain why the change exists. Prefer Lore-style trailers when useful, such as `Constraint:`, `Rejected:`, `Tested:`, and `Not-tested:`. Pull requests should summarize scope, link the relevant requirement/design docs, list verification performed, and include screenshots or short recordings for UI changes.
