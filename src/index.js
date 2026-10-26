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
 * @property {boolean} release - Binding fires when the key comes up ("k:up")
 */

/**
 * @typedef {Object} ParsedMouse
 * @property {Modifiers} mods
 * @property {number} button - Index into BUTTON_NAMES
 * @property {boolean} release - Binding fires when the button comes up ("middle:up")
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
 * @property {number | undefined} [rank] - Where it's listed among matches, before relevance: higher first (default 0)
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
 * Marks a component with its kind, so styles and overlay checks work whatever tag name it was
 * registered under.
 * @param {HTMLElement} el
 * @param {string} kind
 */
function markKind(el, kind) {
  if (!el.hasAttribute('data-keybinds')) el.setAttribute('data-keybinds', kind)
}

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

// Alias key names, resolved to the name a real key event reports
const KEY_ALIASES = /** @type {Record<string, string>} */ ({
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  // "+" separates the parts of a binding, so the key itself is written "plus"
  plus: '+'
})

// Punctuation keys, and the name of the physical key that types each on a US layout (event.code)
const PUNCTUATION_CODES = /** @type {Record<string, string>} */ ({
  '[': 'bracketleft', ']': 'bracketright', '\\': 'backslash', ';': 'semicolon', "'": 'quote',
  ',': 'comma', '.': 'period', '/': 'slash', '`': 'backquote', '-': 'minus', '=': 'equal'
})

// How a physical key name is shown: the character it types on a US layout
const CODE_GLYPHS = /** @type {Record<string, string>} */ ({
  ...Object.fromEntries(Object.entries(PUNCTUATION_CODES).map(([ch, code]) => [code, ch])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, d) => [`digit${d}`, String(d)])),
  plus: '+'
})

/**
 * A single printable character that isn't a letter ("?", "!", "+", "é" is a letter).
 * Shift is part of typing these, so a binding to one matches however it was typed.
 * @param {string} key
 * @returns {boolean}
 */
function isSymbolKey(key) {
  return [...key].length === 1 && key.trim() !== '' && key.toLowerCase() === key.toUpperCase() && !/[0-9]/.test(key)
}

/**
 * Any single printable character can be bound, in addition to the named keys.
 * @param {string} key
 * @returns {boolean}
 */
function isValidKey(key) {
  return VALID_KEYS.has(key) || ([...key].length === 1 && key.trim() !== '')
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
  'comma', 'period', 'slash', 'backquote', 'minus', 'equal',
  'digit0', 'digit1', 'digit2', 'digit3', 'digit4', 'digit5', 'digit6', 'digit7', 'digit8', 'digit9'
])

const VALID_MOUSE = new Set([
  'click', 'leftclick', 'left',
  'rightclick', 'right',
  'middleclick', 'middle',
  'backclick', 'back',
  'forwardclick', 'forward',
  'scrollup', 'scrolldown', 'scrollleft', 'scrollright'
])

const RELEASE_SUFFIX = ':up'

/**
 * Split a lowercase binding into its press/release flag and the rest.
 * A trailing ":up" marks a release binding.
 * @param {string} lower
 * @returns {{ body: string, release: boolean }}
 */
function splitRelease(lower) {
  const trimmed = lower.trim()
  if (trimmed.endsWith(RELEASE_SUFFIX)) {
    return { body: trimmed.slice(0, -RELEASE_SUFFIX.length), release: true }
  }
  return { body: trimmed, release: false }
}

/**
 * Parse a key string like "Ctrl+Shift+K" or "K:up" into normalized form
 * @param {string} keyStr
 * @returns {ParsedKey}
 * @throws {Error} if key binding is invalid
 */
function parseKey(keyStr) {
  if (!keyStr || typeof keyStr !== 'string') {
    throw new Error(`Invalid key binding: ${keyStr}`)
  }

  const { body, release } = splitRelease(keyStr.toLowerCase())
  const parts = body.split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error(`Empty key binding: "${keyStr}"`)
  }

  const { mods, remaining } = parseMods(parts)

  const rawKey = remaining[0]
  if (rawKey === undefined) {
    throw new Error(`Key binding has no key (only modifiers): "${keyStr}"`)
  }
  let key = KEY_ALIASES[rawKey] ?? rawKey
  if (remaining.length > 1) {
    throw new Error(`Key binding has multiple keys: "${keyStr}" (got: ${remaining.join(', ')})`)
  }
  if (!isValidKey(key)) {
    throw new Error(`Unknown key "${rawKey}" in binding "${keyStr}"`)
  }
  // With Shift held, a punctuation or digit key types a different character ("shift+/" types "?"),
  // so the binding means the physical key: "shift+slash", "shift+digit1".
  if (mods.shift) {
    const code = PUNCTUATION_CODES[key] ?? (/^[0-9]$/.test(key) ? `digit${key}` : undefined)
    if (code) key = code
  }

  return { mods, key, release }
}

/**
 * Parse a mouse binding like "$mod+Click", "MiddleClick" or "Back:up"
 * Supported: Click/LeftClick, RightClick, MiddleClick, BackClick, ForwardClick, Scroll{Up,Down,Left,Right}
 * A trailing ":up" binds the button's release.
 * @param {string} binding
 * @returns {ParsedMouse}
 * @throws {Error} if mouse binding is invalid
 */
function parseMouse(binding) {
  if (!binding || typeof binding !== 'string') {
    throw new Error(`Invalid mouse binding: ${binding}`)
  }

  const { body, release } = splitRelease(binding.toLowerCase())
  const parts = body.split('+').map(p => p.trim()).filter(Boolean)
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
    throw new Error(`Unknown mouse button "${btn}" in binding "${binding}". Valid: Click, RightClick, MiddleClick, BackClick, ForwardClick, ScrollUp, ScrollDown, ScrollLeft, ScrollRight`)
  }

  if (release && btn.startsWith('scroll')) {
    throw new Error(`Scroll has no release: "${binding}"`)
  }

  let button = 0 // left
  if (btn === 'rightclick' || btn === 'right') button = 2
  else if (btn === 'middleclick' || btn === 'middle') button = 1
  else if (btn === 'backclick' || btn === 'back') button = 3
  else if (btn === 'forwardclick' || btn === 'forward') button = 4
  else if (btn === 'scrollup') button = 5
  else if (btn === 'scrolldown') button = 6
  else if (btn === 'scrollleft') button = 7
  else if (btn === 'scrollright') button = 8

  return { mods, button, release }
}

// Indexed by parseMouse's button; the first five line up with MouseEvent.button
const BUTTON_NAMES = ['click', 'middle', 'right', 'back', 'forward', 'scrollup', 'scrolldown', 'scrollleft', 'scrollright']
const POINTER_BUTTON_COUNT = 5

/**
 * Back (3) and forward (4) buttons, which browsers bind to history navigation
 * @param {number} button
 * @returns {boolean}
 */
function isSideButton(button) {
  return button === 3 || button === 4
}

/**
 * Binding name for a MouseEvent.button value, null for buttons with no name
 * @param {number} button
 * @returns {string | null}
 */
function pointerButtonName(button) {
  if (!Number.isInteger(button) || button < 0 || button >= POINTER_BUTTON_COUNT) return null
  return BUTTON_NAMES[button] ?? null
}

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
  return `${modsToPrefix(parsed.mods)}${parsed.key}${parsed.release ? RELEASE_SUFFIX : ''}`
}

/**
 * Modifier prefix of an event
 * @param {KeyboardEvent | MouseEvent} event
 * @returns {string}
 */
function eventPrefix(event) {
  return modsToPrefix({
    ctrl: event.ctrlKey,
    alt: event.altKey,
    shift: event.shiftKey,
    meta: event.metaKey
  })
}

/**
 * Convert keyboard event to lookup keys (returns multiple for key/code variants)
 * @param {KeyboardEvent} event
 * @param {string} [prefix] - Modifier prefix to use instead of the event's own
 * @param {string} [suffix] - Appended to every lookup (e.g. ":up")
 * @returns {string[]}
 */
function eventToKeyLookups(event, prefix = eventPrefix(event), suffix = '') {
  const key = event.key.toLowerCase()
  const code = event.code.toLowerCase()
  const codeKey = code.startsWith('key') ? code.slice(3) : null

  const lookups = [`${prefix}${key}${suffix}`]
  if (code !== key) lookups.push(`${prefix}${code}${suffix}`)
  if (codeKey && codeKey !== key) lookups.push(`${prefix}${codeKey}${suffix}`)
  // "?" is bound as "?", but typing it takes Shift on most layouts
  if (isSymbolKey(key) && prefix.includes('shift+')) lookups.push(`${prefix.replace('shift+', '')}${key}${suffix}`)
  return lookups
}

/**
 * Convert parsed mouse binding to lookup key (e.g., "ctrl+click", "middle")
 * @param {ParsedMouse} parsed
 * @returns {string}
 */
function mouseToLookup(parsed) {
  return `${modsToPrefix(parsed.mods)}${BUTTON_NAMES[parsed.button]}${parsed.release ? RELEASE_SUFFIX : ''}`
}

/**
 * Convert mouse event to lookup key. Null for buttons with no binding name.
 * @param {MouseEvent} event
 * @param {string} [prefix] - Modifier prefix to use instead of the event's own
 * @param {string} [suffix] - Appended to the lookup (e.g. ":up")
 * @returns {string | null}
 */
