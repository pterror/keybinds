/**
 * keybinds - Declarative contextual keybindings
 *
 * Commands as data, context as state, zero dependencies.
 * Supports keyboard and mouse bindings.
 */
export type Modifiers = {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
};
export type ParsedKey = {
    mods: Modifiers;
    key: string;
};
export type ParsedMouse = {
    mods: Modifiers;
    button: number;
};
export type Command = {
    id: string;
    label: string;
    description?: string | undefined;
    category?: string | undefined;
    keys?: string[] | undefined;
    mouse?: string[] | undefined;
    when?: ((ctx: Record<string, unknown>) => boolean) | undefined;
    execute: (ctx: Record<string, unknown>, event?: Event) => unknown;
    hidden?: boolean | undefined;
    captureInput?: boolean | undefined;
    menu?: string | string[] | undefined;
};
export type MatchResult = {
    score: number;
    positions?: number[];
};
export type Matcher = (query: string, text: string) => MatchResult | null;
export type SearchOptions = {
    matcher?: Matcher | undefined;
};
export type ScoredCommand = Command & {
    active: boolean;
    score: number;
    positions?: number[];
};
/**
 * Create keybind handler
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {() => Record<string, unknown>} [getContext] - Returns current context state
 * @param {{ target?: EventTarget, onExecute?: (cmd: Command, ctx: Record<string, unknown>) => void }} [options] - Options
 *
 * Command shape:
 *   id: string           - unique identifier
 *   label: string        - display name
 *   category?: string    - group for command palette
 *   keys?: string[]      - keyboard triggers (e.g., ['$mod+k', 'Escape'])
 *   mouse?: string[]     - mouse triggers (e.g., ['$mod+Click', 'MiddleClick'])
 *   when?: ctx => bool   - activation condition
 *   execute: ctx => any  - action (return false to propagate)
 *   hidden?: bool        - hide from search
 *   captureInput?: bool  - fire even when in input fields
 *
 * @example
 * const cleanup = keybinds([
 *   {
 *     id: 'delete',
 *     label: 'Delete selected',
 *     category: 'Edit',
 *     keys: ['Backspace', 'Delete'],
 *     when: ctx => ctx.hasSelection && !ctx.isEditing,
 *     execute: () => deleteSelected()  // return false to propagate
 *   },
 *   {
 *     id: 'pan',
 *     label: 'Pan canvas',
 *     category: 'Canvas',
 *     mouse: ['MiddleClick'],
 *     execute: () => startPan()
 *   }
 * ], () => ({
 *   hasSelection: selectedId() !== null,
 *   isEditing: editingId() !== null
 * }))
 * @returns {() => void} Cleanup function
 */
export declare function keybinds(commands: Command[], getContext?: () => Record<string, unknown>, options?: {
    target?: EventTarget;
    onExecute?: (cmd: Command, ctx: Record<string, unknown>) => void;
}): () => void;
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
export declare function matchCommands(commands: Command[], query: string, context: Record<string, unknown>, matcher: Matcher): ScoredCommand[];
/**
 * Search commands for command palette (defaults to fuzzy matching)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {string} query - Search query
 * @param {Record<string, unknown>} [context] - Current context
 * @param {SearchOptions} [options] - Search options (e.g., custom matcher)
 * @returns {ScoredCommand[]} Matching commands sorted by relevance (active first, then by score)
 */
export declare function searchCommands(commands: Command[], query: string, context?: Record<string, unknown>, options?: SearchOptions): ScoredCommand[];
/**
 * Group commands by category
 *
 * - Dedupes by ID (last registration wins)
 * - Excludes commands with no bindings (no keys and no mouse)
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {Record<string, unknown>} [context] - Current context (for active state)
 * @returns {Record<string, (Command & { active: boolean })[]>} Commands grouped by category
 */
export declare function groupByCategory(commands: Command[], context?: Record<string, unknown>): Record<string, (Command & {
    active: boolean;
})[]>;
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
export declare function filterByMenu(commands: Command[], menu: string, context?: Record<string, unknown>): (Command & {
    active: boolean;
})[];
/**
 * Validate all commands upfront (call on init to catch typos early)
 * @param {Command[]} commands
 * @returns {true}
 * @throws {Error} if any binding is invalid
 */
export declare function validateCommands(commands: Command[]): true;
/**
 * Execute a command by id
 * @param {Command[]} commands
 * @param {string} id
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export declare function executeCommand(commands: Command[], id: string, context?: Record<string, unknown>): boolean;
/**
 * Format key binding into array of display parts (e.g., "$mod+k" -> ["⌘", "K"] on Mac)
 * @param {string} key
 * @returns {string[]}
 */
