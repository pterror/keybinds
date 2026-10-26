/**
 * CommandHub: every command on the page, from every source, with one store of people's rebindings.
 */
import { BindingsStore } from './store.js';
export type Command = import('./core.js').Command;
export type AxisDef = import('./core.js').AxisDef;
export type AxisValue = import('./core.js').AxisValue;
export type Input = import('./core.js').Input;
export type Schema = import('./core.js').Schema;
export type KeybindsOptions = import('./core.js').KeybindsOptions;
export type BindingsStorage = import('./store.js').BindingsStorage;
export type CommandPalette = import('./components/palette.js').CommandPalette;
export type KeybindCheatsheet = import('./components/cheatsheet.js').KeybindCheatsheet;
export type KeybindSettings = import('./components/settings.js').KeybindSettings;
export type ContextMenu = import('./components/context-menu.js').ContextMenu;
export type CommandHubOptions = {
    inputs?: Input[];
    components?: (CustomElementConstructor & {
        kind: string;
    })[];
    host?: HTMLElement;
    storageKey?: string;
    storage?: (scope: string) => BindingsStorage;
    releases?: import('./core.js').Releases;
    anyModifiers?: import('./core.js').AnyModifiers;
    listen?: Omit<KeybindsOptions, 'inputs' | 'axes' | 'releases' | 'anyModifiers'>;
};
/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').AxisDef} AxisDef */
/** @typedef {import('./core.js').AxisValue} AxisValue */
/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').Schema} Schema */
/** @typedef {import('./core.js').KeybindsOptions} KeybindsOptions */
/** @typedef {import('./store.js').BindingsStorage} BindingsStorage */
/** @typedef {import('./components/palette.js').CommandPalette} CommandPalette */
/** @typedef {import('./components/cheatsheet.js').KeybindCheatsheet} KeybindCheatsheet */
/** @typedef {import('./components/settings.js').KeybindSettings} KeybindSettings */
/** @typedef {import('./components/context-menu.js').ContextMenu} ContextMenu */
/**
 * @typedef {Object} CommandHubOptions
 * @property {Input[]} [inputs] - What to listen to: e.g. [keys(), mouse()]. With components, their UI
 *   halves, which can also be shown and recorded: [keysUI(), mouseUI()]
 * @property {(CustomElementConstructor & { kind: string })[]} [components] - Components to make
 *   inside `host`: any of CommandPalette, KeybindCheatsheet, KeybindSettings, ContextMenu
 * @property {HTMLElement} [host] - Where the components go
 * @property {string} [storageKey] - localStorage key for people's rebindings (default "keybinds"); the scope is appended
 * @property {(scope: string) => BindingsStorage} [storage] - Keep rebindings somewhere other than
 *   localStorage, separately per scope. Takes the place of `storageKey`
 * @property {import('./core.js').Releases} [releases] - From releases(), for release bindings ("k:up")
 * @property {import('./core.js').AnyModifiers} [anyModifiers] - From anyModifiers(), for commands with `anyModifiers`
 * @property {Omit<KeybindsOptions, 'inputs' | 'axes' | 'releases' | 'anyModifiers'>} [listen] - Passed on to keybinds(): target, capture, onExecute
 */
/**
 * Every command on the page, from every source, with one store of people's rebindings.
 *
 * Sources are functions, re-read on refresh(), so commands can come and go with the page's
 * state. The hub derives the bindings schema from the commands themselves, lays each person's
 * overrides over it, listens through its inputs, and keeps its components and any command
 * buttons in step.
 *
 * @example
 * const hub = new CommandHub({
 *   inputs: [keys(), mouse()],
 *   components: [CommandPalette, KeybindSettings],
 *   host: document.body,
 *   storageKey: 'myapp:keys',
 * })
 * hub.setSource('editor', () => editorCommands)
 * hub.addContext(() => ({ editing: !!editor.focused }))
 * hub.refresh()
 * hub.bindButtons(toolbar) // <button data-command="save">Save</button>
 *
 * @template {{ id: string, label: string, category?: string | undefined, description?: string | undefined, keys?: string[] | undefined, mouse?: string[] | undefined, gamepad?: string[] | undefined, hidden?: boolean | undefined }} [D=Command]
 * @template {object} [C=Record<string, unknown>] - The context `when` conditions see
 */
