/**
 * Typed characters as key bindings: "?", "!", "/", "+" (written "plus" with aliases()). A binding
 * to one matches however it was typed: "?" takes Shift on most layouts, and still fires.
 */
export type KeySyntax = import('./keys.js').KeySyntax;
/** @typedef {import('./keys.js').KeySyntax} KeySyntax */
export declare const PUNCTUATION_CODES: Record<string, string>;
/**
 * A single printable character that isn't a letter or digit ("?", "!", "+"; "é" is a letter)
 * @param {string} key
 * @returns {boolean}
 */
export declare function isSymbolKey(key: string): boolean;
/**
 * For keys(symbols())
 * @returns {KeySyntax}
 */
export declare function symbols(): KeySyntax;
