/**
 * Showing and recording keyboard bindings, for the settings panel, cheatsheet, palette and menus.
 */
export type InputUI = import('./core.js').InputUI;
export type KeySyntax = import('./keys.js').KeySyntax;
/**
 * Format key binding into array of display parts (e.g., "$mod+k" -> ["⌘", "K"] on Mac)
 * @param {string} key
 * @param {KeySyntax[]} [syntax] - As for keys(); a layout() among them shows physical keys as it types them
 * @returns {string[]}
 */
export declare function formatKeyParts(key: string, syntax?: KeySyntax[]): string[];
/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k"), in the syntax the
 * keyboard input reads: a typed character like "?" only with symbols(), "plus" only with aliases()
 * too; otherwise the physical key ("shift+slash").
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone) and keys that can't be bound.
 *
 * @param {KeyboardEvent} event
 * @param {KeySyntax[]} [syntax]
 * @returns {string | null}
 */
export declare function eventToBindingString(event: KeyboardEvent, syntax?: KeySyntax[]): string | null;
/**
 * The keyboard, shown and recorded as well as listened to
 * @param {...KeySyntax} syntax - As for keys()
 * @returns {InputUI}
 */
export declare function keysUI(...syntax: KeySyntax[]): InputUI;