function eventToMouseLookup(event, prefix = eventPrefix(event), suffix = '') {
  const name = pointerButtonName(event.button)
  if (!name) return null
  return `${prefix}${name}${suffix}`
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
 * @typedef {Object} KeybindsOptions
 * @property {EventTarget} [target] - Where to listen (default: window)
 * @property {(cmd: Command, ctx: Record<string, unknown>) => void} [onExecute] - Called after a command consumes an event
 * @property {boolean} [capture] - Listen in the capture phase, so a bound key reaches its command before
 *   anything under the target (an editor, say) handles it. A command that isn't active, or returns false,
 *   leaves the event alone.
 * @property {{ step?: number, idle?: number }} [wheel] - Scroll bindings: a command runs once per `step`
 *   pixels scrolled (default 50, about one mouse-wheel notch; a trackpad's small deltas add up to it),
 *   and a pause of `idle` ms (default 200) starts a new gesture.
 */

/**
 * Elements whose own keyboard handling takes over while they're open
 * @param {Element | null} tgt
 * @returns {boolean}
 */
function overlayOpen(tgt) {
  return !!tgt?.closest?.('[data-keybinds="command-palette"][open], [data-keybinds="settings"][open], [data-keybinds="context-menu"][open], [data-keybinds="basic-context-menu"][open]')
}

/**
 * Distance a wheel event scrolls along its main axis, in pixels
 * @param {WheelEvent} event
 * @returns {number}
 */
function wheelDistance(event) {
  const d = Math.abs(event.deltaY || event.deltaX)
  if (event.deltaMode === 1) return d * 16
  if (event.deltaMode === 2) return d * (typeof window !== 'undefined' ? window.innerHeight : 800)
  return d
}

/**
 * Create keybind handler
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {() => Record<string, unknown>} [getContext] - Returns current context state
 * @param {KeybindsOptions} [options] - Options
 *
 * Command shape:
 *   id: string           - unique identifier
 *   label: string        - display name
 *   category?: string    - group for command palette
 *   keys?: string[]      - keyboard triggers (e.g., ['$mod+k', 'Escape']); "k:up" binds the release
 *   mouse?: string[]     - mouse triggers (e.g., ['$mod+Click', 'MiddleClick', 'Back:up'])
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
  const { target = window, onExecute, capture = false } = options
  const { step: WHEEL_STEP = 50, idle: WHEEL_IDLE = 200 } = options.wheel ?? {}

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

  /**
   * A held input. `prefix` is the modifier state at press time, which release
   * bindings match against; `fired` holds the commands whose press executed.
   * @typedef {{ prefix: string, fired: Set<Command> }} Press
   */
  /** @type {Map<string, Press>} */
  const keyPresses = new Map()
  /** @type {Map<number, Press>} */
  const mousePresses = new Map()
  /** Side buttons whose press or release was consumed; their auxclick is cancelled too */
  /** @type {Set<number>} */
  const swallowAux = new Set()

  /**
   * Run a release's candidates. Commands whose own press fired always run (a
   * hold can't be left open); the rest run subject to the usual checks until one consumes.
   * @param {Command[]} candidates
   * @param {Press} press
   * @param {KeyboardEvent | MouseEvent} event
   * @param {boolean} blocked
   * @param {boolean} inInput
   * @returns {boolean} whether any command consumed the release
   */
  function runRelease(candidates, press, event, blocked, inInput) {
    const context = getContext()
    let consumed = false
    for (const cmd of candidates) {
      if (press.fired.has(cmd)) {
        if (tryExecute(cmd, context, event)) consumed = true
        continue
      }
      if (consumed || blocked) continue
      if (inInput && !cmd.captureInput) continue
      if (!isActive(cmd, context)) continue
      if (tryExecute(cmd, context, event)) consumed = true
    }
    return consumed
  }

  /** @param {Event} e */
  function handleKeyDown(e) {
    const event = /** @type {KeyboardEvent} */ (e)
    const tgt = /** @type {Element | null} */ (event.target)

    // Don't fire keybinds while the command palette or settings panel is open
    if (overlayOpen(tgt)) return

    // Don't capture when typing in inputs (unless command explicitly allows it)
    const inInput = tgt?.tagName === 'INPUT' ||
                    tgt?.tagName === 'TEXTAREA' ||
                    (tgt instanceof HTMLElement && tgt.isContentEditable)

    const id = event.code || event.key
    let press = keyPresses.get(id)
    if (!press || !event.repeat) {
      press = { prefix: eventPrefix(event), fired: new Set() }
      keyPresses.set(id, press)
    }

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
      if (tryExecute(cmd, context, event)) {
        press.fired.add(cmd)
        return
      }
    }
  }

  /** @param {Event} e */
  function handleKeyUp(e) {
    const event = /** @type {KeyboardEvent} */ (e)
    const id = event.code || event.key
    const press = keyPresses.get(id)
    if (!press) return
    keyPresses.delete(id)

    const tgt = /** @type {Element | null} */ (event.target)
    const inInput = tgt?.tagName === 'INPUT' ||
                    tgt?.tagName === 'TEXTAREA' ||
                    (tgt instanceof HTMLElement && tgt.isContentEditable)

    /** @type {Command[] | undefined} */
    let candidates
    for (const l of eventToKeyLookups(event, press.prefix, RELEASE_SUFFIX)) {
      candidates = lookup.keys.get(l)
      if (candidates) break
    }
    if (!candidates) return
    runRelease(candidates, press, event, overlayOpen(tgt), inInput)
  }

  /** @param {Event} e */
  function handleMouseDown(e) {
    const event = /** @type {MouseEvent} */ (e)

    // Don't fire keybinds while the command palette or settings panel is open
    if (overlayOpen(/** @type {Element | null} */ (event.target))) return

    const lookupKey = eventToMouseLookup(event)
    if (!lookupKey) return

    /** @type {Press} */
    const press = { prefix: eventPrefix(event), fired: new Set() }
    mousePresses.set(event.button, press)
    swallowAux.delete(event.button)

    // O(1) lookup
    const candidates = lookup.mouse.get(lookupKey)
    if (!candidates) return

    const context = getContext()
    for (const cmd of candidates) {
      if (!isActive(cmd, context)) continue
      if (tryExecute(cmd, context, event)) {
        press.fired.add(cmd)
        if (isSideButton(event.button)) swallowAux.add(event.button)
        return
      }
    }
  }

  /** @param {Event} e */
  function handleMouseUp(e) {
    const event = /** @type {MouseEvent} */ (e)
    const press = mousePresses.get(event.button)
    if (!press) return
    mousePresses.delete(event.button)

    let consumed = false
    const lookupKey = eventToMouseLookup(event, press.prefix, RELEASE_SUFFIX)
    const candidates = lookupKey ? lookup.mouse.get(lookupKey) : undefined
    if (candidates) {
      const tgt = /** @type {Element | null} */ (event.target)
      consumed = runRelease(candidates, press, event, overlayOpen(tgt), false)
    }

    // Browsers navigate on a side button's mouseup/auxclick, so cancel both while bound
    if (isSideButton(event.button) && (consumed || press.fired.size > 0)) {
      event.preventDefault()
      swallowAux.add(event.button)
    }
  }

  /** @param {Event} e */
  function handleAuxClick(e) {
    const event = /** @type {MouseEvent} */ (e)
    if (!swallowAux.delete(event.button)) return
    event.preventDefault()
  }

  /**
   * A scroll gesture on one binding: how far it has scrolled since the last step, when it was last
   * moved, and whether its commands are taking it (if one returned false, the page scrolls instead).
   * @typedef {{ amount: number, last: number, ours: boolean }} Gesture
   */
  /** @type {Map<string, Gesture>} */
  const gestures = new Map()

  /** @param {Event} e */
  function handleWheel(e) {
    const event = /** @type {WheelEvent} */ (e)
    if (overlayOpen(/** @type {Element | null} */ (event.target))) return

    const lookupKey = eventToWheelLookup(event)
    if (!lookupKey) return
    const candidates = lookup.mouse.get(lookupKey)
    if (!candidates) return
    const context = getContext()
    const active = candidates.filter((cmd) => isActive(cmd, context))
    if (active.length === 0) return

    const now = performance.now()
    let gesture = gestures.get(lookupKey)
    if (!gesture || now - gesture.last > WHEEL_IDLE) {
      gesture = { amount: 0, last: now, ours: true }
      gestures.set(lookupKey, gesture)
    }
    gesture.last = now
    if (!gesture.ours) return
    // Between steps the gesture is still the command's: the page mustn't scroll or zoom meanwhile
    event.preventDefault()
    gesture.amount += wheelDistance(event)
    if (gesture.amount < WHEEL_STEP) return
    // One step per event, so a fast flick doesn't queue up a burst
    gesture.amount = Math.min(gesture.amount - WHEEL_STEP, WHEEL_STEP)
    for (const cmd of active) {
      if (tryExecute(cmd, context, event)) return
    }
    gesture.ours = false
  }

  const opts = { capture }
  target.addEventListener('keydown', handleKeyDown, opts)
  target.addEventListener('keyup', handleKeyUp, opts)
  target.addEventListener('mousedown', handleMouseDown, opts)
  target.addEventListener('mouseup', handleMouseUp, opts)
  target.addEventListener('auxclick', handleAuxClick, opts)
  target.addEventListener('wheel', handleWheel, { capture, passive: false })

  // Return cleanup function
  return () => {
    target.removeEventListener('keydown', handleKeyDown, opts)
    target.removeEventListener('keyup', handleKeyUp, opts)
    target.removeEventListener('mousedown', handleMouseDown, opts)
    target.removeEventListener('mouseup', handleMouseUp, opts)
    target.removeEventListener('auxclick', handleAuxClick, opts)
    target.removeEventListener('wheel', handleWheel, opts)
    gestures.clear()
    keyPresses.clear()
    mousePresses.clear()
    swallowAux.clear()
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

    // A description or category is found by the words as typed: letters scattered through a
    // sentence match almost anything.
    const match = matcher(query, cmd.label)
      ?? matcher(query, cmd.id)
      ?? (cmd.description ? simpleMatcher(query, cmd.description) : null)
      ?? (cmd.category ? simpleMatcher(query, cmd.category) : null)

    if (!match) continue

    /** @type {ScoredCommand} */
    const scored = { ...cmd, active: isActive(cmd, context), score: match.score }
    if (match.positions) scored.positions = match.positions
    results.push(scored)
  }

  return results.sort(byRelevance)
}

