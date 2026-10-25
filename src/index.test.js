import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  fuzzyMatcher,
  simpleMatcher,
  validateCommands,
  mergeBindings,
  listBindings,
  fromBindings,
  matchCommands,
  searchCommands,
  groupByCategory,
  executeCommand,
  formatKeyParts,
  formatMouseParts,
  keybinds,
  BindingsStore,
  filterByMenu,
  eventToBindingString,
  eventToMouseBindingString,
  findConflict,
  KeybindSettings,
  KeybindCheatsheet,
  defaultScorer,
  BasicContextMenu,
  ContextMenu,
  CommandHub,
  createComponent,
  CommandPalette,
} from './index.js'

// --- Pure logic tests ---

describe('fuzzyMatcher', () => {
  test('returns null on no match', () => {
    expect(fuzzyMatcher('xyz', 'hello')).toBeNull()
  })

  test('returns positions for matching characters', () => {
    const result = fuzzyMatcher('hlo', 'hello')
    expect(result).not.toBeNull()
    expect(result?.positions).toEqual([0, 2, 4])
  })

  test('awards consecutive match bonus', () => {
    const consecutive = /** @type {NonNullable<ReturnType<typeof fuzzyMatcher>>} */ (fuzzyMatcher('he', 'hello'))
    const nonConsecutive = /** @type {NonNullable<ReturnType<typeof fuzzyMatcher>>} */ (fuzzyMatcher('ho', 'hello'))
    expect(consecutive.score).toBeGreaterThan(nonConsecutive.score)
  })

  test('awards word-start bonus', () => {
    const result = fuzzyMatcher('d', 'save document')
    expect(result).not.toBeNull()
    // 'd' at index 5 is after a space → word-start bonus
    expect(result?.positions).toEqual([5])
  })

  test('awards exact case bonus', () => {
    const exact = /** @type {NonNullable<ReturnType<typeof fuzzyMatcher>>} */ (fuzzyMatcher('S', 'Save'))
    const noExact = /** @type {NonNullable<ReturnType<typeof fuzzyMatcher>>} */ (fuzzyMatcher('s', 'Save'))
    expect(exact.score).toBeGreaterThan(noExact.score)
  })

  test('includes ratio in score', () => {
    const short = /** @type {NonNullable<ReturnType<typeof fuzzyMatcher>>} */ (fuzzyMatcher('ab', 'ab'))
    const long = /** @type {NonNullable<ReturnType<typeof fuzzyMatcher>>} */ (fuzzyMatcher('ab', 'a_________b'))
    expect(short.score).toBeGreaterThan(long.score)
  })
})

describe('simpleMatcher', () => {
  test('returns score 2 for startsWith', () => {
    expect(simpleMatcher('hel', 'Hello')).toEqual({ score: 2 })
  })

  test('returns score 1 for includes', () => {
    expect(simpleMatcher('llo', 'Hello')).toEqual({ score: 1 })
  })

  test('returns null on miss', () => {
    expect(simpleMatcher('xyz', 'Hello')).toBeNull()
  })

  test('is case-insensitive', () => {
    expect(simpleMatcher('HEL', 'hello')).toEqual({ score: 2 })
  })
})

describe('validateCommands', () => {
  test('valid commands pass', () => {
    expect(validateCommands([
      { id: 'save', label: 'Save', keys: ['$mod+s'], execute: () => {} },
      { id: 'click', label: 'Click', mouse: ['Click'], execute: () => {} },
    ])).toBe(true)
  })

  test('throws on missing id', () => {
    expect(() => validateCommands([/** @type {any} */ ({ label: 'X', execute: () => {} })]))
      .toThrow('Command missing id')
  })

  test('throws on invalid key', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', keys: ['$mod+banana'], execute: () => {} },
    ])).toThrow('Unknown key "banana"')
  })

  test('throws on modifier-only key binding', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', keys: ['$mod'], execute: () => {} },
    ])).toThrow('no key (only modifiers)')
  })

  test('throws on multi-key binding', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', keys: ['a+b'], execute: () => {} },
    ])).toThrow('multiple keys')
  })

  test('throws on invalid mouse binding', () => {
    expect(() => validateCommands([
      { id: 'x', label: 'X', mouse: ['DoubleClick'], execute: () => {} },
    ])).toThrow('Unknown mouse button')
  })
})

describe('mergeBindings', () => {
  const schema = {
    save: { label: 'Save', keys: ['$mod+s'] },
    open: { label: 'Open', keys: ['$mod+o'], mouse: ['$mod+Click'] },
  }

  test('empty overrides returns schema unchanged', () => {
    const result = mergeBindings(schema, {})
    expect(result['save']?.keys).toEqual(['$mod+s'])
    expect(result['open']?.keys).toEqual(['$mod+o'])
  })

  test('overrides keys', () => {
    const result = mergeBindings(schema, { save: { keys: ['$mod+shift+s'] } })
    expect(result['save']?.keys).toEqual(['$mod+shift+s'])
  })

  test('overrides mouse', () => {
    const result = mergeBindings(schema, { open: { mouse: ['RightClick'] } })
    expect(result['open']?.mouse).toEqual(['RightClick'])
  })

  test('nullish coalescing preserves original when override field is undefined', () => {
    const result = mergeBindings(schema, { open: { keys: ['$mod+p'] } })
    expect(result['open']?.mouse).toEqual(['$mod+Click'])
    expect(result['open']?.keys).toEqual(['$mod+p'])
  })

  test('unknown override IDs are ignored', () => {
    const result = mergeBindings(schema, { nonexistent: { keys: ['a'] } })
    expect(Object.keys(result)).toEqual(['save', 'open'])
  })
})

