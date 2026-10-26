import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { mergeBindings, listBindings, fromBindings, BindingsStore } from './store.js'

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

  /** storage held in a variable, which can also be changed from "elsewhere" */
  const memoryStorage = (/** @type {import('./index.js').BindingOverrides} */ initial = {}) => {
    let held = initial
    /** @type {Set<(o: import('./index.js').BindingOverrides) => void>} */
    const listeners = new Set()
    const set = (/** @type {import('./index.js').BindingOverrides} */ o) => {
      held = o
      for (const l of listeners) l(o)
    }
    return {
      set,
      storage: {
        load: () => held,
        save: set,
        subscribe: (/** @type {(o: import('./index.js').BindingOverrides) => void} */ fn) => {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
      },
    }
  }

  test('loads from and saves to custom storage, without touching localStorage', () => {
    const { storage } = memoryStorage({ save: { keys: ['ctrl+s'] } })
    const store = new BindingsStore(schema, storage)
    expect(store.get()['save']?.keys).toEqual(['ctrl+s'])
    store.save({ open: { keys: ['ctrl+o'] } })
    expect(storage.load()).toEqual({ open: { keys: ['ctrl+o'] } })
    expect(localStorage.length).toBe(0)
  })

  test('follows custom storage changed from elsewhere', () => {
    const { storage, set } = memoryStorage()
    const store = new BindingsStore(schema, storage)
    const handler = mock(() => {})
    store.addEventListener('change', handler)
    set({ save: { keys: ['ctrl+shift+s'] } })
    expect(store.get()['save']?.keys).toEqual(['ctrl+shift+s'])
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('a save that the storage echoes back fires one change', () => {
    const { storage } = memoryStorage()
    const store = new BindingsStore(schema, storage)
    const handler = mock(() => {})
    store.addEventListener('change', handler)
    store.save({ save: { keys: ['ctrl+s'] } })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  test('dispose stops following the storage', () => {
    const { storage, set } = memoryStorage()
    const store = new BindingsStore(schema, storage)
    store.dispose()
    set({ save: { keys: ['ctrl+shift+s'] } })
    expect(store.get()['save']?.keys).toEqual(['$mod+s'])
  })
})
