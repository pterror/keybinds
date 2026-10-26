/**
 * Mouse input: buttons ("$mod+Click", "MiddleClick", "Back:up") and scrolling ("ScrollUp").
 */

import {
  RELEASE_SUFFIX, NO_MODS, splitRelease, parseMods, modsToPrefix, eventMods, eventModParts,
  holdsAll, formatModPart, formatWithRelease, overlayOpen,
} from './core.js'

/** @typedef {import('./core.js').Modifiers} Modifiers */
/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').Press} Press */

/**
 * @typedef {Object} ParsedMouse
 * @property {Modifiers} mods
 * @property {number} button - Index into BUTTON_NAMES
 * @property {boolean} release - Binding fires when the button comes up ("middle:up")
 */

const VALID_MOUSE = new Set([
  'click', 'leftclick', 'left',
  'rightclick', 'right',
  'middleclick', 'middle',
  'backclick', 'back',
  'forwardclick', 'forward',
  'scrollup', 'scrolldown', 'scrollleft', 'scrollright'
])

// Indexed by parseMouse's button; the first five line up with MouseEvent.button
const BUTTON_NAMES = ['click', 'middle', 'right', 'back', 'forward', 'scrollup', 'scrolldown', 'scrollleft', 'scrollright']
const POINTER_BUTTON_COUNT = 5

/** `MouseEvent.buttons` bit for a `MouseEvent.button` */
const BUTTON_BITS = [1, 4, 2, 8, 16]

/**
 * Parse a mouse binding like "$mod+Click", "MiddleClick" or "Back:up"
 * Supported: Click/LeftClick, RightClick, MiddleClick, BackClick, ForwardClick, Scroll{Up,Down,Left,Right}
 * A trailing ":up" binds the button's release.
 * @param {string} binding
 * @returns {ParsedMouse}
 * @throws {Error} if mouse binding is invalid
 */
export function parseMouse(binding) {
  if (!binding || typeof binding !== 'string') {
    throw new Error(`Invalid mouse binding: ${binding}`)
  }

  const { body, release } = splitRelease(binding.toLowerCase())
  const parts = body.split('+').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) {
    throw new Error(`Empty mouse binding: "${binding}"`)
  }

  const { mods, remaining } = parseMods(parts)

  const btn = remaining[0]
  if (btn === undefined) {
    throw new Error(`Mouse binding has no button (only modifiers): "${binding}"`)
  }
  if (remaining.length > 1) {
    throw new Error(`Mouse binding has multiple buttons: "${binding}"`)
  }
  if (!VALID_MOUSE.has(btn)) {
    throw new Error(`Unknown mouse button "${btn}" in binding "${binding}". Valid: Click, RightClick, MiddleClick, BackClick, ForwardClick, ScrollUp, ScrollDown, ScrollLeft, ScrollRight`)
  }

  if (release && btn.startsWith('scroll')) {
    throw new Error(`Scroll has no release: "${binding}"`)
  }

  let button = 0 // left
  if (btn === 'rightclick' || btn === 'right') button = 2
  else if (btn === 'middleclick' || btn === 'middle') button = 1
  else if (btn === 'backclick' || btn === 'back') button = 3
  else if (btn === 'forwardclick' || btn === 'forward') button = 4
  else if (btn === 'scrollup') button = 5
  else if (btn === 'scrolldown') button = 6
  else if (btn === 'scrollleft') button = 7
  else if (btn === 'scrollright') button = 8

  return { mods, button, release }
}

/**
 * Convert parsed mouse binding to lookup key (e.g., "ctrl+click", "middle")
 * @param {ParsedMouse} parsed
 * @returns {string}
 */
function mouseToLookup(parsed) {
  return `${modsToPrefix(parsed.mods)}${BUTTON_NAMES[parsed.button]}${parsed.release ? RELEASE_SUFFIX : ''}`
}

/**
 * Back (3) and forward (4) buttons, which browsers bind to history navigation
 * @param {number} button
 * @returns {boolean}
 */
function isSideButton(button) {
  return button === 3 || button === 4
}

/**
 * Binding name for a MouseEvent.button value, null for buttons with no name
 * @param {number} button
 * @returns {string | null}
 */
function pointerButtonName(button) {
  if (!Number.isInteger(button) || button < 0 || button >= POINTER_BUTTON_COUNT) return null
  return BUTTON_NAMES[button] ?? null
}

