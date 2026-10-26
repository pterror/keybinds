import { describe, test, expect, mock } from 'bun:test'
import { validateCommands, findConflict } from './core.js'
import { formatKeyParts, eventToBindingString } from './keys-ui.js'
import { symbols } from './keys-symbols.js'
import { aliases } from './keys-aliases.js'
import { INPUT, ALL, keybinds, keysInput } from './test-helpers.js'

describe('formatKeyParts', () => {
  test('formats modifiers', () => {
    expect(formatKeyParts('ctrl+a')).toEqual(['Ctrl', 'A'])
    expect(formatKeyParts('alt+b')).toEqual(['Alt', 'B'])
    expect(formatKeyParts('shift+c')).toEqual(['Shift', 'C'])
  })

  test('formats special keys', () => {
    expect(formatKeyParts('backspace')).toEqual(['⌫'])
    expect(formatKeyParts('delete')).toEqual(['⌦'])
    expect(formatKeyParts('escape')).toEqual(['Esc'])
    expect(formatKeyParts('enter')).toEqual(['↵'])
    expect(formatKeyParts('space')).toEqual(['Space'])
    expect(formatKeyParts('tab')).toEqual(['Tab'])
  })

  test('formats arrow keys', () => {
    expect(formatKeyParts('arrowup')).toEqual(['↑'])
    expect(formatKeyParts('arrowdown')).toEqual(['↓'])
    expect(formatKeyParts('arrowleft')).toEqual(['←'])
    expect(formatKeyParts('arrowright')).toEqual(['→'])
  })

  test('formats $mod as Ctrl on non-Mac', () => {
    expect(formatKeyParts('$mod+k')).toEqual(['Ctrl', 'K'])
  })
})

// --- eventToBindingString tests ---

describe('eventToBindingString', () => {
  test('converts simple key', () => {
    const event = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK' })
    expect(eventToBindingString(event)).toBe('k')
  })

  test('converts modified key', () => {
    const event = new KeyboardEvent('keydown', { key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: true })
    // On non-Mac, ctrl = $mod
    expect(eventToBindingString(event)).toBe('$mod+shift+k')
  })

  test('returns null for bare modifier press', () => {
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: 'Shift', code: 'ShiftLeft' }))).toBeNull()
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: 'Control', code: 'ControlLeft' }))).toBeNull()
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: 'Alt', code: 'AltLeft' }))).toBeNull()
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: 'Meta', code: 'MetaLeft' }))).toBeNull()
  })

  test('normalizes $mod on non-Mac (ctrl)', () => {
    const event = new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true })
    expect(eventToBindingString(event)).toBe('$mod+s')
  })

  test('returns null for unknown key', () => {
    const event = new KeyboardEvent('keydown', { key: 'Unidentified', code: 'Unidentified' })
    expect(eventToBindingString(event)).toBeNull()
  })

  test('falls back to code-based key name', () => {
    // Some browsers report special characters in event.key but the code is KeyA
    const event = new KeyboardEvent('keydown', { key: 'å', code: 'KeyA', altKey: true })
    expect(eventToBindingString(event)).toBe('alt+a')
  })
})

// --- Key aliases ---

describe('key aliases', () => {
  const cases = /** @type {[string, string, string][]} */ ([
    ['up', 'ArrowUp', 'ArrowUp'],
    ['down', 'ArrowDown', 'ArrowDown'],
    ['left', 'ArrowLeft', 'ArrowLeft'],
    ['right', 'ArrowRight', 'ArrowRight'],
    ['arrowup', 'ArrowUp', 'ArrowUp'],
    ['space', ' ', 'Space'],
    ['escape', 'Escape', 'Escape'],
    ['comma', ',', 'Comma'],
    ['slash', '/', 'Slash'],
    ['bracketleft', '[', 'BracketLeft'],
    ['[', '[', 'BracketLeft'],
    ['pageup', 'PageUp', 'PageUp'],
    ['f5', 'F5', 'F5'],
    ['5', '5', 'Digit5'],
    ['a', 'A', 'KeyA'],
  ])
  for (const [binding, key, code] of cases) {
    test(`"${binding}" fires on a real ${code} press`, () => {
      const fn = mock(() => {})
      const target = document.createElement('div')
      const cleanup = keybinds([{ id: 'x', label: 'X', keys: [binding], execute: fn }], undefined, { target })
      target.dispatchEvent(new KeyboardEvent('keydown', { key, code }))
      expect(fn).toHaveBeenCalledTimes(1)
      cleanup()
    })
  }

  test('aliases and arrow names conflict and share a release', () => {
    expect(findConflict({ s: { label: 'S', keys: ['arrowup'] } }, 'up', INPUT.keys)?.commandId).toBe('s')
    const up = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'x', label: 'X', keys: ['left:up'], execute: up }], undefined, { target })
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft' }))
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft' }))
    expect(up).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('error for an unknown key names what was typed', () => {
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: ['nope'], execute: () => {} }], ALL)).toThrow('Unknown key "nope"')
  })

  test('modifier and mouse aliases fire', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'a', label: 'A', keys: ['control+a'], execute: fn },
      { id: 'b', label: 'B', keys: ['option+b'], execute: fn },
      { id: 'c', label: 'C', keys: ['cmd+c'], execute: fn },
      { id: 'd', label: 'D', keys: ['command+d'], execute: fn },
      { id: 'l', label: 'L', mouse: ['left'], execute: fn },
      { id: 'r', label: 'R', mouse: ['rightclick'], execute: fn },
      { id: 'm', label: 'M', mouse: ['middleclick'], execute: fn },
    ], undefined, { target })
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', ctrlKey: true }))
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', altKey: true }))
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', code: 'KeyC', metaKey: true }))
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', metaKey: true }))
    target.dispatchEvent(new MouseEvent('mousedown', { button: 0 }))
    target.dispatchEvent(new MouseEvent('mousedown', { button: 2 }))
    target.dispatchEvent(new MouseEvent('mousedown', { button: 1 }))
    expect(fn).toHaveBeenCalledTimes(7)
    cleanup()
  })
})

