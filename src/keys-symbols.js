/**
 * Typed characters as key bindings: "?", "!", "/", "+" (written "plus" with aliases()). A binding
 * to one matches however it was typed: "?" takes Shift on most layouts, and still fires.
 */

/** @typedef {import('./keys.js').KeySyntax} KeySyntax */

// Punctuation keys, and the name of the physical key that types each on a US layout (event.code)
export const PUNCTUATION_CODES = /** @type {Record<string, string>} */ ({
  '[': 'bracketleft', ']': 'bracketright', '\\': 'backslash', ';': 'semicolon', "'": 'quote',
  ',': 'comma', '.': 'period', '/': 'slash', '`': 'backquote', '-': 'minus', '=': 'equal'
})

/**
 * A single printable character that isn't a letter or digit ("?", "!", "+"; "é" is a letter)
 * @param {string} key
 * @returns {boolean}
 */
export function isSymbolKey(key) {
  return [...key].length === 1 && key.trim() !== '' && key.toLowerCase() === key.toUpperCase() && !/[0-9]/.test(key)
}

/**
 * For keys(symbols())
 * @returns {KeySyntax}
 */
export function symbols() {
  return {
    name: 'symbols',
    accepts: isSymbolKey,
    // With Shift held, a punctuation key types a different character ("shift+/" types "?"), so
    // the binding means the physical key: "shift+slash"
    shifted: (key) => PUNCTUATION_CODES[key],
    // "?" is bound as "?", but typing it takes Shift
    lookups: (key, prefix, suffix) =>
      isSymbolKey(key) && prefix.includes('shift+') ? [`${prefix.replace('shift+', '')}${key}${suffix}`] : [],
  }
}
