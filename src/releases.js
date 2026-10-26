/**
 * Release bindings: "k:up", "middle:up", "a:up" run when the key or button comes up.
 */

import { RELEASE_SUFFIX } from './core.js'

/**
 * Release bindings, for keybinds({ releases: releases() }). A command whose own press ran always
 * gets its release (a hold can't be left open); other release bindings run as usual until one
 * takes the event.
 * @returns {import('./core.js').Phase}
 */
export function releases() {
  return {
    suffixes: [RELEASE_SUFFIX],
    up(p) {
      const found = p.find(RELEASE_SUFFIX)
      if (!found) return false
      let consumed = false
      for (const cmd of found) {
        if (p.press.fired.has(cmd)) {
          if (p.execute(cmd)) consumed = true
        } else if (!consumed && p.allowed(cmd) && p.execute(cmd)) {
          consumed = true
        }
      }
      return consumed
    },
  }
}
