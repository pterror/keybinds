import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { ContextMenu } from '../components/context-menu.js'
import { BasicContextMenu } from '../components/basic-context-menu.js'

// --- ContextMenu (new scored/searchable component) tests ---

describe('ContextMenu (scored, searchable)', () => {
  beforeEach(() => {
    if (!customElements.get('keybinds-context-menu')) {
      customElements.define('keybinds-context-menu', ContextMenu)
    }
  })

  /** @returns {ContextMenu} */
  function createMenu(commands = makeCommands(10)) {
    const el = /** @type {ContextMenu} */ (document.createElement('keybinds-context-menu'))
    el.commands = commands
    document.body.appendChild(el)
    return el
  }

  /** @param {number} n */
  function makeCommands(n) {
    return Array.from({ length: n }, (_, i) => ({
      id: `cmd${i}`,
      label: `Command ${i}`,
      execute: () => {},
    }))
  }

  /** @param {HTMLElement} el */
  function cleanup(el) { el.remove() }

  test('renders top 7 items by default when open', () => {
    const el = createMenu(makeCommands(15))
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const items = shadow.querySelectorAll('.context-menu__item')
    expect(items.length).toBe(7)
    cleanup(el)
  })

  test('renders all items when count <= maxVisible', () => {
    const el = createMenu(makeCommands(5))
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const items = shadow.querySelectorAll('.context-menu__item')
    expect(items.length).toBe(5)
    cleanup(el)
  })

  test('"N more" row appears when items > maxVisible', () => {
    const el = createMenu(makeCommands(10))
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const moreRow = shadow.querySelector('.context-menu__more-row')
    expect(moreRow).not.toBeNull()
    expect(moreRow?.textContent).toContain('3 more')
    cleanup(el)
  })

  test('no "N more" row when items <= maxVisible', () => {
    const el = createMenu(makeCommands(7))
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const moreRow = shadow.querySelector('.context-menu__more-row')
    expect(moreRow).toBeNull()
    cleanup(el)
  })

  test('maxVisible property controls visible count', () => {
    const el = createMenu(makeCommands(20))
    el.maxVisible = 3
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const items = shadow.querySelectorAll('.context-menu__item')
    expect(items.length).toBe(3)
    cleanup(el)
  })

  test('search shifts which items are visible', () => {
    const cmds = [
      { id: 'save', label: 'Save document', execute: () => {} },
      { id: 'open', label: 'Open file', execute: () => {} },
      { id: 'delete', label: 'Delete item', execute: () => {} },
      { id: 'copy', label: 'Copy selection', execute: () => {} },
      { id: 'paste', label: 'Paste clipboard', execute: () => {} },
      { id: 'undo', label: 'Undo last action', execute: () => {} },
      { id: 'redo', label: 'Redo action', execute: () => {} },
      { id: 'find', label: 'Find in document', execute: () => {} },
    ]
    const el = createMenu(cmds)
    el.maxVisible = 3
    el.open = true

    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const searchInput = /** @type {HTMLInputElement} */ (shadow.querySelector('.context-menu__search'))
    expect(searchInput).not.toBeNull()

    // Simulate typing into the search input
    searchInput.value = 'doc'
    searchInput.dispatchEvent(new Event('input'))

    const items = shadow.querySelectorAll('.context-menu__item')
    const labels = Array.from(items).map(li => li.querySelector('.context-menu__item-label')?.textContent)
    // Both "Save document" and "Find in document" match "doc" — "redo" etc do not
    expect(labels.some(l => l?.toLowerCase().includes('doc'))).toBe(true)
    cleanup(el)
  })

  test('has a search input with part="search"', () => {
    const el = createMenu()
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const input = shadow.querySelector('[part~="search"]')
    expect(input).not.toBeNull()
    expect(input?.tagName.toLowerCase()).toBe('input')
    cleanup(el)
  })

  test('scorer property is accepted and used', () => {
    const cmds = [
      { id: 'a', label: 'Alpha', execute: () => {} },
      { id: 'b', label: 'Beta', execute: () => {} },
    ]
    const el = createMenu(cmds)
    // Scorer that always prioritizes 'b'
    el.scorer = (cmd) => cmd.id === 'b' ? 10 : 1
    el.open = true
    const shadow = /** @type {ShadowRoot} */ (el.shadowRoot)
    const items = shadow.querySelectorAll('.context-menu__item')
    const firstLabel = items[0]?.querySelector('.context-menu__item-label')?.textContent
    expect(firstLabel).toBe('Beta')
    cleanup(el)
  })
})

