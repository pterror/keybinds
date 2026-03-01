# CLAUDE.md

Behavioral rules for Claude Code in the keybinds repository.

## Project Overview

Declarative, contextual keybindings for the web. Zero-dependency JavaScript library.

## Architecture

Single-file library (`src/index.js`) with JSDoc types checked via `jsconfig.json`.

Key concepts:
- **Commands** — data objects combining triggers (keys/mouse), labels, context conditions, and handlers
- **Schema/Handlers split** — `defineSchema` for binding data, `fromBindings` to attach handlers
- **BindingsStore** — reactive localStorage-persisted user overrides
- **Web components** — `<command-palette>` and `<keybind-cheatsheet>` (shadow DOM, unstyled)

## Development

```bash
nix develop          # Enter dev shell
cd docs && bun dev   # Local docs
```

## Core Rules

- **Note things down immediately:** problems, tech debt, or issues spotted MUST be added to TODO.md backlog
- **Do the work properly.** Don't leave workarounds or hacks undocumented.

## Design Principles

**Unify, don't multiply.** One interface for multiple cases > separate interfaces.

**Simplicity over cleverness.** Functions > abstractions until you need the abstraction.

**Explicit over implicit.** Log when skipping. Show what's at stake before refusing.

**Zero dependencies.** This library has no runtime dependencies. Keep it that way.

## Session Handoff

Use plan mode as a handoff mechanism when:
- A task is fully complete (committed, pushed, docs updated)
- The session has drifted from its original purpose
- Context has accumulated enough that a fresh start would help

Before entering plan mode:
- Update TODO.md with any remaining work
- Update memory files with anything worth preserving across sessions

Then enter plan mode and write a plan file that either:
- Proposes the next task if it's clear: "next up: X — see TODO.md"
- Flags that direction is needed: "task complete / session drifted — see TODO.md"

ExitPlanMode hands control back to the user to approve, redirect, or stop.

## Commit Convention

Use conventional commits: `type(scope): message`

Types:
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code change that neither fixes a bug nor adds a feature
- `docs` - Documentation only
- `chore` - Maintenance (deps, CI, etc.)
- `test` - Adding or updating tests

## Negative Constraints

Do not:
- Announce actions ("I will now...") - just do them
- Leave work uncommitted
- Add runtime dependencies
- Use `--no-verify` - fix the issue or fix the hook
