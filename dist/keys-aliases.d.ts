/**
 * Short names for keys in bindings: "up", "down", "left", "right" for the arrow keys, and "plus"
 * for "+" (which separates a binding's parts, so it can't be written as itself; needs symbols()).
 */
export type KeySyntax = import('./keys.js').KeySyntax;
/** @typedef {import('./keys.js').KeySyntax} KeySyntax */
export declare const KEY_ALIASES: Record<string, string>;
/**
 * For keys(aliases())
 * @returns {KeySyntax}
 */
export declare function aliases(): KeySyntax;