/**
 * Convert mouse event to lookup key. Null for buttons with no binding name.
 * @param {MouseEvent} event
 * @param {string} prefix - Modifier prefix
 * @param {string} [suffix] - Appended to the lookup (e.g. ":up")
 * @returns {string | null}
 */
function eventToMouseLookup(event, prefix, suffix = '') {
  const name = pointerButtonName(event.button)
  if (!name) return null
  return `${prefix}${name}${suffix}`
}

/**
 * Which way a wheel event scrolls, as a binding names it; null if it doesn't
 * @param {WheelEvent} event
 * @returns {string | null}
 */
function wheelDirection(event) {
  // Prefer vertical axis; fall back to horizontal
  if (event.deltaY < 0) return 'scrollup'
  if (event.deltaY > 0) return 'scrolldown'
  if (event.deltaX < 0) return 'scrollleft'
  if (event.deltaX > 0) return 'scrollright'
  return null
}

/**
 * Distance a wheel event scrolls along its main axis, in pixels
 * @param {WheelEvent} event
 * @returns {number}
 */
function wheelDistance(event) {
  const d = Math.abs(event.deltaY || event.deltaX)
  if (event.deltaMode === 1) return d * 16
  if (event.deltaMode === 2) return d * (typeof window !== 'undefined' ? window.innerHeight : 800)
  return d
}

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
 * Whether a mouse press is one of a command's press bindings (same button, same modifiers), for
 * code that handles the press itself, like a drag that should start on a rebindable button.
 * @param {Command} cmd
 * @param {MouseEvent} event
 * @returns {boolean}
 */
export function mouseMatches(cmd, event) {
  const lookup = eventToMouseLookup(event, cmd.anyModifiers ? '' : modsToPrefix(eventMods(event)))
  if (!lookup) return false
  return (cmd.mouse ?? []).some((m) => {
    const parsed = parseMouse(m)
    if (parsed.release) return false
    if (!cmd.anyModifiers) return mouseToLookup(parsed) === lookup
    return mouseToLookup({ ...parsed, mods: NO_MODS }) === lookup && holdsAll(parsed.mods, eventMods(event))
  })
}

/**
 * The mouse
 * @param {{ wheel?: { step?: number, idle?: number } }} [options] - Scroll bindings: a command
 *   runs once per `step` pixels scrolled (default 50, about one mouse-wheel notch; a trackpad's
 *   small deltas add up to it), and a pause of `idle` ms (default 200) starts a new gesture.
 * @returns {Input}
 */
