/**
 * Keyboard input: bindings like "$mod+k", "Escape", "?" or "k:up".
 */

import {
  RELEASE_SUFFIX, NO_MODS, splitRelease, parseMods, modsToPrefix, eventMods, eventModParts,
  formatModPart, formatWithRelease, overlayOpen, inInput,
} from './core.js'

/** @typedef {import('./core.js').Modifiers} Modifiers */
/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').Press} Press */

/**
 * @typedef {Object} ParsedKey
 * @property {Modifiers} mods
 * @property {string} key
 * @property {boolean} release - Binding fires when the key comes up ("k:up")
 */

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

/**
 * Parse a key string like "Ctrl+Shift+K" or "K:up" into normalized form
 * @param {string} keyStr
 * @returns {ParsedKey}
 * @throws {Error} if key binding is invalid
 */
export function parseKey(keyStr) {
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
 * Convert parsed key to lookup key (e.g., "ctrl+shift+k")
 * @param {ParsedKey} parsed
 * @returns {string}
 */
export function keyToLookup(parsed) {
  return `${modsToPrefix(parsed.mods)}${parsed.key}${parsed.release ? RELEASE_SUFFIX : ''}`
}

/**
 * Convert keyboard event to lookup keys (returns multiple for key/code variants)
 * @param {KeyboardEvent} event
 * @param {string} [prefix] - Modifier prefix to use instead of the event's own
 * @param {string} [suffix] - Appended to every lookup (e.g. ":up")
 * @returns {string[]}
 */
export function eventToKeyLookups(event, prefix = modsToPrefix(eventMods(event)), suffix = '') {
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
 * Format a single key part for display
 * @param {string} part
 * @returns {string}
 */
function formatKeyPart(part) {
  const p = part.trim().toLowerCase()
  const mod = formatModPart(p)
  if (mod) return mod
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

  return [...eventModParts(event, shift), normalizedKey].join('+') + suffix
}

/**
 * The keyboard
 * @returns {Input}
 */
export function keys() {
  return {
    field: 'keys',
    label: 'Key',
    parse(binding) {
      const parsed = parseKey(binding)
      return { lookup: keyToLookup(parsed), loose: keyToLookup({ ...parsed, mods: NO_MODS }), mods: parsed.mods }
    },
    format: formatKeyParts,
    release: () => true,
    prompt: (release) => release ? 'Press and release a key...' : 'Press a key...',

    record({ release, ignore }, done) {
      /** @type {{ id: string, binding: string } | null} */
      let held = null
      /** @param {Event} e */
      const down = (e) => {
        const event = /** @type {KeyboardEvent} */ (e)
        if (ignore(event) || event.key === 'Escape') return
        const binding = eventToBindingString(event)
        if (!binding) return // bare modifier
        event.preventDefault()
        event.stopPropagation()
        if (!release) return done(binding)
        // Held until its keyup; the press-time modifiers are what the release binds to
        if (!event.repeat) held = { id: event.code || event.key, binding }
      }
      /** @param {Event} e */
      const up = (e) => {
        const event = /** @type {KeyboardEvent} */ (e)
        if (ignore(event) || !held || held.id !== (event.code || event.key)) return
        event.preventDefault()
        event.stopPropagation()
        const binding = held.binding
        held = null
        done(binding + RELEASE_SUFFIX)
      }
      window.addEventListener('keydown', down, true)
      window.addEventListener('keyup', up, true)
      return () => {
        window.removeEventListener('keydown', down, true)
        window.removeEventListener('keyup', up, true)
      }
    },

    listen(d) {
      /**
       * Commands a key event triggers, with the modifiers given (the press's, for a release)
       * @param {KeyboardEvent} event
       * @param {Modifiers} mods
       * @param {string} [suffix]
       */
      const candidates = (event, mods, suffix = '') =>
        d.candidates(eventToKeyLookups(event, modsToPrefix(mods), suffix), eventToKeyLookups(event, '', suffix), mods)

      /** @param {Event} e */
      function onDown(e) {
        const event = /** @type {KeyboardEvent} */ (e)
        // Don't fire keybinds while the command palette or settings panel is open
        if (overlayOpen(/** @type {Element | null} */ (event.target))) return

        const id = event.code || event.key
        let press = d.presses.get(id)
        if (!press || !event.repeat) {
          press = { mods: eventMods(event), fired: new Set(), key: event.key, code: event.code }
          d.presses.set(id, press)
        }
        const found = candidates(event, eventMods(event))
        if (found) d.fire(found, event, { inInput: inInput(event.target), press })
      }

      /** @param {Event} e */
      function onUp(e) {
        const event = /** @type {KeyboardEvent} */ (e)
        const id = event.code || event.key
        const press = d.presses.get(id)
        if (!press) return
        d.presses.delete(id)
        const found = candidates(event, press.mods, RELEASE_SUFFIX)
        if (found) {
          d.release(found, press, event, { blocked: overlayOpen(/** @type {Element | null} */ (event.target)), inInput: inInput(event.target) })
        }
      }

      // A key let go after the window lost focus sends its keyup to whatever has focus now, so
      // every held key is released when focus goes. Coming back with it still down, its
      // auto-repeat starts a new press.
      function onBlur() {
        const presses = [...d.presses.values()]
        d.presses.clear()
        for (const press of presses) {
          const event = new KeyboardEvent('keyup', { key: /** @type {string} */ (press['key']), code: /** @type {string} */ (press['code']), cancelable: true })
          const found = candidates(event, press.mods, RELEASE_SUFFIX)
          if (found) d.release(found, press, event)
        }
      }

      const opts = { capture: d.capture }
      d.target.addEventListener('keydown', onDown, opts)
      d.target.addEventListener('keyup', onUp, opts)
      // Focus is the window's, whatever element the bindings listen on
      const focusTarget = typeof window !== 'undefined' ? window : d.target
      focusTarget.addEventListener('blur', onBlur)
      return () => {
        d.target.removeEventListener('keydown', onDown, opts)
        d.target.removeEventListener('keyup', onUp, opts)
        focusTarget.removeEventListener('blur', onBlur)
      }
    },
  }
}
