export type Command = import('../core.js').Command;
/** @typedef {import('../core.js').Command} Command */
/**
 * <keybinds-radial-menu> - Radial command menu with bilateral text layout
 *
 * Up to 8 commands arranged evenly around a circle. Labels on the right half
 * are left-aligned to the right of their indicator; labels on the left half
 * are right-aligned to the left. Direction becomes muscle memory; eight slots
 * maps to Miller's Law (≤7±2).
 *
 * No auto-trigger — caller controls open/close.
 *
 * Attributes:
 *   open - Reflects open state
 *
 * Properties:
 *   commands: Command[]            - Up to 8 command definitions
 *   context: object                - Context for `when` checks
 *   open: boolean                  - Show/hide the menu
 *
 * Methods:
 *   open({ x, y })  - Open at viewport coordinates (omit for viewport center)
 *   close()         - Dismiss the menu
 *
 * Events:
 *   command - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * CSS parts:
 *   backdrop        - Click-away backdrop
 *   container       - SVG/div outer wrapper
 *   slot            - Each radial slot wrapper
 *   slot-active     - Hovered/focused slot
 *   slot-disabled   - Inactive command slot
 *   indicator       - The dot/circle for each slot
 *   label           - The text label for each slot
 */
export declare class RadialMenu extends HTMLElement {
    static kind: string;
    static get observedAttributes(): string[];
    constructor();
    connectedCallback(): void;
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
    /**
     * Open the menu at the given viewport coordinates.
     * If no coords given, centers in the viewport.
     * @param {{ x?: number, y?: number } | undefined} [coords]
     */
    openAt(coords?: {
        x?: number;
        y?: number;
    } | undefined): void;
    close(): void;
    _onOpen(): void;
    _onClose(): void;
    _close(): void;
    _buildItems(): void;
    _updatePosition(): void;
    _render(): void;
    /** @param {KeyboardEvent} e */
    _handleKey(e: KeyboardEvent): void;
    /** @param {number} slot */
    _execute(slot: number): void;
}
