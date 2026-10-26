export type Command = import('../core.js').Command;
export type Input = import('../core.js').InputUI;
/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').InputUI} Input */
/**
 * <keybinds-basic-context-menu> - Context menu driven by commands (no search, no limit)
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
 *   inputs: Input[]         - How bindings are shown (default: keys only)
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
export declare class BasicContextMenu extends HTMLElement {
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
