/**
 * Showing physical keys ("slash", "digit1", "bracketleft") as the character they type on the
 * person's own keyboard layout, rather than a US one. Browsers that can tell (Chromium) say so
 * through navigator.keyboard.getLayoutMap(); elsewhere keys show as on a US layout.
 *
 * @example
 * const input = keysUI(layout())  // follows the layout, and switches to it
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
 * @param {Map<string, string> | null} a
 * @param {Map<string, string> | null} b
 */
const sameLayout = (a, b) => a === b || (!!a && !!b && a.size === b.size && [...a].every(([k, v]) => b.get(k) === v))

/**
 * For keysUI(layout()): shows physical keys as the person's layout types them.
 *
 * Without a map, it loads the layout and follows it: browsers say nothing when someone switches
 * layouts, so it looks again when the window gets focus back, and when a key types something other
 * than the layout it has says it should. Components showing bindings update when it changes. Given
 * a map (from loadLayout(), or null), it shows that one and nothing more.
 * @param {Map<string, string> | null} [map]
 * @returns {KeySyntax}
 */
export function layout(map) {
  let current = map ?? null
  /** @type {Set<() => void>} */
  const listeners = new Set()
  /** @type {KeySyntax} */
  const piece = {
    name: 'layout',
    glyph: (name) => {
      const code = CODES[name]
      return (code ? current?.get(code) : undefined)?.toUpperCase()
    },
  }
  if (map !== undefined || typeof window === 'undefined') return piece

  const reload = async () => {
    const next = await loadLayout()
    if (sameLayout(next, current)) return
    current = next
    for (const l of listeners) l()
  }
  /** @param {KeyboardEvent} e */
  const check = (e) => {
    if (!current || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey || [...e.key].length !== 1) return
    const said = current.get(e.code)
    if (said !== undefined && said !== e.key.toLowerCase()) void reload()
  }
  void reload()
  window.addEventListener('focus', reload)
  window.addEventListener('keydown', check, { capture: true, passive: true })
  return {
    ...piece,
    watch(onChange) {
      listeners.add(onChange)
      return () => { listeners.delete(onChange) }
    },
  }
}