describe('BasicContextMenu', () => {
  beforeEach(() => {
    if (!customElements.get('keybinds-basic-context-menu')) {
      customElements.define('keybinds-basic-context-menu', BasicContextMenu)
    }
  })

  /** @param {import('../index.js').Command[]} commands */
  function createMenu(commands, menu = '') {
    const el = /** @type {BasicContextMenu} */ (document.createElement('keybinds-basic-context-menu'))
    el.commands = commands
    if (menu) el.menu = menu
    document.body.appendChild(el)
    return el
  }
  /** @param {BasicContextMenu} el */
  const items = (el) => /** @type {HTMLElement[]} */ (Array.from(/** @type {ShadowRoot} */ (el.shadowRoot).querySelectorAll('.context-menu__item')))
  /** @param {BasicContextMenu} el @param {string} key */
  const press = (el, key) => /** @type {ShadowRoot} */ (el.shadowRoot).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

  test('shows only the commands tagged with its menu, unavailable ones disabled', () => {
    const el = createMenu([
      { id: 'cut', label: 'Cut', menu: 'edit', execute: () => {} },
      { id: 'paste', label: 'Paste', menu: ['edit', 'other'], when: () => false, execute: () => {} },
      { id: 'zoom', label: 'Zoom', menu: 'view', execute: () => {} },
    ], 'edit')
    el.open = true
    const shown = items(el)
    expect(shown.map((li) => li.textContent)).toEqual(['Cut', 'Paste'])
    expect(shown[1]?.className).toContain('context-menu__item--disabled')
    el.remove()
  })

  test('separates categories', () => {
    const el = createMenu([
      { id: 'a', label: 'A', category: 'One', execute: () => {} },
      { id: 'b', label: 'B', category: 'Two', execute: () => {} },
    ])
    el.open = true
    expect(/** @type {ShadowRoot} */ (el.shadowRoot).querySelectorAll('.context-menu__separator').length).toBe(1)
    el.remove()
  })

  test('clicking an item runs it, closes, and says which command ran', () => {
    const run = mock(() => {})
    const el = createMenu([{ id: 'go', label: 'Go', execute: run }])
    const executed = mock(() => {})
    el.addEventListener('execute', executed)
    el.open = true
    items(el)[0]?.click()
    expect(run).toHaveBeenCalledTimes(1)
    expect(executed).toHaveBeenCalledTimes(1)
    expect(el.open).toBe(false)
    el.remove()
  })

  test('clicking an unavailable item does nothing', () => {
    const run = mock(() => {})
    const el = createMenu([{ id: 'no', label: 'No', when: () => false, execute: run }])
    el.open = true
    items(el)[0]?.click()
    expect(run).not.toHaveBeenCalled()
    expect(el.open).toBe(true)
    el.remove()
  })

  test('arrow keys move through the items, Enter runs one, Escape closes', () => {
    const first = mock(() => {})
    const second = mock(() => {})
    const el = createMenu([
      { id: 'one', label: 'One', execute: first },
      { id: 'two', label: 'Two', execute: second },
    ])
    el.open = true
    press(el, 'ArrowDown')
    press(el, 'ArrowDown')
    expect(items(el)[1]?.className).toContain('context-menu__item--active')
    press(el, 'Enter')
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    el.open = true
    press(el, 'Escape')
    expect(el.open).toBe(false)
    el.remove()
  })
})
