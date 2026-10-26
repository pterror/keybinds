/**
 * Keyboard input: bindings like "$mod+k", "Escape", "?" or "k:up". Showing and recording them is
 * keybinds/keys-ui.
 */

import { RELEASE_SUFFIX, NO_MODS, splitRelease, parseMods, modsToPrefix, eventMods, overlayOpen, inInput } from './core.js'

/** @typedef {import('./core.js').Modifiers} Modifiers */
/** @typedef {import('./core.js').Input} Input */

/**
 * @typedef {Object} ParsedKey
 * @property {Modifiers} mods
 * @property {string} key
 * @property {boolean} release - Binding fires when the key comes up ("k:up")
 */

// Alias key names, resolved to the name a real key event reports
export const KEY_ALIASES = /** @type {Record<string, string>} */ ({
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  // "+" separates the parts of a binding, so the key itself is written "plus"
  plus: '+'
})

// Punctuation keys, and the name of the physical key that types each on a US layout (event.code)
export const PUNCTUATION_CODES = /** @type {Record<string, string>} */ ({
  '[': 'bracketleft', ']': 'bracketright', '\\': 'backslash', ';': 'semicolon', "'": 'quote',
  ',': 'comma', '.': 'period', '/': 'slash', '`': 'backquote', '-': 'minus', '=': 'equal'
})

/**
 * A single printable character that isn't a letter ("?", "!", "+", "é" is a letter).
 * Shift is part of typing these, so a binding to one matches however it was typed.
 * @param {string} key
 * @returns {boolean}
 */
export function isSymbolKey(key) {
  return [...key].length === 1 && key.trim() !== '' && key.toLowerCase() === key.toUpperCase() && !/[0-9]/.test(key)
}

// Named keys; any single printable character can be bound too
export const NAMED_KEY = /^(f([1-9]|1[0-2])|escape|enter|tab|space|backspace|delete|insert|home|end|page(up|down)|arrow(up|down|left|right)|bracket(left|right)|backslash|semicolon|quote|comma|period|slash|backquote|minus|equal|digit[0-9])$/

/**
 * @param {string} key
 * @returns {boolean}
 */
export function isValidKey(key) {
  return NAMED_KEY.test(key) || ([...key].length === 1 && key.trim() !== '')
}

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
 * The keyboard
 * @returns {Input}
 */
export function keys() {
  return {
    field: 'keys',
    parse(binding) {
      const parsed = parseKey(binding)
      return { lookup: keyToLookup(parsed), loose: keyToLookup({ ...parsed, mods: NO_MODS }), mods: parsed.mods }
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
