import { describe, test, expect, mock } from 'bun:test'
import { validateCommands, executeCommand, findConflict } from './core.js'
import { formatKeyParts, eventToBindingString } from './keys-ui.js'
import { formatMouseParts, eventToMouseBindingString } from './mouse-ui.js'
import { BindingsStore } from './store.js'
import { CommandHub } from './hub.js'
import { createComponent } from './components/create.js'
import { CommandPalette } from './components/palette.js'
import { ContextMenu } from './components/context-menu.js'
import { INPUT, ALL, keybinds, listen, keysInput, mouse, kbd } from './test-helpers.js'

describe('validateCommands', () => {
  test('valid commands pass', () => {
    expect(validateCommands([
      { id: 'save', label: 'Save', keys: ['$mod+s'], execute: () => {} },
      { id: 'click', label: 'Click', mouse: ['Click'], execute: () => {} },
    ], ALL.inputs)).toBe(true)
  })

  test('throws on missing id', () => {
    expect(() => validateCommands([/** @type {any} */ ({ label: 'X', execute: () => {} })], ALL.inputs))
      .toThrow('Command missing id')
  })

  test('throws on invalid key', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', keys: ['$mod+banana'], execute: () => {} },
    ], ALL.inputs)).toThrow('Unknown key "banana"')
  })

  test('throws on modifier-only key binding', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', keys: ['$mod'], execute: () => {} },
    ], ALL.inputs)).toThrow('no key (only modifiers)')
  })

  test('throws on multi-key binding', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', keys: ['a+b'], execute: () => {} },
    ], ALL.inputs)).toThrow('multiple keys')
  })

  test('throws on invalid mouse binding', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', mouse: ['DoubleClick'], execute: () => {} },
    ], ALL.inputs)).toThrow('Unknown mouse button')
  })
})

describe('executeCommand', () => {
  test('executes matching command and returns true', () => {
    const fn = mock(() => {})
    const commands = [{ id: 'save', label: 'Save', execute: fn }]
    expect(executeCommand(commands, 'save')).toBe(true)
    expect(fn).toHaveBeenCalled()
  })

  test('returns false for unknown id', () => {
    expect(executeCommand([], 'nonexistent')).toBe(false)
  })

  test('returns false for inactive command', () => {
    const fn = mock(() => {})
    const commands = [{ id: 'x', label: 'X', when: () => false, execute: fn }]
    expect(executeCommand(commands, 'x')).toBe(false)
    expect(fn).not.toHaveBeenCalled()
  })
})

// --- DOM tests ---
// Use happy-dom elements as event targets so dispatched events are accepted

