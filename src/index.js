/**
 * keybinds - Declarative contextual keybindings
 *
 * Commands as data, context as state, zero dependencies.
 * Supports keyboard and mouse bindings.
 */

/**
 * @typedef {Object} Modifiers
 * @property {boolean} ctrl
 * @property {boolean} alt
 * @property {boolean} shift
 * @property {boolean} meta
 */

/**
 * @typedef {Object} ParsedKey
 * @property {Modifiers} mods
 * @property {string} key
 */

/**
 * @typedef {Object} ParsedMouse
 * @property {Modifiers} mods
 * @property {number} button
 */

/**
 * @typedef {Object} Command
 * @property {string} id - Unique identifier
 * @property {string} label - Display name
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Keyboard triggers
 * @property {string[] | undefined} [mouse] - Mouse triggers
 * @property {((ctx: Record<string, unknown>) => boolean) | undefined} [when] - Activation condition
 * @property {(ctx: Record<string, unknown>, event?: Event) => unknown} execute - Action
 * @property {boolean | undefined} [hidden] - Hide from search
 * @property {boolean | undefined} [captureInput] - Fire even in input fields
 */

/**
 * @typedef {{ score: number, positions?: number[] }} MatchResult
 * @typedef {(query: string, text: string) => MatchResult | null} Matcher
 * @typedef {{ matcher?: Matcher }} SearchOptions
 * @typedef {Command & { active: boolean, score: number, positions?: number[] }} ScoredCommand
 */

/**
 * Detect Mac platform
 */
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/**
 * Parse modifiers from a binding string
 * @param {string[]} parts
 * @returns {{ mods: Modifiers, remaining: string[] }}
 */
function parseMods(parts) {
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

// Valid key names (subset - common ones)
const VALID_KEYS = new Set([
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'escape', 'enter', 'tab', 'space', 'backspace', 'delete', 'insert',
  'home', 'end', 'pageup', 'pagedown',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'up', 'down', 'left', 'right',
  '[', ']', '\\', ';', "'", ',', '.', '/', '`', '-', '=',
  'bracketleft', 'bracketright', 'backslash', 'semicolon', 'quote',
  'comma', 'period', 'slash', 'backquote', 'minus', 'equal'
])

const VALID_MOUSE = new Set([
  'click', 'leftclick', 'left',
  'rightclick', 'right',
  'middleclick', 'middle'
])

/**
 * Parse a key string like "Ctrl+Shift+K" into normalized form
 * @param {string} keyStr
 * @returns {ParsedKey}
 * @throws {Error} if key binding is invalid
 */
function parseKey(keyStr) {
  if (!keyStr || typeof keyStr !== 'string') {
    throw new Error(`Invalid key binding: ${keyStr}`)
  }

  const parts = keyStr.toLowerCase().split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error(`Empty key binding: "${keyStr}"`)
  }

  const { mods, remaining } = parseMods(parts)

  const key = remaining[0]
  if (key === undefined) {
    throw new Error(`Key binding has no key (only modifiers): "${keyStr}"`)
  }
  if (remaining.length > 1) {
    throw new Error(`Key binding has multiple keys: "${keyStr}" (got: ${remaining.join(', ')})`)
  }
  if (!VALID_KEYS.has(key)) {
    throw new Error(`Unknown key "${key}" in binding "${keyStr}"`)
  }

  return { mods, key }
}

/**
 * Parse a mouse binding like "$mod+Click" or "MiddleClick"
 * Supported: Click/LeftClick, RightClick, MiddleClick
 * @param {string} binding
 * @returns {ParsedMouse}
 * @throws {Error} if mouse binding is invalid
 */
function parseMouse(binding) {
  if (!binding || typeof binding !== 'string') {
    throw new Error(`Invalid mouse binding: ${binding}`)
  }

  const parts = binding.toLowerCase().split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error(`Empty mouse binding: "${binding}"`)
  }

  const { mods, remaining } = parseMods(parts)

  const btn = remaining[0]
  if (btn === undefined) {
    throw new Error(`Mouse binding has no button (only modifiers): "${binding}"`)
  }
  if (remaining.length > 1) {
    throw new Error(`Mouse binding has multiple buttons: "${binding}"`)
  }
  if (!VALID_MOUSE.has(btn)) {
    throw new Error(`Unknown mouse button "${btn}" in binding "${binding}". Valid: Click, RightClick, MiddleClick`)
  }

  let button = 0 // left
  if (btn === 'rightclick' || btn === 'right') button = 2
  else if (btn === 'middleclick' || btn === 'middle') button = 1

  return { mods, button }
}