export function mouse(options = {}) {
  const { step: WHEEL_STEP = 50, idle: WHEEL_IDLE = 200 } = options.wheel ?? {}
  return {
    field: 'mouse',
    label: 'Mouse',
    parse(binding) {
      const parsed = parseMouse(binding)
      return { lookup: mouseToLookup(parsed), loose: mouseToLookup({ ...parsed, mods: NO_MODS }), mods: parsed.mods }
    },
    format: formatMouseParts,
    release: (binding) => !/(^|\+)scroll(up|down|left|right)$/i.test(splitRelease(binding.toLowerCase()).body),
    prompt: (release) => release ? 'Press and release a button...' : 'Click or scroll...',
    matches: (cmd, event) => mouseMatches(cmd, /** @type {MouseEvent} */ (event)),

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

    listen(d) {
      /**
       * Commands a mouse event triggers, with the modifiers given (the press's, for a release)
       * @param {MouseEvent} event
       * @param {Modifiers} mods
       * @param {string} [suffix]
       */
      const candidates = (event, mods, suffix = '') => {
        const exact = eventToMouseLookup(event, modsToPrefix(mods), suffix)
        const loose = eventToMouseLookup(event, '', suffix)
        return d.candidates(exact ? [exact] : [], loose ? [loose] : [], mods)
      }
      /** Side buttons whose press or release was consumed; their auxclick is canceled too */
      /** @type {Set<number>} */
      const swallowAux = new Set()

      /**
       * Mouse buttons can be let go where the page doesn't see it (over another window after focus
       * moved, say), but every mouse event says which buttons are down. Any held button that isn't
       * gets its release now, rather than guessing at blur whether it will come back.
       * @param {MouseEvent} event
       */
      function reconcile(event) {
        for (const [id, press] of d.presses) {
          const button = Number(id)
          if (event.buttons & (BUTTON_BITS[button] ?? 0)) continue
          if (event.type === 'mouseup' && event.button === button) continue
          d.presses.delete(id)
          const release = new MouseEvent('mouseup', { button, cancelable: true })
          const found = candidates(release, press.mods, RELEASE_SUFFIX)
          if (found) d.release(found, press, release)
        }
      }

      /** @param {Event} e */
      function onDown(e) {
        const event = /** @type {MouseEvent} */ (e)
        reconcile(event)
        // Don't fire keybinds while the command palette or settings panel is open
        if (overlayOpen(/** @type {Element | null} */ (event.target))) return
        if (!pointerButtonName(event.button)) return

        /** @type {Press} */
        const press = { mods: eventMods(event), fired: new Set() }
        d.presses.set(String(event.button), press)
        swallowAux.delete(event.button)

        const found = candidates(event, press.mods)
        if (found && d.fire(found, event, { press }) && isSideButton(event.button)) swallowAux.add(event.button)
      }

      /** @param {Event} e */
      function onUp(e) {
        const event = /** @type {MouseEvent} */ (e)
        reconcile(event)
        const press = d.presses.get(String(event.button))
        if (!press) return
        d.presses.delete(String(event.button))

        const found = candidates(event, press.mods, RELEASE_SUFFIX)
        const consumed = !!found && d.release(found, press, event, { blocked: overlayOpen(/** @type {Element | null} */ (event.target)) })

        // Browsers navigate on a side button's mouseup/auxclick, so cancel both while bound
        if (isSideButton(event.button) && (consumed || press.fired.size > 0)) {
          event.preventDefault()
          swallowAux.add(event.button)
        }
      }

      /** @param {Event} e */
      function onAuxClick(e) {
        const event = /** @type {MouseEvent} */ (e)
        if (!swallowAux.delete(event.button)) return
        event.preventDefault()
      }

      /** @param {Event} e */
      function onMove(e) {
        if (d.presses.size > 0) reconcile(/** @type {MouseEvent} */ (e))
      }

      /**
       * A scroll gesture on one binding: how far it has scrolled since the last step, when it was last
       * moved, and whether its commands are taking it (if one returned false, the page scrolls instead).
       * @typedef {{ amount: number, last: number, ours: boolean }} Gesture
       */
      /** @type {Map<string, Gesture>} */
      const gestures = new Map()

      /** @param {Event} e */
      function onWheel(e) {
        const event = /** @type {WheelEvent} */ (e)
        if (overlayOpen(/** @type {Element | null} */ (event.target))) return

        const direction = wheelDirection(event)
        if (!direction) return
        const mods = eventMods(event)
        const lookup = `${modsToPrefix(mods)}${direction}`
        const found = d.candidates([lookup], [direction], mods)
        if (!found) return
        const active = found.filter(d.isActive)
        if (active.length === 0) return

        const now = performance.now()
        let gesture = gestures.get(lookup)
        if (!gesture || now - gesture.last > WHEEL_IDLE) {
          gesture = { amount: 0, last: now, ours: true }
          gestures.set(lookup, gesture)
        }
        gesture.last = now
        if (!gesture.ours) return
        // Between steps the gesture is still the command's: the page mustn't scroll or zoom meanwhile
        event.preventDefault()
        gesture.amount += wheelDistance(event)
        if (gesture.amount < WHEEL_STEP) return
        // One step per event, so a fast flick doesn't queue up a burst
        gesture.amount = Math.min(gesture.amount - WHEEL_STEP, WHEEL_STEP)
        for (const cmd of active) {
          if (d.execute(cmd, event)) return
        }
        gesture.ours = false
      }

      const opts = { capture: d.capture }
      d.target.addEventListener('mousedown', onDown, opts)
      d.target.addEventListener('mouseup', onUp, opts)
      d.target.addEventListener('auxclick', onAuxClick, opts)
      d.target.addEventListener('mousemove', onMove, opts)
      d.target.addEventListener('wheel', onWheel, { capture: d.capture, passive: false })
      return () => {
        d.target.removeEventListener('mousedown', onDown, opts)
        d.target.removeEventListener('mouseup', onUp, opts)
        d.target.removeEventListener('auxclick', onAuxClick, opts)
        d.target.removeEventListener('mousemove', onMove, opts)
        d.target.removeEventListener('wheel', onWheel, opts)
        gestures.clear()
        swallowAux.clear()
      }
    },
  }
}