describe('listBindings', () => {
  test('returns flat array with IDs', () => {
    const schema = {
      save: { label: 'Save', keys: ['$mod+s'] },
      open: { label: 'Open', keys: ['$mod+o'] },
    }
    const list = listBindings(schema)
    expect(list).toHaveLength(2)
    expect(list[0]?.id).toBe('save')
    const first = /** @type {NonNullable<typeof list[0]>} */ (list[0])
    expect(first).toEqual({ id: 'save', label: 'Save', keys: ['$mod+s'] })
  })

  test('filters hidden bindings', () => {
    const schema = {
      save: { label: 'Save', keys: ['$mod+s'] },
      internal: { label: 'Internal', keys: ['x'], hidden: true },
    }
    const list = listBindings(schema)
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('save')
  })
})

describe('fromBindings', () => {
  const bindings = {
    save: { label: 'Save', category: 'File', keys: ['$mod+s'] },
    open: { label: 'Open', category: 'File', keys: ['$mod+o'] },
  }

  test('constructs commands from bindings and handlers', () => {
    const commands = fromBindings(bindings, { save: () => 'saved' })
    expect(commands).toHaveLength(1)
    expect(commands[0]?.id).toBe('save')
    expect(commands[0]?.label).toBe('Save')
    expect(commands[0]?.category).toBe('File')
    expect(commands[0]?.keys).toEqual(['$mod+s'])
  })

  test('warns on orphan handler', () => {
    const warn = mock(() => {})
    const origWarn = console.warn
    console.warn = warn
    fromBindings(bindings, { nonexistent: () => {} })
    console.warn = origWarn
    expect(warn).toHaveBeenCalledWith('keybinds: handler "nonexistent" has no matching binding')
  })

  test('applies per-command options', () => {
    const whenFn = () => true
    const commands = fromBindings(bindings, { save: () => {} }, {
      save: { when: whenFn, captureInput: true },
    })
    expect(commands[0]?.when).toBe(whenFn)
    expect(commands[0]?.captureInput).toBe(true)
  })
})

describe('searchCommands', () => {
  const commands = [
    { id: 'save', label: 'Save document', category: 'File', keys: ['$mod+s'], execute: () => {} },
    { id: 'open', label: 'Open file', category: 'File', keys: ['$mod+o'], execute: () => {} },
    { id: 'delete', label: 'Delete', category: 'Edit', keys: ['Backspace'], when: () => false, execute: () => {} },
  ]

  test('matches by label', () => {
    const results = searchCommands(commands, 'Save')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.id).toBe('save')
  })

  test('matches by id', () => {
    const results = searchCommands(commands, 'open')
    expect(results.some(r => r.id === 'open')).toBe(true)
  })

  test('matches by category', () => {
    const results = searchCommands(commands, 'File')
    expect(results.length).toBe(2)
  })

  test('excludes hidden commands', () => {
    const cmds = [
      ...commands,
      { id: 'hidden', label: 'Hidden cmd', keys: ['h'], hidden: true, execute: () => {} },
    ]
    expect(searchCommands(cmds, 'Hidden')).toHaveLength(0)
  })

  test('includes unbound commands', () => {
    const cmds = [
      ...commands,
      { id: 'unbound', label: 'Unbound cmd', execute: () => {} },
    ]
    expect(searchCommands(cmds, 'Unbound')).toHaveLength(1)
    expect(searchCommands(cmds, 'Unbound')[0]?.id).toBe('unbound')
  })

  test('deduplicates by id (last wins)', () => {
    const cmds = [
      { id: 'save', label: 'Save v1', keys: ['$mod+s'], execute: () => {} },
      { id: 'save', label: 'Save v2', keys: ['$mod+s'], execute: () => {} },
    ]
    const results = searchCommands(cmds, 'Save')
    expect(results).toHaveLength(1)
    expect(results[0]?.label).toBe('Save v2')
  })

  test('sorts active before inactive, then by score', () => {
    const results = searchCommands(commands, 'e')
    const deleteIdx = results.findIndex(r => r.id === 'delete')
    const activeResults = results.filter(r => r.active)
    if (deleteIdx >= 0 && activeResults.length > 0) {
      expect(deleteIdx).toBeGreaterThanOrEqual(activeResults.length)
    }
  })

  test('uses custom matcher', () => {
    /** @type {import('./index.js').Matcher} */
    const matcher = (_q, t) => t.includes('Save') ? { score: 10, positions: [0] } : null
    const results = searchCommands(commands, 'anything', {}, { matcher })
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('save')
  })

  test('defaults to fuzzy matching', () => {
    const results = searchCommands(commands, 'svd')
    expect(results.some(r => r.id === 'save')).toBe(true)
    expect(results[0]?.positions).toBeDefined()
  })
})

describe('matchCommands', () => {
  const commands = [
    { id: 'save', label: 'Save document', keys: ['$mod+s'], execute: () => {} },
    { id: 'open', label: 'Open file', keys: ['$mod+o'], execute: () => {} },
  ]

  test('uses provided matcher', () => {
    const results = matchCommands(commands, 'Save', {}, simpleMatcher)
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('save')
  })

  test('does not match when matcher rejects', () => {
    const results = matchCommands(commands, 'svd', {}, simpleMatcher)
    expect(results).toHaveLength(0)
  })
})

