/**
 * Showing physical keys ("slash", "digit1", "bracketleft") as the character they type on the
 * person's own keyboard layout, rather than a US one. Browsers that can tell (Chromium) say so
 * through navigator.keyboard.getLayoutMap(); elsewhere keys show as on a US layout.
 *
 * @example
 * const input = keysUI(layout(await loadLayout()))
 */

/** @typedef {import('./keys.js').KeySyntax} KeySyntax */

// Physical key names as bindings write them, and as KeyboardEvent.code names them
const CODES = /** @type {Record<string, string>} */ ({
  bracketleft: 'BracketLeft', bracketright: 'BracketRight', backslash: 'Backslash', semicolon: 'Semicolon',
  quote: 'Quote', comma: 'Comma', period: 'Period', slash: 'Slash', backquote: 'Backquote', minus: 'Minus',
  equal: 'Equal', ...Object.fromEntries(Array.from({ length: 10 }, (_, d) => [`digit${d}`, `Digit${d}`])),
})

/**
 * The person's keyboard layout, from the browser, or null where it can't tell
 * @returns {Promise<Map<string, string> | null>}
 */
export async function loadLayout() {
  const keyboard = /** @type {{ getLayoutMap?: () => Promise<Map<string, string>> } | undefined} */ (
    typeof navigator !== 'undefined' ? /** @type {any} */ (navigator).keyboard : undefined)
  if (!keyboard?.getLayoutMap) return null
  try {
    return await keyboard.getLayoutMap()
  } catch {
    // Not allowed here (an iframe without permission, say)
    return null
  }
}

/**
 * For keysUI(layout(map)): shows physical keys as `map` types them. A null map changes nothing.
 * @param {Map<string, string> | null} map - From loadLayout()
 * @returns {KeySyntax}
 */
export function layout(map) {
  return {
    name: 'layout',
    glyph: (name) => {
      const code = CODES[name]
      const typed = code ? map?.get(code) : undefined
      return typed?.toUpperCase()
    },
  }
}
