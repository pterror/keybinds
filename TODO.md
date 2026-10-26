# TODO

- [ ] Publish to npm as `@pterror/keybinds`
- [x] Support keybindless actions — stop filtering out unbound commands in search/palette/cheatsheet
- [x] Context menu support — add `menu` tag to commands, `<keybinds-basic-context-menu>` web component filtered by tag, positioning, dismissal, keyboard nav. Motivating use case: graph editor (delete/edit node, create node, etc.). High value precisely because this is hard to get right — absorb the complexity so users don't have to.
- [x] `<keybinds-settings>` component — rebindable keybindings panel with recording, conflict detection/resolution, per-command and global reset, store integration. Includes `eventToBindingString`, `eventToMouseBindingString`, and `findConflict` utilities.
- [x] Scroll (wheel) shortcuts. Scroll bindings now run once per step of scrolling (a notch, or 50px of trackpad deltas), hold the page still between steps, end a gesture after 200 ms idle, and both numbers are options.
- [x] Shifted punctuation bindings can never fire. Now any single character can be bound as itself and matches however it's typed (`?` fires on Shift+/), `shift+<symbol>` / `shift+<digit>` are normalized to the physical key (`shift+slash`, `shift+digit1`), and recording a shifted symbol stores the character.
- [x] `styles/palette.css` didn't cover `<keybind-settings>` and hard-coded dark colors. It now styles every component, selected by their `data-keybinds` kind, with all colors and fonts from `--keybinds-*` custom properties whose defaults follow the page's color scheme.
- [x] `formatKeyParts` showed code-name keys raw (`shift+slash` as "SLASH"). Physical key names now show as the character they type.
- [x] `<keybind-cheatsheet auto-trigger>` always held Control for 200 ms. It now holds `$mod` by default (Meta on Mac), and `trigger-key` / `trigger-delay` attributes choose the modifier and delay.
- [x] `dist/index.d.ts` was behind `src/index.js` and `build:types` failed on type errors; the four "failing" tests only failed because `node_modules/happy-dom` was a symlink into another repo's newer happy-dom, whose elements reject Bun's native events. The test setup now installs happy-dom's own DOM and event classes, so the suite passes on either version.
- [ ] `<keybinds-settings>` shows a "Release" switch on every binding, which makes the panel busy for something few people use (seen in cyoa). Consider showing it only for bindings that are releases, or behind a per-binding menu.