const BUTTON_NAMES = ['click', 'middle', 'right']

/**
 * Normalize modifiers to canonical prefix (e.g., "ctrl+alt+")
 * @param {Modifiers} mods
 * @returns {string}
 */
function modsToPrefix(mods) {
  let s = ''
  if (mods.ctrl) s += 'ctrl+'
  if (mods.alt) s += 'alt+'
  if (mods.shift) s += 'shift+'
  if (mods.meta) s += 'meta+'
  return s
}

/**
 * Convert parsed key to lookup key (e.g., "ctrl+shift+k")
 * @param {ParsedKey} parsed
 * @returns {string}
 */
function keyToLookup(parsed) {
  return `${modsToPrefix(parsed.mods)}${parsed.key}`
}

/**
 * Convert keyboard event to lookup keys (returns multiple for key/code variants)
 * @param {KeyboardEvent} event
 * @returns {string[]}
 */
function eventToKeyLookups(event) {
  const prefix = modsToPrefix({
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  })
  const key = event.key.toLowerCase()
  const code = event.code.toLowerCase()
  const codeKey = code.startsWith('key') ? code.slice(3) : null

  const lookups = [`${prefix}${key}`]
  if (code !== key) lookups.push(`${prefix}${code}`)
  if (codeKey && codeKey !== key) lookups.push(`${prefix}${codeKey}`)
  return lookups
}

/**
 * Convert parsed mouse binding to lookup key (e.g., "ctrl+click", "middle")
 * @param {ParsedMouse} parsed
 * @returns {string}
 */
function mouseToLookup(parsed) {
  return `${modsToPrefix(parsed.mods)}${BUTTON_NAMES[parsed.button] || 'click'}`
}

/**
 * Convert mouse event to lookup key
 * @param {MouseEvent} event
 * @returns {string}
 */
function eventToMouseLookup(event) {
  const prefix = modsToPrefix({
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  })
  return `${prefix}${BUTTON_NAMES[event.button] || 'click'}`
}

/**
 * Build lookup tables for O(1) dispatch
 * @param {Command[]} commands
 * @returns {{ keys: Map<string, Command[]>, mouse: Map<string, Command[]> }}
 */
function buildLookupTables(commands) {
  /** @type {Map<string, Command[]>} */
  const keys = new Map()
  /** @type {Map<string, Command[]>} */
  const mouse = new Map()

  for (const cmd of commands) {
    if (cmd.keys) {
      for (const key of cmd.keys) {
        const lookup = keyToLookup(parseKey(key))
        const list = keys.get(lookup)
        if (list) list.push(cmd)
        else keys.set(lookup, [cmd])
      }
    }
    if (cmd.mouse) {
      for (const binding of cmd.mouse) {
        const lookup = mouseToLookup(parseMouse(binding))
        const list = mouse.get(lookup)
        if (list) list.push(cmd)
        else mouse.set(lookup, [cmd])
      }
    }
  }

  return { keys, mouse }
}

/**
 * Check if a command is active given current context
 * @param {Command} command
 * @param {Record<string, unknown>} context
 * @returns {boolean}
 */
function isActive(command, context) {
  if (!command.when) return true
  return command.when(context)
}

/**
 * Create keybind handler
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {() => Record<string, unknown>} [getContext] - Returns current context state
 * @param {{ target?: EventTarget, onExecute?: (cmd: Command, ctx: Record<string, unknown>) => void }} [options] - Options
 *
 * Command shape:
 *   id: string           - unique identifier
 *   label: string        - display name
 *   category?: string    - group for command palette
 *   keys?: string[]      - keyboard triggers (e.g., ['$mod+k', 'Escape'])
 *   mouse?: string[]     - mouse triggers (e.g., ['$mod+Click', 'MiddleClick'])
 *   when?: ctx => bool   - activation condition
 *   execute: ctx => any  - action (return false to propagate)
 *   hidden?: bool        - hide from search
 *   captureInput?: bool  - fire even when in input fields
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
 *   {
 *     id: 'pan',
 *     label: 'Pan canvas',
 *     category: 'Canvas',
 *     mouse: ['MiddleClick'],
 *     execute: () => startPan()
 *   }
 * ], () => ({
 *   hasSelection: selectedId() !== null,
 *   isEditing: editingId() !== null
 * }))
 * @returns {() => void} Cleanup function
 */
