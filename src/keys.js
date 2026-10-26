/**
 * Keyboard input: bindings like "$mod+k", "shift+slash" or "Escape". More syntax is opt-in, each
 * its own module passed to keys(): symbols() for "?" and other typed characters, aliases() for
 * "up" and "plus". Showing and recording bindings is keybinds/keys-ui.
 */

import { RELEASE_SUFFIX, NO_MODS, parseMods, modsToPrefix, eventMods, overlayOpen, inInput } from './core.js'

/** @typedef {import('./core.js').Modifiers} Modifiers */
/** @typedef {import('./core.js').Input} Input */

/**
 * @typedef {Object} ParsedKey
 * @property {Modifiers} mods
 * @property {string} key
 */

/**
 * A piece of key binding syntax beyond modifiers and key names
 * @typedef {Object} KeySyntax
 * @property {string} name
 * @property {(name: string) => string | undefined} [alias] - The key a name stands for
 * @property {(key: string) => boolean} [accepts] - Keys it makes bindable
 * @property {(key: string) => string | undefined} [shifted] - What a binding with Shift means instead
 * @property {(key: string, prefix: string, suffix: string) => string[]} [lookups] - More lookups for a key event
 */

// Named keys, by the name a key event reports (event.key, or event.code for physical keys)
export const NAMED_KEY = /^(f([1-9]|1[0-2])|escape|enter|tab|space|backspace|delete|insert|home|end|page(up|down)|arrow(up|down|left|right)|bracket(left|right)|backslash|semicolon|quote|comma|period|slash|backquote|minus|equal|digit[0-9])$/

/**
 * A letter (in any script) or a digit: what a key types on its own, bindable as itself
 * @param {string} key
 */
export const isLetterOrDigit = (key) => [...key].length === 1 && (key.toLowerCase() !== key.toUpperCase() || /[0-9]/.test(key))

/**
 * Parse a key string like "Ctrl+Shift+K" into normalized form. Its release suffix, if any, has
 * already been taken off.
 * @param {string} keyStr
 * @param {KeySyntax[]} [syntax]
 * @returns {ParsedKey}
 * @throws {Error} if key binding is invalid
 */
export function parseKey(keyStr, syntax = []) {
  if (!keyStr || typeof keyStr !== 'string') {
    throw new Error(`Invalid key binding: ${keyStr}`)
  }
  const parts = keyStr.toLowerCase().split('+').map(p => p.trim()).filter(Boolean)
  const { mods, remaining } = parseMods(parts)
  const rawKey = remaining[0]
  if (rawKey === undefined) {
    throw new Error(`Key binding has no key (only modifiers): "${keyStr}"`)
  }
  if (remaining.length > 1) {
    throw new Error(`Key binding has multiple keys: "${keyStr}" (got: ${remaining.join(', ')})`)
  }
  let key = rawKey
  for (const s of syntax) key = s.alias?.(key) ?? key
  if (!isLetterOrDigit(key) && !NAMED_KEY.test(key) && !syntax.some((s) => s.accepts?.(key))) {
    throw new Error(`Unknown key "${rawKey}" in binding "${keyStr}"`)
  }
  // With Shift held a digit types a different character, so the binding means the physical key
  if (mods.shift) {
    if (/^[0-9]$/.test(key)) key = `digit${key}`
    for (const s of syntax) key = s.shifted?.(key) ?? key
  }
  return { mods, key }
}

/**
 * Convert parsed key to lookup key (e.g., "ctrl+shift+k")
 * @param {ParsedKey} parsed
 * @returns {string}
 */
export function keyToLookup(parsed) {
  return `${modsToPrefix(parsed.mods)}${parsed.key}`
}

/**
 * Convert keyboard event to lookup keys (returns multiple for key/code variants)
 * @param {KeyboardEvent} event
 * @param {string} [prefix] - Modifier prefix to use instead of the event's own
 * @param {string} [suffix] - Appended to every lookup (e.g. ":up")
 * @param {KeySyntax[]} [syntax]
 * @returns {string[]}
 */
export function eventToKeyLookups(event, prefix = modsToPrefix(eventMods(event)), suffix = '', syntax = []) {
  const key = event.key.toLowerCase()
  const code = event.code.toLowerCase()
  const codeKey = code.startsWith('key') ? code.slice(3) : null

  const lookups = [`${prefix}${key}${suffix}`]
  if (code !== key) lookups.push(`${prefix}${code}${suffix}`)
  if (codeKey && codeKey !== key) lookups.push(`${prefix}${codeKey}${suffix}`)
  for (const s of syntax) if (s.lookups) lookups.push(...s.lookups(key, prefix, suffix))
  return lookups
}

/**
 * The keyboard
 * @param {...KeySyntax} syntax - More binding syntax: symbols(), aliases()
 * @returns {Input & { syntax: KeySyntax[] }}
 */
export function keys(...syntax) {
  return {
    field: 'keys',
    syntax,
    parse(binding) {
      const parsed = parseKey(binding, syntax)
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
        d.candidates(eventToKeyLookups(event, modsToPrefix(mods), suffix, syntax), eventToKeyLookups(event, '', suffix, syntax), mods)

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
        if (!d.releases) return
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
        if (!d.releases) return
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
