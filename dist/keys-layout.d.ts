/**
 * Showing physical keys ("slash", "digit1", "bracketleft") as the character they type on the
 * person's own keyboard layout, rather than a US one. Browsers that can tell (Chromium) say so
 * through navigator.keyboard.getLayoutMap(); elsewhere keys show as on a US layout.
 *
 * @example
 * const input = keysUI(layout(await loadLayout()))
 */
export type KeySyntax = import('./keys.js').KeySyntax;
/**
 * The person's keyboard layout, from the browser, or null where it can't tell
 * @returns {Promise<Map<string, string> | null>}
 */
export declare function loadLayout(): Promise<Map<string, string> | null>;
/**
 * For keysUI(layout(map)): shows physical keys as `map` types them. A null map changes nothing.
 * @param {Map<string, string> | null} map - From loadLayout()
 * @returns {KeySyntax}
 */
export declare function layout(map: Map<string, string> | null): KeySyntax;