export function keybinds(commands, getContext = () => ({}), options = {}) {
  const { target = window, onExecute } = options

  // Build lookup tables for O(1) dispatch
  const lookup = buildLookupTables(commands)

  /**
   * @param {Command} cmd
   * @param {Record<string, unknown>} context
   * @param {KeyboardEvent | MouseEvent} event
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

  /** @param {Event} e */
  function handleKeyDown(e) {
    const event = /** @type {KeyboardEvent} */ (e)
    const tgt = /** @type {Element | null} */ (event.target)
    // Don't capture when typing in inputs (unless command explicitly allows it)
    const inInput = tgt?.tagName === 'INPUT' ||
                    tgt?.tagName === 'TEXTAREA' ||
                    (tgt instanceof HTMLElement && tgt.isContentEditable)

    // O(1) lookup - try all key variants (key, code, codeKey)
    const lookups = eventToKeyLookups(event)
    /** @type {Command[] | undefined} */
    let candidates
    for (const l of lookups) {
      candidates = lookup.keys.get(l)
      if (candidates) break
    }
    if (!candidates) return

    const context = getContext()
    for (const cmd of candidates) {
      if (inInput && !cmd.captureInput) continue
      if (!isActive(cmd, context)) continue
      if (tryExecute(cmd, context, event)) return
    }
  }

  /** @param {Event} e */
  function handleMouseDown(e) {
    const event = /** @type {MouseEvent} */ (e)

    // O(1) lookup
    const candidates = lookup.mouse.get(eventToMouseLookup(event))
    if (!candidates) return

    const context = getContext()
    for (const cmd of candidates) {
      if (!isActive(cmd, context)) continue
      if (tryExecute(cmd, context, event)) return
    }
  }

  target.addEventListener('keydown', handleKeyDown)
  target.addEventListener('mousedown', handleMouseDown)

  // Return cleanup function
  return () => {
    target.removeEventListener('keydown', handleKeyDown)
    target.removeEventListener('mousedown', handleMouseDown)
  }
}

/**
 * Check if a command has any bindings
 * @param {Command} cmd
 * @returns {boolean}
 */
function hasBoundKeys(cmd) {
  return Boolean((cmd.keys && cmd.keys.length > 0) || (cmd.mouse && cmd.mouse.length > 0))
}

/**
 * Dedupe commands by ID (last wins - for registration order / inner scope)
 * @param {Command[]} commands
 * @returns {Command[]}
 */
function dedupeCommands(commands) {
  /** @type {Map<string, Command>} */
  const seen = new Map()
  for (const cmd of commands) {
    seen.set(cmd.id, cmd)  // last one wins
  }
  return Array.from(seen.values())
}

/**
 * Search commands for command palette
 *
 * - Dedupes by ID (last registration wins - inner scope shadows outer)
 * - Hides commands with no bindings (no keys and no mouse)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} [context] - Current context
 * @param {SearchOptions} [options] - Search options (e.g., custom matcher)
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export function searchCommands(commands, query, context = {}, options = {}) {
  const { matcher } = options
  const q = query.toLowerCase()
  /** @type {ScoredCommand[]} */
  const results = []

  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue
    if (!hasBoundKeys(cmd)) continue  // hide unbound

    /** @type {MatchResult | null} */
    let match = null

    if (matcher) {
      // Custom matcher: try label, then id, then category
      match = matcher(query, cmd.label)
        ?? matcher(query, cmd.id)
        ?? (cmd.category ? matcher(query, cmd.category) : null)
    } else {
      // Default: simple substring matching
      const label = cmd.label.toLowerCase()
      const id = cmd.id.toLowerCase()
      const category = (cmd.category || '').toLowerCase()

      if (label.startsWith(q)) match = { score: 3 }
      else if (id.startsWith(q)) match = { score: 2 }
      else if (category.startsWith(q)) match = { score: 2 }
      else if (label.includes(q) || id.includes(q) || category.includes(q)) match = { score: 1 }
    }

    if (!match) continue

    results.push({
      ...cmd,
      active: isActive(cmd, context),
      score: match.score,
      positions: match.positions
    })
  }

  return results.sort((a, b) => {
    if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0)
    return b.score - a.score
  })
}

/**
 * Group commands by category
 *
 * - Dedupes by ID (last registration wins)
 * - Hides commands with no bindings
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {Record<string, unknown>} [context] - Current context (for active state)
 * @returns {Record<string, (Command & { active: boolean })[]>} Commands grouped by category
 */
export function groupByCategory(commands, context = {}) {
  /** @type {Record<string, (Command & { active: boolean })[]>} */
  const groups = {}

  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue
    if (!hasBoundKeys(cmd)) continue  // hide unbound
    const cat = cmd.category || 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push({
      ...cmd,
      active: isActive(cmd, context)
    })
  }

  return groups
}