/**
 * Active first, then by rank, then by score.
 * @param {ScoredCommand} a
 * @param {ScoredCommand} b
 */
function byRelevance(a, b) {
  if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0)
  if ((a.rank ?? 0) !== (b.rank ?? 0)) return (b.rank ?? 0) - (a.rank ?? 0)
  return b.score - a.score
}

/**
 * Search commands for command palette (defaults to fuzzy matching)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} [context] - Current context
 * @param {SearchOptions} [options] - Search options (e.g., custom matcher, scorer)
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export function searchCommands(commands, query, context = {}, options = {}) {
  const results = matchCommands(commands, query, context, options.matcher ?? fuzzyMatcher)
  if (!options.scorer) return results
  const scorer = options.scorer
  for (const cmd of results) {
    cmd.score += scorer(cmd, context)
  }
  return results.sort(byRelevance)
}

/**
 * Default scorer — combines specificity and frecency.
 *
 * Specificity: commands with a `when` condition score higher (score 2 if
 * `when(ctx)` is true, score 1 for commands with no condition).
 *
 * Frecency: if history entries are supplied, recently-executed commands
 * receive an additive boost:
 *   - within last 60 s  → +3
 *   - within last 5 min → +2
 *   - within last 30 min → +1
 *
 * @param {HistoryEntry[]} [history]
 * @returns {Scorer}
 */
export function defaultScorer(history) {
  return (command, context) => {
    // Specificity
    let score = command.when
      ? (command.when(/** @type {Record<string, unknown>} */ (context)) ? 2 : 0)
      : 1

    if (score === 0) return 0  // when present but false — exclude

    // Frecency
    if (history && history.length > 0) {
      const now = Date.now()
      let best = 0
      for (const entry of history) {
        if (entry.id !== command.id) continue
        const age = now - entry.timestamp
        if (age <= 60_000 && best < 3) best = 3
        else if (age <= 300_000 && best < 2) best = 2
        else if (age <= 1_800_000 && best < 1) best = 1
      }
      score += best
    }

    return score
  }
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
  return CODE_GLYPHS[p] ?? part.toUpperCase()
}

/**
 * Format key binding into array of display parts (e.g., "$mod+k" -> ["⌘", "K"] on Mac)
 * @param {string} key
 * @returns {string[]}
 */
export function formatKeyParts(key) {
  return formatWithRelease(key, formatKeyPart)
}

/**
 * Format a binding's parts, adding a trailing "Release" part for ":up" bindings
 * @param {string} binding
 * @param {(part: string) => string} formatPart
 * @returns {string[]}
 */
function formatWithRelease(binding, formatPart) {
  const { body, release } = splitRelease(binding.toLowerCase())
  const source = release ? binding.trim().slice(0, body.length) : binding
  const parts = source.split('+').map(formatPart)
  if (release) parts.push('Release')
  return parts
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
  // Declared as fields so they appear in the generated type declarations
  /** @type {T} */ schema
  /** @type {string} */ storageKey
  /** @type {BindingOverrides} */ overrides
  /** @type {T} */ bindings

  /**
   * @param {T} schema - Default bindings schema
   * @param {string} storageKey - localStorage key
   */
  constructor(schema, storageKey) {
    super()
    this.schema = schema
    this.storageKey = storageKey
    this.overrides = this.loadOverrides()
    this.bindings = /** @type {T} */ (mergeBindings(schema, this.overrides))
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
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(newOverrides))
    } catch {
      // Storage can be unavailable (private browsing, full); the overrides still apply until reload
    }
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
  // The query as typed, whole, counts for more than its letters scattered: at a word's start most.
  const whole = t.indexOf(q)
  if (whole >= 0) score += whole === 0 || ' -_'.includes(/** @type {string} */ (t[whole - 1])) ? 20 : 10

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
  const suffix = event.type === 'keyup' ? RELEASE_SUFFIX : ''

  // Ignore bare modifier presses
  if (['shift', 'control', 'alt', 'meta'].includes(key)) return null

  // Normalize key name — prefer event.key, fall back to event.code
  let normalizedKey = key === ' ' ? 'space' : key === '+' ? 'plus' : key
  const code = event.code.toLowerCase()
  if (code.startsWith('key')) {
    const codeKey = code.slice(3)
    if (VALID_KEYS.has(codeKey) && !VALID_KEYS.has(key)) normalizedKey = codeKey
  }

  if (!isValidKey(KEY_ALIASES[normalizedKey] ?? normalizedKey)) return null
  // A symbol is recorded as the character typed ("?"), which already says Shift was needed
  const shift = event.shiftKey && !isSymbolKey(KEY_ALIASES[normalizedKey] ?? normalizedKey)

  // Build modifier prefix using $mod for the platform modifier
  const parts = []
  const hasPlatformMod = isMac ? event.metaKey : event.ctrlKey
  const hasNonPlatformMod = isMac ? event.ctrlKey : event.metaKey

  if (hasPlatformMod) parts.push('$mod')
  if (hasNonPlatformMod) parts.push(isMac ? 'ctrl' : 'meta')
  if (event.altKey) parts.push('alt')
  if (shift) parts.push('shift')
  parts.push(normalizedKey)

  return parts.join('+') + suffix
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
    const name = pointerButtonName(event.button)
    if (!name) return null
    buttonName = name
    if (event.type === 'mouseup') buttonName += RELEASE_SUFFIX
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
 * <keybinds-command-palette> - Search-driven command execution
 *
 * Attributes:
 *   open         - Show/hide the palette
 *   auto-trigger - Enable default $mod+K trigger
 *   placeholder  - Input placeholder text (default: "Type a command...")
 *   hide-inactive - List only commands that apply now (otherwise the rest are shown disabled)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   matcher: Matcher        - Custom matcher function
 *   source: (query) => Command[] | Promise<Command[]>
 *                           - Further commands for a non-empty query, merged with `commands`
 *   sourceDelay: number     - Milliseconds of typing pause before `source` is asked (default 200)
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
    /** @type {((query: string) => Command[] | Promise<Command[]>) | undefined} */
    this._source = undefined
    /** @type {number} */
    this.sourceDelay = 200
    /** What `source` answered for the query in the input. @type {Command[]} */
    this._sourced = []
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._sourceTimer = undefined

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
    this._list.addEventListener('click', (e) => {
      const li = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.palette__item'))
      if (li) this._execute(Number(li.dataset['index']))
    })
    this._list.addEventListener('mouseover', (e) => {
      if (this._inputMode !== 'pointer') return
      const li = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.palette__item'))
      if (!li) return
      const index = Number(li.dataset['index'])
      if (index !== this._activeIndex) this._setActive(index)
    })
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._search(false)
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._search(false)
  }

  get matcher() { return this._matcher }
  set matcher(val) {
    this._matcher = val
    if (this.open) this._search(false)
  }

  get source() { return this._source }
  set source(val) {
    this._source = val
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
    markKind(this, 'command-palette')
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
    this._input.focus()
  }

  _onClose() {
    clearTimeout(this._sourceTimer)
    this._sourced = []
    this._input.blur()
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  /** @param {boolean} [ask] - whether to ask `source` again for this query */
  _search(ask = true) {
    const query = this._input.value
    if (ask) this._ask(query)
    const ids = new Set(this._commands.map(c => c.id))
    const all = query ? [...this._commands, ...this._sourced.filter(c => !ids.has(c.id))] : this._commands
    const found = query ? searchCommands(all, query, this._context, { matcher: this._matcher }) : this._getAllVisible()
    this._results = this.hasAttribute('hide-inactive') ? found.filter(cmd => cmd.active) : found
    this._activeIndex = 0
    this._render()
    this._list.scrollTop = 0
  }

  /**
   * Asks `source` once typing pauses; an answer for a query no longer typed is dropped.
   * @param {string} query
   */
  _ask(query) {
    clearTimeout(this._sourceTimer)
    this._sourced = []
    const source = this._source
    if (!source || !query) return
    this._sourceTimer = setTimeout(async () => {
      let got
      try {
        got = await source(query)
      } catch {
        return
      }
      if (!this.open || this._input.value !== query) return
      this._sourced = got || []
      this._search(false)
    }, this.sourceDelay)
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
    if (this._results.length === 0) {
      for (const item of this._items) item.remove()
      if (!this._emptyEl) {
        this._emptyEl = document.createElement('li')
        this._emptyEl.className = 'palette__empty'
        this._emptyEl.setAttribute('part', 'empty')
        this._emptyEl.textContent = 'No commands found'
      }
      if (!this._emptyEl.parentNode) this._list.appendChild(this._emptyEl)
      return
    }

    if (this._emptyEl && this._emptyEl.parentNode) this._emptyEl.remove()

    for (let i = 0; i < this._results.length; i++) {
      let li = this._items[i]
      if (!li) {
        li = document.createElement('li')
        li.setAttribute('role', 'option')
        this._items[i] = li
      }
      if (!li.parentNode) this._list.appendChild(li)
      this._updateItem(li, /** @type {ScoredCommand} */ (this._results[i]), i)
    }

    for (let i = this._results.length; i < this._items.length; i++) {
      this._items[i]?.remove()
    }

    this._setActive(this._activeIndex)
  }

  /**
   * @param {HTMLLIElement} li
   * @param {ScoredCommand} cmd
   * @param {number} index
   */
  _updateItem(li, cmd, index) {
    li.className = 'palette__item' + (!cmd.active ? ' palette__item--disabled' : '')
    li.setAttribute('part', `item${!cmd.active ? ' item-disabled' : ''}`)
    li.setAttribute('aria-selected', 'false')
    li.dataset['index'] = String(index)
    li.replaceChildren()

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
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}

/**
 * <keybinds-cheatsheet> - Grouped display of available bindings
 *
 * Attributes:
 *   open         - Show/hide the cheatsheet
 *   auto-trigger  - Open while a modifier is held on its own; tapping it twice keeps it open
 *   trigger-key   - The modifier to hold: $mod (default: Meta on Mac, Control elsewhere), Control, Alt, Shift or Meta
 *   trigger-delay - How long to hold it before opening, in ms (default 200)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks (grays out inactive)
 *   open: boolean           - Show/hide the cheatsheet
 *
 * Events:
 *   open  - Fired when it opens, however that happened
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
    return ['open', 'auto-trigger', 'trigger-key', 'trigger-delay']
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
      this.dispatchEvent(new CustomEvent('open'))
      this._render()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    } else if ((name === 'trigger-key' || name === 'trigger-delay') && this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
    }
  }

  connectedCallback() {
    markKind(this, 'cheatsheet')
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

    // Which modifier to hold: "$mod" (the default) is Meta on Mac and Control elsewhere, like in bindings
    const key = this.getAttribute('trigger-key') || '$mod'
    const modifier = key.toLowerCase() === '$mod' ? (isMac ? 'Meta' : 'Control') : key
    const delay = Number(this.getAttribute('trigger-delay') ?? 200)
    // Holding shows it until the key is let go; tapping twice keeps it open (and tapping twice again,
    // Escape or a click outside closes it).
    let pinned = false
    const unhold = onModifierHold(modifier, (held) => {
      if (!pinned) this.open = held
    }, { delay: Number.isFinite(delay) ? delay : 200 })
    const untap = onModifierTaps(modifier, 2, () => {
      pinned = !this.open
      this.open = pinned
    })
    /** @param {KeyboardEvent} e */
    const escape = (e) => {
      if (e.key !== 'Escape' || !this.open) return
      // Escape was for closing it, not for whatever is underneath too
      e.preventDefault()
      e.stopPropagation()
      this._close()
    }
    const closed = () => { pinned = false }
    window.addEventListener('keydown', escape, true)
    this.addEventListener('close', closed)
    this._cleanupTrigger = () => {
      unhold()
      untap()
      window.removeEventListener('keydown', escape, true)
      this.removeEventListener('close', closed)
    }
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
  if (p === 'backclick' || p === 'back') return 'Back'
  if (p === 'forwardclick' || p === 'forward') return 'Forward'
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
  return formatWithRelease(binding, formatMousePart)
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
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  let isHeld = false
  const stop = () => {
    if (timer !== null) { clearTimeout(timer); timer = null }
    if (isHeld) { isHeld = false; callback(false) }
  }
  const unwatch = watchModifier(modifiers, target, {
    down: () => {
      stop()
      timer = setTimeout(() => { timer = null; isHeld = true; callback(true) }, delay)
    },
    spoiled: stop,
    up: stop,
  })
  return () => { unwatch(); if (timer !== null) clearTimeout(timer) }
}

