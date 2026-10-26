export type Command = import('../core.js').Command;
export type Matcher = import('../core.js').Matcher;
export type ScoredCommand = import('../core.js').ScoredCommand;
export type Input = import('../core.js').Input;
/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').Matcher} Matcher */
/** @typedef {import('../core.js').ScoredCommand} ScoredCommand */
/** @typedef {import('../core.js').Input} Input */
/**
 * <keybinds-command-palette> - Search-driven command execution
 *
 * Attributes:
 *   open         - Show/hide the palette
 *   auto-trigger - Enable default $mod+K trigger
 *   placeholder  - Input placeholder text (default: "Type a command...")
 *   hide-inactive - List only commands that apply now (otherwise the rest are shown disabled)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   matcher: Matcher        - Custom matcher function
 *   inputs: Input[]         - How bindings are shown (default: keys only)
 *   source: (query) => Command[] | Promise<Command[]>
 *                           - Further commands for a non-empty query, merged with `commands`
 *   sourceDelay: number     - Milliseconds of typing pause before `source` is asked (default 200)
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
    static kind: string;
    static get observedAttributes(): string[];
    constructor();
    get commands(): import("../core.js").Command[];
    set commands(val: import("../core.js").Command[]);
    get context(): Record<string, unknown>;
    set context(val: Record<string, unknown>);
    get matcher(): import("../core.js").Matcher | undefined;
    set matcher(val: import("../core.js").Matcher | undefined);
    get source(): ((query: string) => import("../core.js").Command[] | Promise<import("../core.js").Command[]>) | undefined;
    set source(val: ((query: string) => import("../core.js").Command[] | Promise<import("../core.js").Command[]>) | undefined);
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
    /** @param {boolean} [ask] - whether to ask `source` again for this query */
    _search(ask?: boolean): void;
    /**
     * Asks `source` once typing pauses; an answer for a query no longer typed is dropped.
     * @param {string} query
     */
    _ask(query: string): void;
    _getAllVisible(): {
        id: string;
        label: string;
        description?: string | undefined;
        category?: string | undefined;
        keys?: string[] | undefined;
        mouse?: string[] | undefined;
        gamepad?: string[] | undefined;
        when?: ((ctx: Record<string, unknown>) => boolean) | undefined;
        execute: (ctx: Record<string, unknown>, event?: Event | undefined) => unknown;
        hidden?: boolean | undefined;
        captureInput?: boolean | undefined;
        anyModifiers?: boolean | undefined;
        menu?: string | string[] | undefined;
        rank?: number | undefined;
        active: boolean;
        score: number;
    }[];
    _render(): void;
    /**
     * @param {HTMLLIElement} li
     * @param {ScoredCommand} cmd
     * @param {number} index
     */
    _updateItem(li: HTMLLIElement, cmd: ScoredCommand, index: number): void;
    /** @param {number} index */
    _setActive(index: number): void;
    /** @param {KeyboardEvent} e */
    _handleKey(e: KeyboardEvent): void;
    _scrollToActive(): void;
    /** @param {number} index */
    _execute(index: number): void;
}
