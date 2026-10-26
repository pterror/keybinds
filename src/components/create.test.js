import { describe, test, expect } from 'bun:test'
import { createComponent } from '../components/create.js'
import { CommandPalette } from '../components/palette.js'
import { RadialMenu } from '../components/radial-menu.js'

describe('createComponent', () => {
  test('uses the usual name, and its own when another copy of the library took it', () => {
    const palette = createComponent(CommandPalette)
    expect(palette).toBeInstanceOf(CommandPalette)
    if (!customElements.get('keybinds-radial-menu')) customElements.define('keybinds-radial-menu', class extends HTMLElement {})
    const radial = createComponent(RadialMenu)
    expect(radial.tagName.toLowerCase()).toMatch(/^keybinds-radial-menu-\d+$/)
    document.body.appendChild(radial)
    expect(radial.getAttribute('data-keybinds')).toBe('radial-menu')
    radial.remove()
  })
})
