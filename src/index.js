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
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Keyboard triggers
 * @property {string[] | undefined} [mouse] - Mouse triggers
 * @property {((ctx: Record<string, unknown>) => boolean) | undefined} [when] - Activation condition
 * @property {(ctx: Record<string, unknown>, event?: Event) => unknown} execute - Action
 * @property {boolean | undefined} [hidden] - Hide from search
 * @property {boolean | undefined} [captureInput] - Fire even in input fields
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
 */

/**
 * @typedef {{ score: number, positions?: number[] }} MatchResult
 * @typedef {(query: string, text: string) => MatchResult | null} Matcher
 * @typedef {{ matcher?: Matcher | undefined }} SearchOptions
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
  'middleclick', 'middle',
  'scrollup', 'scrolldown', 'scrollleft', 'scrollright'
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
  else if (btn === 'scrollup') button = 3
  else if (btn === 'scrolldown') button = 4
  else if (btn === 'scrollleft') button = 5
  else if (btn === 'scrollright') button = 6

  return { mods, button }
}

const BUTTON_NAMES = ['click', 'middle', 'right', 'scrollup', 'scrolldown', 'scrollleft', 'scrollright']

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
 * Convert a WheelEvent to a lookup key (e.g. "ctrl+scrollup")
 * Returns null if both deltas are zero.
 * @param {WheelEvent} event
 * @returns {string | null}
 */
function eventToWheelLookup(event) {
  let direction
  // Prefer vertical axis; fall back to horizontal
  if (event.deltaY < 0) direction = 'scrollup'
  else if (event.deltaY > 0) direction = 'scrolldown'
  else if (event.deltaX < 0) direction = 'scrollleft'
  else if (event.deltaX > 0) direction = 'scrollright'
  else return null

  const prefix = modsToPrefix({
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  })
  return `${prefix}${direction}`
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

    // Don't fire keybinds while the command palette or settings panel is open
    if (tgt?.matches?.('command-palette[open]')) return
    if (tgt?.matches?.('keybind-settings[open]')) return

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

    // Don't fire keybinds while the command palette or settings panel is open
    const tgt = /** @type {Element | null} */ (event.target)
    if (tgt?.matches?.('command-palette[open]')) return
    if (tgt?.matches?.('keybind-settings[open]')) return

    // O(1) lookup
    const candidates = lookup.mouse.get(eventToMouseLookup(event))
    if (!candidates) return

    const context = getContext()
    for (const cmd of candidates) {
      if (!isActive(cmd, context)) continue
      if (tryExecute(cmd, context, event)) return
    }
  }

  // Cooldown-based wheel dispatch: fires immediately, then suppresses for 100ms
  /** @type {Map<string, number>} */
  const wheelCooldowns = new Map()
  const WHEEL_COOLDOWN_MS = 100

  /** @param {Event} e */
  function handleWheel(e) {
    const event = /** @type {WheelEvent} */ (e)

    // Don't fire keybinds while the command palette or settings panel is open
    const tgt = /** @type {Element | null} */ (event.target)
    if (tgt?.matches?.('command-palette[open]')) return
    if (tgt?.matches?.('keybind-settings[open]')) return

    const lookupKey = eventToWheelLookup(event)
    if (!lookupKey) return

    const candidates = lookup.mouse.get(lookupKey)
    if (!candidates) return

    // Cooldown check
    const now = performance.now()
    const lastFire = wheelCooldowns.get(lookupKey)
    if (lastFire !== undefined && now - lastFire < WHEEL_COOLDOWN_MS) return

    const context = getContext()
    for (const cmd of candidates) {
      if (!isActive(cmd, context)) continue
      if (tryExecute(cmd, context, event)) {
        wheelCooldowns.set(lookupKey, now)
        return
      }
    }
  }

  target.addEventListener('keydown', handleKeyDown)
  target.addEventListener('mousedown', handleMouseDown)
  target.addEventListener('wheel', handleWheel, { passive: false })

  // Return cleanup function
  return () => {
    target.removeEventListener('keydown', handleKeyDown)
    target.removeEventListener('mousedown', handleMouseDown)
    target.removeEventListener('wheel', handleWheel)
  }
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
 * Search commands with a given matcher
 *
 * - Dedupes by ID (last registration wins - inner scope shadows outer)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} context - Current context
 * @param {Matcher} matcher - Matcher function to score results
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export function matchCommands(commands, query, context, matcher) {
  /** @type {ScoredCommand[]} */
  const results = []

  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue

    const match = matcher(query, cmd.label)
      ?? matcher(query, cmd.id)
      ?? (cmd.description ? matcher(query, cmd.description) : null)
      ?? (cmd.category ? matcher(query, cmd.category) : null)

    if (!match) continue

    /** @type {ScoredCommand} */
    const scored = { ...cmd, active: isActive(cmd, context), score: match.score }
    if (match.positions) scored.positions = match.positions
    results.push(scored)
  }

  return results.sort((a, b) => {
    if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0)
    return b.score - a.score
  })
}

