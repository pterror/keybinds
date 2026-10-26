/**
 * Holding a modifier on its own, or tapping it, as a trigger (the cheatsheet opens this way).
 */
/**
 * Trigger callback when a modifier key is held
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {(held: boolean) => void} callback - Called with true on hold, false on release
 * @param {{ delay?: number, target?: EventTarget }} [options]
 * @returns {() => void} Cleanup function
 *
 * @example
 * const cleanup = onModifierHold('Control', (held) => {
 *   cheatsheet.open = held
 * }, { delay: 300 })
 */
export declare function onModifierHold(modifiers: string | string[], callback: (held: boolean) => void, options?: {
    delay?: number;
    target?: EventTarget;
}): () => void;
/**
 * Trigger callback when a modifier key is tapped (pressed and released by itself) `count` times in
 * quick succession, as in double-tapping Shift.
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {number} count - Taps in a row
 * @param {() => void} callback
 * @param {{ within?: number, target?: EventTarget }} [options] - `within`: most ms from one tap's
 *   press to the next tap's release (default 400)
 * @returns {() => void} Cleanup function
 *
 * @example
 * onModifierTaps('Control', 2, () => { cheatsheet.open = !cheatsheet.open })
 */
export declare function onModifierTaps(modifiers: string | string[], count: number, callback: () => void, options?: {
    within?: number;
    target?: EventTarget;
}): () => void;
