/**
 * Mouse input: buttons ("$mod+Click", "MiddleClick", "Back:up") and scrolling ("ScrollUp").
 * Showing and recording them is keybinds/mouse-ui.
 */
export type Modifiers = import('./core.js').Modifiers;
export type Input = import('./core.js').Input;
export type Command = import('./core.js').Command;
export type Press = import('./core.js').Press;
export type ParsedMouse = {
    mods: Modifiers;
    button: number;
};
/**
 * Parse a mouse binding like "$mod+Click" or "MiddleClick", without its release suffix
 * Supported: Click/LeftClick, RightClick, MiddleClick, BackClick, ForwardClick, Scroll{Up,Down,Left,Right}
 * @param {string} binding
 * @param {boolean} [release] - Whether it had a release suffix; scrolling has no release
 * @returns {ParsedMouse}
 * @throws {Error} if mouse binding is invalid
 */
export declare function parseMouse(binding: string, release?: boolean): ParsedMouse;
/**
 * Binding name for a MouseEvent.button value, null for buttons with no name
 * @param {number} button
 * @returns {string | null}
 */
export declare function pointerButtonName(button: number): string | null;
/**
 * Which way a wheel event scrolls, as a binding names it; null if it doesn't
 * @param {WheelEvent} event
 * @returns {string | null}
 */
export declare function wheelDirection(event: WheelEvent): string | null;
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
