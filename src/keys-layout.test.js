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
