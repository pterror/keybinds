import { describe, test, expect } from 'bun:test'
import { formatAxisParts } from './axes-ui.js'
import { BindingsStore } from './store.js'
import { CommandHub } from './hub.js'
import { createComponent } from './components/create.js'
import { KeybindSettings } from './components/settings.js'
import { ALL, keybinds, kbd, fakePads } from './test-helpers.js'

describe('axes', () => {
  const noop = /** @type {import('./index.js').Command[]} */ ([])

  test('parses sources and rejects unknown ones', () => {
    expect(() => keybinds(noop, undefined, { axes: [{ id: 'a', label: 'A', axes: ['mouse:x', '-pad:ry', 'keys:a/d', 'pad:rt'] }] })()).not.toThrow()
    expect(() => keybinds(noop, undefined, { axes: [{ id: 'a', label: 'A', axes: ['mouse:z'] }] })).toThrow(/Axis "a"/)
    expect(() => keybinds(noop, undefined, { axes: [{ id: 'a', label: 'A', axes: ['keys:a'] }] })).toThrow(/Unknown axis/)
  })

  test('formats for display', () => {
    expect(formatAxisParts('mouse:x')).toEqual(['Mouse ↔'])
    expect(formatAxisParts('-pad:ry')).toEqual(['Right stick ↕', 'Inverted'])
    expect(formatAxisParts('keys:a/d')).toEqual(['A', '/', 'D'])
  })

  test('key pairs give a position from -1 to 1', () => {
    const target = document.createElement('div')
    const kb = keybinds(noop, undefined, { target, axes: [{ id: 'strafe', label: 'Strafe', axes: ['keys:a/d'] }] })
    expect(kb.axis('strafe')).toEqual({ position: 0, delta: 0 })
    target.dispatchEvent(kbd('keydown', 'd', 'KeyD'))
    expect(kb.axis('strafe').position).toBe(1)
    target.dispatchEvent(kbd('keydown', 'a', 'KeyA', { shiftKey: true }))
    expect(kb.axis('strafe').position).toBe(0)
    target.dispatchEvent(kbd('keyup', 'd', 'KeyD'))
    expect(kb.axis('strafe').position).toBe(-1)
    window.dispatchEvent(new Event('blur'))
    expect(kb.axis('strafe').position).toBe(0)
    kb()
  })

  test('mouse movement is a delta since each axis was last read', () => {
    const target = document.createElement('div')
    const kb = keybinds(noop, undefined, { target, axes: [
      { id: 'look', label: 'Look', axes: ['mouse:x'] },
      { id: 'pitch', label: 'Pitch', axes: ['-mouse:y'] },
    ] })
    target.dispatchEvent(new MouseEvent('mousemove', { movementX: 5, movementY: 2 }))
    target.dispatchEvent(new MouseEvent('mousemove', { movementX: 3, movementY: 1 }))
    expect(kb.axis('look')).toEqual({ position: 0, delta: 8 })
    expect(kb.axis('look').delta).toBe(0)
    expect(kb.axis('pitch').delta).toBe(-3)
    kb()
  })

  test('sticks ignore drift and triggers read their pull', () => {
    const pads = fakePads()
    const pad = { index: 0, axes: [0.1, 0, 1, -0.5], buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: false, value: i === 7 ? 0.5 : 0 })) }
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true, writable: true })
    const kb = keybinds(noop, undefined, { axes: [
      { id: 'drift', label: 'Drift', axes: ['pad:lx'] },
      { id: 'turn', label: 'Turn', axes: ['pad:rx'] },
      { id: 'tilt', label: 'Tilt', axes: ['-pad:ry'] },
      { id: 'gas', label: 'Gas', axes: ['pad:rt'] },
    ] })
    expect(kb.axis('drift').position).toBe(0)
    expect(kb.axis('turn').position).toBeCloseTo(1)
    expect(kb.axis('tilt').position).toBeCloseTo((0.5 - 0.15) / 0.85)
    expect(kb.axis('gas').position).toBeCloseTo(0.5)
    kb()
    pads.restore()
  })

  test('an axis whose when is false reads zero, and its mouse movement is dropped', () => {
    const target = document.createElement('div')
    let on = false
    const kb = keybinds(noop, undefined, { target, axes: [{ id: 'look', label: 'Look', axes: ['mouse:x'], when: () => on }] })
    target.dispatchEvent(new MouseEvent('mousemove', { movementX: 5 }))
    expect(kb.axis('look').delta).toBe(0)
    on = true
    expect(kb.axis('look').delta).toBe(0)
    kb()
  })

  test('the hub rebinds and reads axes', () => {
    const target = document.createElement('div')
    /** @type {Record<string, import('./index.js').BindingOverrides>} */
    const kept = { global: { strafe: { axes: ['keys:j/l'] } } }
    const hub = new CommandHub({ ...ALL, listen: { target }, storage: (scope) => ({ load: () => kept[scope] ?? {}, save: (o) => { kept[scope] = o } }) })
    hub.setAxes('game', () => [{ id: 'strafe', label: 'Strafe', axes: ['keys:a/d'] }])
    hub.refresh()
    expect(hub.bindingsFor('strafe', 'axes')).toEqual(['J / L'])
    target.dispatchEvent(kbd('keydown', 'l', 'KeyL'))
    expect(hub.axis('strafe').position).toBe(1)
    hub.destroy()
  })

  test('the settings panel records two keys as an axis, and inverts it', () => {
    const el = /** @type {import('./index.js').KeybindSettings} */ (createComponent(KeybindSettings))
    el.inputs = ALL.inputs
    el.store = new BindingsStore({ strafe: { label: 'Strafe', axes: ['keys:a/d'] } }, { load: () => ({}), save: () => {} })
    document.body.appendChild(el)
    el.open = true
    const add = /** @type {HTMLElement} */ (el.shadowRoot?.querySelector('[part="add-axis"]'))
    expect(add).toBeTruthy()
    add.click()
    window.dispatchEvent(kbd('keydown', 'j', 'KeyJ'))
    window.dispatchEvent(kbd('keydown', 'l', 'KeyL'))
    expect(el.store?.get()['strafe']?.axes).toEqual(['keys:a/d', 'keys:j/l'])
    const invert = /** @type {HTMLElement} */ (el.shadowRoot?.querySelector('[part~="binding-invert"]'))
    invert.click()
    expect(el.store?.get()['strafe']?.axes).toEqual(['-keys:a/d', 'keys:j/l'])
    el.remove()
  })
})
