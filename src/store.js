/**
 * Binding schemas, and the store of people's rebindings laid over them.
 */

/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').BindingSchema} BindingSchema */
/** @typedef {import('./core.js').Schema} Schema */
/** @typedef {import('./core.js').BindingOverrides} BindingOverrides */

/**
 * Define a binding schema (identity function for type inference/autocomplete)
 * @template {Schema} T
 * @param {T} schema
 * @returns {T}
 */
export function defineSchema(schema) {
  return schema
}

/**
 * Merge schema with user overrides
 * @param {Schema} schema - Default bindings
 * @param {BindingOverrides} overrides - User customizations
 * @returns {Schema} Merged bindings
 */
export function mergeBindings(schema, overrides) {
  /** @type {Schema} */
  const result = {}
  for (const [id, binding] of Object.entries(schema)) {
    const override = overrides[id]
    result[id] = override
      ? { ...binding, ...Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined)) }
      : binding
  }
  return result
}

/**
 * Create commands from bindings + handlers
 * Handlers only need to implement commands they care about
 *
 * @param {Schema} bindings - Binding definitions (from schema + overrides)
 * @param {Record<string, (ctx: Record<string, unknown>, event?: Event) => unknown>} handlers - Handler implementations
 * @param {Record<string, { when?: (ctx: Record<string, unknown>) => boolean, captureInput?: boolean, anyModifiers?: boolean }>} [options] - Per-command options
 * @returns {Command[]}
 */
export function fromBindings(bindings, handlers, options = {}) {
  /** @type {Command[]} */
  const commands = []

  for (const [id, handler] of Object.entries(handlers)) {
    const binding = bindings[id]
    if (!binding) {
      console.warn(`keybinds: handler "${id}" has no matching binding`)
      continue
    }
    commands.push({ id, ...binding, execute: handler, ...options[id] })
  }

  return commands
}

/**
 * Get all bindings as a flat list (for settings UI)
 * @param {Schema} schema
 * @returns {Array<BindingSchema & { id: string }>}
 */
export function listBindings(schema) {
  return Object.entries(schema)
    .filter(([, b]) => !b.hidden)
    .map(([id, binding]) => ({ id, ...binding }))
}

/**
 * @template {Schema} T
 * @typedef {{ bindings: T, overrides: BindingOverrides }} BindingsChangeDetail
 */

/**
 * @template {Schema} T
 * @typedef {CustomEvent<BindingsChangeDetail<T>>} BindingsChangeEvent
 */

/**
 * Where a BindingsStore keeps people's overrides
 *
 * @typedef {Object} BindingsStorage
 * @property {() => BindingOverrides} load - The current overrides
 * @property {(overrides: BindingOverrides) => void} save
 * @property {(onChange: (overrides: BindingOverrides) => void) => () => void} [subscribe] - For storage
 *   that can change from elsewhere (another tab, an undo, sync): the store follows it. Returns an
 *   unsubscribe function
 */

/**
 * Storage that keeps overrides in localStorage under one key
 *
 * @param {string} key
 * @returns {BindingsStorage}
 */
export function localStorageBindings(key) {
  return {
    load() {
      try {
        return JSON.parse(localStorage.getItem(key) || '{}')
      } catch {
        return {}
      }
    },
    save(overrides) {
      try {
        localStorage.setItem(key, JSON.stringify(overrides))
      } catch {
        // Storage can be unavailable (private browsing, full); the overrides still apply until reload
      }
    },
  }
}

/**
 * Reactive bindings store, persisted to localStorage or to any {@link BindingsStorage}
 *
 * Extends EventTarget - dispatches 'change' events when bindings are saved, or when the storage
 * changes from elsewhere.
 *
 * @template {Schema} T
 * @extends {EventTarget}
 *
 * @example
 * const store = new BindingsStore(schema, 'myapp:keybinds')
 * // or keep them anywhere:
 * const store = new BindingsStore(schema, { load: () => prefs.keys ?? {}, save: (o) => { prefs.keys = o } })
 *
 * // Get current bindings (merged schema + overrides)
 * const bindings = store.get()
 *
 * // Subscribe to changes
 * store.addEventListener('change', (ev) => {
 *   console.log(ev.detail.bindings) // fully typed
 * })
 *
 * // Save new overrides (dispatches 'change' event)
 * store.save({ delete: { keys: ['$mod+d'] } })
 */
export class BindingsStore extends EventTarget {
  // Declared as fields so they appear in the generated type declarations
  /** @type {T} */ schema
  /** @type {BindingsStorage} */ storage
  /** @type {BindingOverrides} */ overrides
  /** @type {T} */ bindings

  /**
   * @param {T} schema - Default bindings schema
   * @param {string | BindingsStorage} storage - A localStorage key, or where to keep overrides
   */
  constructor(schema, storage) {
    super()
    this.schema = schema
    this.storage = typeof storage === 'string' ? localStorageBindings(storage) : storage
    this.overrides = this.storage.load()
    this.bindings = /** @type {T} */ (mergeBindings(schema, this.overrides))
    // Storage that echoes the store's own saves back would otherwise fire every change twice
    /** @type {(() => void) | null} */
    this._unsubscribe = this.storage.subscribe?.((overrides) => {
      if (JSON.stringify(overrides) === JSON.stringify(this.overrides)) return
      this.overrides = overrides
      this._changed()
    }) ?? null
  }

  /** Get current bindings (schema merged with overrides) */
  get() {
    return this.bindings
  }

  /** Get current overrides only */
  getOverrides() {
    return this.overrides
  }

  /**
   * Save new overrides and dispatch 'change' event
   * @param {BindingOverrides} newOverrides
   */
  save(newOverrides) {
    this.overrides = newOverrides
    this.storage.save(newOverrides)
    this._changed()
  }

  /** Stop following the storage's changes */
  dispose() {
    this._unsubscribe?.()
    this._unsubscribe = null
  }

  /** @private */
  _changed() {
    this.bindings = /** @type {T} */ (mergeBindings(this.schema, this.overrides))
    this.dispatchEvent(new CustomEvent('change', {
      detail: { bindings: this.bindings, overrides: this.overrides }
    }))
  }
}