describe('keybinds', () => {
  test('listens only through the inputs it is given, and a binding none of them reads is an error', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const pad = { id: 'jump', label: 'Jump', gamepad: ['a'], execute: () => {} }
    expect(() => listen([pad], undefined, { target, inputs: [keysInput()] })).toThrow('Command "jump" has gamepad bindings, but no input reads gamepad')
    expect(() => listen([], undefined, { target, axes: [{ id: 'x', label: 'X', axes: ['mouse:x'] }] })).toThrow('no input reads them')
    const cleanup = listen([{ id: 's', label: 'S', keys: ['s'], execute: fn }], undefined, { target, inputs: [keysInput()] })
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS' }))
    expect(fn).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('dispatches matching key command', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'save', label: 'Save', keys: ['ctrl+s'], execute: fn },
    ]
    const cleanup = keybinds(commands, undefined, { target })

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', code: 'KeyS', ctrlKey: true,
    }))

    expect(fn).toHaveBeenCalled()
    cleanup()
  })

  test('does not dispatch for non-matching key', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'save', label: 'Save', keys: ['ctrl+s'], execute: fn },
    ]
    const cleanup = keybinds(commands, undefined, { target })

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'a', code: 'KeyA', ctrlKey: true,
    }))

    expect(fn).not.toHaveBeenCalled()
    cleanup()
  })

  test('skips inactive commands', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'x', label: 'X', keys: ['ctrl+x'], when: () => false, execute: fn },
    ]
    const cleanup = keybinds(commands, undefined, { target })

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'x', code: 'KeyX', ctrlKey: true,
    }))

    expect(fn).not.toHaveBeenCalled()
    cleanup()
  })

  test('cleanup removes listeners', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'save', label: 'Save', keys: ['ctrl+s'], execute: fn },
    ]
    const cleanup = keybinds(commands, undefined, { target })
    cleanup()

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', code: 'KeyS', ctrlKey: true,
    }))

    expect(fn).not.toHaveBeenCalled()
  })

  test('dispatches matching mouse command', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'pan', label: 'Pan', mouse: ['MiddleClick'], execute: fn },
    ]
    const cleanup = keybinds(commands, undefined, { target })

    target.dispatchEvent(new MouseEvent('mousedown', { button: 1 }))

    expect(fn).toHaveBeenCalled()
    cleanup()
  })

  test('calls onExecute callback', () => {
    const executeFn = mock(() => {})
    const onExecute = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'save', label: 'Save', keys: ['ctrl+s'], execute: executeFn },
    ]
    const cleanup = keybinds(commands, undefined, { target, onExecute })

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', code: 'KeyS', ctrlKey: true,
    }))

    expect(onExecute).toHaveBeenCalledTimes(1)
    const call = /** @type {any[]} */ (onExecute.mock.calls[0])
    expect(call[0].id).toBe('save')
    cleanup()
  })

  test('does not dispatch when event target is an open keybinds-command-palette', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'save', label: 'Save', keys: ['ctrl+s'], execute: fn },
    ]
    const cleanup = keybinds(commands, undefined, { target })
    if (!customElements.get('keybinds-command-palette')) customElements.define('keybinds-command-palette', CommandPalette)
    document.body.appendChild(target)

    const palette = document.createElement('keybinds-command-palette')
    palette.setAttribute('open', '')
    target.appendChild(palette)

    const event = new KeyboardEvent('keydown', {
      key: 's', code: 'KeyS', ctrlKey: true,
    })
    Object.defineProperty(event, 'target', { value: palette })
    target.dispatchEvent(event)

    expect(fn).not.toHaveBeenCalled()
    cleanup()
    target.remove()
  })

  test('passes context to execute and when', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'x', label: 'X', keys: ['ctrl+x'], when: (/** @type {Record<string, unknown>} */ ctx) => /** @type {boolean} */ (ctx['ready']), execute: fn },
    ]
    const cleanup = keybinds(commands, () => ({ ready: true }), { target })

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'x', code: 'KeyX', ctrlKey: true,
    }))

    expect(fn).toHaveBeenCalled()
    const call = /** @type {any[]} */ (fn.mock.calls[0])
    expect(call[0]).toEqual({ ready: true })
    cleanup()
  })
})

describe('findConflict', () => {
  const schema = {
    save: { label: 'Save', keys: ['$mod+s'] },
    open: { label: 'Open', keys: ['$mod+o'], mouse: ['$mod+click'] },
    close: { label: 'Close', keys: ['$mod+w'] },
  }

  test('returns null when no conflict', () => {
    expect(findConflict(schema, '$mod+k', INPUT.keys)).toBeNull()
  })

  test('finds key conflict', () => {
    const conflict = findConflict(schema, '$mod+s', INPUT.keys)
    expect(conflict).toEqual({ commandId: 'save', label: 'Save' })
  })

  test('finds mouse conflict', () => {
    const conflict = findConflict(schema, '$mod+click', INPUT.mouse)
    expect(conflict).toEqual({ commandId: 'open', label: 'Open' })
  })

  test('excludes self by id', () => {
    expect(findConflict(schema, '$mod+s', INPUT.keys, 'save')).toBeNull()
  })

  test('normalizes through parse for accurate comparison', () => {
    // ctrl+s should conflict with $mod+s on non-Mac
    const conflict = findConflict(schema, 'ctrl+s', INPUT.keys)
    expect(conflict).toEqual({ commandId: 'save', label: 'Save' })
  })
})