describe('characters and shifted keys', () => {
  /**
   * @param {string} binding
   * @param {KeyboardEventInit} init
   */
  function fires(binding, init) {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'x', label: 'X', keys: [binding], execute: fn }], undefined, { target })
    target.dispatchEvent(new KeyboardEvent('keydown', init))
    cleanup()
    return fn.mock.calls.length === 1
  }

  test('a character binds however it is typed: "?" fires on Shift+/', () => {
    expect(fires('?', { key: '?', code: 'Slash', shiftKey: true })).toBe(true)
    expect(fires('!', { key: '!', code: 'Digit1', shiftKey: true })).toBe(true)
    expect(fires('$mod+?', { key: '?', code: 'Slash', shiftKey: true, ctrlKey: true })).toBe(true)
  })

  test('"shift+/" and "shift+1" mean the physical keys, so they fire', () => {
    expect(fires('shift+/', { key: '?', code: 'Slash', shiftKey: true })).toBe(true)
    expect(fires('shift+1', { key: '!', code: 'Digit1', shiftKey: true })).toBe(true)
  })

  test('"plus" is the + key', () => {
    expect(fires('$mod+plus', { key: '+', code: 'Equal', shiftKey: true, ctrlKey: true })).toBe(true)
  })

  test('Shift still distinguishes letters', () => {
    expect(fires('a', { key: 'A', code: 'KeyA', shiftKey: true })).toBe(false)
    expect(fires('shift+a', { key: 'A', code: 'KeyA', shiftKey: true })).toBe(true)
  })

  test('recording a shifted symbol keeps the character, not Shift, with symbols()', () => {
    const syntax = [symbols(), aliases()]
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true }), syntax)).toBe('?')
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '+', code: 'Equal', shiftKey: true, ctrlKey: true }), syntax)).toBe('$mod+plus')
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', shiftKey: false }), syntax)).toBe('1')
  })

  test('without symbols(), a typed character is recorded as the physical key', () => {
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true }))).toBe('shift+slash')
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '+', code: 'Equal', shiftKey: true, ctrlKey: true }))).toBe('$mod+shift+equal')
    // "+" can't be written as itself, so without aliases() it's the physical key even with symbols()
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '+', code: 'Equal', shiftKey: true }), [symbols()])).toBe('shift+equal')
  })

  test('syntax nobody added is an error, naming what to add', () => {
    const keysOnly = { inputs: [keysInput()] }
    expect(() => validateCommands([{ id: 'q', label: 'Q', keys: ['?'], execute: () => {} }], keysOnly)).toThrow('Unknown key "?"')
    expect(() => validateCommands([{ id: 'u', label: 'U', keys: ['up'], execute: () => {} }], keysOnly)).toThrow('Unknown key "up"')
    expect(() => validateCommands([{ id: 'k', label: 'K', keys: ['k:up'], execute: () => {} }], keysOnly)).toThrow('needs releases()')
    expect(() => validateCommands([{ id: 'w', label: 'W', keys: ['w'], anyModifiers: true, execute: () => {} }], keysOnly)).toThrow('needs anyModifiers()')
    expect(validateCommands([{ id: 'q', label: 'Q', keys: ['?', 'up', 'shift+slash'], execute: () => {} }], { inputs: [keysInput(symbols(), aliases())] })).toBe(true)
  })

  test('physical key names show as the character they type', () => {
    expect(formatKeyParts('shift+slash')).toEqual(['Shift', '/'])
    expect(formatKeyParts('shift+digit1')).toEqual(['Shift', '1'])
    expect(formatKeyParts('$mod+comma').at(-1)).toBe(',')
    expect(formatKeyParts('$mod+plus').at(-1)).toBe('+')
    expect(formatKeyParts('?')).toEqual(['?'])
  })
})
