import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { BindingsStore } from '../store.js'
import { KeybindSettings } from '../components/settings.js'
import { ALL, keybinds } from '../test-helpers.js'

// --- KeybindSettings component tests ---

describe('KeybindSettings', () => {
  beforeEach(() => {
    localStorage.clear()
    if (!customElements.get('keybinds-settings')) {
      customElements.define('keybinds-settings', KeybindSettings)
    }
  })

  const schema = {
    save: { label: 'Save', category: 'File', keys: ['$mod+s'] },
    open: { label: 'Open', category: 'File', keys: ['$mod+o'] },
    delete: { label: 'Delete', category: 'Edit', keys: ['backspace'] },
    hidden: { label: 'Hidden', keys: ['h'], hidden: true },
  }

  function createSettings() {
    const el = /** @type {import('../index.js').KeybindSettings} */ (document.createElement('keybinds-settings'))
    el.inputs = ALL.inputs
    const store = new BindingsStore(schema, 'test:settings')
    el.store = store
    document.body.appendChild(el)
    return { el, store }
  }

  function cleanup(/** @type {HTMLElement} */ el) {
    el.remove()
  }

  test('renders groups from schema', () => {
    const { el } = createSettings()
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const groups = shadow.querySelectorAll('.settings__group-title')
    const titles = Array.from(groups).map(g => g.textContent)
    expect(titles).toContain('File')
    expect(titles).toContain('Edit')
    cleanup(el)
  })

  test('excludes hidden commands', () => {
    const { el } = createSettings()
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const labels = Array.from(shadow.querySelectorAll('.settings__item-label')).map(l => l.textContent)
    expect(labels).not.toContain('Hidden')
    cleanup(el)
  })

  test('shows bindings for commands', () => {
    const { el } = createSettings()
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const keys = shadow.querySelectorAll('.settings__binding-key')
    expect(keys.length).toBeGreaterThan(0)
    cleanup(el)
  })

  test('remove button deletes a binding', () => {
    const { el, store } = createSettings()
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const removeBtn = /** @type {HTMLButtonElement} */ (shadow.querySelector('.settings__binding-remove'))
    expect(removeBtn).not.toBeNull()
    removeBtn.click()
    // After removing, the save command should have no keys
    const bindings = store.get()
    expect(bindings['save']?.keys).toEqual([])
    cleanup(el)
  })

  test('reset individual command restores defaults', () => {
    const { el, store } = createSettings()
    store.save({ save: { keys: ['ctrl+shift+s'] } })
    el.open = true

    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const resetBtn = /** @type {HTMLButtonElement} */ (shadow.querySelectorAll('.settings__item-reset')[0])
    resetBtn.click()

    // save should be back to schema default
    expect(store.get()['save']?.keys).toEqual(['$mod+s'])
    cleanup(el)
  })

  test('reset all clears all overrides', () => {
    const { el, store } = createSettings()
    store.save({ save: { keys: ['ctrl+s'] }, open: { keys: ['ctrl+p'] } })
    el.open = true

    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const resetAllBtn = /** @type {HTMLButtonElement} */ (shadow.querySelector('.settings__reset-all'))
    resetAllBtn.click()

    expect(store.getOverrides()).toEqual({})
    expect(store.get()['save']?.keys).toEqual(['$mod+s'])
    cleanup(el)
  })

  test('dispatches close event', () => {
    const { el } = createSettings()
    el.open = true
    const handler = mock(() => {})
    el.addEventListener('close', handler)

    // Click backdrop
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.settings__backdrop'))
    backdrop.click()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(el.open).toBe(false)
    cleanup(el)
  })

  test('dispatches change event on binding modification', () => {
    const { el } = createSettings()
    el.open = true
    const handler = mock(() => {})
    el.addEventListener('change', handler)

    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const removeBtn = /** @type {HTMLButtonElement} */ (shadow.querySelector('.settings__binding-remove'))
    removeBtn.click()

    expect(handler).toHaveBeenCalledTimes(1)
    const call = /** @type {any[]} */ (handler.mock.calls[0])
    expect(call[0].detail.commandId).toBe('save')
    cleanup(el)
  })

  test('dispatches reset event', () => {
    const { el, store } = createSettings()
    store.save({ save: { keys: ['ctrl+s'] } })
    el.open = true
    const handler = mock(() => {})
    el.addEventListener('reset', handler)

    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const resetBtn = /** @type {HTMLButtonElement} */ (shadow.querySelectorAll('.settings__item-reset')[0])
    resetBtn.click()

    expect(handler).toHaveBeenCalledTimes(1)
    const call = /** @type {any[]} */ (handler.mock.calls[0])
    expect(call[0].detail.commandId).toBe('save')
    cleanup(el)
  })

  test('re-renders on store change', () => {
    const { el, store } = createSettings()
    el.open = true

    store.save({ save: { keys: ['ctrl+shift+s'] } })

    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const keys = Array.from(shadow.querySelectorAll('.settings__binding-key')).map(k => k.textContent)
    expect(keys.some(k => k === 'S')).toBe(true)
    cleanup(el)
  })

  test('does not fire keybinds when settings is open', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'save', label: 'Save', keys: ['ctrl+s'], execute: fn },
    ]
    const kbCleanup = keybinds(commands, undefined, { target })
    document.body.appendChild(target)

    const settings = document.createElement('keybinds-settings')
    settings.setAttribute('open', '')
    target.appendChild(settings)

    const event = new KeyboardEvent('keydown', {
      key: 's', code: 'KeyS', ctrlKey: true,
    })
    Object.defineProperty(event, 'target', { value: settings })
    target.dispatchEvent(event)

    expect(fn).not.toHaveBeenCalled()
    kbCleanup()
    target.remove()
  })

  test('override cleanup removes entry when matching defaults', () => {
    const { el, store } = createSettings()
    el.open = true

    // First override to something different
    store.save({ save: { keys: ['ctrl+shift+s'] } })
    expect(store.getOverrides()['save']).toBeDefined()

    // Remove the binding via the UI
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const removeBtn = /** @type {HTMLButtonElement} */ (shadow.querySelector('.settings__binding-remove'))
    removeBtn.click()

    // save now has empty keys, which doesn't match default, so override stays
    expect(store.getOverrides()['save']).toBeDefined()

    // Reset the command - this should remove the override
    const resetBtn = /** @type {HTMLButtonElement} */ (shadow.querySelectorAll('.settings__item-reset')[0])
    resetBtn.click()
    expect(store.getOverrides()['save']).toBeUndefined()

    cleanup(el)
  })
})