export declare function formatKeyParts(key: string): string[];
export type BindingSchema = {
    label: string;
    description?: string | undefined;
    category?: string | undefined;
    keys?: string[] | undefined;
    mouse?: string[] | undefined;
    hidden?: boolean | undefined;
    menu?: string | string[] | undefined;
};
export type Schema = Record<string, BindingSchema>;
/**
 * @typedef {Object} BindingSchema
 * @property {string} label - Display name
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Default keyboard triggers
 * @property {string[] | undefined} [mouse] - Default mouse triggers
 * @property {boolean | undefined} [hidden] - Hide from search/settings
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
 */
/**
 * @typedef {Record<string, BindingSchema>} Schema
 */
/**
 * Define a binding schema (identity function for type inference/autocomplete)
 * @template {Schema} T
 * @param {T} schema
 * @returns {T}
 */
export declare function defineSchema<T extends Schema>(schema: T): T;
export type BindingOverrides = Record<string, {
    keys?: string[];
    mouse?: string[];
}>;
/**
 * @typedef {Record<string, { keys?: string[], mouse?: string[] }>} BindingOverrides
 */
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
 * @param {Record<string, { when?: (ctx: Record<string, unknown>) => boolean, captureInput?: boolean }>} [options] - Per-command options
 * @returns {Command[]}
 */
