/**
 * keybinds - Declarative contextual keybindings
 *
 * Commands as data, context as state, zero dependencies. Every kind of input (keys, mouse,
 * gamepad, axes) is its own module, handed to keybinds() by whoever uses it; the core only
 * knows commands, context and presses.
 */

/**
 * @typedef {Object} Modifiers
 * @property {boolean} ctrl
 * @property {boolean} alt
 * @property {boolean} shift
 * @property {boolean} meta
 */

/**
 * @typedef {Object} Command
 * @property {string} id - Unique identifier
 * @property {string} label - Display name
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Keyboard triggers
 * @property {string[] | undefined} [mouse] - Mouse triggers
 * @property {string[] | undefined} [gamepad] - Gamepad button triggers (e.g. "a", "rt", "start:up")
 * @property {((ctx: Record<string, unknown>) => boolean) | undefined} [when] - Activation condition
 * @property {(ctx: Record<string, unknown>, event?: Event) => unknown} execute - Action
 * @property {boolean | undefined} [hidden] - Hide from search
 * @property {boolean | undefined} [captureInput] - Fire even in input fields
 * @property {boolean | undefined} [anyModifiers] - Bindings match whatever other modifiers are held
 *   (a binding's own modifiers are still required), e.g. a game's movement keys. A binding that
 *   matches exactly still comes first
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
 * @property {number | undefined} [rank] - Where it's listed among matches, before relevance: higher first (default 0)
 */

/**
 * A continuous input read every frame (looking around, steering), instead of a command run per
 * event. Its sources are any of: "mouse:x" / "mouse:y" (movement), "pad:lx" / "pad:ly" /
 * "pad:rx" / "pad:ry" (sticks), "pad:lt" / "pad:rt" (triggers), "keys:a/d" (the first key toward
 * -1, the second toward 1). A leading "-" inverts a source.
 * @typedef {Object} AxisDef
 * @property {string} id
 * @property {string} label
 * @property {string | undefined} [category]
 * @property {string | undefined} [description]
 * @property {string[]} axes - Sources
 * @property {((ctx: Record<string, unknown>) => boolean) | undefined} [when] - Reads as zero otherwise
 * @property {boolean | undefined} [hidden] - Hide from settings
 */

/**
 * An axis's value. `position` is where sticks, triggers and keys are, -1 to 1. `delta` is mouse
 * movement in pixels since this axis was last read. They're kept apart because they're different
 * things: a position is scaled by a speed and the frame's time, a delta by a sensitivity.
 * @typedef {{ position: number, delta: number }} AxisValue
 */

/**
 * A binding, normalized. `lookup` is equal for bindings that trigger the same way; `loose` is
 * the lookup without modifiers, which `anyModifiers` commands are found by, and `mods` the
 * modifiers the binding still requires then.
 * @typedef {{ lookup: string, loose: string, mods: Modifiers }} ParsedBinding
 */

/**
 * The lookups of an input event, with a suffix (":up") and the modifiers to match against:
 * exact ones, and ones without modifiers for `anyModifiers` commands
 * @typedef {(suffix: string, mods: Modifiers) => [string[], string[]]} Lookups
 */

/**
 * A held input. `mods` is the modifier state at press time, which release bindings match
 * against; `fired` holds the commands that ran for it; `at` is when it started; `lookups` finds
 * its bindings. Inputs keep what else they need on it.
 * @typedef {{ mods: Modifiers, fired: Set<Command>, at: number, lookups: Lookups, [extra: string]: unknown }} Press
 */

