export type Command = import('../core.js').Command;
export type Input = import('../core.js').InputUI;
export type Scorer = import('../core.js').Scorer;
export type HistoryEntry = import('../core.js').HistoryEntry;
export type ScoredCommand = import('../core.js').ScoredCommand;
/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').InputUI} Input */
/** @typedef {import('../core.js').Scorer} Scorer */
/** @typedef {import('../core.js').HistoryEntry} HistoryEntry */
/** @typedef {import('../core.js').ScoredCommand} ScoredCommand */
/**
 * <keybinds-context-menu> - Scored, searchable context menu driven by commands
 *
 * Shows top `maxVisible` items (default: 7) scored via the scorer (default:
 * `defaultScorer()`). A search input at the top filters and re-scores. When
 * more items exist than `maxVisible`, a subtle "▾ N more" row at the bottom
 * reveals them on hover/focus with a smooth height transition.
 *
 * Attributes:
 *   open         - Show/hide the menu
 *   auto-trigger - Wire contextmenu event on target element
 *   menu         - Menu tag to filter commands by
 *   target       - CSS selector for contextmenu target (defaults to parentElement)
 *
 * Properties:
 *   commands: Command[]           - Array of command definitions
 *   context: object               - Context for `when` checks
 *   open: boolean                 - Show/hide the menu
 *   menu: string                  - Menu tag to filter by
 *   position: { x: number, y: number } - Menu position
 *   scorer: Scorer                - Scoring function (default: defaultScorer())
 *   history: HistoryEntry[]       - Frecency history for defaultScorer
 *   maxVisible: number            - Max visible items before "N more" (default: 7)
 *   inputs: Input[]               - How bindings are shown (default: keys only)
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * CSS parts:
 *   search          - The search input element
 *   context-menu    - Outer container
 *   backdrop        - Click-away backdrop
 *   list            - The <ul>
 *   separator       - Category separator <li>
 *   item            - Command <li>
 *   item-active     - Active/focused item
 *   item-disabled   - Inactive command
 *   item-label      - Label span
 *   item-keys       - Keys container
 *   item-key        - Individual key <kbd>
 *   more-row        - "▾ N more" toggle row
 */
export declare class ContextMenu extends HTMLElement {
    static kind: string;
    static get observedAttributes(): string[];
    constructor();
    get commands(): import("../core.js").Command[];
    set commands(val: import("../core.js").Command[]);
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
    get scorer(): import("../core.js").Scorer;
    set scorer(val: import("../core.js").Scorer);
    get history(): import("../core.js").HistoryEntry[];
    set history(val: import("../core.js").HistoryEntry[]);
    get maxVisible(): number;
    set maxVisible(val: number);
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
