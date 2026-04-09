import { CommandPalette, KeybindCheatsheet, KeybindSettings, BasicContextMenu, ContextMenu } from './index.js'

declare global {
  interface HTMLElementTagNameMap {
    'command-palette': CommandPalette
    'keybind-cheatsheet': KeybindCheatsheet
    'keybind-settings': KeybindSettings
    'keybinds-basic-context-menu': BasicContextMenu
    /** @deprecated Use keybinds-basic-context-menu instead */
    'context-menu': BasicContextMenu
    'keybinds-context-menu': ContextMenu
  }
}
