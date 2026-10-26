/**
 * Bindings of several steps, written with spaces: "g i", "ctrl+k ctrl+s", "k k" for a double tap.
 * Each step must come within `timeout` of the last. A step that starts a sequence is the
 * sequence's: it doesn't reach the page, and it can't also be a binding of its own.
 */

/** @typedef {import('./core.js').Command} Command */

/**
 * For keybinds({ sequences: sequences() })
 * @param {{ timeout?: number }} [options] - Most ms between steps (default 1000)
 * @returns {import('./core.js').Sequences}
 */
export function sequences({ timeout = 1000 } = {}) {
  return {
    steps(binding, suffix) {
      const steps = binding.replace(/\s*\+\s*/g, '+').split(/\s+/).filter(Boolean)
      if (steps.length > 1 && suffix) throw new Error(`"${binding}${suffix}": a sequence can't end in "${suffix}"`)
      return steps.length > 0 ? steps : [binding]
    },
    table() {
      /** Commands by each start of their sequences ("g", for "g i") */
      /** @type {Map<string, Command[]>} */
      const prefixes = new Map()
      /** The steps so far, while a sequence is under way */
      /** @type {{ prefix: string, at: number } | null} */
      let pending = null
      return {
        add(steps, cmd) {
          if (cmd.anyModifiers) throw new Error(`"${steps.join(' ')}" is a sequence, which can't use anyModifiers`)
          for (let i = 1; i < steps.length; i++) {
            const prefix = steps.slice(0, i).join(' ')
            const list = prefixes.get(prefix)
            if (list) list.push(cmd)
            else prefixes.set(prefix, [cmd])
          }
        },
        // A step that's both a binding and the start of a sequence couldn't tell which was meant
        check(lookups) {
          for (const lookup of lookups) {
            if (prefixes.has(lookup)) throw new Error(`"${lookup}" is both a binding and the start of a sequence`)
          }
        },
        resolve(lookups, find, starts) {
          const now = performance.now()
          const before = pending && now - pending.at <= timeout ? pending.prefix : null
          pending = null
          // A step after others first tries to go on from them; failing that, it's a press of its own
          const tries = before ? [lookups.map((l) => `${before} ${l}`), lookups] : [lookups]
          for (const ls of tries) {
            for (const l of ls) {
              const cmds = prefixes.get(l)
              if (cmds && starts(cmds)) {
                pending = { prefix: l, at: now }
                return { found: undefined, pending: true }
              }
            }
            const found = find(ls)
            if (found) return { found, pending: false }
          }
          return { found: undefined, pending: false }
        },
      }
    },
  }
}
