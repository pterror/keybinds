import { describe, test, expect } from 'bun:test'
import { fuzzyMatcher, simpleMatcher, matchCommands, searchCommands, groupByCategory, filterByMenu, defaultScorer } from './search.js'
import { CommandPalette } from './components/palette.js'

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

describe('ranking matches', () => {
  test('the query typed whole counts for more than its letters scattered', () => {
    const found = searchCommands([
      { id: 'dl', label: 'Download this story', execute: () => {} },
      { id: 'door', label: 'The red door', execute: () => {} },
    ], 'door')
    expect(found.map(c => c.id)).toEqual(['door', 'dl'])
  })

  test('rank comes before relevance, and after whether it applies', () => {
    const found = searchCommands([
      { id: 'new', label: 'New page “cave”', rank: -1, execute: () => {} },
      { id: 'off', label: 'Cave', when: () => false, execute: () => {} },
      { id: 'page', label: 'The caves below', execute: () => {} },
    ], 'cave')
    expect(found.map(c => c.id)).toEqual(['page', 'new', 'off'])
  })

  test('a palette told to hide inactive commands lists only those that apply', () => {
    if (!customElements.get('keybinds-command-palette')) customElements.define('keybinds-command-palette', CommandPalette)
    const el = /** @type {CommandPalette} */ (document.createElement('keybinds-command-palette'))
    el.setAttribute('hide-inactive', '')
    document.body.appendChild(el)
    el.commands = [
      { id: 'a', label: 'Delete this page', when: () => false, execute: () => {} },
      { id: 'b', label: 'Delete this story', execute: () => {} },
    ]
    el.open = true
    const input = /** @type {HTMLInputElement} */ (/** @type {ShadowRoot} */ (el.shadowRoot).querySelector('input'))
    input.value = 'delete'
    input.dispatchEvent(new (/** @type {any} */ (input.ownerDocument.defaultView).Event)('input'))
    const labels = Array.from(/** @type {ShadowRoot} */ (el.shadowRoot).querySelectorAll('.palette__item-label')).map(l => l.textContent)
    expect(labels).toEqual(['Delete this story'])
    el.remove()
  })
})

test('a description is found by the words as typed, not letters scattered through it', () => {
  const cmds = [{ id: 'more', label: 'More…', description: 'What can be done with the link or words at the cursor', execute: () => {} }]
  expect(searchCommands(cmds, 'door').length).toBe(0)
  expect(searchCommands(cmds, 'the cursor').length).toBe(1)
})