/**
 * Trigger callback when a modifier key is tapped (pressed and released by itself) `count` times in
 * quick succession, as in double-tapping Shift.
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {number} count - Taps in a row
 * @param {() => void} callback
 * @param {{ within?: number, target?: EventTarget }} [options] - `within`: most ms from one tap's
 *   press to the next tap's release (default 400)
 * @returns {() => void} Cleanup function
 *
 * @example
 * onModifierTaps('Control', 2, () => { cheatsheet.open = !cheatsheet.open })
 */
export function onModifierTaps(modifiers, count, callback, options = {}) {
  const { within = 400, target = window } = options
  /** @type {number[]} */
  let taps = []
  let pressed = 0
  return watchModifier(modifiers, target, {
    down: () => { pressed = performance.now() },
    spoiled: () => { taps = [] },
    up: (clean) => {
      const now = performance.now()
      if (!clean || now - pressed > within) return void (taps = [])
      taps = [...taps.filter((t) => now - t <= within * count), now]
      if (taps.length >= count) {
        taps = []
        callback()
      }
    },
  })
}

/**
 * Follows a modifier being pressed and released by itself. `down` is a fresh press (not the key's
 * auto-repeat) with no other key or button held; `spoiled` is anything else happening while it's
 * held (another key, a click, scrolling), after which nothing counts until it's released; `up`
 * is the release, with whether the press stayed clean. Listens in the capture phase, so editors
 * that stop events don't hide them.
 *
 * @param {string | string[]} modifiers
 * @param {EventTarget} target
 * @param {{ down: () => void, spoiled: () => void, up: (clean: boolean) => void }} on
 * @returns {() => void}
 */
function watchModifier(modifiers, target, on) {
  const modSet = new Set((Array.isArray(modifiers) ? modifiers : [modifiers]).map((m) => m.toLowerCase()))
  let held = false
  let clean = false

  const spoil = () => {
    if (!held || !clean) return
    clean = false
    on.spoiled()
  }
  /** @param {Event} e */
  const keydown = (e) => {
    const event = /** @type {KeyboardEvent} */ (e)
    if (!modSet.has(event.key?.toLowerCase())) return spoil()
    if (event.repeat || held) return
    held = true
    // Other modifiers already down (Shift then Control) make it a chord, not a bare press
    clean = !['Control', 'Alt', 'Shift', 'Meta'].some((m) => !modSet.has(m.toLowerCase()) && event.getModifierState?.(m))
    if (clean) on.down()
  }
  /** @param {Event} e */
  const keyup = (e) => {
    const event = /** @type {KeyboardEvent} */ (e)
    if (!modSet.has(event.key?.toLowerCase()) || !held) return
    held = false
    on.up(clean)
  }
  const blur = () => {
    if (!held) return
    held = false
    clean = false
    on.up(false)
  }

  const others = /** @type {const} */ (['pointerdown', 'wheel', 'contextmenu'])
  target.addEventListener('keydown', keydown, true)
  target.addEventListener('keyup', keyup, true)
  for (const type of others) target.addEventListener(type, spoil, { capture: true, passive: true })
  window.addEventListener('blur', blur)
  return () => {
    target.removeEventListener('keydown', keydown, true)
    target.removeEventListener('keyup', keyup, true)
    for (const type of others) target.removeEventListener(type, spoil, true)
    window.removeEventListener('blur', blur)
  }
}

