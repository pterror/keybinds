/**
 * Showing physical keys ("slash", "digit1", "bracketleft") as the character they type on the
 * person's own keyboard layout, rather than a US one. Browsers that can tell (Chromium) say so
 * through navigator.keyboard.getLayoutMap(); elsewhere keys show as on a US layout.
 *
 * @example
 * const input = keysUI(layout())  // follows the layout, and switches to it
 */
export type KeySyntax = import('./keys.js').KeySyntax;
/**
 * The person's keyboard layout, from the browser, or null where it can't tell
 * @returns {Promise<Map<string, string> | null>}
 */
export declare function loadLayout(): Promise<Map<string, string> | null>;
/**
 * For keysUI(layout()): shows physical keys as the person's layout types them.
 *
 * Without a map, it loads the layout and follows it: browsers say nothing when someone switches
 * layouts, so it looks again when the window gets focus back, and when a key types something other
 * than the layout it has says it should. Components showing bindings update when it changes. Given
 * a map (from loadLayout(), or null), it shows that one and nothing more.
 * @param {Map<string, string> | null} [map]
 * @returns {KeySyntax}
 */
export declare function layout(map?: Map<string, string> | null): KeySyntax;