/**
 * Search commands for command palette (defaults to fuzzy matching)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} [context] - Current context
 * @param {SearchOptions} [options] - Search options (e.g., custom matcher)
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export function searchCommands(commands, query, context = {}, options = {}) {
  return matchCommands(commands, query, context, options.matcher ?? fuzzyMatcher)
}

/**
 * Group commands by category
 *
 * - Dedupes by ID (last registration wins)
 * - Excludes commands with no bindings (no keys and no mouse)
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
    if (!(cmd.keys?.length || cmd.mouse?.length)) continue
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
 * Filter commands by menu tag
 *
 * - Dedupes by ID (last registration wins)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} menu - Menu tag to filter by
 * @param {Record<string, unknown>} [context] - Current context (for active state)
 * @returns {(Command & { active: boolean })[]} Matching commands
 */
export function filterByMenu(commands, menu, context = {}) {
  const results = []
  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue
    const menus = cmd.menu
    if (!menus) continue
    const matches = Array.isArray(menus) ? menus.includes(menu) : menus === menu
    if (!matches) continue
    results.push({ ...cmd, active: isActive(cmd, context) })
  }
  return results
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
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Default keyboard triggers
 * @property {string[] | undefined} [mouse] - Default mouse triggers
 * @property {boolean | undefined} [hidden] - Hide from search/settings
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
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
      description: binding.description,
      category: binding.category,
      keys: binding.keys,
      mouse: binding.mouse,
      hidden: binding.hidden,
      menu: binding.menu,
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
      if (ti === 0 || ' -_'.includes(/** @type {string} */ (t[ti - 1]))) score += 3
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
// Event-to-binding converters
// ========================================

/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k")
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone)
 * and for keys not in VALID_KEYS.
 *
 * @param {KeyboardEvent} event
 * @returns {string | null}
 */
export function eventToBindingString(event) {
  const key = event.key.toLowerCase()

  // Ignore bare modifier presses
  if (['shift', 'control', 'alt', 'meta'].includes(key)) return null

  // Normalize key name — prefer event.key, fall back to event.code
  let normalizedKey = key
  const code = event.code.toLowerCase()
  if (code.startsWith('key')) {
    const codeKey = code.slice(3)
    if (VALID_KEYS.has(codeKey) && !VALID_KEYS.has(key)) normalizedKey = codeKey
  }

  if (!VALID_KEYS.has(normalizedKey)) return null

  // Build modifier prefix using $mod for the platform modifier
  const parts = []
  const hasPlatformMod = isMac ? event.metaKey : event.ctrlKey
  const hasNonPlatformMod = isMac ? event.ctrlKey : event.metaKey

  if (hasPlatformMod) parts.push('$mod')
  if (hasNonPlatformMod) parts.push(isMac ? 'ctrl' : 'meta')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  parts.push(normalizedKey)

  return parts.join('+')
}

/**
 * Convert a MouseEvent or WheelEvent to a canonical binding string (e.g. "$mod+click", "$mod+scrollup")
 *
 * @param {MouseEvent} event
 * @returns {string | null}
 */
export function eventToMouseBindingString(event) {
  let buttonName

  // WheelEvent: derive direction from deltas
  if ('deltaY' in event && 'deltaX' in event) {
    const we = /** @type {WheelEvent} */ (event)
    if (we.deltaY < 0) buttonName = 'scrollup'
    else if (we.deltaY > 0) buttonName = 'scrolldown'
    else if (we.deltaX < 0) buttonName = 'scrollleft'
    else if (we.deltaX > 0) buttonName = 'scrollright'
    else return null
  } else {
    buttonName = BUTTON_NAMES[event.button]
    if (!buttonName) return null
  }

  const parts = []
  const hasPlatformMod = isMac ? event.metaKey : event.ctrlKey
  const hasNonPlatformMod = isMac ? event.ctrlKey : event.metaKey

  if (hasPlatformMod) parts.push('$mod')
  if (hasNonPlatformMod) parts.push(isMac ? 'ctrl' : 'meta')
  if (event.altKey) parts.push('alt')
  if (event.shiftKey) parts.push('shift')
  parts.push(buttonName)

  return parts.join('+')
}

/**
 * Check if a binding string conflicts with any command in the schema
 *
 * @param {Schema} schema - The binding schema to check against
 * @param {string} bindingStr - The binding string to check
 * @param {'keys' | 'mouse'} type - Whether this is a key or mouse binding
 * @param {string} [excludeId] - Command ID to exclude from conflict check
 * @returns {{ commandId: string, label: string } | null}
 */