// --- Release recording in the settings panel ---

describe('KeybindSettings release recording', () => {
  beforeEach(() => {
    localStorage.clear()
    if (!customElements.get('keybinds-settings')) {
      customElements.define('keybinds-settings', KeybindSettings)
    }
  })

  const schema = {
    hold: { label: 'Hold', category: 'A', keys: ['space'], mouse: ['middle', 'scrollup'] },
    other: { label: 'Other', category: 'A', keys: ['o:up'] },
  }

  function setup() {
    const el = /** @type {import('../index.js').KeybindSettings} */ (document.createElement('keybinds-settings'))
    el.inputs = ALL.inputs
    const store = new BindingsStore(schema, 'test:release-settings')
    el.store = store
    // The runtime's CustomEvent is not a happy-dom Event, so the panel's own events can't be dispatched here
    el.dispatchEvent = () => true
    document.body.appendChild(el)
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    return { el, store, shadow }
  }

  /** @param {ShadowRoot} shadow @param {string} part */
  const byPart = (shadow, part) => /** @type {HTMLElement[]} */ (Array.from(shadow.querySelectorAll('[part]')).filter(e => (e.getAttribute('part') ?? '').split(' ').includes(part)))
  /** @param {ShadowRoot} shadow @param {string} part @param {number} [itemIndex] */
  const addButton = (shadow, part, itemIndex = 0) => /** @type {HTMLElement} */ (byPart(shadow, part)[itemIndex])
  /** @param {string} type @param {string} key @param {string} code @param {KeyboardEventInit} [init] */
  const winKey = (type, key, code, init = {}) => window.dispatchEvent(new KeyboardEvent(type, { key, code, cancelable: true, ...init }))
  /** @param {string} type @param {number} button @param {MouseEventInit} [init] */
  const winMouse = (type, button, init = {}) => window.dispatchEvent(new MouseEvent(type, { button, cancelable: true, ...init }))

  test('overlay has a release toggle that is off by default', () => {
    const { el, shadow } = setup()
    addButton(shadow, 'add-key').click()
    const toggle = byPart(shadow, 'recording-release')[0]
    expect(toggle?.getAttribute('aria-pressed')).toBe('false')
    toggle?.click()
    expect(byPart(shadow, 'recording-release-on').length).toBe(1)
    expect(byPart(shadow, 'recording-release')[0]?.getAttribute('aria-pressed')).toBe('true')
    el.remove()
  })

  test('a key recorded with the toggle on becomes x:up on keyup', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-key').click()
    byPart(shadow, 'recording-release')[0]?.click()
    winKey('keydown', 'k', 'KeyK')
    expect(store.get()['hold']?.keys).toEqual(['space'])
    winKey('keyup', 'k', 'KeyK')
    expect(store.get()['hold']?.keys).toEqual(['space', 'k:up'])
    el.remove()
  })

  test('a recorded release keeps the modifiers held at press time', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-key').click()
    byPart(shadow, 'recording-release')[0]?.click()
    winKey('keydown', 'k', 'KeyK', { ctrlKey: true })
    winKey('keyup', 'k', 'KeyK')
    expect(store.get()['hold']?.keys).toEqual(['space', '$mod+k:up'])
    el.remove()
  })

  test('a keyup for a key that was not pressed while recording is ignored', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-key').click()
    byPart(shadow, 'recording-release')[0]?.click()
    winKey('keyup', 'k', 'KeyK')
    expect(store.get()['hold']?.keys).toEqual(['space'])
    el.remove()
  })

  test('with the toggle off, recording is still a press', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-key').click()
    winKey('keydown', 'k', 'KeyK')
    expect(store.get()['hold']?.keys).toEqual(['space', 'k'])
    el.remove()
  })

  test('a mouse button recorded with the toggle on becomes x:up on mouseup', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-mouse').click()
    byPart(shadow, 'recording-release')[0]?.click()
    winMouse('mousedown', 3)
    expect(store.get()['hold']?.mouse).toEqual(['middle', 'scrollup'])
    winMouse('mouseup', 3)
    expect(store.get()['hold']?.mouse).toEqual(['middle', 'scrollup', 'back:up'])
    el.remove()
  })

  test('scrolling is not recorded in release mode', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-mouse').click()
    byPart(shadow, 'recording-release')[0]?.click()
    window.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, cancelable: true }))
    expect(store.get()['hold']?.mouse).toEqual(['middle', 'scrollup'])
    el.remove()
  })

  test('clicking the toggle is not recorded as a mouse binding', () => {
    const { el, store, shadow } = setup()
    addButton(shadow, 'add-mouse').click()
    const toggle = /** @type {HTMLElement} */ (byPart(shadow, 'recording-release')[0])
    toggle.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true, composed: true, cancelable: true }))
    expect(store.get()['hold']?.mouse).toEqual(['middle', 'scrollup'])
    el.remove()
  })

  test('re-recording a binding can also record a release', () => {
    const { el, store, shadow } = setup()
    const keyChip = /** @type {HTMLElement} */ (shadow.querySelector('.settings__binding-keys'))
    keyChip.click()
    byPart(shadow, 'recording-release')[0]?.click()
    winKey('keydown', 'j', 'KeyJ')
    winKey('keyup', 'j', 'KeyJ')
    expect(store.get()['hold']?.keys).toEqual(['j:up'])
    el.remove()
  })

  test('chip switch flips a press to a release and back', () => {
    const { el, store, shadow } = setup()
    byPart(shadow, 'binding-release')[0]?.click()
    expect(store.get()['hold']?.keys).toEqual(['space:up'])
    expect(byPart(shadow, 'binding-release-on').length).toBeGreaterThan(0)
    byPart(shadow, 'binding-release-on')[0]?.click()
    expect(store.get()['hold']?.keys).toEqual(['space'])
    el.remove()
  })

  test('scroll bindings have no chip switch', () => {
    const { el, shadow } = setup()
    const chips = Array.from(shadow.querySelectorAll('.settings__binding'))
    const scrollChip = chips.find(c => c.textContent?.includes('Scroll'))
    expect(scrollChip).toBeDefined()
    expect(scrollChip && byPart(/** @type {any} */ (scrollChip), 'binding-release').length).toBe(0)
    el.remove()
  })

  test('flipping into a taken binding asks before replacing', () => {
    const { el, store, shadow } = setup()
    // hold has "space"; other already has "o:up". Make hold's first key "o" so flipping would collide.
    store.save({ hold: { keys: ['o'] } })
    byPart(shadow, 'binding-release')[0]?.click()
    expect(store.get()['hold']?.keys).toEqual(['o'])
    expect(byPart(shadow, 'conflict').length).toBe(1)
    byPart(shadow, 'conflict-accept')[0]?.click()
    expect(store.get()['hold']?.keys).toEqual(['o:up'])
    expect(store.get()['other']?.keys).toEqual([])
    el.remove()
  })

  test('cancelling a flip conflict leaves the binding and ends the prompt', () => {
    const { el, store, shadow } = setup()
    store.save({ hold: { keys: ['o'] } })
    byPart(shadow, 'binding-release')[0]?.click()
    byPart(shadow, 'conflict-cancel')[0]?.click()
    expect(store.get()['hold']?.keys).toEqual(['o'])
    expect(byPart(shadow, 'conflict').length).toBe(0)
    expect(byPart(shadow, 'recording-overlay').length).toBe(0)
    el.remove()
  })
})
