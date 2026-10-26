/**
 * Holding a modifier on its own, or tapping it, as a trigger (the cheatsheet opens this way).
 */

/**
 * Trigger callback when a modifier key is held
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {(held: boolean) => void} callback - Called with true on hold, false on release
 * @param {{ delay?: number, target?: EventTarget }} [options]
 * @returns {() => void} Cleanup function
 *
 * @example
 * const cleanup = onModifierHold('Control', (held) => {
 *   cheatsheet.open = held
 * }, { delay: 300 })
 */
export function onModifierHold(modifiers, callback, options = {}) {
  const { delay = 200, target = window } = options
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null
  let isHeld = false
  const stop = () => {
    if (timer !== null) { clearTimeout(timer); timer = null }
    if (isHeld) { isHeld = false; callback(false) }
  }
  const unwatch = watchModifier(modifiers, target, {
    down: () => {
      stop()
      timer = setTimeout(() => { timer = null; isHeld = true; callback(true) }, delay)
    },
    spoiled: stop,
    up: stop,
  })
  return () => { unwatch(); if (timer !== null) clearTimeout(timer) }
}

/**
 * Trigger callback when a modifier key is tapped (pressed and released by itself) `count` times in
 * quick succession, as in double-tapping Shift.
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {number} count - Taps in a row
 * @param {() => void} callback
 * @param {{ within?: number, target?: EventTarget }} [options] - `within`: most ms from one tap's
 *   press to the next tap's release (default 400)
 * @returns {() => void} Cleanup function
 *
 * @example
 * onModifierTaps('Control', 2, () => { cheatsheet.open = !cheatsheet.open })
 */
export function onModifierTaps(modifiers, count, callback, options = {}) {
  const { within = 400, target = window } = options
  /** @type {number[]} */
  let taps = []
  let pressed = 0
  return watchModifier(modifiers, target, {
    down: () => { pressed = performance.now() },
    spoiled: () => { taps = [] },
    up: (clean) => {
      const now = performance.now()
      if (!clean || now - pressed > within) return void (taps = [])
      taps = [...taps.filter((t) => now - t <= within * count), now]
      if (taps.length >= count) {
        taps = []
        callback()
      }
    },
  })
}

/**
 * Follows a modifier being pressed and released by itself. `down` is a fresh press (not the key's
 * auto-repeat) with no other key or button held; `spoiled` is anything else happening while it's
 * held (another key, a click, scrolling), after which nothing counts until it's released; `up`
 * is the release, with whether the press stayed clean. Listens in the capture phase, so editors
 * that stop events don't hide them.
 *
 * @param {string | string[]} modifiers
 * @param {EventTarget} target
 * @param {{ down: () => void, spoiled: () => void, up: (clean: boolean) => void }} on
 * @returns {() => void}
 */
function watchModifier(modifiers, target, on) {
  const modSet = new Set((Array.isArray(modifiers) ? modifiers : [modifiers]).map((m) => m.toLowerCase()))
  let held = false
  let clean = false

  const spoil = () => {
    if (!held || !clean) return
    clean = false
    on.spoiled()
  }
  /** @param {Event} e */
  const keydown = (e) => {
    const event = /** @type {KeyboardEvent} */ (e)
    if (!modSet.has(event.key?.toLowerCase())) return spoil()
    if (event.repeat || held) return
    held = true
    // Other modifiers already down (Shift then Control) make it a chord, not a bare press
    clean = !['Control', 'Alt', 'Shift', 'Meta'].some((m) => !modSet.has(m.toLowerCase()) && event.getModifierState?.(m))
    if (clean) on.down()
  }
  /** @param {Event} e */
  const keyup = (e) => {
    const event = /** @type {KeyboardEvent} */ (e)
    if (!modSet.has(event.key?.toLowerCase()) || !held) return
    held = false
    on.up(clean)
  }
  const blur = () => {
    if (!held) return
    held = false
    clean = false
    on.up(false)
  }

  const others = /** @type {const} */ (['pointerdown', 'wheel', 'contextmenu'])
  target.addEventListener('keydown', keydown, true)
  target.addEventListener('keyup', keyup, true)
  for (const type of others) target.addEventListener(type, spoil, { capture: true, passive: true })
  window.addEventListener('blur', blur)
  return () => {
    target.removeEventListener('keydown', keydown, true)
    target.removeEventListener('keyup', keyup, true)
    for (const type of others) target.removeEventListener(type, spoil, true)
    window.removeEventListener('blur', blur)
  }
}
