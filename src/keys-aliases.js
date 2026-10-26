/**
 * Short names for keys in bindings: "up", "down", "left", "right" for the arrow keys, and "plus"
 * for "+" (which separates a binding's parts, so it can't be written as itself; needs symbols()).
 */

/** @typedef {import('./keys.js').KeySyntax} KeySyntax */

export const KEY_ALIASES = /** @type {Record<string, string>} */ ({
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  plus: '+'
})

/**
 * For keys(aliases())
 * @returns {KeySyntax}
 */
export function aliases() {
  return { name: 'aliases', alias: (name) => KEY_ALIASES[name] }
}