/**
 * Validate all commands upfront (call on init to catch typos early)
 * @param {Command[]} commands
 * @returns {true}
 * @throws {Error} if any binding is invalid
 */
export function validateCommands(commands) {
  for (const cmd of commands) {
    if (!cmd.id) {
      throw new Error('Command missing id')
    }
    if (cmd.keys) {
      for (const key of cmd.keys) {
        try {
          parseKey(key)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          throw new Error(`Command "${cmd.id}": ${msg}`)
        }
      }
    }
    if (cmd.mouse) {
      for (const binding of cmd.mouse) {
        try {
          parseMouse(binding)
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          throw new Error(`Command "${cmd.id}": ${msg}`)
        }
      }
    }
  }
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
 * Format a single key part for display
 * @param {string} part
 * @returns {string}
 */
function formatKeyPart(part) {
  const p = part.trim().toLowerCase()
  if (p === '$mod') return isMac ? '⌘' : 'Ctrl'
  if (p === 'ctrl' || p === 'control') return isMac ? '⌃' : 'Ctrl'
  if (p === 'alt' || p === 'option') return isMac ? '⌥' : 'Alt'
  if (p === 'shift') return isMac ? '⇧' : 'Shift'
  if (p === 'meta' || p === 'cmd' || p === 'command') return '⌘'
  if (p === 'backspace') return '⌫'
  if (p === 'delete') return '⌦'
  if (p === 'escape' || p === 'esc') return 'Esc'
  if (p === 'enter') return '↵'
  if (p === 'space') return 'Space'
  if (p === 'tab') return 'Tab'
  if (p === 'arrowup' || p === 'up') return '↑'
  if (p === 'arrowdown' || p === 'down') return '↓'
  if (p === 'arrowleft' || p === 'left') return '←'
  if (p === 'arrowright' || p === 'right') return '→'
  return part.toUpperCase()
}

/**
 * Format key binding into array of display parts (e.g., "$mod+k" -> ["⌘", "K"] on Mac)
 * @param {string} key
 * @returns {string[]}
 */
export function formatKeyParts(key) {
  return key.split('+').map(formatKeyPart)
}

/**
 * @typedef {Object} BindingSchema
 * @property {string} label - Display name
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Default keyboard triggers
 * @property {string[] | undefined} [mouse] - Default mouse triggers
 * @property {boolean | undefined} [hidden] - Hide from search/settings
 */

/**
 * @typedef {Record<string, BindingSchema>} Schema
 */

/**
 * Define a binding schema (identity function for type inference/autocomplete)
 * @template {Schema} T
 * @param {T} schema
 * @returns {T}
 */
export function defineSchema(schema) {
  return schema
}

/**
 * @typedef {Record<string, { keys?: string[], mouse?: string[] }>} BindingOverrides
 */

/**
 * Merge schema with user overrides
 * @param {Schema} schema - Default bindings
 * @param {BindingOverrides} overrides - User customizations
 * @returns {Schema} Merged bindings
 */
export function mergeBindings(schema, overrides) {
  /** @type {Schema} */
  const result = {}
  for (const [id, binding] of Object.entries(schema)) {
    const override = overrides[id]
    result[id] = override
      ? { ...binding, keys: override.keys ?? binding.keys, mouse: override.mouse ?? binding.mouse }
      : binding
  }
  return result
}

/**
 * Create commands from bindings + handlers
 * Handlers only need to implement commands they care about
 *
 * @param {Schema} bindings - Binding definitions (from schema + overrides)
 * @param {Record<string, (ctx: Record<string, unknown>, event?: Event) => unknown>} handlers - Handler implementations
 * @param {Record<string, { when?: (ctx: Record<string, unknown>) => boolean, captureInput?: boolean }>} [options] - Per-command options
 * @returns {Command[]}
 */
export function fromBindings(bindings, handlers, options = {}) {
  /** @type {Command[]} */
  const commands = []

  for (const [id, handler] of Object.entries(handlers)) {
    const binding = bindings[id]
    if (!binding) {
      console.warn(`keybinds: handler "${id}" has no matching binding`)
      continue
    }

    commands.push({
      id,
      label: binding.label,
      category: binding.category,
      keys: binding.keys,
      mouse: binding.mouse,
      hidden: binding.hidden,
      execute: handler,
      ...options[id]
    })
  }

  return commands
}

/**
 * Get all bindings as a flat list (for settings UI)
 * @param {Schema} schema
 * @returns {Array<BindingSchema & { id: string }>}
 */
export function listBindings(schema) {
  return Object.entries(schema)
    .filter(([, b]) => !b.hidden)
    .map(([id, binding]) => ({ id, ...binding }))
}

/**
 * @template {Schema} T
 * @typedef {{ bindings: T, overrides: BindingOverrides }} BindingsChangeDetail
 */

/**
 * @template {Schema} T
 * @typedef {CustomEvent<BindingsChangeDetail<T>>} BindingsChangeEvent
 */

/**
 * Reactive bindings store with localStorage persistence
 *
 * Extends EventTarget - dispatches 'change' events when bindings are saved.
 *
 * @template {Schema} T
 * @extends {EventTarget}
 *
 * @example
 * const store = new BindingsStore(schema, 'myapp:keybinds')
 *
 * // Get current bindings (merged schema + overrides)
 * const bindings = store.get()
 *
 * // Subscribe to changes
 * store.addEventListener('change', (ev) => {
 *   console.log(ev.detail.bindings) // fully typed
 * })
 *
 * // Save new overrides (dispatches 'change' event)
 * store.save({ delete: { keys: ['$mod+d'] } })
 */
export class BindingsStore extends EventTarget {
  /**
   * @param {T} schema - Default bindings schema
   * @param {string} storageKey - localStorage key
   */
  constructor(schema, storageKey) {
    super()
    /** @type {T} */ this.schema = schema
    /** @type {string} */ this.storageKey = storageKey
    /** @type {BindingOverrides} */ this.overrides = this.loadOverrides()
    /** @type {T} */ this.bindings = /** @type {T} */ (mergeBindings(schema, this.overrides))
  }

  /** @returns {BindingOverrides} */
  loadOverrides() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey) || '{}')
    } catch {
      return {}
    }
  }

  /** Get current bindings (schema merged with overrides) */
  get() {
    return this.bindings
  }

  /** Get current overrides only */
  getOverrides() {
    return this.overrides
  }

  /**
   * Save new overrides and dispatch 'change' event
   * @param {BindingOverrides} newOverrides
   */
  save(newOverrides) {
    this.overrides = newOverrides
    localStorage.setItem(this.storageKey, JSON.stringify(newOverrides))
    this.bindings = /** @type {T} */ (mergeBindings(this.schema, this.overrides))
    this.dispatchEvent(new CustomEvent('change', {
      detail: { bindings: this.bindings, overrides: this.overrides }
    }))
  }
}

