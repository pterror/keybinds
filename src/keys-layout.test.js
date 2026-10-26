import { describe, test, expect } from 'bun:test'
import { formatBinding } from './core.js'
import { keysUI, formatKeyParts } from './keys-ui.js'
import { layout, loadLayout } from './keys-layout.js'

// A German layout: the key a US layout calls "/" types "-", and the 1 key's Shift is "!"
const german = new Map([['Slash', '-'], ['Digit1', '1'], ['BracketLeft', 'ü'], ['KeyZ', 'y']])

describe('keyboard layouts', () => {
  test('physical keys show as the layout types them', () => {
    expect(formatKeyParts('shift+slash', [layout(german)])).toEqual(['Shift', '-'])
    expect(formatKeyParts('bracketleft', [layout(german)])).toEqual(['Ü'])
    expect(formatBinding(keysUI(layout(german)), 'ctrl+bracketleft')).toEqual(['Ctrl', 'Ü'])
  })

  test('letters are bound by what they type, so they show as written', () => {
    expect(formatKeyParts('z', [layout(german)])).toEqual(['Z'])
  })

  test('without a layout, or keys it does not know, show as on a US layout', () => {
    expect(formatKeyParts('shift+slash', [layout(null)])).toEqual(['Shift', '/'])
    expect(formatKeyParts('comma', [layout(german)])).toEqual([','])
  })

  test('a browser that cannot tell gives no layout', async () => {
    expect(await loadLayout()).toBeNull()
  })
})

describe('following the layout', () => {
  /** @param {Map<string, string>} first */
  const fakeKeyboard = (first) => {
    let map = first
    Object.defineProperty(navigator, 'keyboard', { value: { getLayoutMap: async () => map }, configurable: true })
    return {
      /** @param {Map<string, string>} next */
      set: (next) => { map = next },
      restore: () => { Object.defineProperty(navigator, 'keyboard', { value: undefined, configurable: true }) },
    }
  }
  const settle = () => new Promise((r) => setTimeout(r, 0))
  const us = new Map([['Slash', '/'], ['KeyZ', 'z']])

  test('loads the layout, and looks again when the window gets focus back', async () => {
    const keyboard = fakeKeyboard(us)
    const piece = layout()
    let changes = 0
    piece.watch?.(() => { changes++ })
    await settle()
    expect(piece.glyph?.('slash')).toBe('/')
    keyboard.set(german)
    window.dispatchEvent(new Event('focus'))
    await settle()
    expect(piece.glyph?.('slash')).toBe('-')
    expect(changes).toBe(2)
    keyboard.restore()
  })

  test('a key typing something the layout did not say means it changed', async () => {
    const keyboard = fakeKeyboard(us)
    const piece = layout()
    await settle()
    keyboard.set(german)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', code: 'KeyZ' }))
    await settle()
    expect(piece.glyph?.('slash')).toBe('-')
    keyboard.restore()
  })

  test('keysUI follows it, so the components showing bindings do', async () => {
    const keyboard = fakeKeyboard(us)
    const input = keysUI(layout())
    let changes = 0
    input.watch?.(() => { changes++ })
    await settle()
    expect(changes).toBe(1)
    keyboard.restore()
  })
})
