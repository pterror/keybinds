# TODO

- [ ] Publish to npm as `@pterror/keybinds`
- [x] Support keybindless actions — stop filtering out unbound commands in search/palette/cheatsheet
- [x] Context menu support — add `menu` tag to commands, `<context-menu>` web component filtered by tag, positioning, dismissal, keyboard nav. Motivating use case: graph editor (delete/edit node, create node, etc.). High value precisely because this is hard to get right — absorb the complexity so users don't have to.
- [x] `<keybind-settings>` component — rebindable keybindings panel with recording, conflict detection/resolution, per-command and global reset, store integration. Includes `eventToBindingString`, `eventToMouseBindingString`, and `findConflict` utilities.