// ========================================
// Matchers
// ========================================

/**
 * Simple substring matcher (case-insensitive)
 *
 * Scores by position: startsWith > includes
 *
 * @type {Matcher}
 */
export function simpleMatcher(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  if (t.startsWith(q)) return { score: 2 }
  if (t.includes(q)) return { score: 1 }
  return null
}

/**
 * Fuzzy sequential character matcher
 *
 * Matches if all query chars appear in order in text.
 * Scores based on consecutive matches and word-start bonuses.
 * Returns positions for highlighting.
 *
 * @type {Matcher}
 */
export function fuzzyMatcher(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  let qi = 0
  let ti = 0
  let score = 0
  let lastMatch = -1
  /** @type {number[]} */
  const positions = []

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      positions.push(ti)
      // Consecutive match bonus
      if (ti === lastMatch + 1) score += 2
      // Word start bonus (after space/hyphen/underscore or at beginning)
      if (ti === 0 || ' -_'.includes(t[ti - 1])) score += 3
      // Exact case match bonus
      if (query[qi] === text[ti]) score += 1
      lastMatch = ti
      qi++
    }
    ti++
  }

  // All query chars must be found
  if (qi < q.length) return null

  // Base score from match ratio
  score += Math.round((positions.length / t.length) * 10)

  return { score, positions }
}

// ========================================
// Web Components
// ========================================

/**
 * <command-palette> - Search-driven command execution
 *
 * Attributes:
 *   open         - Show/hide the palette
 *   auto-trigger - Enable default $mod+K trigger
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   matcher: Matcher        - Custom matcher function
 *   open: boolean           - Show/hide the palette
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when palette is dismissed
 *
 * BEM classes:
 *   .palette
 *   .palette__backdrop
 *   .palette__dialog
 *   .palette__input
 *   .palette__list
 *   .palette__item
 *   .palette__item--active
 *   .palette__item--disabled
 *   .palette__item-label
 *   .palette__item-label-match (highlight)
 *   .palette__item-category
 *   .palette__item-keys
 *   .palette__item-key
 *   .palette__empty
 */
