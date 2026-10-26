/**
 * What the tests share: inputs with every piece of syntax, a keybinds() that listens to all of
 * them, and events.
 */

import { keybinds as listen } from './core.js'
import { keys } from './keys.js'
import { symbols } from './keys-symbols.js'
import { aliases } from './keys-aliases.js'
import { releases } from './releases.js'
import { anyModifiers } from './any-modifiers.js'
import { mouse as mouseInput } from './mouse.js'
import { gamepad } from './gamepad.js'
import { axes } from './axes.js'
import { keysUI } from './keys-ui.js'
import { mouseUI } from './mouse-ui.js'
import { gamepadUI } from './gamepad-ui.js'
import { axesUI } from './axes-ui.js'
import { CommandPalette } from './components/palette.js'
import { KeybindCheatsheet } from './components/cheatsheet.js'
import { KeybindSettings } from './components/settings.js'
import { ContextMenu } from './components/context-menu.js'

export { listen, keys as keysInput }

/** One of each input, shown and recorded too, for findConflict, the settings panel and the hub */
export const INPUT = {
  keys: keysUI(symbols(), aliases()),
  mouse: mouseUI(),
  gamepad: gamepadUI(),
  axes: axesUI(symbols(), aliases()),
}
/** Every input and feature: options for keybinds(), validateCommands() and the hub */
export const ALL = { inputs: Object.values(INPUT), releases: releases(), anyModifiers: anyModifiers() }
export const COMPONENTS = [CommandPalette, KeybindCheatsheet, KeybindSettings, ContextMenu]

/**
 * keybinds() listening to every input, with every feature
 * @param {import('./core.js').Command[]} commands
 * @param {(() => Record<string, unknown>) | undefined} [context]
 * @param {import('./core.js').KeybindsOptions & { wheel?: { step?: number, idle?: number } }} [options]
 */
export const keybinds = (commands, context, options = {}) => {
  const { wheel, ...rest } = options
  return listen(commands, context, {
    inputs: [keys(symbols(), aliases()), mouseInput(wheel ? { wheel } : {}), gamepad(), axes(symbols(), aliases())],
    releases: releases(),
    anyModifiers: anyModifiers(),
    ...rest,
  })
}
/** @param {string} type @param {number} button @param {MouseEventInit} [init] */
export const mouse = (type, button, init = {}) => new MouseEvent(type, { button, cancelable: true, ...init })
/** @param {string} type @param {string} key @param {string} code @param {KeyboardEventInit} [init] */
export const kbd = (type, key, code, init = {}) => new KeyboardEvent(type, { key, code, cancelable: true, bubbles: true, ...init })

/** A fake pad, and animation frames run by hand */
export const fakePads = () => {
  /** @type {any[]} */
  let pads = []
  /** @type {FrameRequestCallback[]} */
  let frames = []
  const nav = /** @type {any} */ (navigator)
  const saved = { get: nav.getGamepads, raf: globalThis.requestAnimationFrame, cancel: globalThis.cancelAnimationFrame }
  Object.defineProperty(navigator, 'getGamepads', { value: () => pads, configurable: true, writable: true })
  globalThis.requestAnimationFrame = (cb) => { frames.push(cb); return frames.length }
  globalThis.cancelAnimationFrame = () => { frames = [] }
  /** @param {number[]} down */
  const pad = (down, index = 0) => ({ index, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i) })) })
  return {
    /** @param {...number[]} down - pressed buttons, one list per pad */
    set: (...down) => { pads = down.map((d, i) => pad(d, i)) },
    frame: () => { const run = frames; frames = []; for (const f of run) f(0) },
    restore: () => {
      Object.defineProperty(navigator, 'getGamepads', { value: saved.get, configurable: true, writable: true })
      globalThis.requestAnimationFrame = saved.raf
      globalThis.cancelAnimationFrame = saved.cancel
    },
  }
}