export function findConflict(schema, bindingStr, type, excludeId) {
  // Normalize the candidate through parse → lookup
  let candidateLookup
  try {
    if (type === 'keys') {
      candidateLookup = keyToLookup(parseKey(bindingStr))
    } else {
      candidateLookup = mouseToLookup(parseMouse(bindingStr))
    }
  } catch {
    return null
  }

  for (const [id, binding] of Object.entries(schema)) {
    if (id === excludeId) continue
    const bindings = binding[type]
    if (!bindings) continue

    for (const b of bindings) {
      try {
        const lookup = type === 'keys' ? keyToLookup(parseKey(b)) : mouseToLookup(parseMouse(b))
        if (lookup === candidateLookup) {
          return { commandId: id, label: binding.label }
        }
      } catch {
        continue
      }
    }
  }

  return null
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
 *   placeholder  - Input placeholder text (default: "Type a command...")
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
 *   .palette__item-description
 *   .palette__item-category
 *   .palette__item-keys
 *   .palette__item-key
 *   .palette__empty
 */
export class CommandPalette extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'auto-trigger', 'placeholder']
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
    /** @type {HTMLLIElement[]} */
    this._items = []
    /** @type {number} */
    this._activeIndex = 0
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'keyboard'
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
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

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.palette__backdrop'))
    /** @type {HTMLInputElement} */
    this._input = /** @type {HTMLInputElement} */ (shadow.querySelector('.palette__input'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.palette__list'))

    this._backdrop.addEventListener('click', () => this._close())
    this._input.addEventListener('input', () => this._search())
    this._input.addEventListener('keydown', (e) => this._handleKey(e))
    this._list.addEventListener('mousemove', () => { this._inputMode = 'pointer' })
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

  /**
   * @param {string} name
   * @param {string | null} _oldVal
   * @param {string | null} newVal
   */
  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'open') {
      if (newVal !== null) this._onOpen()
      else this._onClose()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    } else if (name === 'placeholder') {
      this._input.placeholder = newVal || 'Type a command...'
    }
  }

  connectedCallback() {
    if (this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
    }
    if (this.hasAttribute('placeholder')) {
      this._input.placeholder = this.getAttribute('placeholder') || 'Type a command...'
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
    this._inputMode = 'keyboard'
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
    this._activeIndex = 0
    this._render()
    this._list.scrollTop = 0
  }

  _getAllVisible() {
    // Show all non-hidden commands when no query
    return this._commands
      .filter(cmd => !cmd.hidden)
      .map(cmd => ({
        ...cmd,
        active: !cmd.when || cmd.when(this._context),
        score: 0
      }))
  }

  _render() {
    /** @type {HTMLLIElement[]} */
    this._items = []
    this._list.replaceChildren()
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
      li.className = 'palette__item' + (!cmd.active ? ' palette__item--disabled' : '')
      li.setAttribute('role', 'option')
      li.dataset['index'] = String(i)

      const label = document.createElement('span')
      label.className = 'palette__item-label'
      label.setAttribute('part', 'item-label')

      if (cmd.positions && cmd.positions.length > 0) {
        const posSet = new Set(cmd.positions)
        for (let j = 0; j < cmd.label.length; j++) {
          const ch = /** @type {string} */ (cmd.label[j])
          if (posSet.has(j)) {
            const mark = document.createElement('mark')
            mark.className = 'palette__item-label-match'
            mark.setAttribute('part', 'item-label-match')
            mark.textContent = ch
            label.appendChild(mark)
          } else {
            label.appendChild(document.createTextNode(ch))
          }
        }
      } else {
        label.textContent = cmd.label
      }

      li.appendChild(label)

      if (cmd.description) {
        const desc = document.createElement('span')
        desc.className = 'palette__item-description'
        desc.setAttribute('part', 'item-description')
        desc.textContent = cmd.description
        li.appendChild(desc)
      }

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
        if (this._inputMode !== 'pointer') return
        this._setActive(i)
      })

      this._items.push(li)
      this._list.appendChild(li)
    })

    this._setActive(this._activeIndex)
  }

  /** @param {number} index */
  _setActive(index) {
    const prev = this._items[this._activeIndex]
    const next = this._items[index]
    if (prev) {
      prev.classList.remove('palette__item--active')
      prev.setAttribute('part', `item${prev.classList.contains('palette__item--disabled') ? ' item-disabled' : ''}`)
      prev.setAttribute('aria-selected', 'false')
    }
    if (next) {
      next.classList.add('palette__item--active')
      next.setAttribute('part', `item item-active${next.classList.contains('palette__item--disabled') ? ' item-disabled' : ''}`)
      next.setAttribute('aria-selected', 'true')
    }
    this._activeIndex = index
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(this._activeIndex < this._results.length - 1
          ? this._activeIndex + 1 : 0)
        this._scrollToActive()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(this._activeIndex > 0
          ? this._activeIndex - 1 : this._results.length - 1)
        this._scrollToActive()
        break
      case 'Home':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(0)
        this._scrollToActive()
        break
      case 'End':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(this._results.length - 1)
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
    const el = this._items[this._activeIndex]
    if (el) el.scrollIntoView({ block: 'nearest' })
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

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
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

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.cheatsheet__backdrop'))
    /** @type {HTMLElement} */
    this._dialog = /** @type {HTMLElement} */ (shadow.querySelector('.cheatsheet__dialog'))

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

  /**
   * @param {string} name
   * @param {string | null} _oldVal
   * @param {string | null} newVal
   */
  attributeChangedCallback(name, _oldVal, newVal) {
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
    this._dialog.replaceChildren()

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
  if (p === 'scrollup') return 'Scroll \u2191'
  if (p === 'scrolldown') return 'Scroll \u2193'
  if (p === 'scrollleft') return 'Scroll \u2190'
  if (p === 'scrollright') return 'Scroll \u2192'
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
    if (!modSet.has(event.key.toLowerCase())) {
      // Non-modifier key pressed — a shortcut was used, not a bare hold
      if (timer !== null) { clearTimeout(timer); timer = null }
      if (isHeld) { isHeld = false; callback(false) }
      return
    }
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
 * <keybind-settings> - Keybinding settings panel
 *
 * Attributes:
 *   open - Show/hide the settings panel
 *
 * Properties:
 *   store: BindingsStore  - Reactive bindings store
 *   open: boolean         - Show/hide the settings panel
 *
 * Events:
 *   close  - Fired when settings panel is dismissed
 *   change - Fired when a binding is changed (detail: { commandId, keys?, mouse? })
 *   reset  - Fired when bindings are reset (detail: { commandId? })
 *
 * BEM classes:
 *   .settings
 *   .settings__backdrop
 *   .settings__dialog
 *   .settings__header
 *   .settings__title
 *   .settings__reset-all
 *   .settings__group
 *   .settings__group-title
 *   .settings__list
 *   .settings__item
 *   .settings__item-label
 *   .settings__item-bindings
 *   .settings__item-reset
 *   .settings__binding
 *   .settings__binding-keys
 *   .settings__binding-key
 *   .settings__binding-remove
 *   .settings__item-add
 *   .settings__binding--recording
 *   .settings__recording-overlay
 *   .settings__conflict
 */
export class KeybindSettings extends HTMLElement {
  static get observedAttributes() {
    return ['open']
  }

  constructor() {
    super()
    /** @type {BindingsStore<any> | null} */
    this._store = null
    /** @type {((e: Event) => void) | null} */
    this._storeListener = null
    /** @type {{ commandId: string, type: 'keys' | 'mouse', index: number | null } | null} */
    this._recording = null
    /** @type {{ commandId: string, label: string, bindingStr: string, type: 'keys' | 'mouse', index: number | null } | null} */
    this._conflict = null
    /** @type {((e: Event) => void) | null} */
    this._recordKeyHandler = null
    /** @type {((e: Event) => void) | null} */
    this._recordMouseHandler = null
    /** @type {((e: Event) => void) | null} */
    this._recordWheelHandler = null

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .settings__backdrop { position: fixed; inset: 0; }
      </style>
      <div class="settings" part="settings">
        <div class="settings__backdrop" part="backdrop"></div>
        <div class="settings__dialog" part="dialog" role="dialog" aria-modal="true" aria-label="Keybind Settings"></div>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.settings__backdrop'))
    /** @type {HTMLElement} */
    this._dialog = /** @type {HTMLElement} */ (shadow.querySelector('.settings__dialog'))

    this._backdrop.addEventListener('click', () => this._close())
  }

  get store() { return this._store }
  set store(val) {
    // Remove old listener
    if (this._store && this._storeListener) {
      this._store.removeEventListener('change', this._storeListener)
    }
    this._store = val || null
    // Add new listener
    if (this._store) {
      this._storeListener = () => this._render()
      this._store.addEventListener('change', this._storeListener)
    }
    if (this.open) this._render()
  }

  get open() { return this.hasAttribute('open') }
  set open(val) {
    if (val) this.setAttribute('open', '')
    else this.removeAttribute('open')
  }

  /**
   * @param {string} name
   * @param {string | null} _oldVal
   * @param {string | null} newVal
   */
  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'open') {
      if (newVal !== null) {
        this._recording = null
        this._conflict = null
        this._render()
      } else {
        this._stopRecording()
      }
    }
  }

  disconnectedCallback() {
    this._stopRecording()
    if (this._store && this._storeListener) {
      this._store.removeEventListener('change', this._storeListener)
    }
  }

  _close() {
    this._stopRecording()
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  /**
   * Get the effective bindings for a command (overrides merged with schema)
   * @param {string} commandId
   * @returns {{ keys: string[], mouse: string[] }}
   */
  _getBindings(commandId) {
    if (!this._store) return { keys: [], mouse: [] }
    const merged = this._store.get()
    const binding = merged[commandId]
    return {
      keys: binding?.keys ? [...binding.keys] : [],
      mouse: binding?.mouse ? [...binding.mouse] : [],
    }
  }

  /**
   * Save binding changes, cleaning up overrides that match defaults
   * @param {string} commandId
   * @param {{ keys: string[], mouse: string[] }} newBindings
   */
  _saveBindings(commandId, newBindings) {
    if (!this._store) return
    const schema = this._store.schema
    const schemaDef = schema[commandId]
    if (!schemaDef) return

    const overrides = { ...this._store.getOverrides() }

    // Check if new bindings match schema defaults
    const keysMatch = arraysEqual(newBindings.keys, schemaDef.keys || [])
    const mouseMatch = arraysEqual(newBindings.mouse, schemaDef.mouse || [])

    if (keysMatch && mouseMatch) {
      // Matches defaults — remove override entry
      delete overrides[commandId]
    } else {
      overrides[commandId] = {}
      if (!keysMatch) overrides[commandId].keys = newBindings.keys
      if (!mouseMatch) overrides[commandId].mouse = newBindings.mouse
    }

    this._store.save(overrides)
    this.dispatchEvent(new CustomEvent('change', {
      detail: { commandId, keys: newBindings.keys, mouse: newBindings.mouse }
    }))
  }

  /**
   * @param {string} commandId
   * @param {'keys' | 'mouse'} type
   * @param {number | null} index - null for adding, number for replacing
   */
  _startRecording(commandId, type, index) {
    this._stopRecording()
    this._recording = { commandId, type, index }
    this._conflict = null

    /** @param {Event} e */
    const keyHandler = (e) => {
      const event = /** @type {KeyboardEvent} */ (e)
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        this._stopRecording()
        this._render()
        return
      }

      if (this._recording?.type !== 'keys') return

      const bindingStr = eventToBindingString(event)
      if (!bindingStr) return // bare modifier, ignore

      event.preventDefault()
      event.stopPropagation()
      this._handleRecordedBinding(bindingStr)
    }

    /** @param {Event} e */
    const mouseHandler = (e) => {
      if (this._recording?.type !== 'mouse') return

      const event = /** @type {MouseEvent} */ (e)
      const bindingStr = eventToMouseBindingString(event)
      if (!bindingStr) return

      event.preventDefault()
      event.stopPropagation()
      this._handleRecordedBinding(bindingStr)
    }

    /** @param {Event} e */
    const wheelHandler = (e) => {
      if (this._recording?.type !== 'mouse') return

      const event = /** @type {WheelEvent} */ (e)
      const bindingStr = eventToMouseBindingString(event)
      if (!bindingStr) return

      event.preventDefault()
      event.stopPropagation()
      this._handleRecordedBinding(bindingStr)
    }

    this._recordKeyHandler = keyHandler
    this._recordMouseHandler = mouseHandler
    this._recordWheelHandler = wheelHandler

    window.addEventListener('keydown', keyHandler, true)
    window.addEventListener('mousedown', mouseHandler, true)
    window.addEventListener('wheel', wheelHandler, { capture: true })

    this._render()
  }

  _stopRecording() {
    if (this._recordKeyHandler) {
      window.removeEventListener('keydown', this._recordKeyHandler, true)
      this._recordKeyHandler = null
    }
    if (this._recordMouseHandler) {
      window.removeEventListener('mousedown', this._recordMouseHandler, true)
      this._recordMouseHandler = null
    }
    if (this._recordWheelHandler) {
      window.removeEventListener('wheel', this._recordWheelHandler, true)
      this._recordWheelHandler = null
    }
    this._recording = null
    this._conflict = null
  }

  /** @param {string} bindingStr */
  _handleRecordedBinding(bindingStr) {
    if (!this._recording || !this._store) return
    const { commandId, type, index } = this._recording

    // Check for conflict
    const conflict = findConflict(this._store.get(), bindingStr, type, commandId)
    if (conflict) {
      this._conflict = { ...conflict, bindingStr, type, index }
      this._render()
      return
    }

    this._applyBinding(commandId, type, index, bindingStr)
  }

  /**
   * @param {string} commandId
   * @param {'keys' | 'mouse'} type
   * @param {number | null} index
   * @param {string} bindingStr
   */
  _applyBinding(commandId, type, index, bindingStr) {
    const bindings = this._getBindings(commandId)
    if (index !== null) {
      bindings[type][index] = bindingStr
    } else {
      bindings[type].push(bindingStr)
    }
    this._stopRecording()
    this._saveBindings(commandId, bindings)
  }

  _acceptConflict() {
    if (!this._conflict || !this._recording || !this._store) return
    const { commandId: conflictCmdId, bindingStr, type } = this._conflict
    const { commandId, index } = this._recording

    // Remove conflicting binding from the other command
    const conflictBindings = this._getBindings(conflictCmdId)
    try {
      const candidateLookup = type === 'keys' ? keyToLookup(parseKey(bindingStr)) : mouseToLookup(parseMouse(bindingStr))
      conflictBindings[type] = conflictBindings[type].filter(b => {
        try {
          const lookup = type === 'keys' ? keyToLookup(parseKey(b)) : mouseToLookup(parseMouse(b))
          return lookup !== candidateLookup
        } catch { return true }
      })
    } catch {
      // Shouldn't happen since we already validated
    }
    this._saveBindings(conflictCmdId, conflictBindings)

    // Apply the new binding
    this._applyBinding(commandId, type, index, bindingStr)
  }

  _cancelConflict() {
    this._conflict = null
    this._render()
  }

  /**
   * @param {string} commandId
   * @param {'keys' | 'mouse'} type
   * @param {number} index
   */
  _removeBinding(commandId, type, index) {
    const bindings = this._getBindings(commandId)
    bindings[type].splice(index, 1)
    this._saveBindings(commandId, bindings)
  }

  /** @param {string} commandId */
  _resetCommand(commandId) {
    if (!this._store) return
    const overrides = { ...this._store.getOverrides() }
    delete overrides[commandId]
    this._store.save(overrides)
    this.dispatchEvent(new CustomEvent('reset', { detail: { commandId } }))
  }

  _resetAll() {
    if (!this._store) return
    this._store.save({})
    this.dispatchEvent(new CustomEvent('reset', { detail: {} }))
  }

  _render() {
    if (!this._store) {
      this._dialog.replaceChildren()
      return
    }

    const schema = this._store.schema
    const merged = this._store.get()
    this._dialog.replaceChildren()

    // Header
    const header = document.createElement('div')
    header.className = 'settings__header'
    header.setAttribute('part', 'header')

    const title = document.createElement('div')
    title.className = 'settings__title'
    title.setAttribute('part', 'title')
    title.textContent = 'Keyboard Shortcuts'
    header.appendChild(title)

    const resetAll = document.createElement('button')
    resetAll.className = 'settings__reset-all'
    resetAll.setAttribute('part', 'reset-all')
    resetAll.textContent = 'Reset All'
    resetAll.addEventListener('click', () => this._resetAll())
    header.appendChild(resetAll)

    this._dialog.appendChild(header)

    // Group by category
    /** @type {Record<string, Array<{ id: string, label: string }>>} */
    const groups = {}
    for (const [id, val] of Object.entries(schema)) {
      const binding = /** @type {BindingSchema} */ (val)
      if (binding.hidden) continue
      const cat = binding.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({ id, label: binding.label })
    }

    for (const [category, cmds] of Object.entries(groups)) {
      const group = document.createElement('div')
      group.className = 'settings__group'
      group.setAttribute('part', 'group')

      const groupTitle = document.createElement('div')
      groupTitle.className = 'settings__group-title'
      groupTitle.setAttribute('part', 'group-title')
      groupTitle.textContent = category
      group.appendChild(groupTitle)

      const list = document.createElement('ul')
      list.className = 'settings__list'
      list.setAttribute('part', 'list')

      for (const cmd of cmds) {
        const bindings = merged[cmd.id]
        const li = document.createElement('li')
        li.className = 'settings__item'
        li.setAttribute('part', 'item')

        // Label
        const label = document.createElement('span')
        label.className = 'settings__item-label'
        label.setAttribute('part', 'item-label')
        label.textContent = cmd.label
        li.appendChild(label)

        // Bindings container
        const bindingsEl = document.createElement('span')
        bindingsEl.className = 'settings__item-bindings'
        bindingsEl.setAttribute('part', 'item-bindings')

        // Render key bindings
        if (bindings?.keys) {
          for (let i = 0; i < bindings.keys.length; i++) {
            const key = /** @type {string} */ (bindings.keys[i])
            bindingsEl.appendChild(this._renderBinding(cmd.id, 'keys', i, key))
          }
        }

        // Render mouse bindings
        if (bindings?.mouse) {
          for (let i = 0; i < bindings.mouse.length; i++) {
            const mouse = /** @type {string} */ (bindings.mouse[i])
            bindingsEl.appendChild(this._renderBinding(cmd.id, 'mouse', i, mouse))
          }
        }

        // Check if recording for this command (add mode)
        const isRecordingAdd = this._recording &&
          this._recording.commandId === cmd.id &&
          this._recording.index === null

        if (isRecordingAdd) {
          const overlay = document.createElement('span')
          overlay.className = 'settings__binding settings__binding--recording'
          overlay.setAttribute('part', 'binding binding-recording')
          const recordingText = document.createElement('span')
          recordingText.className = 'settings__recording-overlay'
          recordingText.setAttribute('part', 'recording-overlay')
          recordingText.textContent = this._recording?.type === 'keys' ? 'Press a key...' : 'Click or scroll...'
          overlay.appendChild(recordingText)
          bindingsEl.appendChild(overlay)

          // Show conflict if any
          if (this._conflict) {
            bindingsEl.appendChild(this._renderConflict())
          }
        }

        // Add button (dropdown for key/mouse)
        if (!this._recording) {
          const addBtn = document.createElement('span')
          addBtn.className = 'settings__item-add'
          addBtn.setAttribute('part', 'item-add')

          const addKeyBtn = document.createElement('button')
          addKeyBtn.setAttribute('part', 'add-key')
          addKeyBtn.textContent = '+ Key'
          addKeyBtn.addEventListener('click', () => this._startRecording(cmd.id, 'keys', null))
          addBtn.appendChild(addKeyBtn)

          const addMouseBtn = document.createElement('button')
          addMouseBtn.setAttribute('part', 'add-mouse')
          addMouseBtn.textContent = '+ Mouse'
          addMouseBtn.addEventListener('click', () => this._startRecording(cmd.id, 'mouse', null))
          addBtn.appendChild(addMouseBtn)

          bindingsEl.appendChild(addBtn)
        }

        li.appendChild(bindingsEl)

        // Reset button
        const resetBtn = document.createElement('button')
        resetBtn.className = 'settings__item-reset'
        resetBtn.setAttribute('part', 'item-reset')
        resetBtn.textContent = 'Reset'
        resetBtn.addEventListener('click', () => this._resetCommand(cmd.id))
        li.appendChild(resetBtn)

        list.appendChild(li)
      }

      group.appendChild(list)
      this._dialog.appendChild(group)
    }
  }

  /**
   * @param {string} commandId
   * @param {'keys' | 'mouse'} type
   * @param {number} index
   * @param {string} bindingStr
   * @returns {HTMLElement}
   */
  _renderBinding(commandId, type, index, bindingStr) {
    const isRecording = this._recording &&
      this._recording.commandId === commandId &&
      this._recording.type === type &&
      this._recording.index === index

    if (isRecording) {
      const wrapper = document.createElement('span')
      wrapper.className = 'settings__binding settings__binding--recording'
      wrapper.setAttribute('part', 'binding binding-recording')
      const overlay = document.createElement('span')
      overlay.className = 'settings__recording-overlay'
      overlay.setAttribute('part', 'recording-overlay')
      overlay.textContent = type === 'keys' ? 'Press a key...' : 'Click or scroll...'
      wrapper.appendChild(overlay)

      if (this._conflict) {
        wrapper.appendChild(this._renderConflict())
      }

      return wrapper
    }

    const binding = document.createElement('span')
    binding.className = 'settings__binding'
    binding.setAttribute('part', 'binding')

    const keysContainer = document.createElement('span')
    keysContainer.className = 'settings__binding-keys'
    keysContainer.setAttribute('part', 'binding-keys')

    const parts = type === 'keys' ? formatKeyParts(bindingStr) : formatMouseParts(bindingStr)
    for (const part of parts) {
      const kbd = document.createElement('kbd')
      kbd.className = 'settings__binding-key'
      kbd.setAttribute('part', 'binding-key')
      kbd.textContent = part
      keysContainer.appendChild(kbd)
    }
    keysContainer.addEventListener('click', () => this._startRecording(commandId, type, index))
    binding.appendChild(keysContainer)

    const removeBtn = document.createElement('button')
    removeBtn.className = 'settings__binding-remove'
    removeBtn.setAttribute('part', 'binding-remove')
    removeBtn.textContent = '\u00d7'
    removeBtn.addEventListener('click', () => this._removeBinding(commandId, type, index))
    binding.appendChild(removeBtn)

    return binding
  }

  /** @returns {HTMLElement} */
  _renderConflict() {
    const conflict = /** @type {NonNullable<typeof this._conflict>} */ (this._conflict)
    const conflictEl = document.createElement('span')
    conflictEl.className = 'settings__conflict'
    conflictEl.setAttribute('part', 'conflict')
    conflictEl.textContent = `Already bound to "${conflict.label}". `

    const acceptBtn = document.createElement('button')
    acceptBtn.setAttribute('part', 'conflict-accept')
    acceptBtn.textContent = 'Replace'
    acceptBtn.addEventListener('click', () => this._acceptConflict())
    conflictEl.appendChild(acceptBtn)

    const cancelBtn = document.createElement('button')
    cancelBtn.setAttribute('part', 'conflict-cancel')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => this._cancelConflict())
    conflictEl.appendChild(cancelBtn)

    return conflictEl
  }
}

