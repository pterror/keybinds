import { describe, test, expect, mock } from 'bun:test'
import { validateCommands, findConflict } from './core.js'
import { formatGamepadParts } from './gamepad-ui.js'
import { mergeBindings, BindingsStore } from './store.js'
import { CommandHub } from './hub.js'
import { createComponent } from './components/create.js'
import { KeybindSettings } from './components/settings.js'
import { INPUT, ALL, keybinds, fakePads } from './test-helpers.js'

describe('gamepad', () => {
  test('parses names and aliases, and rejects unknown buttons', () => {
    expect(() => validateCommands([{ id: 'j', label: 'J', gamepad: ['a', 'south', 'rt:up', 'dpadUp'], execute: () => {} }], ALL.inputs)).not.toThrow()
    expect(() => validateCommands([{ id: 'j', label: 'J', gamepad: ['shift+a'], execute: () => {} }], ALL.inputs)).toThrow(/Unknown gamepad button/)
  })

  test('formats for display', () => {
    expect(formatGamepadParts('rt')).toEqual(['RT'])
    expect(formatGamepadParts('south:up')).toEqual(['A', 'Release'])
    expect(formatGamepadParts('up')).toEqual(['D-pad ↑'])
  })

  test('presses and releases fire, and held follows the button', () => {
    const pads = fakePads()
    /** @type {string[]} */
    const calls = []
    pads.set([])
    const kb = keybinds([{
      id: 'jump', label: 'Jump', gamepad: ['a', 'a:up'],
      execute: (/** @type {unknown} */ _, /** @type {Event | undefined} */ e) => { calls.push(/** @type {Event} */ (e).type) },
    }])
    pads.frame() // first sight
    pads.set([0])
    pads.frame()
    expect(calls).toEqual(['gamepadbuttondown'])
    expect(kb.held('jump')).toBe(true)
    pads.set([])
    pads.frame()
    expect(calls).toEqual(['gamepadbuttondown', 'gamepadbuttonup'])
    expect(kb.held('jump')).toBe(false)
    kb()
    pads.restore()
  })

  test('a button already down when the pad is first seen is not a press', () => {
    const pads = fakePads()
    const fn = mock(() => {})
    pads.set([0])
    const kb = keybinds([{ id: 'jump', label: 'Jump', gamepad: ['a'], execute: fn }])
    pads.frame()
    pads.frame()
    expect(fn).not.toHaveBeenCalled()
    kb()
    pads.restore()
  })

  test('a pad going away lets go of its buttons', () => {
    const pads = fakePads()
    pads.set([])
    const kb = keybinds([{ id: 'fire', label: 'Fire', gamepad: ['rt'], execute: () => {} }])
    pads.frame()
    pads.set([7])
    pads.frame()
    expect(kb.held('fire')).toBe(true)
    pads.set()
    pads.frame()
    expect(kb.held('fire')).toBe(false)
    kb()
    pads.restore()
  })

  test('no polling without gamepad bindings', () => {
    const pads = fakePads()
    const raf = mock(globalThis.requestAnimationFrame)
    globalThis.requestAnimationFrame = raf
    pads.set([])
    const kb = keybinds([{ id: 'k', label: 'K', keys: ['k'], execute: () => {} }])
    expect(raf).not.toHaveBeenCalled()
    kb()
    pads.restore()
  })

  test('the settings panel records a gamepad button', () => {
    const pads = fakePads()
    pads.set([])
    const el = /** @type {import('./index.js').KeybindSettings} */ (createComponent(KeybindSettings))
    el.inputs = ALL.inputs
    el.store = new BindingsStore({ jump: { label: 'Jump', keys: ['space'] } }, 'test:pad-settings')
    document.body.appendChild(el)
    el.open = true
    const add = /** @type {HTMLElement} */ (el.shadowRoot?.querySelector('[part="add-gamepad"]'))
    expect(add).toBeTruthy()
    add.click()
    pads.frame() // first sight
    pads.set([3])
    pads.frame()
    expect(el.store?.getOverrides()).toEqual({ jump: { gamepad: ['y'] } })
    el.remove()
    localStorage.removeItem('test:pad-settings')
    pads.restore()
  })

  test('conflicts, overrides and the hub', () => {
    const schema = { jump: { label: 'Jump', gamepad: ['a'] }, fire: { label: 'Fire', gamepad: ['rt'] } }
    expect(findConflict(schema, 'south', INPUT.gamepad, 'fire')).toEqual({ commandId: 'jump', label: 'Jump' })
    expect(mergeBindings(schema, { jump: { gamepad: ['b'] } })['jump']?.gamepad).toEqual(['b'])
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target: document.createElement('div') } })
    hub.setSource('a', () => [{ id: 'jump', label: 'Jump', gamepad: ['a'], execute: () => {} }])
    hub.refresh()
    expect(hub.bindingsFor('jump', 'gamepad')).toEqual(['A'])
    hub.destroy()
  })
})
