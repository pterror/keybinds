import { describe, test, expect, mock } from 'bun:test'
import { keybinds, validateCommands, formatBinding } from './core.js'
import { keys } from './keys.js'
import { keysUI } from './keys-ui.js'
import { mouse } from './mouse.js'
import { holds } from './holds.js'
import { kbd } from './test-helpers.js'

const DELAY = 30
const wait = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms))

/** @param {import('./core.js').Command[]} commands */
const listen = (commands) => {
  const target = document.createElement('div')
  const kb = keybinds(commands, undefined, { target, inputs: [keys(), mouse()], holds: holds({ delay: DELAY }) })
  return { target, kb }
}

describe('holds', () => {
  test('a hold binding fires once the key has been held long enough, and the command is held until it comes up', async () => {
    const fn = mock(() => {})
    const { target, kb } = listen([{ id: 'charge', label: 'Charge', keys: ['k:hold'], execute: fn }])
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    expect(fn).not.toHaveBeenCalled()
    await wait(DELAY * 2)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(kb.held('charge')).toBe(true)
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(kb.held('charge')).toBe(false)
    kb()
  })

  test('a key let go before then is a tap, not a hold', async () => {
    const hold = mock(() => {})
    const tap = mock(() => {})
    const { target, kb } = listen([
      { id: 'hold', label: 'Hold', keys: ['k:hold'], execute: hold },
      { id: 'tap', label: 'Tap', keys: ['k:tap'], execute: tap },
    ])
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    await wait(DELAY * 2)
    expect(tap).toHaveBeenCalledTimes(1)
    expect(hold).not.toHaveBeenCalled()

    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    await wait(DELAY * 2)
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(hold).toHaveBeenCalledTimes(1)
    expect(tap).toHaveBeenCalledTimes(1)
    kb()
  })

  test('mouse buttons can be held too, but scrolling cannot', async () => {
    const fn = mock(() => {})
    const { target, kb } = listen([{ id: 'grab', label: 'Grab', mouse: ['middle:hold'], execute: fn }])
    target.dispatchEvent(new MouseEvent('mousedown', { button: 1, buttons: 4, cancelable: true }))
    await wait(DELAY * 2)
    expect(fn).toHaveBeenCalledTimes(1)
    kb()
    expect(() => validateCommands([{ id: 'z', label: 'Z', mouse: ['scrollup:hold'], execute: () => {} }], { inputs: [mouse()], holds: holds() })).toThrow('Scroll has no ":hold"')
  })

  test('holding and tapping need holds()', () => {
    expect(() => validateCommands([{ id: 'k', label: 'K', keys: ['k:hold'], execute: () => {} }], { inputs: [keys()] })).toThrow('needs holds()')
    expect(() => validateCommands([{ id: 'k', label: 'K', keys: ['k:tap'], execute: () => {} }], { inputs: [keys()] })).toThrow('needs holds()')
  })

  test('shown with what it waits for', () => {
    expect(formatBinding(keysUI(), 'k:hold')).toEqual(['K', 'Hold'])
    expect(formatBinding(keysUI(), 'k:tap')).toEqual(['K', 'Tap'])
  })
})
