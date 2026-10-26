export type Input = import('../core.js').InputUI;
export type BindingSchema = import('../core.js').BindingSchema;
export type AnyStore = import('../store.js').BindingsStore<any>;
/** @typedef {import('../core.js').InputUI} Input */
/** @typedef {import('../core.js').BindingSchema} BindingSchema */
/** @typedef {import('../store.js').BindingsStore<any>} AnyStore */
/**
 * <keybinds-settings> - Keybinding settings panel
 *
 * Attributes:
 *   open - Show/hide the settings panel
 *
 * Properties:
 *   store: BindingsStore  - Reactive bindings store
 *   inputs: Input[]       - Which bindings are shown and can be recorded (default: keys only)
 *   releases: boolean     - Offer release bindings ("k:up"); set when keybinds() has releases() (default: false)
 *   holds: boolean        - Offer hold and tap bindings ("k:hold", "k:tap"), with holds() (default: false)
 *   sequences: boolean    - Offer bindings of several steps ("g i"), with sequences() (default: false)
 *   open: boolean         - Show/hide the settings panel
 *
 * Events:
 *   close  - Fired when settings panel is dismissed
 *   change - Fired when a binding is changed (detail: { commandId, bindings })
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
    static kind: string;
    static get observedAttributes(): string[];
    constructor();
    connectedCallback(): void;
    get store(): import("../store.js").BindingsStore<any> | null;
    set store(val: import("../store.js").BindingsStore<any> | null);
    get inputs(): import("../core.js").InputUI[];
    set inputs(val: import("../core.js").InputUI[]);
    get open(): boolean;
    set open(val: boolean);
    /**
     * @param {string} name
     * @param {string | null} _oldVal
     * @param {string | null} newVal
     */
    attributeChangedCallback(name: string, _oldVal: string | null, newVal: string | null): void;
    disconnectedCallback(): void;
    _watchInputs(): void;
    _close(): void;
    /**
     * The effective bindings for a command (overrides merged with schema), by field
     * @param {string} commandId
     * @returns {Record<string, string[]>}
     */
    _getBindings(commandId: string): Record<string, string[]>;
    /**
     * Save binding changes, cleaning up overrides that match defaults
     * @param {string} commandId
     * @param {Record<string, string[]>} newBindings
     */
    _saveBindings(commandId: string, newBindings: Record<string, string[]>): void;
    /**
     * @param {string} commandId
     * @param {Input} input
     * @param {number | null} index - null for adding, number for replacing
     */
    _startRecording(commandId: string, input: Input, index: number | null): void;
    _record(): void;
    _stopRecording(): void;
    /**
     * Switch what recording captures; choosing what's already chosen goes back to a press
     * @param {string} suffix - "", ":up", ":hold" or ":tap"
     */
    _setRecordSuffix(suffix: string): void;
    _toggleSequence(): void;
    static SEQUENCE_PAUSE: number;
    /**
     * A binding was recorded: one step of a sequence, or the whole binding
     * @param {string} binding
     */
    _recorded(binding: string): void;
    _finishSequence(): void;
    /**
     * Switch a stored binding to another form of it: its release, or inverted
     * @param {string} commandId
     * @param {Input} input
     * @param {number} index
     * @param {string} flipped
     */
    _flip(commandId: string, input: Input, index: number, flipped: string): void;
    /**
     * A switch inside the recording prompt
     * @param {string} name - Its part name: "release" gives "recording-release" and, while on, "recording-release-on"
     * @param {string} label
     * @param {boolean} on
     * @param {() => void} onClick
     * @returns {HTMLElement}
     */
    _renderToggle(name: string, label: string, on: boolean, onClick: () => void): HTMLElement;
    /** @param {string} bindingStr */
    _handleRecordedBinding(bindingStr: string): void;
    /**
     * @param {string} commandId
     * @param {Input} input
     * @param {number | null} index
     * @param {string} bindingStr
     */
    _applyBinding(commandId: string, input: Input, index: number | null, bindingStr: string): void;
    _acceptConflict(): void;
    _cancelConflict(): void;
    /**
     * @param {string} commandId
     * @param {Input} input
     * @param {number} index
     */
    _removeBinding(commandId: string, input: Input, index: number): void;
    /** @param {string} commandId */
    _resetCommand(commandId: string): void;
    _resetAll(): void;
    _render(): void;
    /**
     * What's shown while recording: the input's prompt, or the steps so far, and switches for what
     * to record: a release, hold or tap instead of a press, or several steps
     * @returns {HTMLElement}
     */
    _renderRecording(): HTMLElement;
    /**
     * @param {string} commandId
     * @param {Input} input
     * @param {number} index
     * @param {string} bindingStr
     * @returns {HTMLElement}
     */
    _renderBinding(commandId: string, input: Input, index: number, bindingStr: string): HTMLElement;
    /**
     * @param {HTMLElement} el
     * @returns {HTMLElement}
     */
    _withConflict(el: HTMLElement): HTMLElement;
    /** @returns {HTMLElement} */
    _renderConflict(): HTMLElement;
}