describe('held', () => {
  test('a command is held from its press until its key comes up', () => {
    const target = document.createElement('div')
    const kb = keybinds([{ id: 'fwd', label: 'Forward', keys: ['w'], execute: () => {} }], undefined, { target })
    expect(kb.held('fwd')).toBe(false)
    target.dispatchEvent(kbd('keydown', 'w', 'KeyW'))
    expect(kb.held('fwd')).toBe(true)
    target.dispatchEvent(kbd('keydown', 'w', 'KeyW', { repeat: true }))
    expect(kb.held('fwd')).toBe(true)
    target.dispatchEvent(kbd('keyup', 'w', 'KeyW'))
    expect(kb.held('fwd')).toBe(false)
    kb()
  })

  test("a press that didn't fire (inactive, or passed on) isn't held", () => {
    const target = document.createElement('div')
    const kb = keybinds([
      { id: 'off', label: 'Off', keys: ['a'], when: () => false, execute: () => {} },
      { id: 'pass', label: 'Pass', keys: ['b'], execute: () => false },
    ], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'a', 'KeyA'))
    target.dispatchEvent(kbd('keydown', 'b', 'KeyB'))
    expect(kb.held('off')).toBe(false)
    expect(kb.held('pass')).toBe(false)
    kb()
  })

  test('mouse buttons, and losing focus', () => {
    const target = document.createElement('div')
    const kb = keybinds([
      { id: 'fire', label: 'Fire', mouse: ['Click'], execute: () => {} },
      { id: 'fwd', label: 'Forward', keys: ['w'], execute: () => {} },
    ], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 0, { buttons: 1 }))
    target.dispatchEvent(kbd('keydown', 'w', 'KeyW'))
    expect(kb.held('fire')).toBe(true)
    window.dispatchEvent(new Event('blur'))
    expect(kb.held('fwd')).toBe(false)
    expect(kb.held('fire')).toBe(true)
    target.dispatchEvent(mouse('mouseup', 0, { buttons: 0 }))
    expect(kb.held('fire')).toBe(false)
    kb()
  })

  test('the hub answers too', () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target } })
    hub.setSource('a', () => [{ id: 'fwd', label: 'Forward', keys: ['w'], execute: () => {} }])
    hub.refresh()
    target.dispatchEvent(kbd('keydown', 'w', 'KeyW'))
    expect(hub.held('fwd')).toBe(true)
    hub.destroy()
    expect(hub.held('fwd')).toBe(false)
  })
})

describe('releases that never arrive', () => {
  /** @param {string[]} calls */
  const recorder = (calls) => (/** @type {unknown} */ _, /** @type {Event | undefined} */ e) => { calls.push(/** @type {Event} */ (e).type) }

  test('held keys are released when the window loses focus', () => {
    /** @type {string[]} */
    const calls = []
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['k', 'k:up'], execute: recorder(calls) }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    window.dispatchEvent(new Event('blur'))
    expect(calls).toEqual(['keydown', 'keyup'])
    // the real keyup, if it does come, has nothing left to release
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(calls).toEqual(['keydown', 'keyup'])
    cleanup()
  })

  test('a mouse button is not released just because focus went', () => {
    /** @type {string[]} */
    const calls = []
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'm', label: 'M', mouse: ['MiddleClick', 'MiddleClick:up'], execute: recorder(calls) }], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 1, { buttons: 4 }))
    window.dispatchEvent(new Event('blur'))
    // still held when the page hears from the mouse again
    target.dispatchEvent(mouse('mousemove', 0, { buttons: 4 }))
    expect(calls).toEqual(['mousedown'])
    target.dispatchEvent(mouse('mouseup', 1, { buttons: 0 }))
    expect(calls).toEqual(['mousedown', 'mouseup'])
    cleanup()
  })

  test('a mouse button let go out of sight is released on the next mouse event', () => {
    /** @type {string[]} */
    const calls = []
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'm', label: 'M', mouse: ['MiddleClick', 'MiddleClick:up'], execute: recorder(calls) }], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 1, { buttons: 4 }))
    target.dispatchEvent(mouse('mousemove', 0, { buttons: 0 }))
    expect(calls).toEqual(['mousedown', 'mouseup'])
    cleanup()
  })

  test('another button going down doesn\'t release one that is still held', () => {
    /** @type {string[]} */
    const calls = []
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'm', label: 'M', mouse: ['MiddleClick', 'MiddleClick:up'], execute: recorder(calls) }], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 1, { buttons: 4 }))
    target.dispatchEvent(mouse('mousedown', 0, { buttons: 5 }))
    target.dispatchEvent(mouse('mouseup', 0, { buttons: 4 }))
    expect(calls).toEqual(['mousedown'])
    cleanup()
  })
})

