import { describe, test, expect, beforeEach } from 'bun:test'
import { KeybindCheatsheet } from '../components/cheatsheet.js'

describe('cheatsheet hold trigger', () => {
  beforeEach(() => {
    if (!customElements.get('keybinds-cheatsheet')) customElements.define('keybinds-cheatsheet', KeybindCheatsheet)
  })

  test('holds the chosen modifier, for the chosen time', async () => {
    const el = /** @type {KeybindCheatsheet} */ (document.createElement('keybinds-cheatsheet'))
    el.setAttribute('trigger-key', 'Alt')
    el.setAttribute('trigger-delay', '10')
    el.setAttribute('auto-trigger', '')
    document.body.appendChild(el)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Control' }))
    await Bun.sleep(30)
    expect(el.open).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt' }))
    await Bun.sleep(30)
    expect(el.open).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }))
    expect(el.open).toBe(false)
    el.remove()
  })

  /** @param {string} type @param {string} key @param {KeyboardEventInit} [init] */
  const key = (type, key, init = {}) => window.dispatchEvent(new KeyboardEvent(type, { key, ...init }))
  const sheet = () => {
    const el = /** @type {KeybindCheatsheet} */ (document.createElement('keybinds-cheatsheet'))
    el.setAttribute('trigger-key', 'Control')
    el.setAttribute('trigger-delay', '10')
    el.setAttribute('auto-trigger', '')
    document.body.appendChild(el)
    return el
  }

  test("a shortcut spoils the hold, and the modifier's auto-repeat doesn't start it again", async () => {
    const el = sheet()
    key('keydown', 'Control')
    key('keydown', 'b', { ctrlKey: true })
    key('keyup', 'b', { ctrlKey: true })
    key('keydown', 'Control', { repeat: true })
    await Bun.sleep(30)
    expect(el.open).toBe(false)
    key('keyup', 'Control')
    el.remove()
  })

  test('clicking or scrolling while holding spoils it', async () => {
    const el = sheet()
    for (const type of ['pointerdown', 'wheel']) {
      key('keydown', 'Control')
      window.dispatchEvent(new Event(type))
      await Bun.sleep(30)
      expect(el.open).toBe(false)
      key('keyup', 'Control')
    }
    el.remove()
  })

  test('the hold closes when another key is pressed', async () => {
    const el = sheet()
    key('keydown', 'Control')
    await Bun.sleep(30)
    expect(el.open).toBe(true)
    key('keydown', 'k', { ctrlKey: true })
    expect(el.open).toBe(false)
    key('keyup', 'Control')
    el.remove()
  })

  test('tapping twice keeps it open; twice again or Escape closes it', () => {
    const el = sheet()
    const tap = () => (key('keydown', 'Control'), key('keyup', 'Control'))
    tap()
    expect(el.open).toBe(false)
    tap()
    expect(el.open).toBe(true)
    tap()
    tap()
    expect(el.open).toBe(false)
    tap()
    tap()
    expect(el.open).toBe(true)
    key('keydown', 'Escape')
    expect(el.open).toBe(false)
    el.remove()
  })

  test('a tap that was part of a shortcut does not count', () => {
    const el = sheet()
    key('keydown', 'Control')
    key('keyup', 'Control')
    key('keydown', 'Control')
    key('keydown', 'c', { ctrlKey: true })
    key('keyup', 'Control')
    key('keydown', 'Control')
    key('keyup', 'Control')
    expect(el.open).toBe(false)
    el.remove()
  })
})