/**
 * Check if two string arrays are equal
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

/**
 * <context-menu> - Context menu driven by commands
 *
 * Attributes:
 *   open         - Show/hide the menu
 *   auto-trigger - Wire contextmenu event on target element
 *   menu         - Menu tag to filter commands by
 *   target       - CSS selector for contextmenu target (defaults to parentElement)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   open: boolean           - Show/hide the menu
 *   menu: string            - Menu tag to filter by
 *   position: { x: number, y: number } - Menu position
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * BEM classes:
 *   .context-menu
 *   .context-menu__backdrop
 *   .context-menu__list
 *   .context-menu__separator
 *   .context-menu__item
 *   .context-menu__item--disabled
 *   .context-menu__item--active
 *   .context-menu__item-label
 *   .context-menu__item-keys
 *   .context-menu__item-key
 */
export class ContextMenu extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'auto-trigger', 'menu', 'target']
  }

  constructor() {
    super()
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {string} */
    this._menu = ''
    /** @type {{ x: number, y: number }} */
    this._position = { x: 0, y: 0 }
    /** @type {(Command & { active: boolean })[]} */
    this._items = []
    /** @type {number} */
    this._activeIndex = -1
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'pointer'
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null
    /** @type {((e: Event) => void) | null} */
    this._keyHandler = null

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .context-menu__backdrop { position: fixed; inset: 0; }
      </style>
      <div class="context-menu" part="context-menu">
        <div class="context-menu__backdrop" part="backdrop"></div>
        <ul class="context-menu__list" part="list" role="menu"></ul>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__backdrop'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__list'))

    this._backdrop.addEventListener('click', () => this._close())
    this._backdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this._close()
    })
    this._list.addEventListener('mousemove', () => { this._inputMode = 'pointer' })
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._buildItems()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._buildItems()
  }

  get menu() { return this._menu }
  set menu(val) {
    this._menu = val || ''
    if (this.open) this._buildItems()
  }

  get open() { return this.hasAttribute('open') }
  set open(val) {
    if (val) this.setAttribute('open', '')
    else this.removeAttribute('open')
  }

  get position() { return this._position }
  set position(val) {
    this._position = val || { x: 0, y: 0 }
    if (this.open) this._updatePosition()
  }

  /**
   * @param {string} name
   * @param {string | null} _oldVal
   * @param {string | null} newVal
   */
  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'open') {
      if (newVal !== null) this._onOpen()
      else this._onClose()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    } else if (name === 'menu') {
      this._menu = newVal || ''
      if (this.open) this._buildItems()
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

    /** @param {Event} e */
    const handler = (e) => {
      const event = /** @type {MouseEvent} */ (e)
      event.preventDefault()
      this._position = { x: event.clientX, y: event.clientY }
      this._buildItems()
      this.open = true
    }

    const selector = this.getAttribute('target')
    const target = selector ? document.querySelector(selector) : this.parentElement
    if (!target) return

    target.addEventListener('contextmenu', handler)
    this._cleanupTrigger = () => target.removeEventListener('contextmenu', handler)
  }

  _onOpen() {
    this._activeIndex = -1
    this._inputMode = 'pointer'
    this._buildItems()
    this._updatePosition()
    /** @type {(e: Event) => void} */
    const handler = (e) => this._handleKey(/** @type {KeyboardEvent} */ (e))
    this._keyHandler = handler
    const shadow = /** @type {ShadowRoot} */ (this.shadowRoot)
    shadow.addEventListener('keydown', handler)
    requestAnimationFrame(() => this._list.focus())
  }

  _onClose() {
    if (this._keyHandler) {
      const shadow = /** @type {ShadowRoot} */ (this.shadowRoot)
      shadow.removeEventListener('keydown', this._keyHandler)
      this._keyHandler = null
    }
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _buildItems() {
    this._items = this._menu
      ? filterByMenu(this._commands, this._menu, this._context)
      : this._commands
          .filter(cmd => !cmd.hidden)
          .map(cmd => ({ ...cmd, active: isActive(cmd, this._context) }))
    this._render()
  }

  _updatePosition() {
    const { x, y } = this._position
    const list = this._list
    list.style.position = 'fixed'
    list.style.left = `${x}px`
    list.style.top = `${y}px`

    // Defer clamping to after render
    requestAnimationFrame(() => {
      const rect = list.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (rect.right > vw) list.style.left = `${Math.max(0, vw - rect.width)}px`
      if (rect.bottom > vh) list.style.top = `${Math.max(0, vh - rect.height)}px`
    })
  }

  _render() {
    this._list.replaceChildren()
    this._list.setAttribute('tabindex', '0')

    let lastCategory = null
    for (let i = 0; i < this._items.length; i++) {
      const cmd = /** @type {Command & { active: boolean }} */ (this._items[i])

      // Category separator
      const cat = cmd.category || null
      if (cat !== lastCategory && lastCategory !== null) {
        const sep = document.createElement('li')
        sep.className = 'context-menu__separator'
        sep.setAttribute('part', 'separator')
        sep.setAttribute('role', 'separator')
        this._list.appendChild(sep)
      }
      lastCategory = cat

      const li = document.createElement('li')
      li.className = 'context-menu__item'
      if (i === this._activeIndex) li.className += ' context-menu__item--active'
      if (!cmd.active) li.className += ' context-menu__item--disabled'
      li.setAttribute('part', `item${i === this._activeIndex ? ' item-active' : ''}${!cmd.active ? ' item-disabled' : ''}`)
      li.setAttribute('role', 'menuitem')
      li.dataset['index'] = String(i)

      const label = document.createElement('span')
      label.className = 'context-menu__item-label'
      label.setAttribute('part', 'item-label')
      label.textContent = cmd.label
      li.appendChild(label)

      if (cmd.keys && cmd.keys[0]) {
        const keyContainer = document.createElement('span')
        keyContainer.className = 'context-menu__item-keys'
        keyContainer.setAttribute('part', 'item-keys')
        for (const part of formatKeyParts(cmd.keys[0])) {
          const kbd = document.createElement('kbd')
          kbd.className = 'context-menu__item-key'
          kbd.setAttribute('part', 'item-key')
          kbd.textContent = part
          keyContainer.appendChild(kbd)
        }
        li.appendChild(keyContainer)
      }

      li.addEventListener('click', () => this._execute(i))
      li.addEventListener('mouseenter', () => {
        if (this._inputMode !== 'pointer') return
        this._activeIndex = i
        this._render()
      })

      this._list.appendChild(li)
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex < this._items.length - 1
          ? this._activeIndex + 1 : 0
        this._render()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex > 0
          ? this._activeIndex - 1 : this._items.length - 1
        this._render()
        break
      case 'Home':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = 0
        this._render()
        break
      case 'End':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._items.length - 1
        this._render()
        break
      case 'Enter':
        e.preventDefault()
        if (this._activeIndex >= 0) this._execute(this._activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        this._close()
        break
    }
  }

  /** @param {number} index */
  _execute(index) {
    const cmd = this._items[index]
    if (!cmd || !cmd.active) return

    this._close()
    executeCommand(this._commands, cmd.id, this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
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
  if (!customElements.get('context-menu')) {
    customElements.define('context-menu', ContextMenu)
  }
  if (!customElements.get('keybind-settings')) {
    customElements.define('keybind-settings', KeybindSettings)
  }
}

export default keybinds