describe('anyModifiers', () => {
  test('a binding fires whatever other modifiers are held', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'w', label: 'W', keys: ['w'], anyModifiers: true, execute: fn }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'w', 'KeyW'))
    target.dispatchEvent(kbd('keydown', 'W', 'KeyW', { shiftKey: true }))
    target.dispatchEvent(kbd('keydown', 'w', 'KeyW', { ctrlKey: true, altKey: true }))
    expect(fn).toHaveBeenCalledTimes(3)
    cleanup()
  })

  test("a binding's own modifiers are still required", () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'x', label: 'X', keys: ['shift+x'], anyModifiers: true, execute: fn }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'x', 'KeyX'))
    expect(fn).not.toHaveBeenCalled()
    target.dispatchEvent(kbd('keydown', 'X', 'KeyX', { shiftKey: true, ctrlKey: true }))
    expect(fn).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('an exact binding wins', () => {
    const loose = mock(() => {})
    const exact = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'loose', label: 'Loose', keys: ['x'], anyModifiers: true, execute: loose },
      { id: 'exact', label: 'Exact', keys: ['shift+x'], execute: exact },
    ], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'X', 'KeyX', { shiftKey: true }))
    expect(exact).toHaveBeenCalledTimes(1)
    expect(loose).not.toHaveBeenCalled()
    target.dispatchEvent(kbd('keydown', 'x', 'KeyX', { ctrlKey: true }))
    expect(loose).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('a hold started with a modifier down gets its release', () => {
    /** @type {string[]} */
    const calls = []
    const target = document.createElement('div')
    const cleanup = keybinds([{
      id: 'fwd', label: 'Forward', keys: ['w', 'w:up'], anyModifiers: true,
      execute: (/** @type {unknown} */ _, /** @type {Event | undefined} */ e) => { calls.push(/** @type {Event} */ (e).type) },
    }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'W', 'KeyW', { shiftKey: true }))
    target.dispatchEvent(kbd('keyup', 'w', 'KeyW'))
    expect(calls).toEqual(['keydown', 'keyup'])
    cleanup()
  })

  test('mouse buttons and scrolling too', () => {
    const click = mock(() => {})
    const scroll = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'c', label: 'C', mouse: ['Click'], anyModifiers: true, execute: click },
      { id: 's', label: 'S', mouse: ['scrolldown'], anyModifiers: true, execute: scroll },
    ], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 0, { shiftKey: true }))
    target.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, cancelable: true }))
    expect(click).toHaveBeenCalledTimes(1)
    expect(scroll).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('without it, modifiers must match exactly as before', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'w', label: 'W', keys: ['w'], execute: fn }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'W', 'KeyW', { shiftKey: true }))
    expect(fn).not.toHaveBeenCalled()
    cleanup()
  })
})

