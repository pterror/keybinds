/**
 * Holding and tapping: "k:hold" runs once a key or button has been held for a while, "k:tap" when
 * it comes up before that. Together they give one key two jobs.
 */
/**
 * For keybinds({ holds: holds() })
 * @param {{ delay?: number }} [options] - How long a press is held before it's a hold, in ms (default 500)
 * @returns {import('./core.js').Phase}
 */
export declare function holds({ delay }?: {
    delay?: number;
}): import('./core.js').Phase;
