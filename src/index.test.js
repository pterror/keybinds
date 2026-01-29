import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  fuzzyMatcher,
  simpleMatcher,
  validateCommands,
  mergeBindings,
  listBindings,
  fromBindings,
  searchCommands,
  groupByCategory,
  executeCommand,
  formatKeyParts,
  formatMouseParts,
  keybinds,
  BindingsStore,
  filterByMenu,
} from './index.js'

// --- Pure logic tests ---

describe('fuzzyMatcher', () => {
  test('returns null on no match', () => {
    expect(fuzzyMatcher('xyz', 'hello')).toBeNull()
  })

  test('returns positions for matching characters', () => {
    const result = fuzzyMatcher('hlo', 'hello')
    expect(result).not.toBeNull()
    expect(result.positions).toEqual([0, 2, 4])
  })

  test('awards consecutive match bonus', () => {
    const consecutive = fuzzyMatcher('he', 'hello')
    const nonConsecutive = fuzzyMatcher('ho', 'hello')
    expect(consecutive.score).toBeGreaterThan(nonConsecutive.score)
  })

  test('awards word-start bonus', () => {
    const result = fuzzyMatcher('d', 'save document')
    expect(result).not.toBeNull()
    // 'd' at index 5 is after a space → word-start bonus
    expect(result.positions).toEqual([5])
  })

  test('awards exact case bonus', () => {
    const exact = fuzzyMatcher('S', 'Save')
    const noExact = fuzzyMatcher('s', 'Save')
    expect(exact.score).toBeGreaterThan(noExact.score)
  })

  test('includes ratio in score', () => {
    const short = fuzzyMatcher('ab', 'ab')
    const long = fuzzyMatcher('ab', 'a_________b')
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
    expect(() => validateCommands([{ label: 'X', execute: () => {} }]))
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
    expect(result.save.keys).toEqual(['$mod+s'])
    expect(result.open.keys).toEqual(['$mod+o'])
  })

  test('overrides keys', () => {
    const result = mergeBindings(schema, { save: { keys: ['$mod+shift+s'] } })
    expect(result.save.keys).toEqual(['$mod+shift+s'])
  })

  test('overrides mouse', () => {
    const result = mergeBindings(schema, { open: { mouse: ['RightClick'] } })
    expect(result.open.mouse).toEqual(['RightClick'])
  })

  test('nullish coalescing preserves original when override field is undefined', () => {
    const result = mergeBindings(schema, { open: { keys: ['$mod+p'] } })
    expect(result.open.mouse).toEqual(['$mod+Click'])
    expect(result.open.keys).toEqual(['$mod+p'])
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
    expect(list[0]).toEqual({ id: 'save', label: 'Save', keys: ['$mod+s'] })
  })

  test('filters hidden bindings', () => {
    const schema = {
      save: { label: 'Save', keys: ['$mod+s'] },
      internal: { label: 'Internal', keys: ['x'], hidden: true },
    }
    const list = listBindings(schema)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('save')
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
    expect(commands[0].id).toBe('save')
    expect(commands[0].label).toBe('Save')
    expect(commands[0].category).toBe('File')
    expect(commands[0].keys).toEqual(['$mod+s'])
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
    expect(commands[0].when).toBe(whenFn)
    expect(commands[0].captureInput).toBe(true)
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
    expect(results[0].id).toBe('save')
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
    expect(searchCommands(cmds, 'Unbound')[0].id).toBe('unbound')
  })

  test('deduplicates by id (last wins)', () => {
    const cmds = [
      { id: 'save', label: 'Save v1', keys: ['$mod+s'], execute: () => {} },
      { id: 'save', label: 'Save v2', keys: ['$mod+s'], execute: () => {} },
    ]
    const results = searchCommands(cmds, 'Save')
    expect(results).toHaveLength(1)
    expect(results[0].label).toBe('Save v2')
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
    const matcher = (q, t) => t.includes('Save') ? { score: 10, positions: [0] } : null
    const results = searchCommands(commands, 'anything', {}, { matcher })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('save')
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
    expect(groups['Other'][0].id).toBe('misc')
  })

  test('excludes hidden commands', () => {
    const cmds = [...commands, { id: 'h', label: 'H', keys: ['h'], hidden: true, execute: () => {} }]
    const allIds = Object.values(groupByCategory(cmds)).flat().map(c => c.id)
    expect(allIds).not.toContain('h')
  })

  test('includes unbound commands', () => {
    const cmds = [...commands, { id: 'u', label: 'U', execute: () => {} }]
    const allIds = Object.values(groupByCategory(cmds)).flat().map(c => c.id)
    expect(allIds).toContain('u')
  })

  test('reflects active state from context', () => {
    const cmds = [
      { id: 'a', label: 'A', keys: ['a'], when: ctx => ctx.ready, execute: () => {} },
    ]
    const groups = groupByCategory(cmds, { ready: false })
    expect(groups['Other'][0].active).toBe(false)
  })

  test('deduplicates by id', () => {
    const cmds = [
      { id: 'save', label: 'Save v1', category: 'File', keys: ['$mod+s'], execute: () => {} },
      { id: 'save', label: 'Save v2', category: 'File', keys: ['$mod+s'], execute: () => {} },
    ]
    const groups = groupByCategory(cmds)
    expect(groups['File']).toHaveLength(1)
    expect(groups['File'][0].label).toBe('Save v2')
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
    expect(results[0].id).toBe('a')
  })

  test('filters by array menu field', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: ['node', 'edge'], execute: () => {} },
      { id: 'b', label: 'B', menu: 'edge', execute: () => {} },
    ]
    const results = filterByMenu(cmds, 'node')
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('a')
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
    expect(results[0].label).toBe('A v2')
  })

  test('returns active state from context', () => {
    const cmds = [
      { id: 'a', label: 'A', menu: 'node', when: ctx => ctx.ready, execute: () => {} },
    ]
    const active = filterByMenu(cmds, 'node', { ready: true })
    expect(active[0].active).toBe(true)
    const inactive = filterByMenu(cmds, 'node', { ready: false })
    expect(inactive[0].active).toBe(false)
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
    expect(onExecute.mock.calls[0][0].id).toBe('save')
    cleanup()
  })

  test('passes context to execute and when', () => {
    const fn = mock(() => {})
    const target = document.createElement('div')
    const commands = [
      { id: 'x', label: 'X', keys: ['ctrl+x'], when: ctx => ctx.ready, execute: fn },
    ]
    const cleanup = keybinds(commands, () => ({ ready: true }), { target })

    target.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'x', code: 'KeyX', ctrlKey: true,
    }))

    expect(fn).toHaveBeenCalled()
    expect(fn.mock.calls[0][0]).toEqual({ ready: true })
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
    expect(store.get().save.keys).toEqual(['$mod+s'])
  })

  test('saves overrides to localStorage', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    store.save({ save: { keys: ['$mod+shift+s'] } })

    const stored = JSON.parse(localStorage.getItem('test:bindings'))
    expect(stored.save.keys).toEqual(['$mod+shift+s'])
  })

  test('merges overrides into bindings', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    store.save({ save: { keys: ['$mod+shift+s'] } })
    expect(store.get().save.keys).toEqual(['$mod+shift+s'])
    expect(store.get().open.keys).toEqual(['$mod+o'])
  })

  test('loads persisted overrides on construction', () => {
    localStorage.setItem('test:bindings', JSON.stringify({ save: { keys: ['ctrl+s'] } }))
    const store = new BindingsStore(schema, 'test:bindings')
    expect(store.get().save.keys).toEqual(['ctrl+s'])
  })

  test('handles corrupt JSON gracefully', () => {
    localStorage.setItem('test:bindings', 'not json')
    const store = new BindingsStore(schema, 'test:bindings')
    expect(store.get().save.keys).toEqual(['$mod+s'])
  })

  test('dispatches change event on save', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    const handler = mock(() => {})
    store.addEventListener('change', handler)

    store.save({ save: { keys: ['ctrl+s'] } })

    expect(handler).toHaveBeenCalledTimes(1)
    const detail = handler.mock.calls[0][0].detail
    expect(detail.bindings.save.keys).toEqual(['ctrl+s'])
    expect(detail.overrides).toEqual({ save: { keys: ['ctrl+s'] } })
  })

  test('getOverrides returns current overrides', () => {
    const store = new BindingsStore(schema, 'test:bindings')
    store.save({ open: { keys: ['ctrl+o'] } })
    expect(store.getOverrides()).toEqual({ open: { keys: ['ctrl+o'] } })
  })
})
