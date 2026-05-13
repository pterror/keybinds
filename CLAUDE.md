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

## Context Is The Only Scarce Resource

Every byte that enters the main session stays in the main session for its entire lifetime. File contents, command output, search results, page text — once read, it lingers in cache and shapes every downstream token. There is no "just looking."

**All exploration runs in subagents.** Investigations, audits, deep dives, surveys, "let me check," "let me find" — if the purpose of a tool sequence is to find out something you don't yet know, it runs in a subagent. Renaming the activity does not change what it is. The subagent returns a distilled summary; the raw output stays in the subagent.

The main session holds only the durable artifacts you are producing: the edit, the commit, the doc update.

Inline tool use in the main context is reserved for:
- Reading a known file at a known path
- Edits/writes you're committing to
- A single targeted lookup whose result you'll act on immediately

If you find yourself running a second grep to refine the first, you should have spawned a subagent.

## Durability

Subagent reports, mid-session realizations, "I'll remember this" — none of these outlast the session. Anything worth keeping goes into CLAUDE.md, code, docs, or a commit. If it isn't written down, it is gone.

Problems, tech debt, issues → TODO.md now, in the same response. Future/deferred scope → TODO.md **before** writing any code, not after.

**Commit completed work immediately.** After tests pass, commit. After each phase of a multi-phase plan, commit. Uncommitted work is lost work, and accumulated uncommitted phases lose isolation as well.

**Docs change in the same commit as the code.** New pages enter the sidebar in that commit. There is no follow-up.

## Authenticity

When asked to analyze X, read X. Do not synthesize from conversation memory, prior summaries, or what the file probably says. Claims must correspond to evidence produced this session.

**Something unexpected is a signal.** Surprising output, anomalous numbers, a file containing what it shouldn't — stop and find out why. Do not accept the anomaly and proceed.

## Discipline

Corrections from the user are conversation, not material for new rules. A single correction does not warrant a CLAUDE.md edit. Rules are added when a failure mode is observed repeatedly and the rule names the failure it prevents.

Do not announce actions ("I will now…"). Act.

## Workflow

**Minimize file churn.** When editing a file, read it once, plan all changes, and apply them in one pass.

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

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.

## Hard Constraints

- No runtime dependencies. This library is zero-dependency; keep it that way.
- No `--no-verify`. Fix the issue or fix the hook.
- No interactive git (`git add -p`, `git add -i`, `git rebase -i`) — these block on stdin and hang.
