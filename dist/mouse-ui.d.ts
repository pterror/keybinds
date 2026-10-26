/**
 * Showing and recording mouse bindings, for the settings panel, cheatsheet, palette and menus.
 */
export type InputUI = import('./core.js').InputUI;
/**
 * Format mouse binding into array of display parts
 * @param {string} binding
 * @returns {string[]}
 */
export declare function formatMouseParts(binding: string): string[];
/**
 * Convert a MouseEvent or WheelEvent to a canonical binding string (e.g. "$mod+click", "$mod+scrollup")
 *
 * @param {MouseEvent} event
 * @returns {string | null}
 */
export declare function eventToMouseBindingString(event: MouseEvent): string | null;
/**
 * The mouse, shown and recorded as well as listened to
 * @param {{ wheel?: { step?: number, idle?: number } }} [options] - As for mouse()
 * @returns {InputUI}
 */
export declare function mouseUI(options?: {
    wheel?: {
        step?: number;
        idle?: number;
    };
}): InputUI;
