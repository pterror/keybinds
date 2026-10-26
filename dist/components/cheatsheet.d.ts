export type Command = import('../core.js').Command;
export type Input = import('../core.js').InputUI;
/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').InputUI} Input */
/**
 * <keybinds-cheatsheet> - Grouped display of available bindings
 *
 * Attributes:
 *   open         - Show/hide the cheatsheet
 *   auto-trigger  - Open while a modifier is held on its own; tapping it twice keeps it open
 *   trigger-key   - The modifier to hold: $mod (default: Meta on Mac, Control elsewhere), Control, Alt, Shift or Meta
 *   trigger-delay - How long to hold it before opening, in ms (default 200)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks (grays out inactive)
 *   open: boolean           - Show/hide the cheatsheet
 *   inputs: Input[]         - Which bindings are shown, and how (default: keys only)
 *
 * Events:
 *   open  - Fired when it opens, however that happened
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
    static kind: string;
    static get observedAttributes(): string[];
    constructor();
    get commands(): import("../core.js").Command[];
    set commands(val: import("../core.js").Command[]);
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