export class CommandPalette extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'auto-trigger']
  }

  constructor() {
    super()
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {Matcher | undefined} */
    this._matcher = undefined
    /** @type {ScoredCommand[]} */
    this._results = []
    /** @type {number} */
    this._activeIndex = 0
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null

    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
      </style>
      <div class="palette" part="palette">
        <div class="palette__backdrop" part="backdrop"></div>
        <div class="palette__dialog" part="dialog" role="dialog" aria-modal="true">
          <input
            class="palette__input"
            part="input"
            type="text"
            placeholder="Type a command..."
            autocomplete="off"
            spellcheck="false"
          />
          <ul class="palette__list" part="list" role="listbox"></ul>
        </div>
      </div>
    `

    this._backdrop = this.shadowRoot.querySelector('.palette__backdrop')
    this._input = this.shadowRoot.querySelector('.palette__input')
    this._list = this.shadowRoot.querySelector('.palette__list')

    this._backdrop.addEventListener('click', () => this._close())
    this._input.addEventListener('input', () => this._search())
    this._input.addEventListener('keydown', (e) => this._handleKey(e))
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._search()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._search()
  }

  get matcher() { return this._matcher }
  set matcher(val) {
    this._matcher = val
    if (this.open) this._search()
  }

  get open() { return this.hasAttribute('open') }
  set open(val) {
    if (val) this.setAttribute('open', '')
    else this.removeAttribute('open')
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'open') {
      if (newVal !== null) this._onOpen()
      else this._onClose()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    }
  }

  connectedCallback() {
    if (this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
    }
  }

  disconnectedCallback() {
    this._setupAutoTrigger(false)
  }

  /** @param {boolean} enable */
  _setupAutoTrigger(enable) {
    if (this._cleanupTrigger) {
      this._cleanupTrigger()
      this._cleanupTrigger = null
    }
    if (!enable) return

    const mac = /Mac|iPhone|iPad/.test(navigator.platform)

    /** @param {KeyboardEvent} e */
    const handler = (e) => {
      const mod = mac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        this.open = !this.open
      }
    }

    window.addEventListener('keydown', handler)
    this._cleanupTrigger = () => window.removeEventListener('keydown', handler)
  }

  _onOpen() {
    this._input.value = ''
    this._activeIndex = 0
    this._search()
    requestAnimationFrame(() => this._input.focus())
  }

  _onClose() {
    this._input.blur()
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _search() {
    const query = this._input.value
    this._results = query
      ? searchCommands(this._commands, query, this._context, { matcher: this._matcher })
      : this._getAllVisible()
    this._activeIndex = Math.min(this._activeIndex, Math.max(0, this._results.length - 1))
    this._render()
  }

  _getAllVisible() {
    // Show all non-hidden commands when no query
    return this._commands
      .filter(cmd => !cmd.hidden && ((cmd.keys && cmd.keys.length) || (cmd.mouse && cmd.mouse.length)))
      .map(cmd => ({
        ...cmd,
        active: !cmd.when || cmd.when(this._context),
        score: 0
      }))
  }

  _render() {
    this._list.innerHTML = ''
    if (this._results.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'palette__empty'
      empty.setAttribute('part', 'empty')
      empty.textContent = 'No commands found'
      this._list.appendChild(empty)
      return
    }

    this._results.forEach((cmd, i) => {
      const li = document.createElement('li')
      li.className = 'palette__item'
      if (i === this._activeIndex) li.className += ' palette__item--active'
      if (!cmd.active) li.className += ' palette__item--disabled'
      li.setAttribute('part', `item${i === this._activeIndex ? ' item-active' : ''}${!cmd.active ? ' item-disabled' : ''}`)
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', i === this._activeIndex ? 'true' : 'false')
      li.dataset.index = String(i)

      const label = document.createElement('span')
      label.className = 'palette__item-label'
      label.setAttribute('part', 'item-label')

      if (cmd.positions && cmd.positions.length > 0) {
        // Render with highlights
        const posSet = new Set(cmd.positions)
        for (let j = 0; j < cmd.label.length; j++) {
          if (posSet.has(j)) {
            const mark = document.createElement('mark')
            mark.className = 'palette__item-label-match'
            mark.setAttribute('part', 'item-label-match')
            mark.textContent = cmd.label[j]
            label.appendChild(mark)
          } else {
            label.appendChild(document.createTextNode(cmd.label[j]))
          }
        }
      } else {
        label.textContent = cmd.label
      }

      li.appendChild(label)

      if (cmd.category) {
        const cat = document.createElement('span')
        cat.className = 'palette__item-category'
        cat.setAttribute('part', 'item-category')
        cat.textContent = cmd.category
        li.appendChild(cat)
      }

      if (cmd.keys && cmd.keys[0]) {
        const keyContainer = document.createElement('span')
        keyContainer.className = 'palette__item-keys'
        keyContainer.setAttribute('part', 'item-keys')
        for (const part of formatKeyParts(cmd.keys[0])) {
          const kbd = document.createElement('kbd')
          kbd.className = 'palette__item-key'
          kbd.setAttribute('part', 'item-key')
          kbd.textContent = part
          keyContainer.appendChild(kbd)
        }
        li.appendChild(keyContainer)
      }

      li.addEventListener('click', () => this._execute(i))
      li.addEventListener('mouseenter', () => {
        this._activeIndex = i
        this._render()
      })

      this._list.appendChild(li)
    })
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._activeIndex = Math.min(this._activeIndex + 1, this._results.length - 1)
        this._render()
        this._scrollToActive()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._activeIndex = Math.max(this._activeIndex - 1, 0)
        this._render()
        this._scrollToActive()
        break
      case 'Enter':
        e.preventDefault()
        this._execute(this._activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        this._close()
        break
    }
  }

  _scrollToActive() {
    const active = this._list.querySelector('.palette__item--active')
    if (active) active.scrollIntoView({ block: 'nearest' })
  }

  /** @param {number} index */
  _execute(index) {
    const cmd = this._results[index]
    if (!cmd || !cmd.active) return

    this._close()
    executeCommand(this._commands, cmd.id, this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}

/**
 * <keybind-cheatsheet> - Grouped display of available bindings
 *
 * Attributes:
 *   open         - Show/hide the cheatsheet
 *   auto-trigger - Enable hold-Control trigger (200ms delay)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks (grays out inactive)
 *   open: boolean           - Show/hide the cheatsheet
 *
 * Events:
 *   close - Fired when cheatsheet is dismissed
 *
 * BEM classes:
 *   .cheatsheet
 *   .cheatsheet__backdrop
 *   .cheatsheet__dialog
 *   .cheatsheet__group
 *   .cheatsheet__group-title
 *   .cheatsheet__list
 *   .cheatsheet__item
 *   .cheatsheet__item--disabled
 *   .cheatsheet__item-label
 *   .cheatsheet__item-keys
 *   .cheatsheet__item-binding
 *   .cheatsheet__item-key
 */
export class KeybindCheatsheet extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'auto-trigger']
  }

  constructor() {
    super()
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null

    this.attachShadow({ mode: 'open' })
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
      </style>
      <div class="cheatsheet" part="cheatsheet">
        <div class="cheatsheet__backdrop" part="backdrop"></div>
        <div class="cheatsheet__dialog" part="dialog" role="dialog" aria-modal="true"></div>
      </div>
    `

    this._backdrop = this.shadowRoot.querySelector('.cheatsheet__backdrop')
    this._dialog = this.shadowRoot.querySelector('.cheatsheet__dialog')

    this._backdrop.addEventListener('click', () => this._close())
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._render()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._render()
  }

  get open() { return this.hasAttribute('open') }
  set open(val) {
    if (val) this.setAttribute('open', '')
    else this.removeAttribute('open')
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'open' && newVal !== null) {
      this._render()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    }
  }

  connectedCallback() {
    if (this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
    }
  }

  disconnectedCallback() {
    this._setupAutoTrigger(false)
  }

  /** @param {boolean} enable */
  _setupAutoTrigger(enable) {
    if (this._cleanupTrigger) {
      this._cleanupTrigger()
      this._cleanupTrigger = null
    }
    if (!enable) return

    this._cleanupTrigger = onModifierHold('Control', (held) => {
      this.open = held
    })
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _render() {
    const groups = groupByCategory(this._commands, this._context)
    this._dialog.innerHTML = ''

    for (const [category, cmds] of Object.entries(groups)) {
      const group = document.createElement('div')
      group.className = 'cheatsheet__group'
      group.setAttribute('part', 'group')

      const title = document.createElement('div')
      title.className = 'cheatsheet__group-title'
      title.setAttribute('part', 'group-title')
      title.textContent = category
      group.appendChild(title)

      const list = document.createElement('ul')
      list.className = 'cheatsheet__list'
      list.setAttribute('part', 'list')

      for (const cmd of cmds) {
        const li = document.createElement('li')
        li.className = 'cheatsheet__item'
        if (!cmd.active) li.className += ' cheatsheet__item--disabled'
        li.setAttribute('part', `item${!cmd.active ? ' item-disabled' : ''}`)

        const label = document.createElement('span')
        label.className = 'cheatsheet__item-label'
        label.setAttribute('part', 'item-label')
        label.textContent = cmd.label
        li.appendChild(label)

        const keys = document.createElement('span')
        keys.className = 'cheatsheet__item-keys'
        keys.setAttribute('part', 'item-keys')

        // Show all key bindings
        if (cmd.keys) {
          for (const k of cmd.keys) {
            const binding = document.createElement('span')
            binding.className = 'cheatsheet__item-binding'
            binding.setAttribute('part', 'item-binding')
            for (const part of formatKeyParts(k)) {
              const kbd = document.createElement('kbd')
              kbd.className = 'cheatsheet__item-key'
              kbd.setAttribute('part', 'item-key')
              kbd.textContent = part
              binding.appendChild(kbd)
            }
            keys.appendChild(binding)
          }
        }
        // Show mouse bindings
        if (cmd.mouse) {
          for (const m of cmd.mouse) {
            const binding = document.createElement('span')
            binding.className = 'cheatsheet__item-binding'
            binding.setAttribute('part', 'item-binding')
            for (const part of formatMouseParts(m)) {
              const kbd = document.createElement('kbd')
              kbd.className = 'cheatsheet__item-key'
              kbd.setAttribute('part', 'item-key')
              kbd.textContent = part
              binding.appendChild(kbd)
            }
            keys.appendChild(binding)
          }
        }

        li.appendChild(keys)
        list.appendChild(li)
      }

      group.appendChild(list)
      this._dialog.appendChild(group)
    }
  }
}

