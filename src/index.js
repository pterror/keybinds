/**
 * keybinds - Declarative contextual keybindings
 *
 * Everything, from one place. Each part is also its own module (keybinds/core, keybinds/keys,
 * keybinds/palette, ...) for pages that load them without a bundler.
 */

import { keybinds } from './core.js'
import { CommandPalette } from './components/palette.js'
import { KeybindCheatsheet } from './components/cheatsheet.js'
import { KeybindSettings } from './components/settings.js'
import { BasicContextMenu } from './components/basic-context-menu.js'
import { ContextMenu } from './components/context-menu.js'
import { RadialMenu } from './components/radial-menu.js'

export {
  keybinds, validateCommands, executeCommand, findConflict, bindingParts, isActive,
} from './core.js'
export { keys, parseKey } from './keys.js'
export { keysUI, formatKeyParts, eventToBindingString } from './keys-ui.js'
export { mouse, mouseMatches } from './mouse.js'
export { mouseUI, formatMouseParts, eventToMouseBindingString } from './mouse-ui.js'
export { gamepad } from './gamepad.js'
export { gamepadUI, formatGamepadParts } from './gamepad-ui.js'
export { axes } from './axes.js'
export { axesUI, formatAxisParts } from './axes-ui.js'
export {
  matchCommands, searchCommands, defaultScorer, groupByCategory, filterByMenu, simpleMatcher, fuzzyMatcher,
} from './search.js'
export {
  defineSchema, mergeBindings, fromBindings, listBindings, localStorageBindings, BindingsStore,
} from './store.js'
export { onModifierHold, onModifierTaps } from './modifiers.js'
export { createComponent } from './components/create.js'
export { CommandHub } from './hub.js'
export { CommandPalette, KeybindCheatsheet, KeybindSettings, BasicContextMenu, ContextMenu, RadialMenu }

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
export function registerComponents() {
  for (const cls of [CommandPalette, KeybindCheatsheet, BasicContextMenu, ContextMenu, KeybindSettings, RadialMenu]) {
    const name = `keybinds-${cls.kind}`
    if (!customElements.get(name)) customElements.define(name, cls)
  }
}

export default keybinds