describe('groupByCategory', () => {
  const commands = [
    { id: 'save', label: 'Save', category: 'File', keys: ['$mod+s'], execute: () => {} },
    { id: 'open', label: 'Open', category: 'File', keys: ['$mod+o'], execute: () => {} },
    { id: 'delete', label: 'Delete', category: 'Edit', keys: ['Backspace'], execute: () => {} },
    { id: 'misc', label: 'Misc', keys: ['m'], execute: () => {} },
  ]

  test('groups by category', () => {
    const groups = groupByCategory(commands)
    expect(groups['File']).toHaveLength(2)
    expect(groups['Edit']).toHaveLength(1)
  })

  test('defaults to "Other" when no category', () => {
    const groups = groupByCategory(commands)
    expect(groups['Other']).toBeDefined()
    expect(groups['Other']?.[0]?.id).toBe('misc')
  })

  test('excludes hidden commands', () => {
    const cmds = [...commands, { id: 'h', label: 'H', keys: ['h'], hidden: true, execute: () => {} }]
    const allIds = Object.values(groupByCategory(cmds)).flat().map(c => c.id)
    expect(allIds).not.toContain('h')
  })

  test('excludes unbound commands', () => {
    const cmds = [...commands, { id: 'u', label: 'U', execute: () => {} }]
    const allIds = Object.values(groupByCategory(cmds)).flat().map(c => c.id)
    expect(allIds).not.toContain('u')
  })

  test('reflects active state from context', () => {
    const cmds = [
      { id: 'a', label: 'A', keys: ['a'], when: (/** @type {Record<string, unknown>} */ ctx) => /** @type {boolean} */ (ctx['ready']), execute: () => {} },
    ]
    const groups = groupByCategory(cmds, { ready: false })
    expect(groups['Other']?.[0]?.active).toBe(false)
  })

  test('deduplicates by id', () => {
    const cmds = [
      { id: 'save', label: 'Save v1', category: 'File', keys: ['$mod+s'], execute: () => {} },
      { id: 'save', label: 'Save v2', category: 'File', keys: ['$mod+s'], execute: () => {} },
    ]
    const groups = groupByCategory(cmds)
    expect(groups['File']).toHaveLength(1)
    expect(groups['File']?.[0]?.label).toBe('Save v2')
  })
})

describe('filterByMenu', () => {
  test('filters by string menu field', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: 'node', execute: () => {} },
      { id: 'b', label: 'B', menu: 'edge', execute: () => {} },
    ]
    const results = filterByMenu(cmds, 'node')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('a')
  })

  test('filters by array menu field', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: ['node', 'edge'], execute: () => {} },
      { id: 'b', label: 'B', menu: 'edge', execute: () => {} },
    ]
    const results = filterByMenu(cmds, 'node')
    expect(results).toHaveLength(1)
    expect(results[0]?.id).toBe('a')
  })

  test('excludes hidden commands', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: 'node', hidden: true, execute: () => {} },
    ]
    expect(filterByMenu(cmds, 'node')).toHaveLength(0)
  })

  test('deduplicates by id', () => {
    const cmds = [
      { id: 'a', label: 'A v1', menu: 'node', execute: () => {} },
      { id: 'a', label: 'A v2', menu: 'node', execute: () => {} },
    ]
    const results = filterByMenu(cmds, 'node')
    expect(results).toHaveLength(1)
    expect(results[0]?.label).toBe('A v2')
  })

  test('returns active state from context', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: 'node', when: (/** @type {Record<string, unknown>} */ ctx) => /** @type {boolean} */ (ctx['ready']), execute: () => {} },
    ]
    const active = filterByMenu(cmds, 'node', { ready: true })
    expect(active[0]?.active).toBe(true)
    const inactive = filterByMenu(cmds, 'node', { ready: false })
    expect(inactive[0]?.active).toBe(false)
  })

  test('returns empty when no match', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: 'node', execute: () => {} },
    ]
    expect(filterByMenu(cmds, 'nonexistent')).toHaveLength(0)
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

describe('formatMouseParts', () => {
  test('formats click buttons', () => {
    expect(formatMouseParts('Click')).toEqual(['Click'])
    expect(formatMouseParts('RightClick')).toEqual(['Right'])
    expect(formatMouseParts('MiddleClick')).toEqual(['Middle'])
  })

  test('formats modifiers', () => {
    expect(formatMouseParts('ctrl+Click')).toEqual(['Ctrl', 'Click'])
    expect(formatMouseParts('alt+RightClick')).toEqual(['Alt', 'Right'])
  })

  test('formats $mod as Ctrl on non-Mac', () => {
    expect(formatMouseParts('$mod+Click')).toEqual(['Ctrl', 'Click'])
  })
})

// --- DOM tests ---
// Use happy-dom elements as event targets so dispatched events are accepted

