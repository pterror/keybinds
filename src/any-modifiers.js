/**
 * Commands with `anyModifiers: true`: their bindings match whatever other modifiers are held, as a
 * game's movement keys should. A binding's own modifiers are still required, and a command bound
 * exactly to what was pressed comes first.
 */

import { holdsAll } from './core.js'

/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').Modifiers} Modifiers */

/**
 * For keybinds({ anyModifiers: anyModifiers() })
 * @returns {import('./core.js').AnyModifiers}
 */
export function anyModifiers() {
  return {
    table() {
      /** Bindings by their lookup without modifiers, with the modifiers they still need */
      /** @type {Map<string, { cmd: Command, mods: Modifiers }[]>} */
      const loose = new Map()
      return {
        add(parsed, cmd) {
          const list = loose.get(parsed.loose)
          if (list) list.push({ cmd, mods: parsed.mods })
          else loose.set(parsed.loose, [{ cmd, mods: parsed.mods }])
        },
        find(lookups, mods, found) {
          /** @type {{ cmd: Command, mods: Modifiers }[] | undefined} */
          let bound
          for (const l of lookups) {
            bound = loose.get(l)
            if (bound) break
          }
          const extra = (bound ?? []).filter((b) => holdsAll(b.mods, mods) && !found?.includes(b.cmd)).map((b) => b.cmd)
          if (extra.length === 0) return found
          return found ? [...found, ...extra] : extra
        },
        size: () => loose.size,
      }
    },
  }
}