export declare function fromBindings(bindings: Schema, handlers: Record<string, (ctx: Record<string, unknown>, event?: Event) => unknown>, options?: Record<string, {
    when?: (ctx: Record<string, unknown>) => boolean;
    captureInput?: boolean;
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
/**
 * @template {Schema} T
 * @typedef {{ bindings: T, overrides: BindingOverrides }} BindingsChangeDetail
 */
/**
 * @template {Schema} T
 * @typedef {CustomEvent<BindingsChangeDetail<T>>} BindingsChangeEvent
 */
/**
 * Reactive bindings store with localStorage persistence
 *
 * Extends EventTarget - dispatches 'change' events when bindings are saved.
 *
 * @template {Schema} T
 * @extends {EventTarget}
 *
 * @example
 * const store = new BindingsStore(schema, 'myapp:keybinds')
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
    /**
     * @param {T} schema - Default bindings schema
     * @param {string} storageKey - localStorage key
     */
    constructor(schema: T, storageKey: string);
    /** @returns {BindingOverrides} */
    loadOverrides(): BindingOverrides;
    /** Get current bindings (schema merged with overrides) */
    get(): T;
    /** Get current overrides only */
    getOverrides(): BindingOverrides;
    /**
     * Save new overrides and dispatch 'change' event
     * @param {BindingOverrides} newOverrides
     */
    save(newOverrides: BindingOverrides): void;
}
/**
 * Simple substring matcher (case-insensitive)
 *
 * Scores by position: startsWith > includes
 *
 * @type {Matcher}
 */
export declare function simpleMatcher(query: string, text: string): MatchResult | null;
/**
 * Fuzzy sequential character matcher
 *
 * Matches if all query chars appear in order in text.
 * Scores based on consecutive matches and word-start bonuses.
 * Returns positions for highlighting.
 *
 * @type {Matcher}
 */
export declare function fuzzyMatcher(query: string, text: string): MatchResult | null;
/**
 * Convert a KeyboardEvent to a canonical binding string (e.g. "$mod+shift+k")
 *
 * Returns null for bare modifier presses (Shift/Ctrl/Alt/Meta alone)
 * and for keys not in VALID_KEYS.
 *
 * @param {KeyboardEvent} event
 * @returns {string | null}
 */
export declare function eventToBindingString(event: KeyboardEvent): string | null;
/**
 * Convert a MouseEvent or WheelEvent to a canonical binding string (e.g. "$mod+click", "$mod+scrollup")
 *
 * @param {MouseEvent} event
 * @returns {string | null}
 */
export declare function eventToMouseBindingString(event: MouseEvent): string | null;
/**
 * Check if a binding string conflicts with any command in the schema
 *
 * @param {Schema} schema - The binding schema to check against
 * @param {string} bindingStr - The binding string to check
 * @param {'keys' | 'mouse'} type - Whether this is a key or mouse binding
 * @param {string} [excludeId] - Command ID to exclude from conflict check
 * @returns {{ commandId: string, label: string } | null}
 */
export declare function findConflict(schema: Schema, bindingStr: string, type: 'keys' | 'mouse', excludeId?: string): {
    commandId: string;
    label: string;
} | null;
/**
 * <command-palette> - Search-driven command execution
 *
 * Attributes:
 *   open         - Show/hide the palette
 *   auto-trigger - Enable default $mod+K trigger
 *   placeholder  - Input placeholder text (default: "Type a command...")
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   matcher: Matcher        - Custom matcher function
 *   open: boolean           - Show/hide the palette
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when palette is dismissed
 *
 * BEM classes:
 *   .palette
 *   .palette__backdrop
 *   .palette__dialog
 *   .palette__input
 *   .palette__list
 *   .palette__item
 *   .palette__item--active
 *   .palette__item--disabled
 *   .palette__item-label
 *   .palette__item-label-match (highlight)
 *   .palette__item-description
 *   .palette__item-category
 *   .palette__item-keys
 *   .palette__item-key
 *   .palette__empty
 */
export declare class CommandPalette extends HTMLElement {
    static get observedAttributes(): string[];
    constructor();
    get commands(): Command[];
    set commands(val: Command[]);
    get context(): Record<string, unknown>;
    set context(val: Record<string, unknown>);
    get matcher(): Matcher | undefined;
    set matcher(val: Matcher | undefined);
    get open(): boolean;
    set open(val: boolean);
    /**
     * @param {string} name
     * @param {string | null} _oldVal
     * @param {string | null} newVal
     */
    attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    /** @param {boolean} enable */
    _setupAutoTrigger(enable: boolean): void;
    _onOpen(): void;
    _onClose(): void;
    _close(): void;
    _search(): void;
    _getAllVisible(): {
        id: string;
        label: string;
        description?: string | undefined;
        category?: string | undefined;
        keys?: string[] | undefined;
        mouse?: string[] | undefined;
        when?: ((ctx: Record<string, unknown>) => boolean) | undefined;
        execute: (ctx: Record<string, unknown>, event?: Event | undefined) => unknown;
        hidden?: boolean | undefined;
        captureInput?: boolean | undefined;
        menu?: string | string[] | undefined;
        active: boolean;
        score: number;
    }[];
    _render(): void;
    /** @param {KeyboardEvent} e */
    _handleKey(e: KeyboardEvent): void;
    _scrollToActive(): void;
    /** @param {number} index */
    _execute(index: number): void;
}
/**
 * <keybind-cheatsheet> - Grouped display of available bindings
 *
 * Attributes:
 *   open         - Show/hide the cheatsheet
 *   auto-trigger - Enable hold-Control trigger (200ms delay)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks (grays out inactive)
 *   open: boolean           - Show/hide the cheatsheet
 *
 * Events:
 *   close - Fired when cheatsheet is dismissed
 *
 * BEM classes:
 *   .cheatsheet
 *   .cheatsheet__backdrop
 *   .cheatsheet__dialog
 *   .cheatsheet__group
 *   .cheatsheet__group-title
 *   .cheatsheet__list
 *   .cheatsheet__item
 *   .cheatsheet__item--disabled
 *   .cheatsheet__item-label
 *   .cheatsheet__item-keys
 *   .cheatsheet__item-binding
 *   .cheatsheet__item-key
 */
export declare class KeybindCheatsheet extends HTMLElement {
    static get observedAttributes(): string[];
    constructor();
    get commands(): Command[];
    set commands(val: Command[]);
    get context(): Record<string, unknown>;
    set context(val: Record<string, unknown>);
    get open(): boolean;
    set open(val: boolean);
    /**
     * @param {string} name
     * @param {string | null} _oldVal
     * @param {string | null} newVal
     */
    attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    /** @param {boolean} enable */
    _setupAutoTrigger(enable: boolean): void;
    _close(): void;
    _render(): void;
}
/**
 * Format mouse binding into array of display parts
 * @param {string} binding
 * @returns {string[]}
 */
export declare function formatMouseParts(binding: string): string[];
/**
 * Trigger callback when a modifier key is held
 *
 * @param {string | string[]} modifiers - Modifier(s) to listen for: 'Control', 'Alt', 'Shift', 'Meta'
 * @param {(held: boolean) => void} callback - Called with true on hold, false on release
 * @param {{ delay?: number, target?: EventTarget }} [options]
 * @returns {() => void} Cleanup function
 *
 * @example
 * const cleanup = onModifierHold('Control', (held) => {
 *   cheatsheet.open = held
 * }, { delay: 300 })
 */
export declare function onModifierHold(modifiers: string | string[], callback: (held: boolean) => void, options?: {
    delay?: number;
    target?: EventTarget;
}): () => void;
/**
 * <keybind-settings> - Keybinding settings panel
 *
 * Attributes:
 *   open - Show/hide the settings panel
 *
 * Properties:
 *   store: BindingsStore  - Reactive bindings store
 *   open: boolean         - Show/hide the settings panel
 *
 * Events:
 *   close  - Fired when settings panel is dismissed
 *   change - Fired when a binding is changed (detail: { commandId, keys?, mouse? })
 *   reset  - Fired when bindings are reset (detail: { commandId? })
 *
 * BEM classes:
 *   .settings
 *   .settings__backdrop
 *   .settings__dialog
 *   .settings__header
 *   .settings__title
 *   .settings__reset-all
 *   .settings__group
 *   .settings__group-title
 *   .settings__list
 *   .settings__item
 *   .settings__item-label
 *   .settings__item-bindings
 *   .settings__item-reset
 *   .settings__binding
 *   .settings__binding-keys
 *   .settings__binding-key
 *   .settings__binding-remove
 *   .settings__item-add
 *   .settings__binding--recording
 *   .settings__recording-overlay
 *   .settings__conflict
 */
export declare class KeybindSettings extends HTMLElement {
    static get observedAttributes(): string[];
    constructor();
    get store(): BindingsStore<any> | null;
    set store(val: BindingsStore<any> | null);
    get open(): boolean;
    set open(val: boolean);
    /**
     * @param {string} name
     * @param {string | null} _oldVal
     * @param {string | null} newVal
     */
    attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void;
    disconnectedCallback(): void;
    _close(): void;
    /**
     * Get the effective bindings for a command (overrides merged with schema)
     * @param {string} commandId
     * @returns {{ keys: string[], mouse: string[] }}
     */
    _getBindings(commandId: string): {
        keys: string[];
        mouse: string[];
    };
    /**
     * Save binding changes, cleaning up overrides that match defaults
     * @param {string} commandId
     * @param {{ keys: string[], mouse: string[] }} newBindings
     */
    _saveBindings(commandId: string, newBindings: {
        keys: string[];
        mouse: string[];
    }): void;
    /**
     * @param {string} commandId
     * @param {'keys' | 'mouse'} type
     * @param {number | null} index - null for adding, number for replacing
     */
    _startRecording(commandId: string, type: 'keys' | 'mouse', index: number | null): void;
    _stopRecording(): void;
    /** @param {string} bindingStr */
    _handleRecordedBinding(bindingStr: string): void;
    /**
     * @param {string} commandId
     * @param {'keys' | 'mouse'} type
     * @param {number | null} index
     * @param {string} bindingStr
     */
    _applyBinding(commandId: string, type: 'keys' | 'mouse', index: number | null, bindingStr: string): void;
    _acceptConflict(): void;
    _cancelConflict(): void;
    /**
     * @param {string} commandId
     * @param {'keys' | 'mouse'} type
     * @param {number} index
     */
    _removeBinding(commandId: string, type: 'keys' | 'mouse', index: number): void;
    /** @param {string} commandId */
    _resetCommand(commandId: string): void;
    _resetAll(): void;
    _render(): void;
    /**
     * @param {string} commandId
     * @param {'keys' | 'mouse'} type
     * @param {number} index
     * @param {string} bindingStr
     * @returns {HTMLElement}
     */
    _renderBinding(commandId: string, type: 'keys' | 'mouse', index: number, bindingStr: string): HTMLElement;
    /** @returns {HTMLElement} */
    _renderConflict(): HTMLElement;
}
/**
 * <context-menu> - Context menu driven by commands
 *
 * Attributes:
 *   open         - Show/hide the menu
 *   auto-trigger - Wire contextmenu event on target element
 *   menu         - Menu tag to filter commands by
 *   target       - CSS selector for contextmenu target (defaults to parentElement)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   open: boolean           - Show/hide the menu
 *   menu: string            - Menu tag to filter by
 *   position: { x: number, y: number } - Menu position
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * BEM classes:
 *   .context-menu
 *   .context-menu__backdrop
 *   .context-menu__list
 *   .context-menu__separator
 *   .context-menu__item
 *   .context-menu__item--disabled
 *   .context-menu__item--active
 *   .context-menu__item-label
 *   .context-menu__item-keys
 *   .context-menu__item-key
 */
export declare class ContextMenu extends HTMLElement {
    static get observedAttributes(): string[];
    constructor();
    get commands(): Command[];
    set commands(val: Command[]);
    get context(): Record<string, unknown>;
    set context(val: Record<string, unknown>);
    get menu(): string;
    set menu(val: string);
    get open(): boolean;
    set open(val: boolean);
    get position(): {
        x: number;
        y: number;
    };
    set position(val: {
        x: number;
        y: number;
    });
    /**
     * @param {string} name
     * @param {string | null} _oldVal
     * @param {string | null} newVal
     */
    attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    /** @param {boolean} enable */
    _setupAutoTrigger(enable: boolean): void;
    _onOpen(): void;
    _onClose(): void;
    _close(): void;
    _buildItems(): void;
    _updatePosition(): void;
    _render(): void;
    /** @param {KeyboardEvent} e */
    _handleKey(e: KeyboardEvent): void;
    /** @param {number} index */
    _execute(index: number): void;
}
/**
 * Register all keybind components
 * Call this once to define the custom elements
 */
export declare function registerComponents(): void;
export default keybinds;
