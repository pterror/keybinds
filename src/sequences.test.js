import { describe, test, expect, mock } from 'bun:test'
import { keybinds, validateCommands, formatBinding } from './core.js'
import { keys } from './keys.js'
import { keysUI } from './keys-ui.js'
import { sequences } from './sequences.js'
import { kbd } from './test-helpers.js'

/**
 * @param {import('./core.js').Command[]} commands
 * @param {{ timeout?: number }} [options]
 */
const listen = (commands, options) => {
  const target = document.createElement('div')
  const stop = keybinds(commands, undefined, { target, inputs: [keys()], sequences: sequences(options) })
  /** @param {string} key @param {KeyboardEventInit} [init] */
  const press = (key, init = {}) => {
    const code = /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : key
    const down = kbd('keydown', key, code, init)
    target.dispatchEvent(down)
    target.dispatchEvent(kbd('keyup', key, code, init))
    return down
  }
  return { target, stop, press }
}

describe('sequences', () => {
  test('a binding of several steps fires on its last step, and earlier steps are its own', () => {
    const fn = mock(() => {})
    const { press, stop } = listen([{ id: 'inbox', label: 'Inbox', keys: ['g i'], execute: fn }])
    const g = press('g')
    expect(g.defaultPrevented).toBe(true)
    expect(fn).not.toHaveBeenCalled()
    press('i')
    expect(fn).toHaveBeenCalledTimes(1)
    press('i')
    expect(fn).toHaveBeenCalledTimes(1)
    stop()
  })

  test('steps can have modifiers, and a double tap is the same key twice', () => {
    const save = mock(() => {})
    const twice = mock(() => {})
    const { press, stop } = listen([
      { id: 'save-all', label: 'Save all', keys: ['ctrl+k ctrl+s'], execute: save },
      { id: 'twice', label: 'Twice', keys: ['j j'], execute: twice },
    ])
    press('k', { ctrlKey: true })
    press('s', { ctrlKey: true })
    expect(save).toHaveBeenCalledTimes(1)
    press('j')
    press('j')
    expect(twice).toHaveBeenCalledTimes(1)
    stop()
  })

  test('a press that does not go on from the steps so far is a press of its own', () => {
    const inbox = mock(() => {})
    const x = mock(() => {})
    const { press, stop } = listen([
      { id: 'inbox', label: 'Inbox', keys: ['g i'], execute: inbox },
      { id: 'x', label: 'X', keys: ['x'], execute: x },
    ])
    press('g')
    press('x')
    expect(x).toHaveBeenCalledTimes(1)
    press('i')
    expect(inbox).not.toHaveBeenCalled()
    stop()
  })

  test('the next step has to come within the timeout', async () => {
    const fn = mock(() => {})
    const { press, stop } = listen([{ id: 'inbox', label: 'Inbox', keys: ['g i'], execute: fn }], { timeout: 20 })
    press('g')
    await new Promise((r) => setTimeout(r, 40))
    press('i')
    expect(fn).not.toHaveBeenCalled()
    stop()
  })

  test('pressing Shift between steps does not break a sequence', () => {
    const fn = mock(() => {})
    const { target, press, stop } = listen([{ id: 'top', label: 'Top', keys: ['g shift+g'], execute: fn }])
    press('g')
    target.dispatchEvent(kbd('keydown', 'Shift', 'ShiftLeft', { shiftKey: true }))
    press('G', { shiftKey: true, code: 'KeyG' })
    expect(fn).toHaveBeenCalledTimes(1)
    stop()
  })

  test('a sequence whose commands are not active does not take its first step', () => {
    const { press, stop } = listen([{ id: 'inbox', label: 'Inbox', keys: ['g i'], when: () => false, execute: () => {} }])
    expect(press('g').defaultPrevented).toBe(false)
    stop()
  })

  test('a step that is also a binding of its own is an error, and so is a sequence without sequences()', () => {
    const both = [
      { id: 'go', label: 'Go', keys: ['g'], execute: () => {} },
      { id: 'inbox', label: 'Inbox', keys: ['g i'], execute: () => {} },
    ]
    expect(() => validateCommands(both, { inputs: [keys()], sequences: sequences() })).toThrow('both a binding and the start of a sequence')
    expect(() => validateCommands([{ id: 'inbox', label: 'Inbox', keys: ['g i'], execute: () => {} }], { inputs: [keys()] })).toThrow('needs sequences()')
  })

  test('shown step by step', () => {
    expect(formatBinding(keysUI(), 'ctrl+k ctrl+s')).toEqual(['Ctrl', 'K', 'then', 'Ctrl', 'S'])
  })
})