/**
 * What keybinds() gives each input to work with. An input reports presses starting and ending;
 * the core runs what's bound, and its phases (releases(), holds()) and sequences() do their part.
 * @typedef {Object} Dispatch
 * @property {EventTarget} target - Where to listen
 * @property {boolean} capture - Whether to listen in the capture phase
 * @property {boolean} bound - Whether any command has a binding for this input
 * @property {AxisDef[]} axes - The axes passed to keybinds()
 * @property {() => Record<string, unknown>} context
 * @property {Map<string, Press>} presses - This input's held presses, by whatever id it chooses
 * @property {(id: string, event: Event, press: { mods: Modifiers, lookups: Lookups, repeat?: boolean,
 *   inInput?: boolean, blocked?: boolean, extra?: Record<string, unknown> }) => Press} down -
 *   A press started (or repeated: the same press goes on). `blocked`: note it, but run nothing
 * @property {(id: string, event: Event, where?: { inInput?: boolean, blocked?: boolean }) =>
 *   { press: Press, consumed: boolean } | null} up - A press ended; null if it wasn't going
 * @property {(lookups: string[], loose: string[], mods: Modifiers) => Command[] | undefined} candidates -
 *   Commands bound to the first of `lookups` that has any, then `anyModifiers` ones, for inputs
 *   with no presses (scrolling)
 * @property {(cmd: Command) => boolean} isActive
 * @property {(cmd: Command, event: Event) => boolean} execute - Runs a command, true if it took the event
 */

/**
 * A kind of input. Each is a module (keys, mouse, gamepad, axes) whose factory returns one of
 * these, and keybinds() listens with the ones it's given.
 * @typedef {Object} Input
 * @property {string} field - The command (or axis) field holding its bindings: "keys", "mouse", ...
 * @property {boolean} [axis] - Its bindings are an axis's sources rather than a command's triggers
 * @property {(step: string, suffix: string) => ParsedBinding} parse - Parses one step of a
 *   binding, without its suffix (":up", ":hold"), which is given to reject where it can't apply.
 *   Throws if the binding is invalid
 * @property {(cmd: Command, event: Event) => boolean} [matches] - Whether an event is one of the command's press bindings
 * @property {(d: Dispatch) => InputHandle} listen
 */

/**
 * An input that can also be shown and recorded, for the settings panel, cheatsheet, palette and
 * menus. Each input's UI half is its own module (keybinds/keys-ui, ...), so an app without them
 * doesn't ship it.
 * @typedef {Input & {
 *   label: string,
 *   format: (binding: string) => string[],
 *   release?: (binding: string) => boolean,
 *   invert?: boolean,
 *   available?: () => boolean,
 *   watch?: (onChange: () => void) => () => void,
 *   record?: (options: { release: boolean, ignore: (e: Event) => boolean }, done: (binding: string) => void) => () => void,
 *   prompt?: (release: boolean) => string,
 * }} InputUI
 * `label` is what one binding is called ("Key", for "+ Key"); `format` gives display parts;
 * `release` says whether a binding can be its release form (":up"), absent for inputs with no
 * releases; `invert`: bindings can be inverted with a leading "-"; `available` says whether it can
 * be recorded now (a pad is connected) and `watch` follows that changing; `record` records a
 * binding from what's done next and returns a function that stops; `prompt` says what to do.
 */

/**
 * What an input's listen() returns: a function that stops it, which can also read axes
 * @typedef {(() => void) & { axis?: (id: string) => AxisValue }} InputHandle
 */

/**
 * @typedef {{ score: number, positions?: number[] }} MatchResult
 * @typedef {(query: string, text: string) => MatchResult | null} Matcher
 * @typedef {{ id: string, timestamp: number }} HistoryEntry
 * @typedef {(command: Command, context: unknown) => number} Scorer
 * @typedef {{ matcher?: Matcher | undefined, scorer?: Scorer | undefined }} SearchOptions
 * @typedef {Command & { active: boolean, score: number, positions?: number[] }} ScoredCommand
 */

/**
 * @typedef {Object} BindingSchema
 * @property {string} label - Display name
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Default keyboard triggers
 * @property {string[] | undefined} [mouse] - Default mouse triggers
 * @property {string[] | undefined} [gamepad] - Default gamepad button triggers
 * @property {string[] | undefined} [axes] - Default sources, for an axis (see {@link AxisDef})
 * @property {boolean | undefined} [hidden] - Hide from search/settings
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
 */

/**
 * @typedef {Record<string, BindingSchema>} Schema
 */

