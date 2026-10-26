/**
 * Keyboard input: bindings like "$mod+k", "Escape", "?" or "k:up".
 */
export type Modifiers = import('./core.js').Modifiers;
export type Input = import('./core.js').Input;
export type Press = import('./core.js').Press;
export type ParsedKey = {
    mods: Modifiers;
    key: string;
    release: boolean;
};
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
 * Format key binding into array of display parts (e.g., "$mod+k" -> ["⌘", "K"] on Mac)
 * @param {string} key
 * @returns {string[]}
 */
export declare function formatKeyParts(key: string): string[];
/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k")
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone)
 * and for keys not in VALID_KEYS.
 *
 * @param {KeyboardEvent} event
 * @returns {string | null}
 */
export declare function eventToBindingString(event: KeyboardEvent): string | null;
/**
 * The keyboard
 * @returns {Input}
 */
export declare function keys(): Input;
