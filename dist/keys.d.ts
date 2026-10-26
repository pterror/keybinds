/**
 * Keyboard input: bindings like "$mod+k", "Escape", "?" or "k:up". Showing and recording them is
 * keybinds/keys-ui.
 */
export type Modifiers = import('./core.js').Modifiers;
export type Input = import('./core.js').Input;
export type ParsedKey = {
    mods: Modifiers;
    key: string;
    release: boolean;
};
/** @typedef {import('./core.js').Modifiers} Modifiers */
/** @typedef {import('./core.js').Input} Input */
/**
 * @typedef {Object} ParsedKey
 * @property {Modifiers} mods
 * @property {string} key
 * @property {boolean} release - Binding fires when the key comes up ("k:up")
 */
export declare const KEY_ALIASES: Record<string, string>;
export declare const PUNCTUATION_CODES: Record<string, string>;
/**
 * A single printable character that isn't a letter ("?", "!", "+", "é" is a letter).
 * Shift is part of typing these, so a binding to one matches however it was typed.
 * @param {string} key
 * @returns {boolean}
 */
export declare function isSymbolKey(key: string): boolean;
export declare const NAMED_KEY: RegExp;
/**
 * @param {string} key
 * @returns {boolean}
 */
export declare function isValidKey(key: string): boolean;
/**
 * Parse a key string like "Ctrl+Shift+K" or "K:up" into normalized form
 * @param {string} keyStr
 * @returns {ParsedKey}
 * @throws {Error} if key binding is invalid
 */
export declare function parseKey(keyStr: string): ParsedKey;
/**
 * Convert parsed key to lookup key (e.g., "ctrl+shift+k")
 * @param {ParsedKey} parsed
 * @returns {string}
 */
export declare function keyToLookup(parsed: ParsedKey): string;
/**
 * Convert keyboard event to lookup keys (returns multiple for key/code variants)
 * @param {KeyboardEvent} event
 * @param {string} [prefix] - Modifier prefix to use instead of the event's own
 * @param {string} [suffix] - Appended to every lookup (e.g. ":up")
 * @returns {string[]}
 */
export declare function eventToKeyLookups(event: KeyboardEvent, prefix?: string, suffix?: string): string[];
/**
 * The keyboard
 * @returns {Input}
 */
export declare function keys(): Input;