describe('keybinds', () => {
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

describe('BindingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  const schema = {
    save: { label: 'Save', keys: ['$mod+s'] },
    open: { label: 'Open', keys: ['$mod+o'] },
  }

  test('loads with schema defaults', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    expect(store.get()['save']?.keys).toEqual(['$mod+s'])
  })

  test('saves overrides to localStorage', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    store.save({ save: { keys: ['$mod+shift+s'] } })

    const stored = JSON.parse(/** @type {string} */ (localStorage.getItem('test:bindings')))
    expect(stored.save.keys).toEqual(['$mod+shift+s'])
  })

  test('merges overrides into bindings', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    store.save({ save: { keys: ['$mod+shift+s'] } })
    expect(store.get()['save']?.keys).toEqual(['$mod+shift+s'])
    expect(store.get()['open']?.keys).toEqual(['$mod+o'])
  })

  test('loads persisted overrides on construction', () => {
    localStorage.setItem('test:bindings', JSON.stringify({ save: { keys: ['ctrl+s'] } }))
    const store = new BindingsStore(schema, 'test:bindings')
    expect(store.get()['save']?.keys).toEqual(['ctrl+s'])
  })

  test('handles corrupt JSON gracefully', () => {
    localStorage.setItem('test:bindings', 'not json')
    const store = new BindingsStore(schema, 'test:bindings')
    expect(store.get()['save']?.keys).toEqual(['$mod+s'])
  })

  test('dispatches change event on save', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    const handler = mock(() => {})
    store.addEventListener('change', handler)

    store.save({ save: { keys: ['ctrl+s'] } })

    expect(handler).toHaveBeenCalledTimes(1)
    const call = /** @type {any[]} */ (handler.mock.calls[0])
    const detail = call[0].detail
    expect(detail.bindings.save.keys).toEqual(['ctrl+s'])
    expect(detail.overrides).toEqual({ save: { keys: ['ctrl+s'] } })
  })

  test('getOverrides returns current overrides', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    store.save({ open: { keys: ['ctrl+o'] } })
    expect(store.getOverrides()).toEqual({ open: { keys: ['ctrl+o'] } })
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

describe('eventToMouseBindingString', () => {
  test('converts left click', () => {
    const event = new MouseEvent('mousedown', { button: 0 })
    expect(eventToMouseBindingString(event)).toBe('click')
  })

  test('converts middle click', () => {
    const event = new MouseEvent('mousedown', { button: 1 })
    expect(eventToMouseBindingString(event)).toBe('middle')
  })

  test('converts right click', () => {
    const event = new MouseEvent('mousedown', { button: 2 })
    expect(eventToMouseBindingString(event)).toBe('right')
  })

  test('converts modified click', () => {
    const event = new MouseEvent('mousedown', { button: 0, ctrlKey: true })
    expect(eventToMouseBindingString(event)).toBe('$mod+click')
  })

  test('converts alt+shift+click', () => {
    const event = new MouseEvent('mousedown', { button: 0, altKey: true, shiftKey: true })
    expect(eventToMouseBindingString(event)).toBe('alt+shift+click')
  })
})

describe('findConflict', () => {
  const schema = {
    save: { label: 'Save', keys: ['$mod+s'] },
    open: { label: 'Open', keys: ['$mod+o'], mouse: ['$mod+click'] },
    close: { label: 'Close', keys: ['$mod+w'] },
  }

  test('returns null when no conflict', () => {
    expect(findConflict(schema, '$mod+k', 'keys')).toBeNull()
  })

  test('finds key conflict', () => {
    const conflict = findConflict(schema, '$mod+s', 'keys')
    expect(conflict).toEqual({ commandId: 'save', label: 'Save' })
  })

  test('finds mouse conflict', () => {
    const conflict = findConflict(schema, '$mod+click', 'mouse')
    expect(conflict).toEqual({ commandId: 'open', label: 'Open' })
  })

  test('excludes self by id', () => {
    expect(findConflict(schema, '$mod+s', 'keys', 'save')).toBeNull()
  })

  test('normalizes through parse for accurate comparison', () => {
    // ctrl+s should conflict with $mod+s on non-Mac
    const conflict = findConflict(schema, 'ctrl+s', 'keys')
    expect(conflict).toEqual({ commandId: 'save', label: 'Save' })
  })
})

// --- KeybindSettings component tests ---

describe('CommandPalette source', () => {
  beforeEach(() => {
    if (!customElements.get('keybinds-command-palette')) {
      customElements.define('keybinds-command-palette', CommandPalette)
    }
  })

  const labels = (/** @type {HTMLElement} */ el) =>
    Array.from(/** @type {ShadowRoot} */ (el.shadowRoot).querySelectorAll('.palette__item-label'))
      .map(l => l.textContent)
  const type = (/** @type {HTMLInputElement} */ input) =>
    input.dispatchEvent(new (/** @type {any} */ (input.ownerDocument.defaultView).Event)('input'))

  test('merges what source answers for the typed query, after the delay, once', async () => {
    const el = /** @type {CommandPalette} */ (document.createElement('keybinds-command-palette'))
    document.body.appendChild(el)
    const asked = /** @type {string[]} */ ([])
    el.commands = [{ id: 'a', label: 'Alpha', execute: () => {} }]
    el.sourceDelay = 5
    el.source = async (q) => {
      asked.push(q)
      return [{ id: 'b', label: 'Alphabet', execute: () => {} }, { id: 'a', label: 'Alpha dup', execute: () => {} }]
    }
    el.open = true
    const input = /** @type {HTMLInputElement} */ (/** @type {ShadowRoot} */ (el.shadowRoot).querySelector('input'))
    input.value = 'al'
    type(input)
    input.value = 'alp'
    type(input)
    expect(labels(el)).toEqual(['Alpha'])
    await new Promise(r => setTimeout(r, 30))
    expect(asked).toEqual(['alp'])
    expect(labels(el).sort()).toEqual(['Alpha', 'Alphabet'])
    el.commands = [{ id: 'a', label: 'Alpha', execute: () => {} }]
    await new Promise(r => setTimeout(r, 30))
    expect(asked).toEqual(['alp'])
    expect(labels(el).sort()).toEqual(['Alpha', 'Alphabet'])
    el.remove()
  })

  test('drops an answer for a query no longer typed', async () => {
    const el = /** @type {CommandPalette} */ (document.createElement('keybinds-command-palette'))
    document.body.appendChild(el)
    el.sourceDelay = 0
    /** @type {(x: any[]) => void} */
    let answer = () => {}
    el.source = () => new Promise(r => { answer = r })
    el.open = true
    const input = /** @type {HTMLInputElement} */ (/** @type {ShadowRoot} */ (el.shadowRoot).querySelector('input'))
    input.value = 'x'
    type(input)
    await new Promise(r => setTimeout(r, 5))
    input.value = 'y'
    answer([{ id: 'x', label: 'Xylophone', execute: () => {} }])
    await new Promise(r => setTimeout(r, 5))
    expect(labels(el)).toEqual([])
    el.remove()
  })
})

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
    const el = /** @type {import('./index.js').KeybindSettings} */ (document.createElement('keybinds-settings'))
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

// --- defaultScorer tests ---

describe('defaultScorer', () => {
  const cmdWithWhen = { id: 'a', label: 'A', when: () => true, execute: () => {} }
  const cmdWithWhenFalse = { id: 'b', label: 'B', when: () => false, execute: () => {} }
  const cmdNoWhen = { id: 'c', label: 'C', execute: () => {} }

  test('command with no when scores 1', () => {
    const scorer = defaultScorer()
    expect(scorer(cmdNoWhen, {})).toBe(1)
  })

  test('command with when=true scores 2', () => {
    const scorer = defaultScorer()
    expect(scorer(cmdWithWhen, {})).toBe(2)
  })

  test('command with when=false scores 0 (excluded)', () => {
    const scorer = defaultScorer()
    expect(scorer(cmdWithWhenFalse, {})).toBe(0)
  })

  test('command with when scores higher than command without when', () => {
    const scorer = defaultScorer()
    expect(scorer(cmdWithWhen, {})).toBeGreaterThan(scorer(cmdNoWhen, {}))
  })

  test('frecency: within last 60s adds +3', () => {
    const now = Date.now()
    const history = [{ id: 'c', timestamp: now - 10_000 }]
    const scorer = defaultScorer(history)
    expect(scorer(cmdNoWhen, {})).toBe(1 + 3)
  })

  test('frecency: within last 5min (but not 60s) adds +2', () => {
    const now = Date.now()
    const history = [{ id: 'c', timestamp: now - 120_000 }]
    const scorer = defaultScorer(history)
    expect(scorer(cmdNoWhen, {})).toBe(1 + 2)
  })

  test('frecency: within last 30min (but not 5min) adds +1', () => {
    const now = Date.now()
    const history = [{ id: 'c', timestamp: now - 600_000 }]
    const scorer = defaultScorer(history)
    expect(scorer(cmdNoWhen, {})).toBe(1 + 1)
  })

  test('frecency: older than 30min adds 0', () => {
    const now = Date.now()
    const history = [{ id: 'c', timestamp: now - 4_000_000 }]
    const scorer = defaultScorer(history)
    expect(scorer(cmdNoWhen, {})).toBe(1)
  })

  test('frecency: uses best matching history entry', () => {
    const now = Date.now()
    const history = [
      { id: 'c', timestamp: now - 600_000 },  // 10min → +1
      { id: 'c', timestamp: now - 30_000 },   // 30s → +3
    ]
    const scorer = defaultScorer(history)
    expect(scorer(cmdNoWhen, {})).toBe(1 + 3)
  })

  test('frecency: does not apply to other command ids', () => {
    const now = Date.now()
    const history = [{ id: 'different', timestamp: now - 1_000 }]
    const scorer = defaultScorer(history)
    expect(scorer(cmdNoWhen, {})).toBe(1)
  })
})

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

// --- Side buttons, press/release ---

/** @param {string} type @param {number} button @param {MouseEventInit} [init] */
const mouse = (type, button, init = {}) => new MouseEvent(type, { button, cancelable: true, ...init })
/** @param {string} type @param {string} key @param {string} code @param {KeyboardEventInit} [init] */
const kbd = (type, key, code, init = {}) => new KeyboardEvent(type, { key, code, cancelable: true, bubbles: true, ...init })

describe('side buttons', () => {
  test('back and forward presses fire their own bindings, not scroll', () => {
    const back = mock(() => {})
    const fwd = mock(() => {})
    const up = mock(() => {})
    const down = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'b', label: 'B', mouse: ['Back'], execute: back },
      { id: 'f', label: 'F', mouse: ['ForwardClick'], execute: fwd },
      { id: 'u', label: 'U', mouse: ['scrollup'], execute: up },
      { id: 'd', label: 'D', mouse: ['scrolldown'], execute: down },
    ], undefined, { target })

    target.dispatchEvent(mouse('mousedown', 3))
    expect(back).toHaveBeenCalledTimes(1)
    target.dispatchEvent(mouse('mousedown', 4))
    expect(fwd).toHaveBeenCalledTimes(1)
    expect(up).not.toHaveBeenCalled()
    expect(down).not.toHaveBeenCalled()
    cleanup()
  })

  test('scroll bindings do not fire on side buttons when only scroll is bound', () => {
    const up = mock(() => {})
    const down = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'u', label: 'U', mouse: ['scrollup'], execute: up },
      { id: 'd', label: 'D', mouse: ['scrolldown'], execute: down },
    ], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 3))
    target.dispatchEvent(mouse('mousedown', 4))
    expect(up).not.toHaveBeenCalled()
    expect(down).not.toHaveBeenCalled()
    cleanup()
  })

  test('buttons beyond the named five are ignored, not treated as click', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'c', label: 'C', mouse: ['Click'], execute: fn }], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 5))
    target.dispatchEvent(mouse('mousedown', 7))
    expect(fn).not.toHaveBeenCalled()
    target.dispatchEvent(mouse('mousedown', 0))
    expect(fn).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('mousedown, mouseup and auxclick are cancelled while the press fired', () => {
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'b', label: 'B', mouse: ['Back'], execute: () => {} }], undefined, { target })
    const down = mouse('mousedown', 3)
    const up = mouse('mouseup', 3)
    const aux = mouse('auxclick', 3)
    target.dispatchEvent(down)
    target.dispatchEvent(up)
    target.dispatchEvent(aux)
    expect(down.defaultPrevented).toBe(true)
    expect(up.defaultPrevented).toBe(true)
    expect(aux.defaultPrevented).toBe(true)
    cleanup()
  })

  test('side buttons are left alone when nothing fired', () => {
    const target = document.createElement('div')
    const cleanup = keybinds([
      { id: 'b', label: 'B', mouse: ['Back'], when: () => false, execute: () => {} },
    ], undefined, { target })
    const down = mouse('mousedown', 3)
    const up = mouse('mouseup', 3)
    const aux = mouse('auxclick', 3)
    target.dispatchEvent(down)
    target.dispatchEvent(up)
    target.dispatchEvent(aux)
    expect(down.defaultPrevented).toBe(false)
    expect(up.defaultPrevented).toBe(false)
    expect(aux.defaultPrevented).toBe(false)
    cleanup()
  })

  test('a release-only side binding cancels its mouseup and auxclick', () => {
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'b', label: 'B', mouse: ['Forward:up'], execute: () => {} }], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 4))
    const up = mouse('mouseup', 4)
    const aux = mouse('auxclick', 4)
    target.dispatchEvent(up)
    target.dispatchEvent(aux)
    expect(up.defaultPrevented).toBe(true)
    expect(aux.defaultPrevented).toBe(true)
    cleanup()
  })

  test('a stale auxclick block does not leak into the next press', () => {
    const target = document.createElement('div')
    let active = true
    const cleanup = keybinds([{ id: 'b', label: 'B', mouse: ['Back'], when: () => active, execute: () => {} }], undefined, { target })
    target.dispatchEvent(mouse('mousedown', 3))
    target.dispatchEvent(mouse('mouseup', 3))
    active = false
    target.dispatchEvent(mouse('mousedown', 3))
    const aux = mouse('auxclick', 3)
    target.dispatchEvent(aux)
    expect(aux.defaultPrevented).toBe(false)
    cleanup()
  })

  test('parse, format and conflict handle back/forward', () => {
    expect(() => validateCommands([{ id: 'x', label: 'X', mouse: ['Back', 'forward', 'ctrl+BackClick'], execute: () => {} }])).not.toThrow()
    expect(formatMouseParts('Back')).toEqual(['Back'])
    expect(formatMouseParts('ctrl+ForwardClick')).toEqual(['Ctrl', 'Forward'])
    const schema = { s: { label: 'S', mouse: ['back'] } }
    expect(findConflict(schema, 'BackClick', 'mouse')?.commandId).toBe('s')
    expect(findConflict(schema, 'scrollup', 'mouse')).toBeNull()
    expect(findConflict(schema, 'forward', 'mouse')).toBeNull()
  })

  test('eventToMouseBindingString names side buttons and rejects unnamed ones', () => {
    expect(eventToMouseBindingString(mouse('mousedown', 3))).toBe('back')
    expect(eventToMouseBindingString(mouse('mousedown', 4))).toBe('forward')
    expect(eventToMouseBindingString(mouse('mousedown', 5))).toBeNull()
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
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: ['ctrl+k:up', 'Escape:UP'], mouse: ['middle:up'], execute: () => {} }])).not.toThrow()
    expect(() => validateCommands([{ id: 'x', label: 'X', mouse: ['scrollup:up'], execute: () => {} }])).toThrow()
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: [':up'], execute: () => {} }])).toThrow()
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: ['ctrl+:up'], execute: () => {} }])).toThrow()
  })

  test('format adds a Release part', () => {
    expect(formatKeyParts('ctrl+k:up')).toEqual(['Ctrl', 'K', 'Release'])
    expect(formatMouseParts('MiddleClick:up')).toEqual(['Middle', 'Release'])
  })

  test('conflicts treat press and release as different inputs', () => {
    const schema = { s: { label: 'S', keys: ['k'], mouse: ['middle'] } }
    expect(findConflict(schema, 'k:up', 'keys')).toBeNull()
    expect(findConflict(schema, 'middle:up', 'mouse')).toBeNull()
    expect(findConflict(schema, 'K', 'keys')?.commandId).toBe('s')
    expect(findConflict({ s: { label: 'S', keys: ['k:up'] } }, 'K:UP', 'keys')?.commandId).toBe('s')
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
    const el = /** @type {import('./index.js').KeybindSettings} */ (document.createElement('keybinds-settings'))
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
    expect(findConflict({ s: { label: 'S', keys: ['arrowup'] } }, 'up', 'keys')?.commandId).toBe('s')
    const up = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'x', label: 'X', keys: ['left:up'], execute: up }], undefined, { target })
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', code: 'ArrowLeft' }))
    target.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', code: 'ArrowLeft' }))
    expect(up).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('error for an unknown key names what was typed', () => {
    expect(() => validateCommands([{ id: 'x', label: 'X', keys: ['nope'], execute: () => {} }])).toThrow('Unknown key "nope"')
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

describe('BasicContextMenu', () => {
  beforeEach(() => {
    if (!customElements.get('keybinds-basic-context-menu')) {
      customElements.define('keybinds-basic-context-menu', BasicContextMenu)
    }
  })

  /** @param {import('./index.js').Command[]} commands */
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

  test('recording a shifted symbol keeps the character, not Shift', () => {
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '?', code: 'Slash', shiftKey: true }))).toBe('?')
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '+', code: 'Equal', shiftKey: true, ctrlKey: true }))).toBe('$mod+plus')
    expect(eventToBindingString(new KeyboardEvent('keydown', { key: '1', code: 'Digit1', shiftKey: false }))).toBe('1')
  })

  test('physical key names show as the character they type', () => {
    expect(formatKeyParts('shift+slash')).toEqual(['Shift', '/'])
    expect(formatKeyParts('shift+digit1')).toEqual(['Shift', '1'])
    expect(formatKeyParts('$mod+comma').at(-1)).toBe(',')
    expect(formatKeyParts('$mod+plus').at(-1)).toBe('+')
    expect(formatKeyParts('?')).toEqual(['?'])
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
    const menu = createComponent('context-menu')
    target.appendChild(menu)
    menu.setAttribute('open', '')
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
    expect(fn).not.toHaveBeenCalled()
    cleanup()
    target.remove()
  })
})

