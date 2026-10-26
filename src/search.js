/**
 * Searching, ranking and grouping commands, for the palette, cheatsheet and menus.
 */

import { isActive } from './core.js'

/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').Matcher} Matcher */
/** @typedef {import('./core.js').Scorer} Scorer */
/** @typedef {import('./core.js').SearchOptions} SearchOptions */
/** @typedef {import('./core.js').ScoredCommand} ScoredCommand */
/** @typedef {import('./core.js').HistoryEntry} HistoryEntry */

/**
 * Dedupe commands by ID (last wins - for registration order / inner scope)
 * @param {Command[]} commands
 * @returns {Command[]}
 */
function dedupeCommands(commands) {
  /** @type {Map<string, Command>} */
  const seen = new Map()
  for (const cmd of commands) {
    seen.set(cmd.id, cmd)  // last one wins
  }
  return Array.from(seen.values())
}

/**
 * Search commands with a given matcher
 *
 * - Dedupes by ID (last registration wins - inner scope shadows outer)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} context - Current context
 * @param {Matcher} matcher - Matcher function to score results
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export function matchCommands(commands, query, context, matcher) {
  /** @type {ScoredCommand[]} */
  const results = []

  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue

    // A description or category is found by the words as typed: letters scattered through a
    // sentence match almost anything.
    const match = matcher(query, cmd.label)
      ?? matcher(query, cmd.id)
      ?? (cmd.description ? simpleMatcher(query, cmd.description) : null)
      ?? (cmd.category ? simpleMatcher(query, cmd.category) : null)

    if (!match) continue

    /** @type {ScoredCommand} */
    const scored = { ...cmd, active: isActive(cmd, context), score: match.score }
    if (match.positions) scored.positions = match.positions
    results.push(scored)
  }

  return results.sort(byRelevance)
}

/**
 * Active first, then by rank, then by score.
 * @param {ScoredCommand} a
 * @param {ScoredCommand} b
 */
function byRelevance(a, b) {
  if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0)
  if ((a.rank ?? 0) !== (b.rank ?? 0)) return (b.rank ?? 0) - (a.rank ?? 0)
  return b.score - a.score
}

/**
 * Search commands for command palette (defaults to fuzzy matching)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} [context] - Current context
 * @param {SearchOptions} [options] - Search options (e.g., custom matcher, scorer)
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export function searchCommands(commands, query, context = {}, options = {}) {
  const results = matchCommands(commands, query, context, options.matcher ?? fuzzyMatcher)
  if (!options.scorer) return results
  const scorer = options.scorer
  for (const cmd of results) {
    cmd.score += scorer(cmd, context)
  }
  return results.sort(byRelevance)
}

/**
 * Default scorer — combines specificity and frecency.
 *
 * Specificity: commands with a `when` condition score higher (score 2 if
 * `when(ctx)` is true, score 1 for commands with no condition).
 *
 * Frecency: if history entries are supplied, recently-executed commands
 * receive an additive boost:
 *   - within last 60 s  → +3
 *   - within last 5 min → +2
 *   - within last 30 min → +1
 *
 * @param {HistoryEntry[]} [history]
 * @returns {Scorer}
 */
export function defaultScorer(history) {
  return (command, context) => {
    // Specificity
    let score = command.when
      ? (command.when(/** @type {Record<string, unknown>} */ (context)) ? 2 : 0)
      : 1

    if (score === 0) return 0  // when present but false — exclude

    // Frecency
    if (history && history.length > 0) {
      const now = Date.now()
      let best = 0
      for (const entry of history) {
        if (entry.id !== command.id) continue
        const age = now - entry.timestamp
        if (age <= 60_000 && best < 3) best = 3
        else if (age <= 300_000 && best < 2) best = 2
        else if (age <= 1_800_000 && best < 1) best = 1
      }
      score += best
    }

    return score
  }
}

/**
 * Group commands by category
 *
 * - Dedupes by ID (last registration wins)
 * - Excludes commands with no bindings
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {Record<string, unknown>} [context] - Current context (for active state)
 * @param {string[]} [fields] - The command fields that hold bindings
 * @returns {Record<string, (Command & { active: boolean })[]>} Commands grouped by category
 */
export function groupByCategory(commands, context = {}, fields = ['keys', 'mouse', 'gamepad']) {
  /** @type {Record<string, (Command & { active: boolean })[]>} */
  const groups = {}

  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue
    if (!fields.some((f) => /** @type {unknown[] | undefined} */ (/** @type {Record<string, unknown>} */ (cmd)[f])?.length)) continue
    const cat = cmd.category || 'Other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push({
      ...cmd,
      active: isActive(cmd, context)
    })
  }

  return groups
}

/**
 * Filter commands by menu tag
 *
 * - Dedupes by ID (last registration wins)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} menu - Menu tag to filter by
 * @param {Record<string, unknown>} [context] - Current context (for active state)
 * @returns {(Command & { active: boolean })[]} Matching commands
 */
export function filterByMenu(commands, menu, context = {}) {
  const results = []
  for (const cmd of dedupeCommands(commands)) {
    if (cmd.hidden) continue
    const menus = cmd.menu
    if (!menus) continue
    const matches = Array.isArray(menus) ? menus.includes(menu) : menus === menu
    if (!matches) continue
    results.push({ ...cmd, active: isActive(cmd, context) })
  }
  return results
}

// ========================================
// Matchers
// ========================================

/**
 * Simple substring matcher (case-insensitive)
 *
 * Scores by position: startsWith > includes
 *
 * @type {Matcher}
 */
export function simpleMatcher(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  if (t.startsWith(q)) return { score: 2 }
  if (t.includes(q)) return { score: 1 }
  return null
}

/**
 * Fuzzy sequential character matcher
 *
 * Matches if all query chars appear in order in text.
 * Scores based on consecutive matches and word-start bonuses.
 * Returns positions for highlighting.
 *
 * @type {Matcher}
 */
export function fuzzyMatcher(query, text) {
  const q = query.toLowerCase()
  const t = text.toLowerCase()

  let qi = 0
  let ti = 0
  let score = 0
  let lastMatch = -1
  /** @type {number[]} */
  const positions = []

  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      positions.push(ti)
      // Consecutive match bonus
      if (ti === lastMatch + 1) score += 2
      // Word start bonus (after space/hyphen/underscore or at beginning)
      if (ti === 0 || ' -_'.includes(/** @type {string} */ (t[ti - 1]))) score += 3
      // Exact case match bonus
      if (query[qi] === text[ti]) score += 1
      lastMatch = ti
      qi++
    }
    ti++
  }

  // All query chars must be found
  if (qi < q.length) return null

  // Base score from match ratio
  score += Math.round((positions.length / t.length) * 10)
  // The query as typed, whole, counts for more than its letters scattered: at a word's start most.
  const whole = t.indexOf(q)
  if (whole >= 0) score += whole === 0 || ' -_'.includes(/** @type {string} */ (t[whole - 1])) ? 20 : 10

  return { score, positions }
}