/**
 * Format mouse binding for display
 * @param {string} binding
 * @returns {string}
 */
/**
 * Format a single mouse binding part for display
 * @param {string} part
 * @returns {string}
 */
function formatMousePart(part) {
  const p = part.trim().toLowerCase()
  if (p === '$mod') return isMac ? '⌘' : 'Ctrl'
  if (p === 'ctrl' || p === 'control') return isMac ? '⌃' : 'Ctrl'
  if (p === 'alt' || p === 'option') return isMac ? '⌥' : 'Alt'
  if (p === 'shift') return isMac ? '⇧' : 'Shift'
  if (p === 'meta' || p === 'cmd' || p === 'command') return '⌘'
  if (p === 'click' || p === 'leftclick' || p === 'left') return 'Click'
  if (p === 'middleclick' || p === 'middle') return 'Middle'
  if (p === 'rightclick' || p === 'right') return 'Right'
  return part
}

/**
 * Format mouse binding into array of display parts
 * @param {string} binding
 * @returns {string[]}
 */
export function formatMouseParts(binding) {
  return binding.split('+').map(formatMousePart)
}

/**
 * Trigger callback when a modifier key is held
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {(held: boolean) => void} callback - Called with true on hold, false on release
 * @param {{ delay?: number, target?: EventTarget }} [options]
 * @returns {() => void} Cleanup function
 *
 * @example
 * const cleanup = onModifierHold('Control', (held) => {
 *   cheatsheet.open = held
 * }, { delay: 300 })
 */