describe('scroll gestures', () => {
  // (happy-dom's WheelEvent ignores modifier keys, so these bind plain scrolling)
  /** @param {number} deltaY @param {number} [deltaMode] */
  const wheel = (deltaY, deltaMode = 0) => new WheelEvent('wheel', { deltaY, deltaMode, cancelable: true })

  test('a mouse-wheel notch is one step', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'z', label: 'Zoom out', mouse: ['scrolldown'], execute: fn }], undefined, { target })
    target.dispatchEvent(wheel(100))
    expect(fn).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test("a trackpad's small deltas add up to a step, and the page doesn't scroll in between", () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'z', label: 'Zoom out', mouse: ['scrolldown'], execute: fn }], undefined, { target })
    const events = Array.from({ length: 10 }, () => wheel(12))
    for (const e of events) target.dispatchEvent(e)
    // 120px in 12px events: steps at 48+ and 96+... one per 50px
    expect(fn).toHaveBeenCalledTimes(2)
    expect(events.every((e) => e.defaultPrevented)).toBe(true)
    cleanup()
  })

  test('lines count as pixels', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'z', label: 'Z', mouse: ['scrolldown'], execute: fn }], undefined, { target })
    target.dispatchEvent(wheel(3, 1))
    expect(fn).toHaveBeenCalledTimes(0)
    target.dispatchEvent(wheel(1, 1))
    expect(fn).toHaveBeenCalledTimes(1)
    cleanup()
  })

  test('a pause starts a new gesture', async () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'z', label: 'Z', mouse: ['scrolldown'], execute: fn }], undefined, { target, wheel: { idle: 30 } })
    target.dispatchEvent(wheel(40))
    await Bun.sleep(60)
    target.dispatchEvent(wheel(40))
    expect(fn).toHaveBeenCalledTimes(0)
    cleanup()
  })

  test('a command returning false gives the gesture back to the page', () => {
    const fn = mock(() => false)
    const target = document.createElement('div')
    const cleanup = keybinds([{ id: 'z', label: 'Z', mouse: ['scrolldown'], execute: fn }], undefined, { target })
    target.dispatchEvent(wheel(60))
    const later = wheel(60)
    target.dispatchEvent(later)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(later.defaultPrevented).toBe(false)
    cleanup()
  })
})

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

