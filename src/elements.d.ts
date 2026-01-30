import { CommandPalette, KeybindCheatsheet, KeybindSettings, ContextMenu } from './index.js'

declare global {
  interface HTMLElementTagNameMap {
    'command-palette': CommandPalette
    'keybind-cheatsheet': KeybindCheatsheet
    'keybind-settings': KeybindSettings
    'context-menu': ContextMenu
  }
}
