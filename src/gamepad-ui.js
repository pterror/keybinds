/**
 * Showing and recording gamepad bindings, for the settings panel, cheatsheet, palette and menus.
 */

import { RELEASE_SUFFIX, formatWithRelease } from './core.js'
import { gamepad, GAMEPAD_BUTTONS, GAMEPAD_ALIASES, hasPads } from './gamepad.js'

/** @typedef {import('./core.js').InputUI} InputUI */

/** @type {Record<string, string>} */
const GAMEPAD_GLYPHS = {
  a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', back: 'Back', start: 'Start',
  ls: 'LS', rs: 'RS', up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →', home: 'Home',
}

/**
 * Format a gamepad binding into display parts (e.g. "rt:up" -> ["RT", "Release"])
 * @param {string} binding
 * @returns {string[]}
 */
export function formatGamepadParts(binding) {
  return formatWithRelease(binding, (part) => {
    const p = part.trim().toLowerCase()
    return GAMEPAD_GLYPHS[GAMEPAD_ALIASES[p] ?? p] ?? part
  })
}

/**
 * Gamepad buttons, shown and recorded as well as listened to. Recording is offered while a pad
 * is connected.
 * @returns {InputUI}
 */
export function gamepadUI() {
  return {
    ...gamepad(),
    label: 'Gamepad',
    format: formatGamepadParts,
    release: () => true,
    prompt: (release) => release ? 'Press and release a gamepad button...' : 'Press a gamepad button...',
    available: () => hasPads() && navigator.getGamepads().some(Boolean),
    watch(onChange) {
      window.addEventListener('gamepadconnected', onChange)
      window.addEventListener('gamepaddisconnected', onChange)
      return () => {
        window.removeEventListener('gamepadconnected', onChange)
        window.removeEventListener('gamepaddisconnected', onChange)
      }
    },

    // Recording reads every pad each frame. Buttons already down when recording starts don't
    // count until they've been let go
    record({ release }, done) {
      /** @type {Map<number, boolean[]>} */
      const before = new Map()
      /** @type {string | null} */
      let held = null
      /** @type {number | null} */
      let frame = null
      const read = () => {
        frame = null
        for (const pad of navigator.getGamepads()) {
          if (!pad) continue
          const now = pad.buttons.slice(0, GAMEPAD_BUTTONS.length).map((b) => b.pressed)
          const was = before.get(pad.index)
          before.set(pad.index, now)
          if (!was) continue
          for (let i = 0; i < now.length; i++) {
            const name = /** @type {string} */ (GAMEPAD_BUTTONS[i])
            const id = `${pad.index}:${i}`
            if (now[i] && !was[i]) {
              if (!release) return done(name)
              held = id
            } else if (!now[i] && was[i] && held === id) {
              return done(name + RELEASE_SUFFIX)
            }
          }
        }
        frame = requestAnimationFrame(read)
      }
      if (hasPads()) frame = requestAnimationFrame(read)
      return () => { if (frame !== null) cancelAnimationFrame(frame) }
    },
  }
}