/**
 * <keybinds-settings> - Keybinding settings panel
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
    /** @type {{ commandId: string, label: string, bindingStr: string, type: 'keys' | 'mouse', index: number | null, flip?: boolean } | null} */
    this._conflict = null
    /** Whether recording captures a release (the input comes up) instead of a press */
    this._recordRelease = false
    /** @type {HTMLElement | null} */
    this._releaseToggle = null
    /** Press-time binding of the input currently held while recording a release */
    /** @type {{ kind: 'key' | 'mouse', id: string, binding: string } | null} */
    this._heldPress = null
    /** @type {((e: Event) => void) | null} */
    this._recordKeyHandler = null
    /** @type {((e: Event) => void) | null} */
    this._recordKeyUpHandler = null
    /** @type {((e: Event) => void) | null} */
    this._recordMouseUpHandler = null

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

  connectedCallback() {
    markKind(this, 'settings')
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
    this._recordRelease = false
    this._heldPress = null

    /** @param {Event} e */
    const fromToggle = (e) => !!this._releaseToggle && e.composedPath().includes(this._releaseToggle)

    /** @param {Event} e */
    const keyHandler = (e) => {
      if (fromToggle(e)) return
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
      if (this._recordRelease) {
        // Held until its keyup; the press-time modifiers are what the release binds to
        if (!event.repeat) this._heldPress = { kind: 'key', id: event.code || event.key, binding: bindingStr }
        return
      }
      this._handleRecordedBinding(bindingStr)
    }

    /** @param {Event} e */
    const keyUpHandler = (e) => {
      if (fromToggle(e)) return
      if (!this._recordRelease || this._recording?.type !== 'keys') return
      const event = /** @type {KeyboardEvent} */ (e)
      const held = this._heldPress
      if (!held || held.kind !== 'key' || held.id !== (event.code || event.key)) return
      event.preventDefault()
      event.stopPropagation()
      this._heldPress = null
      this._handleRecordedBinding(held.binding + RELEASE_SUFFIX)
    }

    /** @param {Event} e */
    const mouseHandler = (e) => {
      if (fromToggle(e)) return
      if (this._recording?.type !== 'mouse') return

      const event = /** @type {MouseEvent} */ (e)
      const bindingStr = eventToMouseBindingString(event)
      if (!bindingStr) return

      event.preventDefault()
      event.stopPropagation()
      if (this._recordRelease) {
        this._heldPress = { kind: 'mouse', id: String(event.button), binding: bindingStr }
        return
      }
      this._handleRecordedBinding(bindingStr)
    }

    /** @param {Event} e */
    const mouseUpHandler = (e) => {
      if (fromToggle(e)) return
      if (!this._recordRelease || this._recording?.type !== 'mouse') return
      const event = /** @type {MouseEvent} */ (e)
      const held = this._heldPress
      if (!held || held.kind !== 'mouse' || held.id !== String(event.button)) return
      event.preventDefault()
      event.stopPropagation()
      this._heldPress = null
      this._handleRecordedBinding(held.binding + RELEASE_SUFFIX)
    }

    /** @param {Event} e */
    const wheelHandler = (e) => {
      if (this._recording?.type !== 'mouse') return
      if (this._recordRelease) return // scroll has no release

      const event = /** @type {WheelEvent} */ (e)
      const bindingStr = eventToMouseBindingString(event)
      if (!bindingStr) return

      event.preventDefault()
      event.stopPropagation()
      this._handleRecordedBinding(bindingStr)
    }

    this._recordKeyHandler = keyHandler
    this._recordKeyUpHandler = keyUpHandler
    this._recordMouseHandler = mouseHandler
    this._recordMouseUpHandler = mouseUpHandler
    this._recordWheelHandler = wheelHandler

    window.addEventListener('keydown', keyHandler, true)
    window.addEventListener('keyup', keyUpHandler, true)
    window.addEventListener('mousedown', mouseHandler, true)
    window.addEventListener('mouseup', mouseUpHandler, true)
    window.addEventListener('wheel', wheelHandler, { capture: true })

    this._render()
  }

  _stopRecording() {
    if (this._recordKeyHandler) {
      window.removeEventListener('keydown', this._recordKeyHandler, true)
      this._recordKeyHandler = null
    }
    if (this._recordKeyUpHandler) {
      window.removeEventListener('keyup', this._recordKeyUpHandler, true)
      this._recordKeyUpHandler = null
    }
    if (this._recordMouseHandler) {
      window.removeEventListener('mousedown', this._recordMouseHandler, true)
      this._recordMouseHandler = null
    }
    if (this._recordMouseUpHandler) {
      window.removeEventListener('mouseup', this._recordMouseUpHandler, true)
      this._recordMouseUpHandler = null
    }
    if (this._recordWheelHandler) {
      window.removeEventListener('wheel', this._recordWheelHandler, true)
      this._recordWheelHandler = null
    }
    this._recording = null
    this._conflict = null
    this._recordRelease = false
    this._heldPress = null
    this._releaseToggle = null
  }

  /** @param {boolean} release */
  _setRecordRelease(release) {
    this._recordRelease = release
    this._heldPress = null
    this._render()
  }

  /**
   * Switch a stored binding between its press and release form
   * @param {string} commandId
   * @param {'keys' | 'mouse'} type
   * @param {number} index
   */
  _flipRelease(commandId, type, index) {
    const current = this._getBindings(commandId)[type][index]
    if (current === undefined) return
    const { body, release } = splitRelease(current.toLowerCase())
    const flipped = release ? current.trim().slice(0, body.length) : current.trim() + RELEASE_SUFFIX

    if (this._store) {
      const conflict = findConflict(this._store.get(), flipped, type, commandId)
      if (conflict) {
        this._stopRecording()
        this._recording = { commandId, type, index }
        this._conflict = { ...conflict, bindingStr: flipped, type, index, flip: true }
        this._render()
        return
      }
    }
    this._applyBinding(commandId, type, index, flipped)
  }

  /**
   * Release switch inside the recording overlay
   * @returns {HTMLElement}
   */
  _renderReleaseToggle() {
    const toggle = document.createElement('button')
    toggle.className = 'settings__recording-release'
    toggle.setAttribute('part', this._recordRelease ? 'recording-release recording-release-on' : 'recording-release')
    toggle.setAttribute('aria-pressed', String(this._recordRelease))
    toggle.textContent = 'Release'
    toggle.addEventListener('click', () => this._setRecordRelease(!this._recordRelease))
    this._releaseToggle = toggle
    return toggle
  }

  /** @returns {string} */
  _recordingPrompt() {
    const keys = this._recording?.type === 'keys'
    if (this._recordRelease) return keys ? 'Press and release a key...' : 'Press and release a button...'
    return keys ? 'Press a key...' : 'Click or scroll...'
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
    if (this._conflict?.flip) this._stopRecording()
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
          recordingText.textContent = this._recordingPrompt()
          overlay.appendChild(recordingText)
          overlay.appendChild(this._renderReleaseToggle())
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
      overlay.textContent = this._recordingPrompt()
      if (!this._conflict?.flip) {
        wrapper.appendChild(overlay)
        wrapper.appendChild(this._renderReleaseToggle())
      }

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

    const isRelease = splitRelease(bindingStr.toLowerCase()).release
    if (isRelease || !/(^|\+)scroll(up|down|left|right)$/i.test(bindingStr.trim())) {
      const releaseBtn = document.createElement('button')
      releaseBtn.className = 'settings__binding-release'
      releaseBtn.setAttribute('part', isRelease ? 'binding-release binding-release-on' : 'binding-release')
      releaseBtn.setAttribute('aria-pressed', String(isRelease))
      releaseBtn.textContent = 'Release'
      releaseBtn.addEventListener('click', () => this._flipRelease(commandId, type, index))
      binding.appendChild(releaseBtn)
    }

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
 * <keybinds-basic-context-menu> - Context menu driven by commands (no search, no limit)
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
export class BasicContextMenu extends HTMLElement {
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
      <div class="context-menu__backdrop" part="backdrop"></div>
      <div class="context-menu" part="context-menu">
        <ul class="context-menu__list" part="list" role="menu"></ul>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__backdrop'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__list'))
    /** @type {ResizeObserver | null} */
    this._resize = null

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
    markKind(this, 'basic-context-menu')
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
    this._list.focus()
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
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}