describe('createComponent', () => {
  test('uses the usual name, and its own when another copy of the library took it', () => {
    const palette = createComponent('command-palette')
    expect(palette).toBeInstanceOf(CommandPalette)
    if (!customElements.get('keybinds-radial-menu')) customElements.define('keybinds-radial-menu', class extends HTMLElement {})
    const radial = createComponent('radial-menu')
    expect(radial.tagName.toLowerCase()).toMatch(/^keybinds-radial-menu-\d+$/)
    document.body.appendChild(radial)
    expect(radial.getAttribute('data-keybinds')).toBe('radial-menu')
    radial.remove()
  })
})

describe('CommandHub', () => {
  beforeEach(() => localStorage.clear())

  /** @param {Partial<import('./index.js').Command>} extra */
  const cmd = (extra = {}) => ({ id: 'save', label: 'Save', keys: ['ctrl+s'], execute: mock(() => {}), ...extra })
  const press = (/** @type {EventTarget} */ t) => t.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true }))

  test('commands from every source fire on their keys, and the first source wins an id', () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ storageKey: 't', listen: { target } })
    const mine = cmd()
    const theirs = cmd({ label: 'Other save' })
    hub.setSource('a', () => [mine])
    hub.setSource('b', () => [theirs])
    hub.refresh()
    press(target)
    expect(mine.execute).toHaveBeenCalledTimes(1)
    expect(theirs.execute).not.toHaveBeenCalled()
    expect(hub.get('save')?.label).toBe('Save')
    hub.destroy()
  })

  test("a person's rebinding takes effect at once and is kept per scope", () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ storageKey: 't', listen: { target } })
    const save = cmd()
    hub.setSource('a', () => [save])
    hub.refresh()
    hub.store?.save({ save: { keys: ['ctrl+d'] } })
    press(target)
    expect(save.execute).not.toHaveBeenCalled()
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', ctrlKey: true }))
    expect(save.execute).toHaveBeenCalledTimes(1)
    expect(hub.keysFor('save')).toEqual(['Ctrl+D'])
    hub.setScope('other')
    hub.refresh()
    expect(hub.keysFor('save')).toEqual(['Ctrl+S'])
    hub.destroy()
  })

  test('one unreadable binding leaves the others working', () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ storageKey: 't', listen: { target } })
    const save = cmd()
    const broken = cmd({ id: 'broken', keys: ['ctrl+notakey'] })
    const error = console.error
    console.error = () => {}
    hub.setSource('a', () => [broken, save])
    hub.refresh()
    console.error = error
    press(target)
    expect(save.execute).toHaveBeenCalledTimes(1)
    expect(hub.keysFor('broken')).toEqual([])
    hub.destroy()
  })

  test('adapt turns other definitions into commands', () => {
    const target = document.createElement('div')
    const ran = mock(() => {})
    const hub = new CommandHub({ storageKey: 't', listen: { target }, adapt: (/** @type {any} */ d) => ({ ...d, execute: d.run }) })
    hub.setSource('a', () => [{ id: 'save', label: 'Save', keys: ['ctrl+s'], run: ran }])
    hub.refresh()
    press(target)
    expect(ran).toHaveBeenCalledTimes(1)
    expect(hub.run('save')).toBe(true)
    expect(ran).toHaveBeenCalledTimes(2)
    hub.destroy()
  })

  test('command buttons run their command and are disabled while it is unavailable', () => {
    let available = false
    const hub = new CommandHub({ storageKey: 't', listen: { target: document.createElement('div') } })
    const save = cmd({ when: () => available })
    hub.setSource('a', () => [save])
    hub.refresh()
    const bar = document.createElement('div')
    const button = document.createElement('button')
    button.dataset['command'] = 'save'
    bar.appendChild(button)
    const stop = hub.bindButtons(bar)
    expect(button.disabled).toBe(true)
    available = true
    hub.syncContext()
    expect(button.disabled).toBe(false)
    button.click()
    expect(save.execute).toHaveBeenCalledTimes(1)
    stop()
    hub.destroy()
  })

  test('with a host, it makes the components and keeps them in step', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const hub = new CommandHub({ storageKey: 't', host, listen: { target: document.createElement('div') } })
    hub.setSource('a', () => [cmd(), cmd({ id: 'secret', label: 'Secret', hidden: true })])
    hub.refresh()
    expect(hub.palette?.commands.map((c) => c.id)).toEqual(['save'])
    expect(hub.settings?.store).toBe(hub.store)
    expect(host.querySelectorAll('[data-keybinds]').length).toBe(4)
    hub.destroy()
    host.remove()
  })

  test('closing the palette gives focus back to where it was', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const hub = new CommandHub({ storageKey: 't', host, listen: { target: document.createElement('div') } })
    const editor = document.createElement('textarea')
    document.body.appendChild(editor)
    editor.focus()
    hub.openPalette()
    const palette = /** @type {any} */ (hub.palette)
    palette._input.focus()
    palette._close()
    expect(document.activeElement).toBe(editor)
    hub.destroy()
    host.remove()
    editor.remove()
  })

  test('an open menu or palette keeps the context it was opened in', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const hub = new CommandHub({ storageKey: 't', host, listen: { target: document.createElement('div') } })
    let editing = true
    hub.addContext(() => ({ editing }))
    hub.setSource('a', () => [cmd({ menu: 'text' })])
    hub.refresh()
    hub.openMenu('text', 0, 0)
    hub.openPalette()
    // Focus moved into them, so nothing is being edited any more
    editing = false
    hub.syncContext()
    expect(hub.menu?.context).toEqual({ editing: true })
    expect(hub.palette?.context).toEqual({ editing: true })
    expect(hub.cheatsheet?.context).toEqual({ editing: false })
    hub.menu && (hub.menu.open = false)
    hub.syncContext()
    expect(hub.menu?.context).toEqual({ editing: false })
    hub.destroy()
    host.remove()
  })
})
