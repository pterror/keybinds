/**
 * Showing and recording axis sources, for the settings panel.
 */

import { axes, parseAxis, axisToLookup, hasPads, PAD_AXES } from './axes.js'
import { keyToLookup } from './keys.js'
import { formatKeyParts, eventToBindingString } from './keys-ui.js'

/** @typedef {import('./core.js').InputUI} InputUI */

/** @type {Record<string, string>} */
const AXIS_GLYPHS = {
  'mouse:x': 'Mouse ↔', 'mouse:y': 'Mouse ↕',
  'pad:lx': 'Left stick ↔', 'pad:ly': 'Left stick ↕', 'pad:rx': 'Right stick ↔', 'pad:ry': 'Right stick ↕',
  'pad:lt': 'LT', 'pad:rt': 'RT',
}

/**
 * Format an axis binding into display parts (e.g. "-mouse:y" -> ["Mouse ↕", "Inverted"])
 * @param {string} binding
 * @returns {string[]}
 */
export function formatAxisParts(binding) {
  let parsed
  try {
    parsed = parseAxis(binding)
  } catch {
    return [binding]
  }
  const parts = parsed.kind === 'keys'
    ? [...formatKeyParts(keyToLookup(parsed.neg)), '/', ...formatKeyParts(keyToLookup(parsed.pos))]
    : [AXIS_GLYPHS[axisToLookup(parsed)] ?? binding]
  if (parsed.invert) parts.push('Inverted')
  return parts
}

/**
 * Axes, shown and recorded as well as read
 * @param {...import("./keys.js").KeySyntax} syntax - As for axes()
 * @returns {InputUI}
 */
export function axesUI(...syntax) {
  return {
    ...axes(...syntax),
    label: 'Axis',
    invert: true,
    format: formatAxisParts,
    prompt: () => 'Move the mouse, tilt a stick, or press two keys...',

    // Recorded from whichever comes first: enough mouse movement along one direction, a stick or
    // trigger pushed well past its rest, or two keys (toward -1, then toward 1)
    record(_options, done) {
      const moved = { x: 0, y: 0 }
      /** @type {string | null} */
      let firstKey = null
      /** @param {Event} e */
      const onMove = (e) => {
        const event = /** @type {MouseEvent} */ (e)
        moved.x += Math.abs(event.movementX ?? 0)
        moved.y += Math.abs(event.movementY ?? 0)
        if (Math.max(moved.x, moved.y) > 80) done(moved.x >= moved.y ? 'mouse:x' : 'mouse:y')
      }
      /** @param {Event} e */
      const onKey = (e) => {
        const event = /** @type {KeyboardEvent} */ (e)
        if (event.key === 'Escape' || event.repeat) return
        const binding = eventToBindingString(event, syntax)
        if (!binding) return
        event.preventDefault()
        event.stopPropagation()
        const key = binding.slice(binding.lastIndexOf('+') + 1)
        if (firstKey === null) firstKey = key
        else if (key !== firstKey) done(`keys:${firstKey}/${key}`)
      }
      window.addEventListener('mousemove', onMove, true)
      window.addEventListener('keydown', onKey, true)
      /** @type {Map<number, number[]>} */
      const rest = new Map()
      /** @type {number | null} */
      let frame = null
      const read = () => {
        frame = null
        for (const pad of navigator.getGamepads()) {
          if (!pad) continue
          const now = [...pad.axes.slice(0, 4), pad.buttons[6]?.value ?? 0, pad.buttons[7]?.value ?? 0]
          const was = rest.get(pad.index)
          if (!was) {
            rest.set(pad.index, now)
            continue
          }
          const i = now.findIndex((v, j) => Math.abs(v - (was[j] ?? 0)) > 0.6)
          if (i !== -1) return done(`pad:${PAD_AXES[i]}`)
        }
        frame = requestAnimationFrame(read)
      }
      if (hasPads()) frame = requestAnimationFrame(read)
      return () => {
        window.removeEventListener('mousemove', onMove, true)
        window.removeEventListener('keydown', onKey, true)
        if (frame !== null) cancelAnimationFrame(frame)
      }
    },
  }
}
