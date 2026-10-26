/**
 * Keyboard input: bindings like "$mod+k", "shift+slash" or "Escape". More syntax is opt-in, each
 * its own module passed to keys(): symbols() for "?" and other typed characters, aliases() for
 * "up" and "plus". Showing and recording bindings is keybinds/keys-ui.
 */
export type Modifiers = import('./core.js').Modifiers;
export type Input = import('./core.js').Input;
export type ParsedKey = {
    mods: Modifiers;
    key: string;
};
export type KeySyntax = {
    name: string;
    alias?: (name: string) => string | undefined;
    accepts?: (key: string) => boolean;
    shifted?: (key: string) => string | undefined;
    lookups?: (key: string, prefix: string, suffix: string) => string[];
    glyph?: (name: string) => string | undefined;
    watch?: (onChange: () => void) => () => void;
};
/** @typedef {import('./core.js').Modifiers} Modifiers */
/** @typedef {import('./core.js').Input} Input */
/**
 * @typedef {Object} ParsedKey
 * @property {Modifiers} mods
 * @property {string} key
 */
/**
 * A piece of key binding syntax beyond modifiers and key names
 * @typedef {Object} KeySyntax
 * @property {string} name
 * @property {(name: string) => string | undefined} [alias] - The key a name stands for
 * @property {(key: string) => boolean} [accepts] - Keys it makes bindable
 * @property {(key: string) => string | undefined} [shifted] - What a binding with Shift means instead
 * @property {(key: string, prefix: string, suffix: string) => string[]} [lookups] - More lookups for a key event
 * @property {(name: string) => string | undefined} [glyph] - How a key is shown, for display pieces like layout()
 * @property {(onChange: () => void) => () => void} [watch] - Follows how keys are shown changing
 */
export declare const NAMED_KEY: RegExp;
/**
 * A letter (in any script) or a digit: what a key types on its own, bindable as itself
 * @param {string} key
 */
export declare const isLetterOrDigit: (key: string) => boolean;
/**
 * Parse a key string like "Ctrl+Shift+K" into normalized form. Its release suffix, if any, has
 * already been taken off.
 * @param {string} keyStr
 * @param {KeySyntax[]} [syntax]
 * @returns {ParsedKey}
 * @throws {Error} if key binding is invalid
 */
export declare function parseKey(keyStr: string, syntax?: KeySyntax[]): ParsedKey;
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
 * @param {KeySyntax[]} [syntax]
 * @returns {string[]}
 */
export declare function eventToKeyLookups(event: KeyboardEvent, prefix?: string, suffix?: string, syntax?: KeySyntax[]): string[];
/**
 * The keyboard
 * @param {...KeySyntax} syntax - More binding syntax: symbols(), aliases()
 * @returns {Input & { syntax: KeySyntax[] }}
 */
export declare function keys(...syntax: KeySyntax[]): Input & {
    syntax: KeySyntax[];
};
