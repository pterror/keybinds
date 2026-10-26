/**
 * keybinds - Declarative contextual keybindings
 *
 * Commands as data, context as state, zero dependencies. Every kind of input (keys, mouse,
 * gamepad, axes) is its own module, handed to keybinds() by whoever uses it; the core only
 * knows commands, context and presses.
 */
export type Modifiers = {
    ctrl: boolean;
    alt: boolean;
    shift: boolean;
    meta: boolean;
};
export type Command = {
    id: string;
    label: string;
    description?: string | undefined;
    category?: string | undefined;
    keys?: string[] | undefined;
    mouse?: string[] | undefined;
    gamepad?: string[] | undefined;
    when?: ((ctx: Record<string, unknown>) => boolean) | undefined;
    execute: (ctx: Record<string, unknown>, event?: Event) => unknown;
    hidden?: boolean | undefined;
    captureInput?: boolean | undefined;
    anyModifiers?: boolean | undefined;
    menu?: string | string[] | undefined;
    rank?: number | undefined;
};
export type AxisDef = {
    id: string;
    label: string;
    category?: string | undefined;
    description?: string | undefined;
    axes: string[];
    when?: ((ctx: Record<string, unknown>) => boolean) | undefined;
    hidden?: boolean | undefined;
};
export type AxisValue = {
    position: number;
    delta: number;
};
export type ParsedBinding = {
    lookup: string;
    loose: string;
    mods: Modifiers;
};
export type Press = {
    mods: Modifiers;
    fired: Set<Command>;
    [extra: string]: unknown;
};
export type Dispatch = {
    target: EventTarget;
    capture: boolean;
    bound: boolean;
    axes: AxisDef[];
    context: () => Record<string, unknown>;
    presses: Map<string, Press>;
    candidates: (lookups: string[], loose: string[], mods: Modifiers) => Command[] | undefined;
    fire: (candidates: Command[], event: Event, options?: {
        inInput?: boolean;
        press?: Press;
    }) => Command | null;
    release: (candidates: Command[], press: Press, event: Event, options?: {
        blocked?: boolean;
        inInput?: boolean;
    }) => boolean;
    isActive: (cmd: Command) => boolean;
    execute: (cmd: Command, event: Event) => boolean;
};
export type Input = {
    field: string;
    axis?: boolean;
    parse: (binding: string) => ParsedBinding;
    matches?: (cmd: Command, event: Event) => boolean;
    listen: (d: Dispatch) => InputHandle;
};
export type InputUI = Input & {
    label: string;
    format: (binding: string) => string[];
    release?: (binding: string) => boolean;
    invert?: boolean;
    available?: () => boolean;
    watch?: (onChange: () => void) => () => void;
    record?: (options: {
        release: boolean;
        ignore: (e: Event) => boolean;
    }, done: (binding: string) => void) => () => void;
    prompt?: (release: boolean) => string;
};
export type InputHandle = (() => void) & {
    axis?: (id: string) => AxisValue;
};
export type MatchResult = {
    score: number;
    positions?: number[];
};
export type Matcher = (query: string, text: string) => MatchResult | null;
export type HistoryEntry = {
    id: string;
    timestamp: number;
};
export type Scorer = (command: Command, context: unknown) => number;
export type SearchOptions = {
    matcher?: Matcher | undefined;
    scorer?: Scorer | undefined;
};
export type ScoredCommand = Command & {
    active: boolean;
    score: number;
    positions?: number[];
};
export type BindingSchema = {
    label: string;
    description?: string | undefined;
    category?: string | undefined;
    keys?: string[] | undefined;
    mouse?: string[] | undefined;
    gamepad?: string[] | undefined;
    axes?: string[] | undefined;
    hidden?: boolean | undefined;
    menu?: string | string[] | undefined;
};
export type Schema = Record<string, BindingSchema>;
export type BindingOverrides = Record<string, {
    keys?: string[];
    mouse?: string[];
    gamepad?: string[];
    axes?: string[];
}>;
/**
 * @typedef {Object} Modifiers
 * @property {boolean} ctrl
 * @property {boolean} alt
 * @property {boolean} shift
 * @property {boolean} meta
 */
