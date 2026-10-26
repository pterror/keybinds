/**
 * Showing and recording keyboard bindings, for the settings panel, cheatsheet, palette and menus.
 */

import { RELEASE_SUFFIX, eventModParts, formatModPart, formatWithRelease } from './core.js'
import { keys, KEY_ALIASES, PUNCTUATION_CODES, NAMED_KEY, isSymbolKey, isValidKey } from './keys.js'

/** @typedef {import('./core.js').InputUI} InputUI */

// How a physical key name is shown: the character it types on a US layout
const CODE_GLYPHS = /** @type {Record<string, string>} */ ({
  ...Object.fromEntries(Object.entries(PUNCTUATION_CODES).map(([ch, code]) => [code, ch])),
  ...Object.fromEntries(Array.from({ length: 10 }, (_, d) => [`digit${d}`, String(d)])),
  plus: '+'
})

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

const LETTER_OR_DIGIT = /^[a-z0-9]$/

/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k")
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone) and keys that can't be bound.
 *
 * @param {KeyboardEvent} event
 * @returns {string | null}
 */
export function eventToBindingString(event) {
  const key = event.key.toLowerCase()
  const suffix = event.type === 'keyup' ? RELEASE_SUFFIX : ''

  // Ignore bare modifier presses
  if (['shift', 'control', 'alt', 'meta'].includes(key)) return null

  // Normalize key name — prefer event.key, fall back to the physical key when the character
  // typed isn't one a binding names (Option+A types "å" on a Mac)
  let normalizedKey = key === ' ' ? 'space' : key === '+' ? 'plus' : key
  const code = event.code.toLowerCase()
  if (code.startsWith('key')) {
    const codeKey = code.slice(3)
    const named = LETTER_OR_DIGIT.test(key) || key in PUNCTUATION_CODES || NAMED_KEY.test(KEY_ALIASES[key] ?? key)
    if (LETTER_OR_DIGIT.test(codeKey) && !named) normalizedKey = codeKey
  }

  if (!isValidKey(KEY_ALIASES[normalizedKey] ?? normalizedKey)) return null
  // A symbol is recorded as the character typed ("?"), which already says Shift was needed
  const shift = event.shiftKey && !isSymbolKey(KEY_ALIASES[normalizedKey] ?? normalizedKey)

  return [...eventModParts(event, shift), normalizedKey].join('+') + suffix
}

/**
 * The keyboard, shown and recorded as well as listened to
 * @returns {InputUI}
 */
export function keysUI() {
  return {
    ...keys(),
    label: 'Key',
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
  }
}
