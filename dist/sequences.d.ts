/**
 * Bindings of several steps, written with spaces: "g i", "ctrl+k ctrl+s", "k k" for a double tap.
 * Each step must come within `timeout` of the last. A step that starts a sequence is the
 * sequence's: it doesn't reach the page, and it can't also be a binding of its own.
 */
export type Command = import('./core.js').Command;
/** @typedef {import('./core.js').Command} Command */
/**
 * For keybinds({ sequences: sequences() })
 * @param {{ timeout?: number }} [options] - Most ms between steps (default 1000)
 * @returns {import('./core.js').Sequences}
 */
export declare function sequences({ timeout }?: {
    timeout?: number;
}): import('./core.js').Sequences;
