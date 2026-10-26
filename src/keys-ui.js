/**
 * Showing and recording keyboard bindings, for the settings panel, cheatsheet, palette and menus.
 */

import { RELEASE_SUFFIX, eventModParts, formatModPart, formatWithRelease } from './core.js'
import { keys, NAMED_KEY, isLetterOrDigit } from './keys.js'
import { PUNCTUATION_CODES, isSymbolKey } from './keys-symbols.js'

/** @typedef {import('./core.js').InputUI} InputUI */
/** @typedef {import('./keys.js').KeySyntax} KeySyntax */

// How a physical key name is shown: the character it types on a US layout
const CODE_GLYPHS = /** @type {Record<string, string>} */ ({
  ...Object.fromEntries(Object.entries(PUNCTUATION_CODES).map(([ch, code]) => [code, ch])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, d) => [`digit${d}`, String(d)])),
  plus: '+'
})

/**
 * Format a single key part for display
 * @param {string} part
 * @param {KeySyntax[]} syntax - A layout() among them shows physical keys as it types them
 * @returns {string}
 */
function formatKeyPart(part, syntax) {
  const p = part.trim().toLowerCase()
  const mod = formatModPart(p)
  if (mod) return mod
  for (const s of syntax) {
    const glyph = s.glyph?.(p)
    if (glyph) return glyph
  }
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
 * @param {KeySyntax[]} [syntax] - As for keys(); a layout() among them shows physical keys as it types them
 * @returns {string[]}
 */
export function formatKeyParts(key, syntax = []) {
  return formatWithRelease(key, (part) => formatKeyPart(part, syntax))
}

const ASCII_LETTER_OR_DIGIT = /^[a-z0-9]$/

/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k"), in the syntax the
 * keyboard input reads: a typed character like "?" only with symbols(), "plus" only with aliases()
 * too; otherwise the physical key ("shift+slash").
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone) and keys that can't be bound.
 *
 * @param {KeyboardEvent} event
 * @param {KeySyntax[]} [syntax]
 * @returns {string | null}
 */
export function eventToBindingString(event, syntax = []) {
  const key = event.key.toLowerCase()
  const suffix = event.type === 'keyup' ? RELEASE_SUFFIX : ''

  // Ignore bare modifier presses
  if (['shift', 'control', 'alt', 'meta'].includes(key)) return null

  let name = key === ' ' ? 'space' : key
  const code = event.code.toLowerCase()
  // A letter key typing something no binding names (Option+A types "å" on a Mac) is the key itself
  if (/^key[a-z]$/.test(code) && !ASCII_LETTER_OR_DIGIT.test(name) && !NAMED_KEY.test(name) && !isSymbolKey(name)) name = code.slice(3)

  if (isSymbolKey(name)) {
    const symbols = syntax.some((s) => s.name === 'symbols')
    const aliases = syntax.some((s) => s.name === 'aliases')
    // A symbol is recorded as the character typed ("?"), which already says Shift was needed
    if (symbols && (name !== '+' || aliases)) return [...eventModParts(event, false), name === '+' ? 'plus' : name].join('+') + suffix
    // Otherwise as the physical key that typed it (a letter key, on some layouts)
    if (/^key[a-z]$/.test(code)) name = code.slice(3)
    else if (NAMED_KEY.test(code)) name = code
    else return null
  } else if (!isLetterOrDigit(name) && !NAMED_KEY.test(name)) {
    return null
  }
  return [...eventModParts(event), name].join('+') + suffix
}

/**
 * The keyboard, shown and recorded as well as listened to
 * @param {...KeySyntax} syntax - As for keys()
 * @returns {InputUI}
 */
export function keysUI(...syntax) {
  return {
    ...keys(...syntax),
    label: 'Key',
    format: (binding) => formatKeyParts(binding, syntax),
    release: () => true,
    prompt: (release) => release ? 'Press and release a key...' : 'Press a key...',

    record({ release, ignore }, done) {
      /** @type {{ id: string, binding: string } | null} */
      let held = null
      /** @param {Event} e */
      const down = (e) => {
        const event = /** @type {KeyboardEvent} */ (e)
        if (ignore(event) || event.key === 'Escape') return
        const binding = eventToBindingString(event, syntax)
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
  }
}
