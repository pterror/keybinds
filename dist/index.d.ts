/**
 * keybinds - Declarative contextual keybindings
 *
 * Everything, from one place. Each part is also its own module (keybinds/core, keybinds/keys,
 * keybinds/palette, ...) for pages that load them without a bundler.
 */
import { keybinds } from './core.js';
import { CommandPalette } from './components/palette.js';
import { KeybindCheatsheet } from './components/cheatsheet.js';
import { KeybindSettings } from './components/settings.js';
import { BasicContextMenu } from './components/basic-context-menu.js';
import { ContextMenu } from './components/context-menu.js';
import { RadialMenu } from './components/radial-menu.js';
export { keybinds, validateCommands, executeCommand, findConflict, bindingParts, isActive, parseBinding, splitBinding, bindingLookup, formatBinding, } from './core.js';
export { keys, parseKey } from './keys.js';
export { symbols } from './keys-symbols.js';
export { aliases } from './keys-aliases.js';
export { layout, loadLayout } from './keys-layout.js';
export { releases } from './releases.js';
export { anyModifiers } from './any-modifiers.js';
export { holds } from './holds.js';
export { sequences } from './sequences.js';
export { keysUI, formatKeyParts, eventToBindingString } from './keys-ui.js';
export { mouse, mouseMatches } from './mouse.js';
export { mouseUI, formatMouseParts, eventToMouseBindingString } from './mouse-ui.js';
export { gamepad } from './gamepad.js';
export { gamepadUI, formatGamepadParts } from './gamepad-ui.js';
export { axes } from './axes.js';
export { axesUI, formatAxisParts } from './axes-ui.js';
export { matchCommands, searchCommands, defaultScorer, groupByCategory, filterByMenu, simpleMatcher, fuzzyMatcher, } from './search.js';
export { defineSchema, mergeBindings, fromBindings, listBindings, localStorageBindings, BindingsStore, } from './store.js';
export { onModifierHold, onModifierTaps } from './modifiers.js';
export { createComponent } from './components/create.js';
export { CommandHub } from './hub.js';
export { CommandPalette, KeybindCheatsheet, KeybindSettings, BasicContextMenu, ContextMenu, RadialMenu };
export type Command = import('./core.js').Command;
export type AxisDef = import('./core.js').AxisDef;
export type AxisValue = import('./core.js').AxisValue;
export type Input = import('./core.js').Input;
export type InputUI = import('./core.js').InputUI;
export type Dispatch = import('./core.js').Dispatch;
export type Press = import('./core.js').Press;
export type Modifiers = import('./core.js').Modifiers;
export type KeybindsOptions = import('./core.js').KeybindsOptions;
export type BindingSchema = import('./core.js').BindingSchema;
export type Schema = import('./core.js').Schema;
export type BindingOverrides = import('./core.js').BindingOverrides;
export type Matcher = import('./core.js').Matcher;
export type ScoredCommand = import('./core.js').ScoredCommand;
export type BindingsStorage = import('./store.js').BindingsStorage;
/**
 * @typedef {import('./core.js').Command} Command
 * @typedef {import('./core.js').AxisDef} AxisDef
 * @typedef {import('./core.js').AxisValue} AxisValue
 * @typedef {import('./core.js').Input} Input
 * @typedef {import('./core.js').InputUI} InputUI
 * @typedef {import('./core.js').Dispatch} Dispatch
 * @typedef {import('./core.js').Press} Press
 * @typedef {import('./core.js').Modifiers} Modifiers
 * @typedef {import('./core.js').KeybindsOptions} KeybindsOptions
 * @typedef {import('./core.js').BindingSchema} BindingSchema
 * @typedef {import('./core.js').Schema} Schema
 * @typedef {import('./core.js').BindingOverrides} BindingOverrides
 * @typedef {import('./core.js').Matcher} Matcher
 * @typedef {import('./core.js').ScoredCommand} ScoredCommand
 * @typedef {import('./store.js').BindingsStorage} BindingsStorage
 */
/**
 * Register every component under its plain `keybinds-<kind>` name, for use in HTML
 */
export declare function registerComponents(): void;
export default keybinds;
