/**
 * Mouse input: buttons ("$mod+Click", "MiddleClick", "Back:up") and scrolling ("ScrollUp").
 */
export type Modifiers = import('./core.js').Modifiers;
export type Input = import('./core.js').Input;
export type Command = import('./core.js').Command;
export type Press = import('./core.js').Press;
export type ParsedMouse = {
    mods: Modifiers;
    button: number;
    release: boolean;
};
/**
 * Parse a mouse binding like "$mod+Click", "MiddleClick" or "Back:up"
 * Supported: Click/LeftClick, RightClick, MiddleClick, BackClick, ForwardClick, Scroll{Up,Down,Left,Right}
 * A trailing ":up" binds the button's release.
 * @param {string} binding
 * @returns {ParsedMouse}
 * @throws {Error} if mouse binding is invalid
 */
export declare function parseMouse(binding: string): ParsedMouse;
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
 * Whether a mouse press is one of a command's press bindings (same button, same modifiers), for
 * code that handles the press itself, like a drag that should start on a rebindable button.
 * @param {Command} cmd
 * @param {MouseEvent} event
 * @returns {boolean}
 */
export declare function mouseMatches(cmd: Command, event: MouseEvent): boolean;
/**
 * The mouse
 * @param {{ wheel?: { step?: number, idle?: number } }} [options] - Scroll bindings: a command
 *   runs once per `step` pixels scrolled (default 50, about one mouse-wheel notch; a trackpad's
 *   small deltas add up to it), and a pause of `idle` ms (default 200) starts a new gesture.
 * @returns {Input}
 */
export declare function mouse(options?: {
    wheel?: {
        step?: number;
        idle?: number;
    };
}): Input;