/**
 * <keybinds-context-menu> - Scored, searchable context menu driven by commands
 *
 * Shows top `maxVisible` items (default: 7) scored via the scorer (default:
 * `defaultScorer()`). A search input at the top filters and re-scores. When
 * more items exist than `maxVisible`, a subtle "▾ N more" row at the bottom
 * reveals them on hover/focus with a smooth height transition.
 *
 * Attributes:
 *   open         - Show/hide the menu
 *   auto-trigger - Wire contextmenu event on target element
 *   menu         - Menu tag to filter commands by
 *   target       - CSS selector for contextmenu target (defaults to parentElement)
 *
 * Properties:
 *   commands: Command[]           - Array of command definitions
 *   context: object               - Context for `when` checks
 *   open: boolean                 - Show/hide the menu
 *   menu: string                  - Menu tag to filter by
 *   position: { x: number, y: number } - Menu position
 *   scorer: Scorer                - Scoring function (default: defaultScorer())
 *   history: HistoryEntry[]       - Frecency history for defaultScorer
 *   maxVisible: number            - Max visible items before "N more" (default: 7)
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * CSS parts:
 *   search          - The search input element
 *   context-menu    - Outer container
 *   backdrop        - Click-away backdrop
 *   list            - The <ul>
 *   separator       - Category separator <li>
 *   item            - Command <li>
 *   item-active     - Active/focused item
 *   item-disabled   - Inactive command
 *   item-label      - Label span
 *   item-keys       - Keys container
 *   item-key        - Individual key <kbd>
 *   more-row        - "▾ N more" toggle row
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
    this._allItems = []
    /** @type {(Command & { active: boolean })[]} */
    this._visibleItems = []
    /** @type {number} */
    this._activeIndex = -1
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'pointer'
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null
    /** @type {((e: Event) => void) | null} */
    this._keyHandler = null
    /** @type {Scorer} */
    this._scorer = defaultScorer()
    /** @type {HistoryEntry[]} */
    this._history = []
    /** @type {number} */
    this._maxVisible = 7
    /** @type {boolean} */
    this._expanded = false

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .context-menu__backdrop { position: fixed; inset: 0; }
        .context-menu__more-row {
          list-style: none;
          cursor: pointer;
          padding: 4px 8px;
          opacity: 0.6;
          font-size: 0.85em;
        }
        .context-menu__more-row:hover,
        .context-menu__more-row:focus {
          opacity: 1;
        }
        .context-menu__overflow {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.2s ease;
        }
        .context-menu__overflow--visible {
          max-height: 600px;
        }
      </style>
      <div class="context-menu__backdrop" part="backdrop"></div>
      <div class="context-menu" part="context-menu">
        <input
          class="context-menu__search"
          part="search"
          type="text"
          placeholder="Search..."
          autocomplete="off"
          spellcheck="false"
        />
        <ul class="context-menu__list" part="list" role="menu"></ul>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__backdrop'))
    /** @type {HTMLInputElement} */
    this._searchInput = /** @type {HTMLInputElement} */ (shadow.querySelector('.context-menu__search'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__list'))

    this._backdrop.addEventListener('click', () => this._close())
    this._backdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this._close()
    })
    this._list.addEventListener('mousemove', () => { this._inputMode = 'pointer' })
    this._searchInput.addEventListener('input', () => {
      this._expanded = false
      this._buildItems()
    })
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

  get scorer() { return this._scorer }
  set scorer(val) {
    this._scorer = val || defaultScorer()
    if (this.open) this._buildItems()
  }

  get history() { return this._history }
  set history(val) {
    this._history = val || []
    // Update the scorer to incorporate new history when using default
    if (this.open) this._buildItems()
  }

  get maxVisible() { return this._maxVisible }
  set maxVisible(val) {
    this._maxVisible = (typeof val === 'number' && val > 0) ? val : 7
    if (this.open) this._render()
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
    markKind(this, 'context-menu')
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
    this._expanded = false
    this._searchInput.value = ''
    this._buildItems()
    this._updatePosition()
    /** @type {(e: Event) => void} */
    const handler = (e) => this._handleKey(/** @type {KeyboardEvent} */ (e))
    this._keyHandler = handler
    const shadow = /** @type {ShadowRoot} */ (this.shadowRoot)
    shadow.addEventListener('keydown', handler)
    // On a touch screen, focusing the search would bring up the on-screen keyboard over the menu;
    // the list takes focus instead, and the search is a tap away.
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    const first = touch ? this._list : this._searchInput
    first.focus()
  }

  _onClose() {
    this._resize?.disconnect()
    this._resize = null
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
    const query = this._searchInput ? this._searchInput.value : ''
    const scorer = this._scorer

    if (query) {
      // Search mode: fuzzy match + scorer
      const scored = searchCommands(this._commands, query, this._context, { scorer })
      this._allItems = scored.map(cmd => ({ ...cmd, active: cmd.active }))
    } else {
      // No query: apply scorer to rank all relevant commands
      let base = this._menu
        ? filterByMenu(this._commands, this._menu, this._context)
        : this._commands
            .filter(cmd => !cmd.hidden)
            .map(cmd => ({ ...cmd, active: isActive(cmd, this._context) }))

      // Score and sort: active first, then by score, preserving original order for ties
      /** @type {Array<Command & { active: boolean, _score: number, _origIdx: number }>} */
      const withScores = base.map((cmd, i) => ({
        ...cmd,
        _score: scorer(cmd, this._context),
        _origIdx: i,
      }))

      withScores.sort((a, b) => {
        if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0)
        if (b._score !== a._score) return b._score - a._score
        return a._origIdx - b._origIdx
      })

      // Exclude items the scorer excluded (score <= 0) only if they have a `when`
      // (commands without `when` always get score 1 from defaultScorer so they pass)
      this._allItems = withScores
        .filter(cmd => !cmd.when || cmd._score > 0)
        .map(({ _score: _s, _origIdx: _o, ...cmd }) => cmd)
    }

    this._render()
  }

  _updatePosition() {
    const { x, y } = this._position
    const container = /** @type {HTMLElement} */ (this.shadowRoot?.querySelector('.context-menu'))
    if (!container) return
    container.style.position = 'fixed'
    // Kept on screen, and again whenever it changes size (more items shown, a search narrowing them):
    // without room below the point it opens upward from it, and without room either way it fits
    // where it can.
    const clamp = () => {
      const w = container.offsetWidth
      const h = container.offsetHeight
      const vh = window.innerHeight
      const top = y + h <= vh ? y : y - h >= 0 ? y - h : vh - h
      container.style.left = `${Math.max(0, Math.min(x, window.innerWidth - w))}px`
      container.style.top = `${Math.max(0, top)}px`
    }
    clamp()
    if (typeof ResizeObserver === 'function') {
      this._resize?.disconnect()
      this._resize = new ResizeObserver(clamp)
      this._resize.observe(container)
    } else requestAnimationFrame(clamp)
  }

  _render() {
    const all = this._allItems
    const limit = this._maxVisible
    const showAll = this._expanded || all.length <= limit
    this._visibleItems = showAll ? all : all.slice(0, limit)
    const hiddenCount = all.length - this._visibleItems.length

    this._list.replaceChildren()
    this._list.setAttribute('tabindex', '0')

    let lastCategory = null
    for (let i = 0; i < this._visibleItems.length; i++) {
      const cmd = /** @type {Command & { active: boolean }} */ (this._visibleItems[i])

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

    // "N more" row
    if (hiddenCount > 0) {
      const moreRow = document.createElement('li')
      moreRow.className = 'context-menu__more-row'
      moreRow.setAttribute('part', 'more-row')
      moreRow.setAttribute('role', 'menuitem')
      moreRow.setAttribute('tabindex', '0')
      moreRow.textContent = `▾ ${hiddenCount} more`

      const expand = () => {
        this._expanded = true
        this._render()
      }
      moreRow.addEventListener('click', expand)
      moreRow.addEventListener('mouseenter', expand)
      moreRow.addEventListener('focus', expand)

      this._list.appendChild(moreRow)
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    // Allow typing in search input without intercepting arrow navigation
    if (e.target === this._searchInput && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') {
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex < this._visibleItems.length - 1
          ? this._activeIndex + 1 : 0
        this._render()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex > 0
          ? this._activeIndex - 1 : this._visibleItems.length - 1
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
        this._activeIndex = this._visibleItems.length - 1
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
    const cmd = this._visibleItems[index]
    if (!cmd || !cmd.active) return

    this._close()
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}

/**
 * <keybinds-radial-menu> - Radial command menu with bilateral text layout
 *
 * Up to 8 commands arranged evenly around a circle. Labels on the right half
 * are left-aligned to the right of their indicator; labels on the left half
 * are right-aligned to the left. Direction becomes muscle memory; eight slots
 * maps to Miller's Law (≤7±2).
 *
 * No auto-trigger — caller controls open/close.
 *
 * Attributes:
 *   open - Reflects open state
 *
 * Properties:
 *   commands: Command[]            - Up to 8 command definitions
 *   context: object                - Context for `when` checks
 *   open: boolean                  - Show/hide the menu
 *
 * Methods:
 *   open({ x, y })  - Open at viewport coordinates (omit for viewport center)
 *   close()         - Dismiss the menu
 *
 * Events:
 *   command - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * CSS parts:
 *   backdrop        - Click-away backdrop
 *   container       - SVG/div outer wrapper
 *   slot            - Each radial slot wrapper
 *   slot-active     - Hovered/focused slot
 *   slot-disabled   - Inactive command slot
 *   indicator       - The dot/circle for each slot
 *   label           - The text label for each slot
 */
export class RadialMenu extends HTMLElement {
  static get observedAttributes() {
    return ['open']
  }

  constructor() {
    super()
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {{ x: number, y: number }} */
    this._position = { x: 0, y: 0 }
    /** @type {(Command & { active: boolean })[]} */
    this._items = []
    /** @type {number} */
    this._activeIndex = -1
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'pointer'
    /** @type {((e: Event) => void) | null} */
    this._keyHandler = null

    // Radial layout constants
    /** @type {number} */
    this._radius = 80
    /** @type {number} */
    this._indicatorR = 6
    /** @type {number} */
    this._labelGap = 14

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .radial-menu__backdrop {
          position: fixed;
          inset: 0;
          z-index: 9998;
        }
        .radial-menu__container {
          position: fixed;
          z-index: 9999;
          pointer-events: none;
          overflow: visible;
        }
        .radial-menu__slot {
          pointer-events: all;
          cursor: pointer;
        }
        .radial-menu__slot--disabled {
          cursor: default;
          opacity: 0.35;
        }
        .radial-menu__indicator {
          transition: r 0.1s, fill 0.1s;
        }
        .radial-menu__slot--active .radial-menu__indicator {
          /* active state handled via JS attribute */
        }
        .radial-menu__label {
          font: 13px/1.4 system-ui, sans-serif;
          fill: currentColor;
          dominant-baseline: central;
          pointer-events: none;
          user-select: none;
        }
        .radial-menu__spoke {
          stroke-width: 1;
          opacity: 0.25;
        }
      </style>
      <div class="radial-menu__backdrop" part="backdrop"></div>
      <svg class="radial-menu__container" part="container" xmlns="http://www.w3.org/2000/svg">
        <g class="radial-menu__spokes"></g>
        <g class="radial-menu__slots"></g>
      </svg>
    `

    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.radial-menu__backdrop'))
    this._svg = /** @type {SVGSVGElement} */ (shadow.querySelector('.radial-menu__container'))
    this._spokesGroup = /** @type {SVGGElement} */ (shadow.querySelector('.radial-menu__spokes'))
    this._slotsGroup = /** @type {SVGGElement} */ (shadow.querySelector('.radial-menu__slots'))

    this._backdrop.addEventListener('click', () => this._close())
    this._backdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this._close()
    })
  }

  connectedCallback() {
    markKind(this, 'radial-menu')
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = (val || []).slice(0, 8)
    if (this.open) this._buildItems()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._buildItems()
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
    }
  }

  /**
   * Open the menu at the given viewport coordinates.
   * If no coords given, centers in the viewport.
   * @param {{ x?: number, y?: number } | undefined} [coords]
   */
  openAt(coords) {
    if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
      this._position = { x: coords.x, y: coords.y }
    } else {
      this._position = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }
    }
    this._buildItems()
    this.open = true
  }

  close() {
    this._close()
  }

  _onOpen() {
    this._activeIndex = -1
    this._inputMode = 'pointer'
    this._buildItems()
    this._updatePosition()
    /** @type {(e: Event) => void} */
    const handler = (e) => this._handleKey(/** @type {KeyboardEvent} */ (e))
    this._keyHandler = handler
    // Listen on the document so the component doesn't need focus
    document.addEventListener('keydown', handler)
  }

  _onClose() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler)
      this._keyHandler = null
    }
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _buildItems() {
    this._items = this._commands
      .filter(cmd => !cmd.hidden)
      .map(cmd => ({ ...cmd, active: isActive(cmd, this._context) }))
    this._render()
  }

  _updatePosition() {
    const { x, y } = this._position
    const r = this._radius
    const pad = r + 160 // enough room for labels
    this._svg.style.left = `${x - pad}px`
    this._svg.style.top = `${y - pad}px`
    this._svg.style.width = `${pad * 2}px`
    this._svg.style.height = `${pad * 2}px`
    this._svg.setAttribute('viewBox', `${-pad} ${-pad} ${pad * 2} ${pad * 2}`)
  }

  _render() {
    this._updatePosition()
    this._spokesGroup.replaceChildren()
    this._slotsGroup.replaceChildren()

    const count = this._items.length
    if (count === 0) return

    const total = 8 // always 8 slots so positions are consistent
    const r = this._radius
    const indR = this._indicatorR
    const gap = this._labelGap

    // Indicator fill from CSS custom property or fallback
    const activeColor = 'var(--radial-menu-active-color, #4f8ef7)'
    const inactiveColor = 'var(--radial-menu-inactive-color, #888)'
    const disabledColor = 'var(--radial-menu-disabled-color, #555)'
    const textColor = 'var(--radial-menu-text-color, currentColor)'
    const spokeColor = 'var(--radial-menu-spoke-color, currentColor)'

    for (let slot = 0; slot < total; slot++) {
      // Distribute evenly, starting at top (−π/2), clockwise
      const angle = (2 * Math.PI * slot) / total - Math.PI / 2
      const cx = r * Math.cos(angle)
      const cy = r * Math.sin(angle)

      const cmd = this._items[slot]

      // Spoke line from origin to indicator
      const spokeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      spokeLine.setAttribute('class', 'radial-menu__spoke')
      spokeLine.setAttribute('x1', '0')
      spokeLine.setAttribute('y1', '0')
      spokeLine.setAttribute('x2', String(cx))
      spokeLine.setAttribute('y2', String(cy))
      spokeLine.setAttribute('stroke', cmd ? spokeColor : disabledColor)
      spokeLine.setAttribute('part', 'spoke')
      this._spokesGroup.appendChild(spokeLine)

      if (!cmd) continue

      const isActive_ = cmd.active
      const isHighlighted = slot === this._activeIndex

      // Slot group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', `radial-menu__slot${!isActive_ ? ' radial-menu__slot--disabled' : ''}${isHighlighted ? ' radial-menu__slot--active' : ''}`)
      g.setAttribute('part', `slot${isHighlighted ? ' slot-active' : ''}${!isActive_ ? ' slot-disabled' : ''}`)
      g.setAttribute('role', 'menuitem')
      g.setAttribute('aria-label', cmd.label)
      if (!isActive_) g.setAttribute('aria-disabled', 'true')

      // Clickable hit area (larger than visual indicator)
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      hit.setAttribute('cx', String(cx))
      hit.setAttribute('cy', String(cy))
      hit.setAttribute('r', String(indR + 10))
      hit.setAttribute('fill', 'transparent')
      g.appendChild(hit)

      // Visual indicator dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('class', 'radial-menu__indicator')
      dot.setAttribute('part', 'indicator')
      dot.setAttribute('cx', String(cx))
      dot.setAttribute('cy', String(cy))
      dot.setAttribute('r', isHighlighted ? String(indR + 2) : String(indR))
      dot.setAttribute('fill', !isActive_ ? disabledColor : isHighlighted ? activeColor : inactiveColor)
      g.appendChild(dot)

      // Label — bilateral layout:
      // Right half (cos > 0 or top/bottom dead center columns): label to the right, left-aligned
      // Left half (cos < 0): label to the left, right-aligned
      // Exactly at ±90° (cos ≈ 0): stack label to the right (top/bottom slots go right by convention)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('class', 'radial-menu__label')
      text.setAttribute('part', 'label')
      text.setAttribute('fill', !isActive_ ? disabledColor : isHighlighted ? activeColor : textColor)

      const onRight = Math.cos(angle) >= 0
      const lx = onRight ? cx + indR + gap : cx - indR - gap
      text.setAttribute('x', String(lx))
      text.setAttribute('y', String(cy))
      text.setAttribute('text-anchor', onRight ? 'start' : 'end')
      text.textContent = cmd.label
      g.appendChild(text)

      // Events
      if (isActive_) {
        g.addEventListener('click', () => this._execute(slot))
      }
      g.addEventListener('mouseenter', () => {
        if (this._inputMode !== 'pointer') return
        this._activeIndex = slot
        this._render()
      })
      g.addEventListener('mouseleave', () => {
        if (this._inputMode !== 'pointer') return
        if (this._activeIndex === slot) {
          this._activeIndex = -1
          this._render()
        }
      })

      this._slotsGroup.appendChild(g)
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    if (!this.open) return

    // Arrow key → slot mapping based on 8-slot layout
    // Slots: 0=top, 1=top-right, 2=right, 3=bottom-right, 4=bottom, 5=bottom-left, 6=left, 7=top-left
    /** @type {Record<string, number>} */
    const arrowToSlot = {
      ArrowUp: 0,
      ArrowRight: 2,
      ArrowDown: 4,
      ArrowLeft: 6,
    }

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowLeft': {
        e.preventDefault()
        this._inputMode = 'keyboard'
        const target = /** @type {number} */ (arrowToSlot[e.key])
        // Find the nearest filled slot at or adjacent to the arrow direction
        if (this._items[target]) {
          this._activeIndex = target
        } else {
          // walk clockwise to find nearest filled slot
          for (let d = 1; d < 8; d++) {
            const cw = (target + d) % 8
            const ccw = (target - d + 8) % 8
            if (this._items[cw]) { this._activeIndex = cw; break }
            if (this._items[ccw]) { this._activeIndex = ccw; break }
          }
        }
        this._render()
        break
      }
      case 'Tab': {
        e.preventDefault()
        this._inputMode = 'keyboard'
        const filled = this._items.map((_, i) => i)
        if (filled.length === 0) break
        const cur = filled.indexOf(this._activeIndex)
        const next = e.shiftKey ? filled[cur <= 0 ? filled.length - 1 : cur - 1] : filled[cur >= filled.length - 1 ? 0 : cur + 1]
        this._activeIndex = next ?? 0
        this._render()
        break
      }
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

  /** @param {number} slot */
  _execute(slot) {
    const cmd = this._items[slot]
    if (!cmd || !cmd.active) return

    this._close()
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('command', { detail: { command: cmd } }))
  }
}

/**
 * Register all keybind components
 * Call this once to define the custom elements
 */
export function registerComponents() {
  if (!customElements.get('keybinds-command-palette')) {
    customElements.define('keybinds-command-palette', CommandPalette)
  }
  if (!customElements.get('keybinds-cheatsheet')) {
    customElements.define('keybinds-cheatsheet', KeybindCheatsheet)
  }
  if (!customElements.get('keybinds-basic-context-menu')) {
    customElements.define('keybinds-basic-context-menu', BasicContextMenu)
  }
  if (!customElements.get('keybinds-context-menu')) {
    customElements.define('keybinds-context-menu', ContextMenu)
  }
  if (!customElements.get('keybinds-settings')) {
    customElements.define('keybinds-settings', KeybindSettings)
  }
  if (!customElements.get('keybinds-radial-menu')) {
    customElements.define('keybinds-radial-menu', RadialMenu)
  }
}

// ========================================
// Command hub
// ========================================

const COMPONENTS = {
  'command-palette': CommandPalette,
  cheatsheet: KeybindCheatsheet,
  settings: KeybindSettings,
  'basic-context-menu': BasicContextMenu,
  'context-menu': ContextMenu,
  'radial-menu': RadialMenu
}

/** @typedef {keyof typeof COMPONENTS} ComponentKind */

/** @type {Map<string, string>} */
const componentNames = new Map()

/**
 * Create a component from this copy of the library.
 *
 * A custom element name stays bound to the first class defined for it, so a second copy of the
 * library on the same page (a script loaded again after a deploy, two bundles) can't use the
 * other copy's elements. Each copy gets its own name: `keybinds-<kind>` when that's free or
 * already this copy's, otherwise `keybinds-<kind>-2`, `-3`, ... Styles select components by their
 * `data-keybinds` kind, so the name doesn't matter to them.
 *
 * @template {ComponentKind} K
 * @param {K} kind
 * @returns {InstanceType<(typeof COMPONENTS)[K]>}
 */
export function createComponent(kind) {
  let name = componentNames.get(kind)
  if (!name) {
    const cls = /** @type {CustomElementConstructor} */ (COMPONENTS[kind])
    name = `keybinds-${kind}`
    const existing = customElements.get(name)
    if (!existing) customElements.define(name, cls)
    else if (existing !== cls) {
      let n = 2
      while (customElements.get(`keybinds-${kind}-${n}`)) n++
      name = `keybinds-${kind}-${n}`
      customElements.define(name, class extends cls {})
    }
    componentNames.set(kind, name)
  }
  return /** @type {InstanceType<(typeof COMPONENTS)[K]>} */ (document.createElement(name))
}

/**
 * @typedef {Object} CommandHubOptions
 * @property {string} [storageKey] - Where people's rebindings are kept (default "keybinds"); the scope is appended
 * @property {HTMLElement} [host] - Makes a command palette, cheatsheet, settings panel and context menu inside it
 * @property {KeybindsOptions} [listen] - Passed on to keybinds(): target, capture, wheel, onExecute
 */

/**
 * Every command on the page, from every source, with one store of people's rebindings.
 *
 * Sources are functions, re-read on refresh(), so commands can come and go with the page's
 * state. The hub derives the bindings schema from the commands themselves, lays each person's
 * overrides over it, listens for keys, and keeps the palette, cheatsheet, settings panel, context
 * menu and any command buttons in step.
 *
 * @example
 * const hub = new CommandHub({ storageKey: 'myapp:keys', host: document.body })
 * hub.setSource('editor', () => editorCommands)
 * hub.addContext(() => ({ editing: !!editor.focused }))
 * hub.refresh()
 * hub.bindButtons(toolbar) // <button data-command="save">Save</button>
 *
 * @template {{ id: string, label: string, category?: string | undefined, description?: string | undefined, keys?: string[] | undefined, mouse?: string[] | undefined, hidden?: boolean | undefined }} [D=Command]
 * @template {object} [C=Record<string, unknown>] - The context `when` conditions see
 */
export class CommandHub extends EventTarget {
  // Declared as fields so they appear in the generated type declarations
  /** @type {CommandPalette | null} */
  palette = null
  /** @type {KeybindCheatsheet | null} */
  cheatsheet = null
  /** @type {KeybindSettings | null} */
  settings = null
  /** @type {ContextMenu | null} */
  menu = null

  /**
   * @param {CommandHubOptions & { adapt?: (def: D) => Command }} [options] - `adapt` turns the
   *   sources' definitions into commands, when they aren't commands already
   */
  constructor(options = {}) {
    super()
    this._storageKey = options.storageKey ?? 'keybinds'
    this._listen = options.listen ?? {}
    /** @type {(def: D) => Command} */
    this._adapt = options.adapt ?? ((def) => /** @type {Command} */ (/** @type {unknown} */ (def)))
    /** @type {{ owner: string, get: () => D[] }[]} */
    this._sources = []
    /** @type {(() => Partial<C>)[]} */
    this._contexts = []
    /** @type {Map<string, D>} */
    this._defs = new Map()
    /** @type {Map<string, Command>} */
    this._live = new Map()
    /** @type {BindingsStore<Schema> | null} */
    this._store = null
    this._storeListener = () => this.refresh()
    /** @type {(() => void) | null} */
    this._unbind = null
    this._scope = 'global'
    /** @type {Set<Element>} */
    this._buttonRoots = new Set()

    if (options.host) {
      this.palette = createComponent('command-palette')
      this.cheatsheet = createComponent('cheatsheet')
      this.settings = createComponent('settings')
      this.menu = createComponent('context-menu')
      options.host.append(this.palette, this.cheatsheet, this.settings, this.menu)
      // However the cheatsheet opens (a command, holding a key), it shows what applies right now.
      this.cheatsheet.addEventListener('open', () => this.syncContext())
      // Closing the palette, settings or a menu gives focus back to where it was (the text being
      // edited, say), before the chosen command runs; the command can still move it elsewhere.
      /** @type {HTMLElement | null} */
      this._lastFocus = null
      /** @param {FocusEvent} e */
      this._onFocusIn = (e) => {
        const el = /** @type {HTMLElement} */ (e.target)
        // Focus inside a component (even in its shadow DOM) isn't somewhere to come back to
        for (let n = /** @type {Element | undefined} */ (el); n; n = /** @type {ShadowRoot} */ (n.getRootNode()).host) {
          if (n.closest?.('[data-keybinds]')) return
        }
        this._lastFocus = el
      }
      document.addEventListener('focusin', this._onFocusIn, true)
      for (const overlay of [this.palette, this.settings, this.menu]) {
        overlay.addEventListener('close', () => {
          const now = document.activeElement
          const lost = !now || now === document.body || now === overlay || overlay.contains(now) || now.getRootNode() === overlay.shadowRoot
          if (lost && this._lastFocus?.isConnected) this._lastFocus.focus({ preventScroll: true })
        })
      }
    }
  }

  /**
   * Replace the commands owned by `owner` (null removes them). Takes effect on refresh().
   * Earlier sources win when two define the same id.
   * @param {string} owner
   * @param {(() => D[]) | null} get
   */
  setSource(owner, get) {
    this._sources = this._sources.filter((s) => s.owner !== owner)
    if (get) this._sources.push({ owner, get })
  }

  /**
   * Add to the context that `when` conditions see. Returns a function that removes it again.
   * @param {() => Partial<C>} get
   * @returns {() => void}
   */
  addContext(get) {
    this._contexts.push(get)
    return () => { this._contexts = this._contexts.filter((g) => g !== get) }
  }

  /** @returns {C} */
  context() {
    return Object.assign({}, ...this._contexts.map((g) => g()))
  }

  /**
   * Keep rebindings separately per scope (a document type, a game), so a key can mean different
   * things in each. Takes effect on refresh().
   * @param {string} scope
   */
  setScope(scope) {
    this._scope = scope
  }

  /** The store of people's rebindings, as the settings panel edits it. */
  get store() {
    return this._store
  }

  /** @returns {D[]} */
  all() {
    return [...this._defs.values()]
  }

  /**
   * @param {string} id
   * @returns {D | undefined}
   */
  get(id) {
    return this._defs.get(id)
  }

  /**
   * Run a command if it's available now. Returns whether it ran.
   * @param {string} id
   * @param {Event} [event]
   * @returns {boolean}
   */
  run(id, event) {
    const cmd = this._live.get(id)
    if (!cmd) return false
    const ctx = /** @type {Record<string, unknown>} */ (this.context())
    if (!isActive(cmd, ctx)) return false
    cmd.execute(ctx, event)
    return true
  }

  /** Re-read the sources, rebuild bindings and listeners, and update every component. */
  refresh() {
    this._defs.clear()
    for (const src of this._sources) {
      /** @type {D[]} */
      let list = []
      try {
        list = src.get()
      } catch (e) {
        console.error(`keybinds: command source "${src.owner}" threw`, e)
      }
      for (const d of list) if (!this._defs.has(d.id)) this._defs.set(d.id, d)
    }

    /** @type {Schema} */
    const schema = {}
    for (const d of this._defs.values()) {
      schema[d.id] = { label: d.label, category: d.category, description: d.description, keys: d.keys ?? [], mouse: d.mouse, hidden: d.hidden }
    }
    this._store?.removeEventListener('change', this._storeListener)
    this._store = new BindingsStore(schema, `${this._storageKey}:${this._scope}`)
    this._store.addEventListener('change', this._storeListener)
    const bound = this._store.get()

    this._live.clear()
    for (const d of this._defs.values()) {
      const b = bound[d.id]
      /** @type {Command} */
      const cmd = { ...this._adapt(d), keys: b?.keys, mouse: b?.mouse }
      try {
        validateCommands([cmd])
      } catch (e) {
        // One unreadable binding mustn't take every other key down with it
        console.error(`keybinds: dropping the bindings of "${d.id}"`, e)
        cmd.keys = []
        cmd.mouse = []
      }
      this._live.set(d.id, cmd)
    }

    this._unbind?.()
    const live = [...this._live.values()]
    this._unbind = keybinds(live.filter((c) => c.keys?.length || c.mouse?.length), () => /** @type {Record<string, unknown>} */ (this.context()), this._listen)
    const visible = live.filter((c) => !c.hidden)
    if (this.palette) this.palette.commands = visible
    if (this.cheatsheet) this.cheatsheet.commands = visible
    if (this.menu) this.menu.commands = live
    if (this.settings) this.settings.store = this._store
    this.syncContext()
    this.dispatchEvent(new Event('refresh'))
  }

  /** Push the current context into the components and command buttons, so unavailable commands grey out. */
  syncContext() {
    const ctx = /** @type {Record<string, unknown>} */ (this.context())
    // The palette and menus take focus when they open, which changes the context (nothing is being
    // edited any more); while open, they keep acting on where they were opened from.
    if (this.palette && !this.palette.open) this.palette.context = ctx
    if (this.cheatsheet) this.cheatsheet.context = ctx
    if (this.menu && !this.menu.open) this.menu.context = ctx
    for (const root of this._buttonRoots) this._paintButtons(root, ctx)
  }

  openPalette() {
    if (!this.palette) return
    this.refresh()
    this.palette.open = true
  }

  /**
   * Open the context menu with the commands tagged `tag`, at a point on screen.
   * @param {string} tag
   * @param {number} x
   * @param {number} y
   */
  openMenu(tag, x, y) {
    if (!this.menu) return
    this.syncContext()
    this.menu.menu = tag
    this.menu.position = { x, y }
    this.menu.open = true
  }

  /**
   * The keys bound to a command right now, as shown to people (e.g. "Ctrl+Z").
   * @param {string} id
   * @returns {string[]}
   */
  keysFor(id) {
    return (this._live.get(id)?.keys ?? []).map((k) => formatKeyParts(k).join('+'))
  }

  /**
   * The mouse bindings of a command right now, as shown to people (e.g. "Ctrl+Click").
   * @param {string} id
   * @returns {string[]}
   */
  mouseFor(id) {
    return (this._live.get(id)?.mouse ?? []).map((m) => formatMouseParts(m).join('+'))
  }

  /**
   * Whether a mouse press is one of a command's press bindings (same button, same modifiers), for
   * code that handles the press itself, like a drag that should start on a rebindable button.
   * @param {string} id
   * @param {MouseEvent} event
   * @returns {boolean}
   */
  mouseMatches(id, event) {
    const lookup = eventToMouseLookup(event)
    if (!lookup) return false
    return (this._live.get(id)?.mouse ?? []).some((m) => {
      const parsed = parseMouse(m)
      return !parsed.release && mouseToLookup(parsed) === lookup
    })
  }

  /**
   * Make every element with `data-command="<id>"` under `root` run that command when clicked and
   * be disabled while it isn't available. Returns a function that stops.
   * @param {Element} root
   * @returns {() => void}
   */
  bindButtons(root) {
    /** @param {Event} e */
    const onClick = (e) => {
      const el = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest?.('[data-command]'))
      if (!el || !root.contains(el)) return
      const id = el.dataset['command']
      if (id && this.run(id, e)) e.preventDefault()
    }
    root.addEventListener('click', onClick)
    this._buttonRoots.add(root)
    this._paintButtons(root, /** @type {Record<string, unknown>} */ (this.context()))
    return () => {
      root.removeEventListener('click', onClick)
      this._buttonRoots.delete(root)
    }
  }

  /**
   * @param {Element} root
   * @param {Record<string, unknown>} ctx
   */
  _paintButtons(root, ctx) {
    for (const el of Array.from(/** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-command]')))) {
      const cmd = this._live.get(el.dataset['command'] ?? '')
      const off = !cmd || !isActive(cmd, ctx)
      if ('disabled' in el) /** @type {HTMLButtonElement} */ (el).disabled = off
      else el.toggleAttribute('aria-disabled', off)
    }
  }

  /** Stop listening, and detach from the store. */
  destroy() {
    this._unbind?.()
    this._unbind = null
    this._store?.removeEventListener('change', this._storeListener)
    this._buttonRoots.clear()
    if (this._onFocusIn) document.removeEventListener('focusin', this._onFocusIn, true)
  }
}

export default keybinds