export declare class CommandHub<D extends {
    id: string;
    label: string;
    category?: string | undefined;
    description?: string | undefined;
    keys?: string[] | undefined;
    mouse?: string[] | undefined;
    gamepad?: string[] | undefined;
    hidden?: boolean | undefined;
} = Command, C extends object = Record<string, unknown>> extends EventTarget {
    /** @type {CommandPalette | null} */
    palette: CommandPalette | null;
    /** @type {KeybindCheatsheet | null} */
    cheatsheet: KeybindCheatsheet | null;
    /** @type {KeybindSettings | null} */
    settings: KeybindSettings | null;
    /** @type {ContextMenu | null} */
    menu: ContextMenu | null;
    /**
     * @param {CommandHubOptions & { adapt?: (def: D) => Command }} [options] - `adapt` turns the
     *   sources' definitions into commands, when they aren't commands already
     */
    constructor(options?: CommandHubOptions & {
        adapt?: (def: D) => Command;
    });
    /**
     * Replace the commands owned by `owner` (null removes them). Takes effect on refresh().
     * Earlier sources win when two define the same id.
     * @param {string} owner
     * @param {(() => D[]) | null} get
     */
    setSource(owner: string, get: (() => D[]) | null): void;
    /**
     * Replace the axes owned by `owner` (null removes them). Takes effect on refresh(). Axes are
     * rebindable in the settings panel like commands, and read with axis(id).
     * @param {string} owner
     * @param {(() => AxisDef[]) | null} get
     */
    setAxes(owner: string, get: (() => AxisDef[]) | null): void;
    /**
     * Add to the context that `when` conditions see. Returns a function that removes it again.
     * @param {() => Partial<C>} get
     * @returns {() => void}
     */
    addContext(get: () => Partial<C>): () => void;
    /** @returns {C} */
    context(): C;
    /**
     * Keep rebindings separately per scope (a document type, a game), so a key can mean different
     * things in each. Takes effect on refresh().
     * @param {string} scope
     */
    setScope(scope: string): void;
    /** The store of people's rebindings, as the settings panel edits it. */
    get store(): BindingsStore<import("./core.js").Schema> | null;
    /**
     * Whether a command is held right now: its press fired and that key or button hasn't come up.
     * @param {string} id
     */
    held(id: string): boolean;
    /**
     * An axis's value right now; reading it takes the mouse movement since its last read.
     * @param {string} id
     * @returns {AxisValue}
     */
    axis(id: string): AxisValue;
    /** @returns {D[]} */
    all(): D[];
    /**
     * @param {string} id
     * @returns {D | undefined}
     */
    get(id: string): D | undefined;
    /**
     * Run a command if it's available now. Returns whether it ran.
     * @param {string} id
     * @param {Event} [event]
     * @returns {boolean}
     */
    run(id: string, event?: Event): boolean;
    /** Re-read the sources, rebuild bindings and listeners, and update every component. */
    refresh(): void;
    /** Push the current context into the components and command buttons, so unavailable commands gray out. */
    syncContext(): void;
    openPalette(): void;
    /**
     * Open the context menu with the commands tagged `tag`, at a point on screen.
     * @param {string} tag
     * @param {number} x
     * @param {number} y
     */
    openMenu(tag: string, x: number, y: number): void;
    /**
     * A command's or axis's bindings through one input right now, as shown to people (e.g.
     * "Ctrl+Z" for keys, "Mouse ↔" for axes).
     * @param {string} id
     * @param {string} field - The input's field: "keys", "mouse", "gamepad", "axes"
     * @returns {string[]}
     */
    bindingsFor(id: string, field: string): string[];
    /**
     * Whether an event is one of a command's press bindings, for code that handles the press
     * itself, like a drag that should start on a rebindable mouse button.
     * @param {string} id
     * @param {Event} event
     * @returns {boolean}
     */
    matches(id: string, event: Event): boolean;
    /**
     * Make every element with `data-command="<id>"` under `root` run that command when clicked and
     * be disabled while it isn't available. Returns a function that stops.
     * @param {Element} root
     * @returns {() => void}
     */
    bindButtons(root: Element): () => void;
    /**
     * @param {Element} root
     * @param {Record<string, unknown>} ctx
     */
    _paintButtons(root: Element, ctx: Record<string, unknown>): void;
    /** Stop listening, and detach from the store. */
    destroy(): void;
}
