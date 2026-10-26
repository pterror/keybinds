/**
 * Commands with `anyModifiers: true`: their bindings match whatever other modifiers are held, as a
 * game's movement keys should. A binding's own modifiers are still required, and a command bound
 * exactly to what was pressed comes first.
 */
export type Command = import('./core.js').Command;
export type Modifiers = import('./core.js').Modifiers;
/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').Modifiers} Modifiers */
/**
 * For keybinds({ anyModifiers: anyModifiers() })
 * @returns {import('./core.js').AnyModifiers}
 */
export declare function anyModifiers(): import('./core.js').AnyModifiers;