/**
 * @typedef {Object} Command
 * @property {string} id - Unique identifier
 * @property {string} label - Display name
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Keyboard triggers
 * @property {string[] | undefined} [mouse] - Mouse triggers
 * @property {string[] | undefined} [gamepad] - Gamepad button triggers (e.g. "a", "rt", "start:up")
 * @property {((ctx: Record<string, unknown>) => boolean) | undefined} [when] - Activation condition
 * @property {(ctx: Record<string, unknown>, event?: Event) => unknown} execute - Action
 * @property {boolean | undefined} [hidden] - Hide from search
 * @property {boolean | undefined} [captureInput] - Fire even in input fields
 * @property {boolean | undefined} [anyModifiers] - Bindings match whatever other modifiers are held
 *   (a binding's own modifiers are still required), e.g. a game's movement keys. A binding that
 *   matches exactly still comes first
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
 * @property {number | undefined} [rank] - Where it's listed among matches, before relevance: higher first (default 0)
 */
/**
 * A continuous input read every frame (looking around, steering), instead of a command run per
 * event. Its sources are any of: "mouse:x" / "mouse:y" (movement), "pad:lx" / "pad:ly" /
 * "pad:rx" / "pad:ry" (sticks), "pad:lt" / "pad:rt" (triggers), "keys:a/d" (the first key toward
 * -1, the second toward 1). A leading "-" inverts a source.
 * @typedef {Object} AxisDef
 * @property {string} id
 * @property {string} label
 * @property {string | undefined} [category]
 * @property {string | undefined} [description]
 * @property {string[]} axes - Sources
 * @property {((ctx: Record<string, unknown>) => boolean) | undefined} [when] - Reads as zero otherwise
 * @property {boolean | undefined} [hidden] - Hide from settings
 */
/**
 * An axis's value. `position` is where sticks, triggers and keys are, -1 to 1. `delta` is mouse
 * movement in pixels since this axis was last read. They're kept apart because they're different
 * things: a position is scaled by a speed and the frame's time, a delta by a sensitivity.
 * @typedef {{ position: number, delta: number }} AxisValue
 */
/**
 * A binding, normalized. `lookup` is equal for bindings that trigger the same way; `loose` is
 * the lookup without modifiers, which `anyModifiers` commands are found by, and `mods` the
 * modifiers the binding still requires then.
 * @typedef {{ lookup: string, loose: string, mods: Modifiers }} ParsedBinding
 */
/**
 * A held input. `mods` is the modifier state at press time, which release bindings match
 * against; `fired` holds the commands whose press executed. Inputs keep what else they need on it.
 * @typedef {{ mods: Modifiers, fired: Set<Command>, [extra: string]: unknown }} Press
 */
/**
 * What keybinds() gives each input to work with
 * @typedef {Object} Dispatch
 * @property {EventTarget} target - Where to listen
 * @property {boolean} capture - Whether to listen in the capture phase
 * @property {boolean} bound - Whether any command has a binding for this input
 * @property {AxisDef[]} axes - The axes passed to keybinds()
 * @property {() => Record<string, unknown>} context
 * @property {Map<string, Press>} presses - This input's held presses, by whatever id it chooses
 * @property {(lookups: string[], loose: string[], mods: Modifiers) => Command[] | undefined} candidates -
 *   Commands bound to the first of `lookups` that has any, then `anyModifiers` ones bound to the
 *   first of `loose` whose own modifiers are among `mods`
 * @property {(candidates: Command[], event: Event, options?: { inInput?: boolean, press?: Press }) => Command | null} fire -
 *   Runs the first active candidate that takes the event, noting it on `press`
 * @property {(candidates: Command[], press: Press, event: Event, options?: { blocked?: boolean, inInput?: boolean }) => boolean} release -
 *   Runs a release's candidates: commands whose own press fired always run (a hold can't be left
 *   open), the rest as usual until one takes it. Returns whether any did
 * @property {(cmd: Command) => boolean} isActive
 * @property {(cmd: Command, event: Event) => boolean} execute - Runs a command, true if it took the event
 */
/**
 * A kind of input. Each is a module (keys, mouse, gamepad, axes) whose factory returns one of
 * these, and keybinds() listens with the ones it's given.
 * @typedef {Object} Input
 * @property {string} field - The command (or axis) field holding its bindings: "keys", "mouse", ...
 * @property {boolean} [axis] - Its bindings are an axis's sources rather than a command's triggers
 * @property {(binding: string) => ParsedBinding} parse - Throws if the binding is invalid
 * @property {(cmd: Command, event: Event) => boolean} [matches] - Whether an event is one of the command's press bindings
 * @property {(d: Dispatch) => InputHandle} listen
 */
