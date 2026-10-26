/**
 * Gamepad buttons: bindings like "a", "rt" or "start:up". Gamepad buttons take no modifiers.
 * Showing and recording them is keybinds/gamepad-ui.
 */

import { RELEASE_SUFFIX, NO_MODS, anyOverlayOpen } from './core.js'

/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').Press} Press */

// The browser's "standard" gamepad layout, by button index. Face buttons are named by position
// (an Xbox pad's A is "a", a PlayStation pad's cross is too)
export const GAMEPAD_BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home']
/** @type {Record<string, string>} */
export const GAMEPAD_ALIASES = {
  south: 'a', east: 'b', west: 'x', north: 'y', l1: 'lb', r1: 'rb', l2: 'lt', r2: 'rt',
  select: 'back', view: 'back', menu: 'start', l3: 'ls', r3: 'rs', guide: 'home',
  dpadup: 'up', dpaddown: 'down', dpadleft: 'left', dpadright: 'right',
}
export const hasPads = () => typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'

/**
 * Parse a gamepad binding like "a" or "rt", without its release suffix
 * @param {string} binding
 * @returns {number} The button's index
 * @throws {Error} if the binding is invalid
 */
function parseGamepad(binding) {
  if (!binding || typeof binding !== 'string') {
    throw new Error(`Invalid gamepad binding: ${binding}`)
  }
  const body = binding.trim().toLowerCase()
  const button = GAMEPAD_BUTTONS.indexOf(GAMEPAD_ALIASES[body] ?? body)
  if (button === -1) {
    throw new Error(`Unknown gamepad button "${body}" in binding "${binding}". Valid: ${GAMEPAD_BUTTONS.join(', ')}`)
  }
  return button
}

/**
 * Gamepad buttons. Gamepads have no events for their buttons, so they're read every frame, but
 * only while a command has a gamepad binding and a pad is connected.
 * @returns {Input}
 */
export function gamepad() {
  return {
    field: 'gamepad',
    parse(binding) {
      const lookup = /** @type {string} */ (GAMEPAD_BUTTONS[parseGamepad(binding)])
      return { lookup, loose: lookup, mods: NO_MODS }
    },
    listen(d) {
      /** @type {Map<number, boolean[]>} each pad's buttons as last seen */
      const padButtons = new Map()
      const canPoll = d.bound && hasPads()
      /** @type {number | null} */
      let pollFrame = null

      /**
       * @param {number} pad
       * @param {number} button
       * @param {boolean} down
       */
      function onButton(pad, button, down) {
        const id = `${pad}:${button}`
        const name = GAMEPAD_BUTTONS[button]
        const event = new CustomEvent(down ? 'gamepadbuttondown' : 'gamepadbuttonup', { cancelable: true, detail: { gamepad: pad, button: name } })
        if (!down) {
          const press = d.presses.get(id)
          if (!press) return
          d.presses.delete(id)
          const found = d.releases ? d.candidates([`${name}${RELEASE_SUFFIX}`], [], NO_MODS) : undefined
          if (found) d.release(found, press, event, { blocked: anyOverlayOpen() })
          return
        }
        /** @type {Press} */
        const press = { mods: NO_MODS, fired: new Set() }
        d.presses.set(id, press)
        if (anyOverlayOpen()) return
        const found = d.candidates([`${name}`], [], NO_MODS)
        if (found) d.fire(found, event, { press })
      }

      function poll() {
        pollFrame = null
        /** @type {Set<number>} */
        const seen = new Set()
        for (const pad of navigator.getGamepads()) {
          if (!pad) continue
          seen.add(pad.index)
          const now = pad.buttons.slice(0, GAMEPAD_BUTTONS.length).map((b) => b.pressed)
          const before = padButtons.get(pad.index)
          padButtons.set(pad.index, now)
          // Buttons already down when a pad is first seen are where it starts, not presses
          if (!before) continue
          now.forEach((down, i) => {
            if (down !== before[i]) onButton(pad.index, i, down)
          })
        }
        // A pad that went away lets go of everything it held
        for (const [index, buttons] of padButtons) {
          if (seen.has(index)) continue
          padButtons.delete(index)
          buttons.forEach((down, i) => { if (down) onButton(index, i, false) })
        }
        if (seen.size > 0) pollFrame = requestAnimationFrame(poll)
      }

      function startPolling() {
        if (canPoll && pollFrame === null) pollFrame = requestAnimationFrame(poll)
      }

      startPolling()
      if (canPoll) window.addEventListener('gamepadconnected', startPolling)
      return () => {
        if (pollFrame !== null) cancelAnimationFrame(pollFrame)
        pollFrame = null
        if (canPoll) window.removeEventListener('gamepadconnected', startPolling)
        padButtons.clear()
      }
    },
  }
}
