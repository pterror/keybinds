/**
 * Showing and recording mouse bindings, for the settings panel, cheatsheet, palette and menus.
 */

import { RELEASE_SUFFIX, splitRelease, eventModParts, formatModPart, formatWithRelease } from './core.js'
import { mouse, pointerButtonName, wheelDirection } from './mouse.js'

/** @typedef {import('./core.js').InputUI} InputUI */

/**
 * Format a single mouse binding part for display
 * @param {string} part
 * @returns {string}
 */
function formatMousePart(part) {
  const p = part.trim().toLowerCase()
  const mod = formatModPart(p)
  if (mod) return mod
  if (p === 'click' || p === 'leftclick' || p === 'left') return 'Click'
  if (p === 'middleclick' || p === 'middle') return 'Middle'
  if (p === 'rightclick' || p === 'right') return 'Right'
  if (p === 'backclick' || p === 'back') return 'Back'
  if (p === 'forwardclick' || p === 'forward') return 'Forward'
  if (p === 'scrollup') return 'Scroll ↑'
  if (p === 'scrolldown') return 'Scroll ↓'
  if (p === 'scrollleft') return 'Scroll ←'
  if (p === 'scrollright') return 'Scroll →'
  return part
}

/**
 * Format mouse binding into array of display parts
 * @param {string} binding
 * @returns {string[]}
 */
export function formatMouseParts(binding) {
  return formatWithRelease(binding, formatMousePart)
}

/**
 * Convert a MouseEvent or WheelEvent to a canonical binding string (e.g. "$mod+click", "$mod+scrollup")
 *
 * @param {MouseEvent} event
 * @returns {string | null}
 */
export function eventToMouseBindingString(event) {
  let buttonName
  if ('deltaY' in event && 'deltaX' in event) {
    buttonName = wheelDirection(/** @type {WheelEvent} */ (event))
    if (!buttonName) return null
  } else {
    const name = pointerButtonName(event.button)
    if (!name) return null
    buttonName = name
    if (event.type === 'mouseup') buttonName += RELEASE_SUFFIX
  }
  return [...eventModParts(event), buttonName].join('+')
}

/**
 * The mouse, shown and recorded as well as listened to
 * @param {{ wheel?: { step?: number, idle?: number } }} [options] - As for mouse()
 * @returns {InputUI}
 */
export function mouseUI(options = {}) {
  return {
    ...mouse(options),
    label: 'Mouse',
    format: formatMouseParts,
    release: (binding) => !/(^|\+)scroll(up|down|left|right)$/i.test(splitRelease(binding.toLowerCase()).body),
    prompt: (release) => release ? 'Press and release a button...' : 'Click or scroll...',

    record({ release, ignore }, done) {
      /** @type {{ button: number, binding: string } | null} */
      let held = null
      /** @param {Event} e */
      const down = (e) => {
        const event = /** @type {MouseEvent} */ (e)
        if (ignore(event)) return
        const binding = eventToMouseBindingString(event)
        if (!binding) return
        event.preventDefault()
        event.stopPropagation()
        if (!release) return done(binding)
        held = { button: event.button, binding }
      }
      /** @param {Event} e */
      const up = (e) => {
        const event = /** @type {MouseEvent} */ (e)
        if (ignore(event) || !held || held.button !== event.button) return
        event.preventDefault()
        event.stopPropagation()
        const binding = held.binding
        held = null
        done(binding + RELEASE_SUFFIX)
      }
      /** @param {Event} e */
      const wheel = (e) => {
        if (release) return // scroll has no release
        const binding = eventToMouseBindingString(/** @type {WheelEvent} */ (e))
        if (!binding) return
        e.preventDefault()
        e.stopPropagation()
        done(binding)
      }
      window.addEventListener('mousedown', down, true)
      window.addEventListener('mouseup', up, true)
      window.addEventListener('wheel', wheel, { capture: true })
      return () => {
        window.removeEventListener('mousedown', down, true)
        window.removeEventListener('mouseup', up, true)
        window.removeEventListener('wheel', wheel, true)
      }
    },
  }
}
