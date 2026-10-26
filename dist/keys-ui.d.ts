/**
 * Showing and recording keyboard bindings, for the settings panel, cheatsheet, palette and menus.
 */
export type InputUI = import('./core.js').InputUI;
/**
 * Format key binding into array of display parts (e.g., "$mod+k" -> ["⌘", "K"] on Mac)
 * @param {string} key
 * @returns {string[]}
 */
export declare function formatKeyParts(key: string): string[];
/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k")
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone) and keys that can't be bound.
 *
 * @param {KeyboardEvent} event
 * @returns {string | null}
 */
export declare function eventToBindingString(event: KeyboardEvent): string | null;
/**
 * The keyboard, shown and recorded as well as listened to
 * @returns {InputUI}
 */
export declare function keysUI(): InputUI;