/**
 * @typedef {Record<string, { keys?: string[], mouse?: string[], gamepad?: string[], axes?: string[] }>} BindingOverrides
 */

/**
 * Marks a component with its kind, so styles work whatever tag name it was registered under, and
 * whether it takes the keyboard while open
 * @param {HTMLElement} el
 * @param {string} kind
 * @param {boolean} [modal]
 */
export function markKind(el, kind, modal = false) {
  if (!el.hasAttribute('data-keybinds')) el.setAttribute('data-keybinds', kind)
  if (modal) el.setAttribute('data-keybinds-modal', '')
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Parse modifiers from a binding string
 * @param {string[]} parts
 * @returns {{ mods: Modifiers, remaining: string[] }}
 */
export function parseMods(parts) {
  const mods = { ctrl: false, alt: false, shift: false, meta: false }
  const remaining = []

  for (const part of parts) {
    if (part === 'ctrl' || part === 'control') mods.ctrl = true
    else if (part === 'alt' || part === 'option') mods.alt = true
    else if (part === 'shift') mods.shift = true
    else if (part === 'meta' || part === 'cmd' || part === 'command') mods.meta = true
    else if (part === '$mod') {
      if (isMac) mods.meta = true
      else mods.ctrl = true
    }
    else remaining.push(part)
  }

  return { mods, remaining }
}

/**
 * How a modifier in a binding is shown, null if the part isn't a modifier
 * @param {string} p - lowercase
 * @returns {string | null}
 */
export function formatModPart(p) {
  if (p === '$mod') return isMac ? '⌘' : 'Ctrl'
  if (p === 'ctrl' || p === 'control') return isMac ? '⌃' : 'Ctrl'
  if (p === 'alt' || p === 'option') return isMac ? '⌥' : 'Alt'
  if (p === 'shift') return isMac ? '⇧' : 'Shift'
  if (p === 'meta' || p === 'cmd' || p === 'command') return '⌘'
  return null
}

/**
 * The modifiers held during an event, as a binding writes them ("$mod" for the platform's)
 * @param {KeyboardEvent | MouseEvent} event
 * @param {boolean} shift - Whether to include Shift
 * @returns {string[]}
 */
export function eventModParts(event, shift = event.shiftKey) {
  const parts = []
  if (isMac ? event.metaKey : event.ctrlKey) parts.push('$mod')
  if (isMac ? event.ctrlKey : event.metaKey) parts.push(isMac ? 'ctrl' : 'meta')
  if (event.altKey) parts.push('alt')
  if (shift) parts.push('shift')
  return parts
}

export const RELEASE_SUFFIX = ':up'

/**
 * Split a lowercase binding into its press/release flag and the rest.
 * A trailing ":up" marks a release binding.
 * @param {string} lower
 * @returns {{ body: string, release: boolean }}
 */
export function splitRelease(lower) {
  const trimmed = lower.trim()
  if (trimmed.endsWith(RELEASE_SUFFIX)) {
    return { body: trimmed.slice(0, -RELEASE_SUFFIX.length), release: true }
  }
  return { body: trimmed, release: false }
}

/**
 * A binding's press form if it's a release, its release form otherwise
 * @param {string} binding
 * @returns {string}
 */
export function flipRelease(binding) {
  const { body, release } = splitRelease(binding.toLowerCase())
  return release ? binding.trim().slice(0, body.length) : binding.trim() + RELEASE_SUFFIX
}

/**
 * Format a binding's parts, adding a trailing "Release" part for ":up" bindings
 * @param {string} binding
 * @param {(part: string) => string} formatPart
 * @returns {string[]}
 */
export function formatWithRelease(binding, formatPart) {
  const { body, release } = splitRelease(binding.toLowerCase())
  const source = release ? binding.trim().slice(0, body.length) : binding
  const parts = source.split('+').map(formatPart)
  if (release) parts.push('Release')
  return parts
}

/**
 * Normalize modifiers to canonical prefix (e.g., "ctrl+alt+")
 * @param {Modifiers} mods
 * @returns {string}
 */
export function modsToPrefix(mods) {
  let s = ''
  if (mods.ctrl) s += 'ctrl+'
  if (mods.alt) s += 'alt+'
  if (mods.shift) s += 'shift+'
  if (mods.meta) s += 'meta+'
  return s
}

/** @type {Modifiers} */
export const NO_MODS = { ctrl: false, alt: false, shift: false, meta: false }

/**
 * Modifiers held during an event
 * @param {KeyboardEvent | MouseEvent} event
 * @returns {Modifiers}
 */
export function eventMods(event) {
  return { ctrl: event.ctrlKey, alt: event.altKey, shift: event.shiftKey, meta: event.metaKey }
}

/**
 * Whether every modifier in `required` is among `held`
 * @param {Modifiers} required
 * @param {Modifiers} held
 */
export function holdsAll(required, held) {
  return (!required.ctrl || held.ctrl) && (!required.alt || held.alt) &&
    (!required.shift || held.shift) && (!required.meta || held.meta)
}

/**
 * Check if a command is active given current context
 * @param {{ when?: ((ctx: Record<string, unknown>) => boolean) | undefined }} command
 * @param {Record<string, unknown>} context
 * @returns {boolean}
 */
export function isActive(command, context) {
  if (!command.when) return true
  return command.when(context)
}

// An element with both takes the keyboard while it's open: bindings don't fire inside it. The
// palette, settings panel and menus mark themselves; a page's own dialogs can too
const OVERLAYS = '[data-keybinds-modal][open]'

/**
 * Whether an element is inside one whose own keyboard handling takes over while it's open
 * @param {Element | null} tgt
 * @returns {boolean}
 */
export function overlayOpen(tgt) {
  return !!tgt?.closest?.(OVERLAYS)
}

/** Whether any such component is open, for inputs whose events have no target (gamepads) */
export function anyOverlayOpen() {
  return typeof document !== 'undefined' && !!document.querySelector(OVERLAYS)
}

/**
 * Whether an event's target is somewhere text is typed
 * @param {EventTarget | null} tgt
 */
export function inInput(tgt) {
  const el = /** @type {Element | null} */ (tgt)
  return el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' ||
    (typeof HTMLElement !== 'undefined' && el instanceof HTMLElement && el.isContentEditable)
}

// Command fields that hold bindings, so a binding no input reads is an error rather than ignored
const BINDING_FIELDS = /** @type {const} */ (['keys', 'mouse', 'gamepad'])

// Which module reads each binding suffix, for the error when it isn't there
const SUFFIX_MODULES = /** @type {Record<string, string>} */ ({ ':up': 'releases()', ':hold': 'holds()', ':tap': 'holds()' })

/**
 * What a phase (releases(), holds()) gets at a press's start or end
 * @typedef {Object} PhaseRun
 * @property {Press} press
 * @property {Event} event
 * @property {(suffix: string) => Command[] | undefined} find - Commands bound to this press with a suffix
 * @property {(candidates: Command[]) => boolean} fire - Runs the first candidate that may run and
 *   takes the event, noting it on the press
 * @property {(cmd: Command) => boolean} allowed - Whether a command may run now: it's active, the
 *   input isn't blocked, and it isn't being typed into (unless the command captures input)
 * @property {(cmd: Command) => boolean} execute - Runs a command whatever `allowed` says; true if it took the event
 * @property {() => boolean} held - Whether the press is still going
 */

/**
 * Something that happens at a press's start or end beyond the press itself, owning the binding
 * suffixes that say so: releases() (":up"), holds() (":hold", ":tap")
 * @typedef {Object} Phase
 * @property {string[]} suffixes
 * @property {(p: PhaseRun) => void} [down] - When a press starts
 * @property {(p: PhaseRun) => boolean} [up] - When it ends; returns whether a command took it
 */

/**
 * Finds `anyModifiers` commands: what anyModifiers() gives keybinds(), one table per input
 * @typedef {{ table: () => {
 *   add: (parsed: ParsedBinding, cmd: Command) => void,
 *   find: (loose: string[], mods: Modifiers, found: Command[] | undefined) => Command[] | undefined,
 *   size: () => number,
 * } }} AnyModifiers
 */

/**
 * Bindings of several steps ("g i", "ctrl+k ctrl+s"): what sequences() gives keybinds(). `steps`
 * splits a binding (without its suffix) into steps; `table` keeps one input's sequences
 * @typedef {{
 *   steps: (binding: string, suffix: string) => string[],
 *   table: () => {
 *     add: (steps: string[], cmd: Command) => void,
 *     check: (lookups: Iterable<string>) => void,
 *     resolve: (lookups: string[], find: (lookups: string[]) => Command[] | undefined,
 *       starts: (cmds: Command[]) => boolean) => { found: Command[] | undefined, pending: boolean },
 *   },
 * }} Sequences
 */

/**
 * @typedef {Object} KeybindsOptions
 * @property {Input[]} [inputs] - What to listen to: e.g. [keys(), mouse()]. A command bound
 *   through an input that isn't here is an error
 * @property {Phase} [releases] - From releases(): bindings to an input coming up ("k:up")
 * @property {Phase} [holds] - From holds(): bindings to holding an input ("k:hold") and to a
 *   short press ("k:tap")
 * @property {Sequences} [sequences] - From sequences(): bindings of several steps ("g i")
 * @property {AnyModifiers} [anyModifiers] - From anyModifiers(): commands whose bindings match
 *   whatever other modifiers are held
 * @property {EventTarget} [target] - Where to listen (default: window)
 * @property {(cmd: Command, ctx: Record<string, unknown>) => void} [onExecute] - Called after a command consumes an event
 * @property {boolean} [capture] - Listen in the capture phase, so a bound key reaches its command before
 *   anything under the target (an editor, say) handles it. A command that isn't active, or returns false,
 *   leaves the event alone.
 * @property {AxisDef[]} [axes] - Continuous inputs, read with `axis(id)` on what keybinds() returns
 *
 * Syntax whose module isn't here is an error naming it, never a binding that silently doesn't fire.
 */

/**
 * The phases among the options
 * @param {KeybindsOptions} options
 * @returns {Phase[]}
 */
const phasesOf = (options) => /** @type {Phase[]} */ ([options.releases, options.holds].filter(Boolean))

/**
 * A binding through an input. A suffix (":up") is taken off for the phase that owns it, and
 * sequences() splits steps ("g i"); each step goes to the input to parse
 * @param {Input} input
 * @param {string} binding
 * @param {KeybindsOptions} options - Which syntax modules are on
 * @returns {ParsedBinding & { steps: string[] }}
 */
export function parseBinding(input, binding, options) {
  if (!binding || typeof binding !== 'string') throw new Error(`Invalid binding: ${binding}`)
  let body = binding.trim()
  let suffix = ''
  for (const p of phasesOf(options)) for (const s of p.suffixes) if (body.toLowerCase().endsWith(s)) suffix = s
  body = body.slice(0, body.length - suffix.length)
  const unread = /:(up|hold|tap)$/i.exec(body)?.[0].toLowerCase()
  if (unread) throw new Error(`"${binding}" ends in "${unread}", which needs ${SUFFIX_MODULES[unread]}`)
  const steps = options.sequences ? options.sequences.steps(body, suffix) : [body]
  if (!options.sequences && /\S\s+(?!\+)\S/.test(body.replace(/\s*\+\s*/g, '+'))) {
    throw new Error(`"${binding}" has several steps, which needs sequences()`)
  }
  const parsed = steps.map((s) => input.parse(s, suffix))
  const last = /** @type {ParsedBinding} */ (parsed[parsed.length - 1])
  const lookups = parsed.map((p) => p.lookup)
  return { lookup: lookups.join(' ') + suffix, loose: last.loose + suffix, mods: last.mods, steps: lookups }
}

/**
 * Every command's bindings through one input, by lookup, checked
 * @param {Command[]} commands
 * @param {Input} input
 * @param {KeybindsOptions} options
 */
function index(commands, input, options) {
  /** @type {Map<string, Command[]>} */
  const exact = new Map()
  const loose = options.anyModifiers?.table() ?? null
  const seq = options.sequences?.table() ?? null
  for (const cmd of commands) {
    for (const binding of /** @type {string[] | undefined} */ (/** @type {Record<string, unknown>} */ (cmd)[input.field]) ?? []) {
      if (cmd.anyModifiers && !loose) throw new Error(`Command "${cmd.id}" sets anyModifiers, which needs anyModifiers()`)
      let parsed
      try {
        parsed = parseBinding(input, binding, options)
        if (parsed.steps.length > 1) seq?.add(parsed.steps, cmd)
      } catch (e) {
        throw new Error(`Command "${cmd.id}": ${e instanceof Error ? e.message : String(e)}`)
      }
      if (cmd.anyModifiers) loose?.add(parsed, cmd)
      else {
        const list = exact.get(parsed.lookup)
        if (list) list.push(cmd)
        else exact.set(parsed.lookup, [cmd])
      }
    }
  }
  seq?.check(exact.keys())
  return { exact, loose, seq }
}

/**
 * @param {Command[]} commands
 * @param {KeybindsOptions} options
 */
function checkInputs(commands, options) {
  const inputs = options.inputs ?? []
  for (const field of BINDING_FIELDS) {
    if (inputs.some((i) => i.field === field)) continue
    const cmd = commands.find((c) => c[field]?.length)
    if (cmd) throw new Error(`Command "${cmd.id}" has ${field} bindings, but no input reads ${field}`)
  }
  if ((options.axes ?? []).some((a) => a.axes.length) && !inputs.some((i) => i.axis)) {
    throw new Error('There are axes, but no input reads them')
  }
}

/**
 * Create keybind handler
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {() => Record<string, unknown>} [getContext] - Returns current context state
 * @param {KeybindsOptions} [options] - Options
 *
 * @example
 * const cleanup = keybinds([
 *   {
 *     id: 'delete',
 *     label: 'Delete selected',
 *     category: 'Edit',
 *     keys: ['Backspace', 'Delete'],
 *     when: ctx => ctx.hasSelection && !ctx.isEditing,
 *     execute: () => deleteSelected()  // return false to propagate
 *   },
 * ], () => ({ hasSelection: selectedId() !== null, isEditing: editingId() !== null }),
 *   { inputs: [keys(), mouse()] })
 * @returns {(() => void) & { held: (id: string) => boolean, axis: (id: string) => AxisValue }} Cleanup function, with
 *   `held(id)`: whether a command is held right now, and `axis(id)`: an axis's value
 */
export function keybinds(commands, getContext = () => ({}), options = {}) {
  const { inputs = [], target = window, onExecute, capture = false, axes = [] } = options
  const phases = phasesOf(options)
  checkInputs(commands, options)

  /**
   * @param {Command} cmd
   * @param {Record<string, unknown>} context
   * @param {Event} event
   * @returns {boolean}
   */
  function tryExecute(cmd, context, event) {
    const result = cmd.execute(context, event)
    // Return false from execute to propagate (not consume)
    if (result !== false) {
      event.preventDefault()
      event.stopPropagation()
      onExecute?.(cmd, context)
      return true
    }
    return false
  }

  /** @type {Map<string, Press>[]} */
  const allPresses = []
  /** @type {InputHandle[]} */
  const handles = []

  for (const input of inputs) {
    const { exact, loose, seq } = input.axis ? { exact: new Map(), loose: null, seq: null } : index(commands, input, options)
    /** @type {Map<string, Press>} */
    const presses = new Map()
    allPresses.push(presses)

    /** @param {string[]} lookups */
    const findExact = (lookups) => {
      for (const l of lookups) {
        const found = exact.get(l)
        if (found) return found
      }
      return undefined
    }

    /** @type {Dispatch['candidates']} */
    const candidates = (lookups, looseLookups, mods) => {
      const found = findExact(lookups)
      return loose ? loose.find(looseLookups, mods, found) : found
    }

    /**
     * @param {Press} press
     * @param {string} suffix
     */
    const find = (press, suffix) => {
      const [l, ll] = press.lookups(suffix, press.mods)
      return candidates(l, ll, press.mods)
    }

    /**
     * A press's view of running commands; see PhaseRun
     * @param {Press} press
     * @param {string} id
     * @param {Event} event
     * @param {{ blocked?: boolean, inInput?: boolean }} where
     * @returns {PhaseRun}
     */
    const phaseRun = (press, id, event, { blocked = false, inInput = false }) => {
      /** @param {Command} cmd */
      const allowed = (cmd) => !blocked && (!inInput || !!cmd.captureInput) && isActive(cmd, getContext())
      /** @param {Command} cmd */
      const execute = (cmd) => tryExecute(cmd, getContext(), event)
      return {
        press,
        event,
        find: (suffix) => find(press, suffix),
        fire(found) {
          for (const cmd of found) {
            if (allowed(cmd) && execute(cmd)) {
              press.fired.add(cmd)
              return true
            }
          }
          return false
        },
        allowed,
        execute,
        held: () => presses.get(id) === press,
      }
    }

    /** @type {Dispatch} */
    const d = {
      target,
      capture,
      bound: exact.size > 0 || (loose?.size() ?? 0) > 0,
      axes,
      context: getContext,
      presses,
      candidates,
      down(id, event, { mods, lookups, repeat = false, inInput = false, blocked = false, extra }) {
        let press = presses.get(id)
        const fresh = !press || !repeat
        if (!press || fresh) {
          press = { ...extra, mods, fired: new Set(), at: performance.now(), lookups }
          presses.set(id, press)
        }
        if (blocked) return press
        const run = phaseRun(press, id, event, { inInput })
        const [l, ll] = lookups('', mods)
        // Sequences go first: a press that starts or continues one is the sequence's, not the page's
        const step = seq && fresh ? seq.resolve(l, findExact, (cmds) => cmds.some(run.allowed)) : null
        if (step?.pending) {
          event.preventDefault()
          event.stopPropagation()
          return press
        }
        const found = step ? (loose ? loose.find(ll, mods, step.found) : step.found) : candidates(l, ll, mods)
        if (found) run.fire(found)
        if (fresh) for (const p of phases) p.down?.(run)
        return press
      },
      up(id, event, { inInput = false, blocked = false } = {}) {
        const press = presses.get(id)
        if (!press) return null
        presses.delete(id)
        let consumed = false
        for (const p of phases) if (p.up?.(phaseRun(press, id, event, { inInput, blocked }))) consumed = true
        return { press, consumed }
      },
      isActive: (cmd) => isActive(cmd, getContext()),
      execute: (cmd, event) => tryExecute(cmd, getContext(), event),
    }
    handles.push(input.listen(d))
  }

  /**
   * Whether a command is held right now: its press fired and that key or button hasn't come up.
   * For controls read every frame (a game's movement, say) rather than acted on per event.
   * @param {string} id
   */
  function held(id) {
    for (const presses of allPresses) {
      for (const press of presses.values()) {
        for (const cmd of press.fired) if (cmd.id === id) return true
      }
    }
    return false
  }

  /**
   * An axis's value right now. Reading it takes the mouse movement since its last read
   * @param {string} id
   * @returns {AxisValue}
   */
  function axis(id) {
    for (const h of handles) if (h.axis) return h.axis(id)
    return { position: 0, delta: 0 }
  }

  return Object.assign(() => {
    for (const h of handles) h()
    for (const presses of allPresses) presses.clear()
  }, { held, axis })
}

/**
 * Validate all commands upfront (call on init to catch typos early)
 * @param {Command[]} commands
 * @param {KeybindsOptions} options - As for keybinds(): the inputs, and the syntax modules used
 * @returns {true}
 * @throws {Error} if any binding is invalid
 */
export function validateCommands(commands, options) {
  for (const cmd of commands) {
    if (!cmd.id) throw new Error('Command missing id')
  }
  checkInputs(commands, options)
  for (const input of options.inputs ?? []) if (!input.axis) index(commands, input, options)
  return true
}

/**
 * Execute a command by id
 * @param {Command[]} commands
 * @param {string} id
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export function executeCommand(commands, id, context = {}) {
  const cmd = commands.find(c => c.id === id)
  if (cmd && isActive(cmd, context)) {
    cmd.execute(context)
    return true
  }
  return false
}

/**
 * Split a binding into its steps and its suffix (":up", ":hold", ":tap"), if any, whatever syntax
 * modules are on: for showing and comparing bindings
 * @param {string} binding
 * @returns {{ steps: string[], suffix: string }}
 */
export function splitBinding(binding) {
  let body = binding.trim()
  const suffix = /:(up|hold|tap)$/i.exec(body)?.[0].toLowerCase() ?? ''
  body = body.slice(0, body.length - suffix.length)
  return { steps: body.replace(/\s*\+\s*/g, '+').split(/\s+/).filter(Boolean), suffix }
}

/** Every piece of syntax on, for comparing bindings whatever they use */
const ALL_SYNTAX = /** @type {KeybindsOptions} */ ({
  releases: { suffixes: [':up'] },
  holds: { suffixes: [':hold', ':tap'] },
  sequences: { steps: (b) => splitBinding(b).steps, table: () => { throw new Error('only for comparing') } },
})

/**
 * Check if a binding string conflicts with any command in the schema
 *
 * @param {Schema} schema - The binding schema to check against
 * @param {string} bindingStr - The binding string to check
 * @param {Input} input - The input the binding is for
 * @param {string} [excludeId] - Command ID to exclude from conflict check
 * @returns {{ commandId: string, label: string } | null}
 */
export function findConflict(schema, bindingStr, input, excludeId) {
  let candidate
  try {
    candidate = parseBinding(input, bindingStr, ALL_SYNTAX).lookup
  } catch {
    return null
  }

  for (const [id, binding] of Object.entries(schema)) {
    if (id === excludeId) continue
    const bindings = /** @type {string[] | undefined} */ (/** @type {Record<string, unknown>} */ (binding)[input.field])
    if (!bindings) continue

    for (const b of bindings) {
      try {
        if (parseBinding(input, b, ALL_SYNTAX).lookup === candidate) {
          return { commandId: id, label: binding.label }
        }
      } catch {
        continue
      }
    }
  }

  return null
}

const SUFFIX_LABELS = /** @type {Record<string, string>} */ ({ ':up': 'Release', ':hold': 'Hold', ':tap': 'Tap' })

/**
 * A binding as display parts: each step through the input's format, "then" between steps, and a
 * last part for a suffix ("Release", "Hold", "Tap")
 * @param {InputUI} input
 * @param {string} binding
 * @returns {string[]}
 */
export function formatBinding(input, binding) {
  if (input.axis) return input.format(binding)
  const { steps, suffix } = splitBinding(binding)
  const parts = steps.flatMap((s, i) => i === 0 ? input.format(s) : ['then', ...input.format(s)])
  const label = SUFFIX_LABELS[suffix]
  if (label) parts.push(label)
  return parts
}

/**
 * A command's bindings through each input, as display parts, in the order of `inputs`
 * @param {Command} cmd
 * @param {InputUI[]} inputs
 * @returns {string[][]}
 */
export function bindingParts(cmd, inputs) {
  /** @type {string[][]} */
  const out = []
  for (const input of inputs) {
    if (input.axis) continue
    for (const b of /** @type {string[] | undefined} */ (/** @type {Record<string, unknown>} */ (cmd)[input.field]) ?? []) {
      out.push(formatBinding(input, b))
    }
  }
  return out
}

/**
 * A binding's normalized form through an input, whatever syntax it uses, for telling whether two
 * bindings are the same
 * @param {Input} input
 * @param {string} binding
 * @returns {string}
 */
export function bindingLookup(input, binding) {
  return parseBinding(input, binding, ALL_SYNTAX).lookup
}
