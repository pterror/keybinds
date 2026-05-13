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

**Note things down immediately — no deferral:**
- Problems, tech debt, issues → TODO.md now, in the same response
- Design decisions, key insights → docs/ or CLAUDE.md
- Future/deferred scope → TODO.md **before** writing any code, not after
- **Every observed problem → TODO.md. No exceptions.** Code comments and conversation mentions are not tracked items. If you write a TODO comment in source, the next action is to open TODO.md and write the entry.

**Conversation is not memory.** Anything said in chat evaporates at session end. If it implies future behavior change, write it to CLAUDE.md or a memory file immediately — or it will not happen.

**Warning — these phrases mean something needs to be written down right now:**
- "I won't do X again" / "I'll remember to..." / "I've learned that..."
- "Next time I'll..." / "From now on I'll..."
- Any acknowledgement of a recurring error without a corresponding CLAUDE.md or memory edit

**Triggers:** User corrects you, 2+ failed attempts, "aha" moment, framework quirk discovered → document before proceeding.

**When the user corrects you:** Ask what rule would have prevented this, and write it before proceeding. **"The rule exists, I just didn't follow it" is never the diagnosis** — a rule that doesn't prevent the failure it describes is incomplete; fix the rule, not your behavior.

**Something unexpected is a signal, not noise.** Surprising output, anomalous numbers, files containing what they shouldn't — stop and ask why before continuing. Don't accept anomalies and move on.

**Do the work properly.** Don't leave workarounds or hacks undocumented. When asked to analyze X, actually read X — don't synthesize from conversation.

## Design Principles

**Unify, don't multiply.** One interface for multiple cases > separate interfaces.

**Simplicity over cleverness.** Functions > abstractions until you need the abstraction.

**Explicit over implicit.** Log when skipping. Show what's at stake before refusing.

**Zero dependencies.** This library has no runtime dependencies. Keep it that way.

## Workflow

**Minimize file churn.** When editing a file, read it once, plan all changes, and apply them in one pass.

**Always commit completed work.** After tests pass, commit immediately — don't wait to be asked. When a plan has multiple phases, commit after each phase passes. Uncommitted work is lost work.

## Context Management

**All exploration runs in subagents.** Any tool call whose purpose is "find out what's here" — grep, find, broad reads, surveys, audits — belongs in a subagent. Exploratory output in the main context is active context poisoning: it lingers in cache, shapes downstream reasoning, can't be unsent. The subagent returns a distilled summary; the noise stays in the subagent.

Inline tool use in the main context is reserved for:
- Reading a known file at a known path
- Edits/writes you're committing to
- A single targeted lookup whose result you'll act on immediately

If you find yourself running a second grep to refine the first, you should have spawned a subagent. Mechanical work across many files (applying the same change everywhere) → parallel subagents.

## Session Handoff

Use plan mode as a handoff mechanism when:
- A task is fully complete (committed, pushed, docs updated)
- The session has drifted from its original purpose
- Context has accumulated enough that a fresh start would help

**For handoffs:** enter plan mode, write a short plan pointing at TODO.md, and ExitPlanMode. **Do NOT investigate first** — the session is context-heavy and about to be discarded. The fresh session investigates after approval.

**For mid-session planning** on a different topic: investigating inside plan mode is fine — context isn't being thrown away.

Before the handoff plan, update TODO.md and memory files with anything worth preserving.

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
- Use interactive git commands (`git add -p`, `git add -i`, `git rebase -i`) — these block on stdin and hang in non-interactive shells; stage files by name instead
- Add runtime dependencies
- Use `--no-verify` - fix the issue or fix the hook
