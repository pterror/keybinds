/**
 * Release bindings: "k:up", "middle:up", "a:up" run when the key or button comes up.
 */

import { isActive } from './core.js'

/**
 * Release bindings, for keybinds({ releases: releases() }). A command whose own press fired
 * always gets its release (a hold can't be left open); other release bindings run as usual until
 * one takes the event.
 * @returns {import('./core.js').Releases}
 */
export function releases() {
  return (candidates, press, event, { blocked = false, inInput = false }, { context, execute }) => {
    let consumed = false
    for (const cmd of candidates) {
      if (press.fired.has(cmd)) {
        if (execute(cmd, context, event)) consumed = true
        continue
      }
      if (consumed || blocked) continue
      if (inInput && !cmd.captureInput) continue
      if (!isActive(cmd, context)) continue
      if (execute(cmd, context, event)) consumed = true
    }
    return consumed
  }
}