describe('press and release bindings', () => {
  test('key release fires on keyup after a press', () => {
    const up = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['k:up'], execute: up }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    expect(up).not.toHaveBeenCalled()
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(up).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('press and release are separate bindings on separate commands', () => {
    const open = mock(() => {})
    const close = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'o', label: 'O', mouse: ['MiddleClick'], execute: open },
      { id: 'c', label: 'C', mouse: ['MiddleClick:up'], execute: close },
    ], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 1))
    expect(open).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
    target.dispatchEvent(mouse('mouseup', 1))
    expect(open).toHaveBeenCalledTimes(1)
    expect(close).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('a release with no seen press does not fire', () => {
    const k = mock(() => {})
    const m = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'k', label: 'K', keys: ['k:up'], execute: k },
      { id: 'm', label: 'M', mouse: ['middle:up'], execute: m },
    ], undefined, { target })
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    target.dispatchEvent(mouse('mouseup', 1))
    expect(k).not.toHaveBeenCalled()
    expect(m).not.toHaveBeenCalled()
    cleanup()
  })

  test('a release fires once per press', () => {
    const up = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['k:up'], execute: up }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(up).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('release matches the modifiers held at press time', () => {
    const up = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['ctrl+k:up'], execute: up }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK', { ctrlKey: true }))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK')) // ctrl already let go
    expect(up).toHaveBeenCalledTimes(1)
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK', { ctrlKey: true }))
    expect(up).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('a release-only command checks its own when at release time', () => {
    const up = mock(() => {})
    let on = true
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['k:up'], when: () => on, execute: up }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    on = false
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(up).not.toHaveBeenCalled()
    cleanup()
  })

  test('a command whose press fired always gets its release, even if when went false', () => {
    const calls = /** @type {string[]} */ ([])
    let on = true
    const target = document.createElement('div')
    const cleanup = keybinds([{
      id: 'hold', label: 'Hold', keys: ['space', 'space:up'], mouse: ['middle', 'middle:up'],
      when: () => on,
      execute: (_ctx, e) => { calls.push(/** @type {Event} */ (e).type) },
    }], undefined, { target })

    target.dispatchEvent(kbd('keydown', ' ', 'Space'))
    on = false
    target.dispatchEvent(kbd('keyup', ' ', 'Space'))
    on = true
    target.dispatchEvent(mouse('mousedown', 1))
    on = false
    target.dispatchEvent(mouse('mouseup', 1))
    expect(calls).toEqual(['keydown', 'keyup', 'mousedown', 'mouseup'])
    cleanup()
  })

  test('the guarantee holds even when another command consumes the release first', () => {
    const calls = /** @type {string[]} */ ([])
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'other', label: 'Other', keys: ['k:up'], execute: () => { calls.push('other') } },
      { id: 'hold', label: 'Hold', keys: ['k', 'k:up'], execute: (_c, e) => { calls.push(`hold:${/** @type {Event} */ (e).type}`) } },
    ], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(calls).toEqual(['hold:keydown', 'other', 'hold:keyup'])
    cleanup()
  })

  test('a held key repeating does not reset which commands fired', () => {
    const calls = /** @type {string[]} */ ([])
    let on = true
    const target = document.createElement('div')
    const cleanup = keybinds([{
      id: 'hold', label: 'Hold', keys: ['k', 'k:up'], when: () => on,
      execute: (_c, e) => { calls.push(/** @type {Event} */ (e).type) },
    }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    on = false
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK', { repeat: true }))
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(calls).toEqual(['keydown', 'keyup'])
    cleanup()
  })

  test('release skips inputs unless captureInput, but a fired press still releases', () => {
    const plain = mock(() => {})
    const held = /** @type {string[]} */ ([])
    const input = document.createElement('input')
    const wrap = document.createElement('div')
    wrap.appendChild(input)
    const cleanup = keybinds([
      { id: 'plain', label: 'P', keys: ['j:up'], execute: plain },
      { id: 'hold', label: 'H', keys: ['k', 'k:up'], captureInput: true, execute: (_c, e) => { held.push(/** @type {Event} */ (e).type) } },
    ], undefined, { target: wrap })
    input.dispatchEvent(kbd('keydown', 'j', 'KeyJ'))
    input.dispatchEvent(kbd('keyup', 'j', 'KeyJ'))
    expect(plain).not.toHaveBeenCalled()
    input.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    input.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(held).toEqual(['keydown', 'keyup'])
    cleanup()
  })

  test('press bindings are unaffected by an added release binding', () => {
    const down = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['k', 'k:up'], execute: down }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    expect(down).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('cleanup removes release listeners', () => {
    const up = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'k', label: 'K', keys: ['k:up'], execute: up }], undefined, { target })
    target.dispatchEvent(kbd('keydown', 'k', 'KeyK'))
    cleanup()
    target.dispatchEvent(kbd('keyup', 'k', 'KeyK'))
    expect(up).not.toHaveBeenCalled()
  })

  test('validation accepts :up and rejects scroll release and empty release', () => {
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: ['ctrl+k:up', 'Escape:UP'], mouse: ['middle:up'], execute: () => {} }], ALL.inputs)).not.toThrow()
    expect(() => validateCommands([{ id: 'x', label: 'X', mouse: ['scrollup:up'], execute: () => {} }], ALL.inputs)).toThrow()
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: [':up'], execute: () => {} }], ALL.inputs)).toThrow()
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: ['ctrl+:up'], execute: () => {} }], ALL.inputs)).toThrow()
  })

  test('format adds a Release part', () => {
    expect(formatKeyParts('ctrl+k:up')).toEqual(['Ctrl', 'K', 'Release'])
    expect(formatMouseParts('MiddleClick:up')).toEqual(['Middle', 'Release'])
  })

  test('conflicts treat press and release as different inputs', () => {
    const schema = { s: { label: 'S', keys: ['k'], mouse: ['middle'] } }
    expect(findConflict(schema, 'k:up', INPUT.keys)).toBeNull()
    expect(findConflict(schema, 'middle:up', INPUT.mouse)).toBeNull()
    expect(findConflict(schema, 'K', INPUT.keys)?.commandId).toBe('s')
    expect(findConflict({ s: { label: 'S', keys: ['k:up'] } }, 'K:UP', INPUT.keys)?.commandId).toBe('s')
  })

  test('event to binding string gives :up for keyup and mouseup', () => {
    expect(eventToBindingString(kbd('keyup', 'k', 'KeyK', { ctrlKey: true }))).toBe('$mod+k:up')
    expect(eventToBindingString(kbd('keydown', 'k', 'KeyK'))).toBe('k')
    expect(eventToMouseBindingString(mouse('mouseup', 1))).toBe('middle:up')
    expect(eventToMouseBindingString(mouse('mouseup', 3))).toBe('back:up')
    expect(eventToMouseBindingString(mouse('mousedown', 1))).toBe('middle')
  })

  test('settings store round-trips release bindings', () => {
    const schema = { open: { label: 'Open', mouse: ['middle'] }, close: { label: 'Close', mouse: ['middle:up'] } }
    const store = new BindingsStore(schema, 'test:release-bindings')
    store.save({ close: { mouse: ['back:up'] } })
    const reloaded = new BindingsStore(schema, 'test:release-bindings')
    expect(reloaded.get()['close']?.mouse).toEqual(['back:up'])
    expect(reloaded.get()['open']?.mouse).toEqual(['middle'])
  })
})