export function onModifierHold(modifiers, callback, options = {}) {
  const { delay = 200, target = window } = options
  const mods = Array.isArray(modifiers) ? modifiers : [modifiers]
  const modSet = new Set(mods.map(m => m.toLowerCase()))

  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  let isHeld = false

  /** @param {Event} e */
  function handleKeyDown(e) {
    const event = /** @type {KeyboardEvent} */ (e)
    if (!modSet.has(event.key.toLowerCase())) return
    if (timer !== null) return // already waiting

    timer = setTimeout(() => {
      isHeld = true
      callback(true)
    }, delay)
  }

  /** @param {Event} e */
  function handleKeyUp(e) {
    const event = /** @type {KeyboardEvent} */ (e)
    if (!modSet.has(event.key.toLowerCase())) return

    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (isHeld) {
      isHeld = false
      callback(false)
    }
  }

  function handleBlur() {
    // Release if window loses focus
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    if (isHeld) {
      isHeld = false
      callback(false)
    }
  }

  target.addEventListener('keydown', handleKeyDown)
  target.addEventListener('keyup', handleKeyUp)
  window.addEventListener('blur', handleBlur)

  return () => {
    target.removeEventListener('keydown', handleKeyDown)
    target.removeEventListener('keyup', handleKeyUp)
    window.removeEventListener('blur', handleBlur)
    if (timer !== null) clearTimeout(timer)
  }
}

/**
 * Register all keybind components
 * Call this once to define the custom elements
 */
export function registerComponents() {
  if (!customElements.get('command-palette')) {
    customElements.define('command-palette', CommandPalette)
  }
  if (!customElements.get('keybind-cheatsheet')) {
    customElements.define('keybind-cheatsheet', KeybindCheatsheet)
  }
}

export default keybinds
