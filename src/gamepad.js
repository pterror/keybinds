/**
 * Gamepad buttons: bindings like "a", "rt" or "start:up". Gamepad buttons take no modifiers.
 */

import { RELEASE_SUFFIX, NO_MODS, splitRelease, formatWithRelease, anyOverlayOpen } from './core.js'

/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').Press} Press */

// The browser's "standard" gamepad layout, by button index. Face buttons are named by position
// (an Xbox pad's A is "a", a PlayStation pad's cross is too)
const GAMEPAD_BUTTONS = ['a', 'b', 'x', 'y', 'lb', 'rb', 'lt', 'rt', 'back', 'start', 'ls', 'rs', 'up', 'down', 'left', 'right', 'home']
/** @type {Record<string, string>} */
const GAMEPAD_ALIASES = {
  south: 'a', east: 'b', west: 'x', north: 'y', l1: 'lb', r1: 'rb', l2: 'lt', r2: 'rt',
  select: 'back', view: 'back', menu: 'start', l3: 'ls', r3: 'rs', guide: 'home',
  dpadup: 'up', dpaddown: 'down', dpadleft: 'left', dpadright: 'right',
}
/** @type {Record<string, string>} */
const GAMEPAD_GLYPHS = {
  a: 'A', b: 'B', x: 'X', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', back: 'Back', start: 'Start',
  ls: 'LS', rs: 'RS', up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →', home: 'Home',
}

const hasPads = () => typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'

/**
 * Parse a gamepad binding like "a", "rt" or "start:up"
 * @param {string} binding
 * @returns {{ button: number, release: boolean }}
 * @throws {Error} if the binding is invalid
 */
function parseGamepad(binding) {
  if (!binding || typeof binding !== 'string') {
    throw new Error(`Invalid gamepad binding: ${binding}`)
  }
  const { body, release } = splitRelease(binding.toLowerCase())
  const name = GAMEPAD_ALIASES[body] ?? body
  const button = GAMEPAD_BUTTONS.indexOf(name)
  if (button === -1) {
    throw new Error(`Unknown gamepad button "${body}" in binding "${binding}". Valid: ${GAMEPAD_BUTTONS.join(', ')}`)
  }
  return { button, release }
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
 * Gamepad buttons. Gamepads have no events for their buttons, so they're read every frame, but
 * only while a command has a gamepad binding and a pad is connected.
 * @returns {Input}
 */
export function gamepad() {
  return {
    field: 'gamepad',
    label: 'Gamepad',
    parse(binding) {
      const { button, release } = parseGamepad(binding)
      const lookup = `${GAMEPAD_BUTTONS[button]}${release ? RELEASE_SUFFIX : ''}`
      return { lookup, loose: lookup, mods: NO_MODS }
    },
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
          const found = d.candidates([`${name}${RELEASE_SUFFIX}`], [], NO_MODS)
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