/**
 * An input that can also be shown and recorded, for the settings panel, cheatsheet, palette and
 * menus. Each input's UI half is its own module (keybinds/keys-ui, ...), so an app without them
 * doesn't ship it.
 * @typedef {Input & {
 *   label: string,
 *   format: (binding: string) => string[],
 *   release?: (binding: string) => boolean,
 *   invert?: boolean,
 *   available?: () => boolean,
 *   watch?: (onChange: () => void) => () => void,
 *   record?: (options: { release: boolean, ignore: (e: Event) => boolean }, done: (binding: string) => void) => () => void,
 *   prompt?: (release: boolean) => string,
 * }} InputUI
 * `label` is what one binding is called ("Key", for "+ Key"); `format` gives display parts;
 * `release` says whether a binding can be its release form (":up"), absent for inputs with no
 * releases; `invert`: bindings can be inverted with a leading "-"; `available` says whether it can
 * be recorded now (a pad is connected) and `watch` follows that changing; `record` records a
 * binding from what's done next and returns a function that stops; `prompt` says what to do.
 */
/**
 * What an input's listen() returns: a function that stops it, which can also read axes
 * @typedef {(() => void) & { axis?: (id: string) => AxisValue }} InputHandle
 */
/**
 * @typedef {{ score: number, positions?: number[] }} MatchResult
 * @typedef {(query: string, text: string) => MatchResult | null} Matcher
 * @typedef {{ id: string, timestamp: number }} HistoryEntry
 * @typedef {(command: Command, context: unknown) => number} Scorer
 * @typedef {{ matcher?: Matcher | undefined, scorer?: Scorer | undefined }} SearchOptions
 * @typedef {Command & { active: boolean, score: number, positions?: number[] }} ScoredCommand
 */
/**
 * @typedef {Object} BindingSchema
 * @property {string} label - Display name
 * @property {string | undefined} [description] - Extended description for palette
 * @property {string | undefined} [category] - Group for command palette
 * @property {string[] | undefined} [keys] - Default keyboard triggers
 * @property {string[] | undefined} [mouse] - Default mouse triggers
 * @property {string[] | undefined} [gamepad] - Default gamepad button triggers
 * @property {string[] | undefined} [axes] - Default sources, for an axis (see {@link AxisDef})
 * @property {boolean | undefined} [hidden] - Hide from search/settings
 * @property {string | string[] | undefined} [menu] - Context menu tag(s)
 */
/**
 * @typedef {Record<string, BindingSchema>} Schema
 */
/**
 * @typedef {Record<string, { keys?: string[], mouse?: string[], gamepad?: string[], axes?: string[] }>} BindingOverrides
 */
/**
 * Marks a component with its kind, so styles work whatever tag name it was registered under, and
 * whether it takes the keyboard while open
 * @param {HTMLElement} el
 * @param {string} kind
 * @param {boolean} [modal]
 */
export declare function markKind(el: HTMLElement, kind: string, modal?: boolean): void;
export declare const isMac: boolean;
/**
 * Parse modifiers from a binding string
 * @param {string[]} parts
 * @returns {{ mods: Modifiers, remaining: string[] }}
 */
export declare function parseMods(parts: string[]): {
    mods: Modifiers;
    remaining: string[];
};
/**
 * How a modifier in a binding is shown, null if the part isn't a modifier
 * @param {string} p - lowercase
 * @returns {string | null}
 */
export declare function formatModPart(p: string): string | null;
/**
 * The modifiers held during an event, as a binding writes them ("$mod" for the platform's)
 * @param {KeyboardEvent | MouseEvent} event
 * @param {boolean} shift - Whether to include Shift
 * @returns {string[]}
 */
export declare function eventModParts(event: KeyboardEvent | MouseEvent, shift?: boolean): string[];
export declare const RELEASE_SUFFIX = ":up";
/**
 * Split a lowercase binding into its press/release flag and the rest.
 * A trailing ":up" marks a release binding.
 * @param {string} lower
 * @returns {{ body: string, release: boolean }}
 */
export declare function splitRelease(lower: string): {
    body: string;
    release: boolean;
};
/**
 * A binding's press form if it's a release, its release form otherwise
 * @param {string} binding
 * @returns {string}
 */
export declare function flipRelease(binding: string): string;
/**
 * Format a binding's parts, adding a trailing "Release" part for ":up" bindings
 * @param {string} binding
 * @param {(part: string) => string} formatPart
 * @returns {string[]}
 */
export declare function formatWithRelease(binding: string, formatPart: (part: string) => string): string[];
/**
 * Normalize modifiers to canonical prefix (e.g., "ctrl+alt+")
 * @param {Modifiers} mods
 * @returns {string}
 */