describe('capture phase', () => {
  test('with capture, a bound key reaches its command before the element it was typed in', () => {
    const outer = document.createElement('div')
    const inner = document.createElement('div')
    outer.appendChild(inner)
    const editor = mock((/** @type {Event} */ e) => { if (!e.defaultPrevented) editorSaw.push(e) })
    /** @type {Event[]} */
    const editorSaw = []
    inner.addEventListener('keydown', editor)
    const bold = mock(() => {})
    const cleanup = keybinds([{ id: 'b', label: 'Bold', keys: ['ctrl+b'], execute: bold }], undefined, { target: outer, capture: true })
    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true }))
    expect(bold).toHaveBeenCalledTimes(1)
    expect(editorSaw.length).toBe(0)
    cleanup()
  })

  test('with capture, a key no active command claims still reaches the element', () => {
    const outer = document.createElement('div')
    const inner = document.createElement('div')
    outer.appendChild(inner)
    const editor = mock(() => {})
    inner.addEventListener('keydown', editor)
    const cleanup = keybinds([{ id: 'b', label: 'Bold', keys: ['ctrl+b'], when: () => false, execute: () => {} }], undefined, { target: outer, capture: true })
    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', code: 'KeyB', ctrlKey: true, bubbles: true, cancelable: true }))
    expect(editor).toHaveBeenCalledTimes(1)
    cleanup()
  })
})

describe('overlays under any tag name', () => {
  test('a palette registered under another name still holds keys back while open', () => {
    const name = 'my-own-palette'
    if (!customElements.get(name)) customElements.define(name, class extends CommandPalette {})
    const target = document.createElement('div')
    document.body.appendChild(target)
    const fn = mock(() => {})
    const cleanup = keybinds([{ id: 's', label: 'S', keys: ['ctrl+s'], execute: fn }], undefined, { target })
    const palette = document.createElement(name)
    target.appendChild(palette)
    palette.setAttribute('open', '')
    expect(palette.getAttribute('data-keybinds')).toBe('command-palette')
    palette.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true, bubbles: true }))
    expect(fn).not.toHaveBeenCalled()
    cleanup()
    target.remove()
  })

  test('an open context menu keeps its keys (Enter picks its item, not a command bound to Enter)', () => {
    const target = document.createElement('div')
    document.body.appendChild(target)
    const fn = mock(() => {})
    const cleanup = keybinds([{ id: 'go', label: 'Go', keys: ['Enter'], execute: fn }], undefined, { target })
    const menu = createComponent(ContextMenu)
    target.appendChild(menu)
    menu.setAttribute('open', '')
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    expect(fn).not.toHaveBeenCalled()
    cleanup()
    target.remove()
  })
})
