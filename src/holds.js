/**
 * Holding and tapping: "k:hold" runs once a key or button has been held for a while, "k:tap" when
 * it comes up before that. Together they give one key two jobs.
 */

/**
 * For keybinds({ holds: holds() })
 * @param {{ delay?: number }} [options] - How long a press is held before it's a hold, in ms (default 500)
 * @returns {import('./core.js').Phase}
 */
export function holds({ delay = 500 } = {}) {
  /** Each press's timer, while it's waiting to become a hold */
  /** @type {WeakMap<import('./core.js').Press, ReturnType<typeof setTimeout>>} */
  const timers = new WeakMap()
  return {
    suffixes: [':hold', ':tap'],
    down(p) {
      if (!p.find(':hold')) return
      timers.set(p.press, setTimeout(() => {
        if (!p.held()) return
        const found = p.find(':hold')
        if (found) p.fire(found)
      }, delay))
    },
    up(p) {
      clearTimeout(timers.get(p.press))
      if (performance.now() - p.press.at >= delay) return false
      const found = p.find(':tap')
      return !!found && p.fire(found)
    },
  }
}
