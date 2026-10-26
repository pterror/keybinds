/**
 * Binding schemas, and the store of people's rebindings laid over them.
 */
export type Command = import('./core.js').Command;
export type BindingSchema = import('./core.js').BindingSchema;
export type Schema = import('./core.js').Schema;
export type BindingOverrides = import('./core.js').BindingOverrides;
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
export declare function defineSchema<T extends Schema>(schema: T): T;
/**
 * Merge schema with user overrides
 * @param {Schema} schema - Default bindings
 * @param {BindingOverrides} overrides - User customizations
 * @returns {Schema} Merged bindings
 */
export declare function mergeBindings(schema: Schema, overrides: BindingOverrides): Schema;
/**
 * Create commands from bindings + handlers
 * Handlers only need to implement commands they care about
 *
 * @param {Schema} bindings - Binding definitions (from schema + overrides)
 * @param {Record<string, (ctx: Record<string, unknown>, event?: Event) => unknown>} handlers - Handler implementations
 * @param {Record<string, { when?: (ctx: Record<string, unknown>) => boolean, captureInput?: boolean, anyModifiers?: boolean }>} [options] - Per-command options
 * @returns {Command[]}
 */
export declare function fromBindings(bindings: Schema, handlers: Record<string, (ctx: Record<string, unknown>, event?: Event) => unknown>, options?: Record<string, {
    when?: (ctx: Record<string, unknown>) => boolean;
    captureInput?: boolean;
    anyModifiers?: boolean;
}>): Command[];
/**
 * Get all bindings as a flat list (for settings UI)
 * @param {Schema} schema
 * @returns {Array<BindingSchema & { id: string }>}
 */
export declare function listBindings(schema: Schema): Array<BindingSchema & {
    id: string;
}>;
export type BindingsChangeDetail<T extends Schema> = {
    bindings: T;
    overrides: BindingOverrides;
};
export type BindingsChangeEvent<T extends Schema> = CustomEvent<BindingsChangeDetail<T>>;
export type BindingsStorage = {
    load: () => BindingOverrides;
    save: (overrides: BindingOverrides) => void;
    subscribe?: (onChange: (overrides: BindingOverrides) => void) => () => void;
};
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
export declare function localStorageBindings(key: string): BindingsStorage;
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
export declare class BindingsStore<T extends Schema> extends EventTarget {
    /** @type {T} */ schema: T;
    /** @type {BindingsStorage} */ storage: BindingsStorage;
    /** @type {BindingOverrides} */ overrides: BindingOverrides;
    /** @type {T} */ bindings: T;
    /**
     * @param {T} schema - Default bindings schema
     * @param {string | BindingsStorage} storage - A localStorage key, or where to keep overrides
     */
    constructor(schema: T, storage: string | BindingsStorage);
    /** Get current bindings (schema merged with overrides) */
    get(): T;
    /** Get current overrides only */
    getOverrides(): import("./core.js").BindingOverrides;
    /**
     * Save new overrides and dispatch 'change' event
     * @param {BindingOverrides} newOverrides
     */
    save(newOverrides: BindingOverrides): void;
    /** Stop following the storage's changes */
    dispose(): void;
    private 
    /** @private */
    _changed;
}