export declare function modsToPrefix(mods: Modifiers): string;
/** @type {Modifiers} */
export declare const NO_MODS: Modifiers;
/**
 * Modifiers held during an event
 * @param {KeyboardEvent | MouseEvent} event
 * @returns {Modifiers}
 */
export declare function eventMods(event: KeyboardEvent | MouseEvent): Modifiers;
/**
 * Whether every modifier in `required` is among `held`
 * @param {Modifiers} required
 * @param {Modifiers} held
 */
export declare function holdsAll(required: Modifiers, held: Modifiers): boolean;
/**
 * Check if a command is active given current context
 * @param {{ when?: ((ctx: Record<string, unknown>) => boolean) | undefined }} command
 * @param {Record<string, unknown>} context
 * @returns {boolean}
 */
export declare function isActive(command: {
    when?: ((ctx: Record<string, unknown>) => boolean) | undefined;
}, context: Record<string, unknown>): boolean;
/**
 * Whether an element is inside one whose own keyboard handling takes over while it's open
 * @param {Element | null} tgt
 * @returns {boolean}
 */
export declare function overlayOpen(tgt: Element | null): boolean;
/** Whether any such component is open, for inputs whose events have no target (gamepads) */
export declare function anyOverlayOpen(): boolean;
/**
 * Whether an event's target is somewhere text is typed
 * @param {EventTarget | null} tgt
 */
export declare function inInput(tgt: EventTarget | null): boolean;
export type KeybindsOptions = {
    inputs?: Input[];
    target?: EventTarget;
    onExecute?: (cmd: Command, ctx: Record<string, unknown>) => void;
    capture?: boolean;
    axes?: AxisDef[];
};
/**
 * @typedef {Object} KeybindsOptions
 * @property {Input[]} [inputs] - What to listen to: e.g. [keys(), mouse()]. A command bound
 *   through an input that isn't here is an error
 * @property {EventTarget} [target] - Where to listen (default: window)
 * @property {(cmd: Command, ctx: Record<string, unknown>) => void} [onExecute] - Called after a command consumes an event
 * @property {boolean} [capture] - Listen in the capture phase, so a bound key reaches its command before
 *   anything under the target (an editor, say) handles it. A command that isn't active, or returns false,
 *   leaves the event alone.
 * @property {AxisDef[]} [axes] - Continuous inputs, read with `axis(id)` on what keybinds() returns
 */
/**
 * Create keybind handler
 *
 * @param {Command[]} commands - Array of command definitions
 * @param {() => Record<string, unknown>} [getContext] - Returns current context state
 * @param {KeybindsOptions} [options] - Options
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
 * ], () => ({ hasSelection: selectedId() !== null, isEditing: editingId() !== null }),
 *   { inputs: [keys(), mouse()] })
 * @returns {(() => void) & { held: (id: string) => boolean, axis: (id: string) => AxisValue }} Cleanup function, with
 *   `held(id)`: whether a command is held right now, and `axis(id)`: an axis's value
 */
export declare function keybinds(commands: Command[], getContext?: () => Record<string, unknown>, options?: KeybindsOptions): (() => void) & {
    held: (id: string) => boolean;
    axis: (id: string) => AxisValue;
};
/**
 * Validate all commands upfront (call on init to catch typos early)
 * @param {Command[]} commands
 * @param {Input[]} inputs - The inputs whose bindings to check
 * @returns {true}
 * @throws {Error} if any binding is invalid
 */
export declare function validateCommands(commands: Command[], inputs: Input[]): true;
/**
 * Execute a command by id
 * @param {Command[]} commands
 * @param {string} id
 * @param {Record<string, unknown>} [context]
 * @returns {boolean}
 */
export declare function executeCommand(commands: Command[], id: string, context?: Record<string, unknown>): boolean;
/**
 * Check if a binding string conflicts with any command in the schema
 *
 * @param {Schema} schema - The binding schema to check against
 * @param {string} bindingStr - The binding string to check
 * @param {Input} input - The input the binding is for
 * @param {string} [excludeId] - Command ID to exclude from conflict check
 * @returns {{ commandId: string, label: string } | null}
 */
export declare function findConflict(schema: Schema, bindingStr: string, input: Input, excludeId?: string): {
    commandId: string;
    label: string;
} | null;
/**
 * A command's bindings through each input, as display parts, in the order of `inputs`
 * @param {Command} cmd
 * @param {InputUI[]} inputs
 * @returns {string[][]}
 */
export declare function bindingParts(cmd: Command, inputs: InputUI[]): string[][];
