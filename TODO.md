# TODO

- [ ] Publish to npm as `@pterror/keybinds`
- [x] Support keybindless actions — stop filtering out unbound commands in search/palette/cheatsheet
- [x] Context menu support — add `menu` tag to commands, `<context-menu>` web component filtered by tag, positioning, dismissal, keyboard nav. Motivating use case: graph editor (delete/edit node, create node, etc.). High value precisely because this is hard to get right — absorb the complexity so users don't have to.
- [x] `<keybind-settings>` component — rebindable keybindings panel with recording, conflict detection/resolution, per-command and global reset, store integration. Includes `eventToBindingString`, `eventToMouseBindingString`, and `findConflict` utilities.
- [ ] Scroll (wheel) shortcuts — e.g. `ctrl+scrollup` to switch tabs. The O(1) dispatch is trivial (add to `VALID_MOUSE`, listen on `wheel`), but wheel events are continuous, not discrete like clicks/keypresses. A single scroll gesture fires dozens of events with variable `deltaY` (trackpad smooth scrolling vs. mouse wheel notches), so commands need debouncing/throttling with tunable thresholds. Worth supporting because without it users lose schema integration, user remapping, cheatsheet display, and conflict detection — the actual value of the library. Needs a design that keeps the simple case simple (e.g. sensible default debounce) without over-configuring.
