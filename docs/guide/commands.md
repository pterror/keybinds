# Commands

Commands are the core unit of keybinds. Each command is an object describing what triggers it and what it does.

## Command Shape

```ts
interface Command {
  id: string           // Unique identifier
  label: string        // Display name (for palette/cheatsheet)
  description?: string // Extended description (shown in palette)
  category?: string    // Group for organization
  keys?: string[]      // Keyboard triggers
  mouse?: string[]     // Mouse triggers
  gamepad?: string[]   // Gamepad button triggers
  when?: (ctx) => bool // Activation condition
  execute: (ctx) => any // Action to perform
  hidden?: bool        // Hide from search
  captureInput?: bool  // Fire even in input fields
  anyModifiers?: bool  // Match whatever other modifiers are held
  menu?: string | string[]  // Context menu tag(s)
}
```

Each kind of binding is read by an input, passed to `keybinds()`: `keys()` reads `keys`, `mouse()` reads `mouse`, `gamepad()` reads `gamepad`, and `axes()` reads axes. An app that only uses the keyboard passes only `keys()` and ships nothing else. A command with bindings no input reads is an error, rather than bindings that silently do nothing.

```js
import { keybinds, keys, mouse } from 'keybinds'

keybinds(commands, getContext, { inputs: [keys(), mouse()] })
```

Binding syntax beyond modifiers and key names is opt-in the same way, each piece its own module. Without it, that syntax is an error naming what to add.

| Syntax | Needs |
|--------|-------|
| `?`, `!`, `/`: typed characters | `keys(symbols())` |
| `up`, `down`, `left`, `right`, `plus` | `keys(aliases())` |
| `k:up`: releases | `keybinds(..., { releases: releases() })` |
| `anyModifiers: true` on a command | `keybinds(..., { anyModifiers: anyModifiers() })` |
| `g i`, `ctrl+k ctrl+s`, `k k`: steps in a row | `keybinds(..., { sequences: sequences() })` |
| `k:hold`, `k:tap`: holding and tapping | `keybinds(..., { holds: holds() })` |

```js
import { keybinds, keys, symbols, aliases, releases, holds, sequences, anyModifiers } from 'keybinds'

keybinds(commands, getContext, {
  inputs: [keys(symbols(), aliases())],
  releases: releases(),
  anyModifiers: anyModifiers(),
  holds: holds(),
  sequences: sequences(),
})
```

## Key Bindings

Key strings support modifiers and the `$mod` macro:

```js
keys: ['$mod+s']        // Cmd+S on Mac, Ctrl+S on Windows
keys: ['Ctrl+Shift+K']  // Explicit modifiers
keys: ['Escape']        // Single key
keys: ['Backspace', 'Delete']  // Multiple triggers
```

**Modifiers:** `Ctrl`, `Alt`, `Shift`, `Meta`, `$mod`

**Special keys:** `Escape`, `Enter`, `Tab`, `Space`, `Backspace`, `Delete`, `ArrowUp`, `ArrowDown`, etc.

**Letters and digits** bind as themselves, in any script (`é` too).

**Physical keys:** `shift+1` means Shift and the 1 key (`shift+digit1`). Punctuation keys go by name: `slash`, `comma`, `period`, `semicolon`, `quote`, `backquote`, `minus`, `equal`, `bracketleft`, `bracketright`, `backslash`, and `digit0`–`digit9`. They're shown as the character they type.

**Characters,** with `keys(symbols())`: any other single character can be bound as itself, and binds however it's typed, so `?` fires on Shift+/ on a US layout and on whatever key types `?` elsewhere. `shift+/` then means Shift and the slash key. With `aliases()` too, write the `+` key as `plus`.

```js
keys: ['?']             // the ? character, Shift included (symbols())
keys: ['$mod+plus']     // Ctrl/Cmd and + (symbols() and aliases())
keys: ['shift+slash']   // the same key as '?' on a US layout, with no extra syntax
```

## Mouse Bindings

```js
mouse: ['$mod+Click']   // Cmd/Ctrl + left click
mouse: ['MiddleClick']  // Middle mouse button
mouse: ['RightClick']   // Right click (context menu)
mouse: ['Back']         // Side button toward the user (BackClick also works)
mouse: ['Forward']      // Side button away from the user (ForwardClick also works)
```

While a command's press on Back or Forward fires, the browser's history navigation for that press is canceled (mousedown, mouseup and auxclick).

## Gamepad Bindings

```js
gamepad: ['a']          // the bottom face button (A on Xbox, cross on PlayStation)
gamepad: ['rt', 'rt:up'] // right trigger, pressed and released
```

**Buttons:** `a`, `b`, `x`, `y` (face buttons by position; `south`, `east`, `west`, `north` also work), `lb`, `rb`, `lt`, `rt`, `back`, `start`, `ls`, `rs` (stick clicks), `up`, `down`, `left`, `right` (d-pad), `home`. These are the browser's standard gamepad layout. Gamepad bindings take no modifiers.

Gamepads have no events, so their buttons are read every animation frame, only while some command has a gamepad binding and a pad is connected. Any connected pad triggers them. A button already down when a pad is first seen isn't a press, and a pad that disconnects lets go of whatever it held. `execute` gets a `gamepadbuttondown` or `gamepadbuttonup` event whose `detail` is `{ gamepad, button }`. Browsers only show a page its gamepads after a button is pressed on one.

## Press and Release Bindings

With `releases: releases()`, a trailing `:up` binds the moment the key or button comes up instead of going down:

```js
keys: ['Space', 'Space:up']
mouse: ['MiddleClick', 'MiddleClick:up']
```

- A release is matched against the modifiers held at press time, so `ctrl+k:up` fires when `k` comes up after a `ctrl+k` press, even if ctrl was let go first.
- A release only fires for a press this binding set saw, whether or not anything handled that press.
- A release-only command checks its own `when` at release time. If a command's own press fired, its release fires regardless of `when`, so a hold can't be left open.
- `execute` receives the `keyup` / `mouseup` event; check `event.type` to tell press from release.
- Scroll bindings have no release.
- A release that never arrives is stood in for. A key let go after the window lost focus sends its keyup elsewhere, so held keys are released when focus goes. A mouse button can be let go out of sight too, but every mouse event says which buttons are down, so a held button that no longer is gets its release on the next mouse event (not at blur, since it may well still be held).

## Held Controls

A game reads its movement every frame instead of reacting to each key event. `keybinds()` returns its cleanup function with a `held(id)` on it, true from the moment a command's press fires until that key or button comes up (or the window loses focus, for keys). It needs no release bindings:

```js
const kb = keybinds([{ id: 'forward', label: 'Move forward', keys: ['w'], anyModifiers: true, execute: () => {} }], undefined, { inputs: [keys()], anyModifiers: anyModifiers() })
function frame() {
  if (kb.held('forward')) player.walk()
  requestAnimationFrame(frame)
}
```

## Axes

Looking around or steering isn't a command run per key press; it's a value read every frame. An axis is that value, from any of these sources:

| Source | |
|--------|---|
| `mouse:x`, `mouse:y` | Mouse movement |
| `pad:lx`, `pad:ly`, `pad:rx`, `pad:ry` | Sticks (small drift around the middle is ignored) |
| `pad:lt`, `pad:rt` | Triggers, 0 to 1 |
| `keys:a/d` | Two keys: the first toward -1, the second toward 1 |

A leading `-` inverts a source (`-mouse:y`). Pass axes as an option, with `axes()` among the inputs, and read them with `axis(id)`:

```js
const kb = keybinds(commands, getContext, { inputs: [keys(), mouse(), gamepad(), axes()], axes: [
  { id: 'look-x', label: 'Look left/right', axes: ['mouse:x', 'pad:rx'] },
  { id: 'strafe', label: 'Strafe', axes: ['keys:a/d', 'pad:lx'] },
] })

function frame(dt) {
  const look = kb.axis('look-x')
  yaw += look.delta * mouseSensitivity + look.position * turnSpeed * dt
}
```

`axis(id)` returns `{ position, delta }`. `position` is where sticks, triggers and keys are, -1 to 1. `delta` is mouse movement in pixels since that axis was last read. They're separate because they're different kinds of number: a position is scaled by a speed and the frame's time, a delta by a sensitivity. An axis whose `when` is false, or read while the palette or settings are open, reads zero.

With `CommandHub`, `hub.setAxes(owner, () => axes)` adds them; they're rebindable in the settings panel (where each source has an Invert switch) and read with `hub.axis(id)`.

## Ignoring Other Modifiers

By default a binding needs exactly its modifiers: `w` doesn't fire while Shift is held. A game moving on WASD wants the opposite, so with `anyModifiers: anyModifiers()` passed to `keybinds()`, a command with `anyModifiers: true` matches whatever else is held. A binding's own modifiers are still required (`shift+x` still needs Shift), and a command bound exactly to the keys pressed comes first.

```js
{ id: 'forward', label: 'Move forward', keys: ['w', 'w:up'], anyModifiers: true, execute: (ctx, e) => held(e.type === 'keydown') }
```

## Sequences

With `sequences: sequences()`, a binding of several steps, separated by spaces, runs on its last step:

```js
keys: ['g i']             // g, then i: go to the inbox
keys: ['ctrl+k ctrl+s']   // a chord, as in VS Code
keys: ['j j']             // a double tap
```

- Each step has to come within `timeout` ms of the last (`sequences({ timeout })`, default 1000).
- A step that starts a sequence belongs to it: it doesn't reach the page, and binding it on its own as well is an error, since there'd be no telling which was meant.
- A sequence only starts while one of its commands is active, and not while typing in a field (unless the command has `captureInput`).
- Pressing Shift between steps doesn't break a sequence, so `g shift+g` works.
- A press that doesn't go on from the steps so far is a press of its own.

## Holding and Tapping

With `holds: holds()`, a key or button can do one thing when held and another when tapped:

```js
keys: ['space:hold']      // runs once space has been held for 500 ms
keys: ['space:tap']       // runs when space comes up sooner than that
```

`holds({ delay })` sets how long a hold takes. A command that ran on a hold is `held(id)` until the key comes up. Scrolling has no hold or tap.

## Keyboard Layouts

Physical keys (`slash`, `digit1`, `bracketleft`) are shown as the character they type on a US layout. Where the browser can tell the person's own layout (Chromium, through `navigator.keyboard`), show them as that types them instead:

```js
import { keysUI, layout, loadLayout } from 'keybinds'

const input = keysUI(layout(await loadLayout()))  // shift+slash shows as "Shift -" on a German layout
```

Letters and typed characters are bound by what they type, so they show as written.

## Scroll/Wheel Bindings

Scroll triggers use the `mouse` array with scroll direction names:

```js
mouse: ['$mod+scrollup']    // Cmd/Ctrl + scroll up (e.g. zoom in)
mouse: ['$mod+scrolldown']  // Cmd/Ctrl + scroll down (e.g. zoom out)
mouse: ['scrollleft']       // Horizontal scroll left
mouse: ['scrollright']      // Horizontal scroll right
```

**Directions:** `scrollup`, `scrolldown`, `scrollleft`, `scrollright`

A scroll binding runs once per step of scrolling: a mouse-wheel notch is one step, and a trackpad's stream of small deltas adds up to one every 50 pixels. While a bound gesture is going, the page doesn't scroll or zoom in between steps; a pause of 200 ms ends it. Both numbers are options of the mouse input (`mouse({ wheel: { step, idle } })`). If the command returns `false`, the rest of that gesture goes to the page.

## Context Menu Tags

The `menu` property tags commands for use with `<keybinds-basic-context-menu>`:

```js
{
  id: 'copy',
  label: 'Copy',
  keys: ['$mod+c'],
  menu: 'editor',               // Show in the 'editor' context menu
  execute: () => copy(),
}

{
  id: 'rename',
  label: 'Rename',
  menu: ['sidebar', 'editor'],  // Show in multiple context menus
  execute: () => rename(),
}
```

See [Components > Context Menu](./components.md#context-menu) for rendering these with `<keybinds-basic-context-menu>`.

## Execution

Commands execute when:
1. The trigger matches (key or mouse)
2. The `when` condition returns true (or is absent)
3. Focus is not in an input field (unless `captureInput: true`)

```js
{
  id: 'selectAll',
  keys: ['$mod+a'],
  when: ctx => !ctx.isEditing,  // Only when not editing
  execute: () => selectAll()
}
```

Return `false` from `execute` to let the event propagate:

```js
execute: (ctx, event) => {
  if (someCondition) {
    return false  // Don't prevent default
  }
  doSomething()
}
```

## Schema + Handlers Pattern

For larger apps, separate binding definitions from handlers:

```js
import { defineSchema, fromBindings, BindingsStore } from 'keybinds'

// Define bindings (can be serialized, edited by users)
const schema = defineSchema({
  save: { label: 'Save', category: 'File', keys: ['$mod+s'] },
  undo: { label: 'Undo', category: 'Edit', keys: ['$mod+z'] },
})

// Handlers implement the actions
const handlers = {
  save: () => saveDocument(),
  undo: () => undoAction(),
}

// Combine into commands
const commands = fromBindings(schema, handlers)
```

## User-customizable Bindings

Use `BindingsStore` for localStorage-persisted user overrides:

```js
const store = new BindingsStore(schema, 'myapp:keybinds')

// Get merged bindings (schema + user overrides)
const bindings = store.get()
const commands = fromBindings(bindings, handlers)

// Save user changes
store.save({ save: { keys: ['$mod+Shift+s'] } })

// React to changes
store.addEventListener('change', (e) => {
  // Re-register keybinds with new bindings
})
```

The overrides don't have to live in localStorage. Give the store anything with `load` and `save`, e.g. your app's own state or a server. Add `subscribe` if they can change from elsewhere (an undo, another tab, sync) and the store will follow along:

```js
const store = new BindingsStore(schema, {
  load: () => settings.get('keys') ?? {},
  save: (overrides) => settings.set('keys', overrides),
  subscribe: (onChange) => settings.watch('keys', onChange), // returns an unsubscribe function
})
```

## Commands From Many Places: CommandHub

When commands come from several parts of an app, and come and go with its state, `CommandHub` does all of the above in one place: it collects commands from every source, derives the schema from them, keeps each person's rebindings, listens for keys, and keeps the components and any command buttons up to date.

```js
import { CommandHub, keysUI, mouseUI, releases, CommandPalette, KeybindCheatsheet, KeybindSettings, ContextMenu } from 'keybinds'
import 'keybinds/styles/palette.css'

const hub = new CommandHub({
  inputs: [keysUI(), mouseUI()],  // what it listens to; the UI halves, since its components show and record them
  releases: releases(),       // and anyModifiers: anyModifiers(), as for keybinds()
  components: [CommandPalette, KeybindCheatsheet, KeybindSettings, ContextMenu],
  host: document.body,        // where the components go
  storageKey: 'myapp:keys',   // rebindings are kept under "myapp:keys:<scope>"; or pass
                              // storage: (scope) => ({ load, save }) to keep them elsewhere
  listen: { capture: true },  // keybinds() options; capture lets a command take a key before an editor does
})

hub.setSource('editor', () => editor.commands())
hub.setSource('file', () => fileCommands)
hub.addContext(() => ({ editing: editor.hasFocus() }))
hub.refresh()               // call again whenever the sources' commands change

hub.palette.open = true     // or hub.openPalette()
hub.settings.open = true    // rebinding: changes take effect immediately
hub.bindingsFor('save', 'keys')  // ["Ctrl+S"], after any rebinding
hub.held('forward')         // whether that command is held down right now
hub.syncContext()           // when state changes, so unavailable commands gray out
```

### Command Buttons

Any element with `data-command` becomes a button for that command: clicking runs it, and it's disabled while the command isn't available.

```html
<nav id="toolbar">
  <button data-command="save">Save</button>
  <button data-command="undo">Undo</button>
</nav>
```

```js
hub.bindButtons(document.getElementById('toolbar'))
```

### Definitions That Aren't Commands

If your sources describe commands in their own shape, `adapt` turns each one into a command:

```js
const hub = new CommandHub({ adapt: (def) => ({ ...def, execute: def.run }) })
```

`hub.get(id)` and `hub.all()` return the definitions as the sources gave them.

### Components From Another Copy of the Library

A custom element name stays bound to the first class defined for it. `createComponent(cls)` (which the hub uses) gives each copy of keybinds on a page its own names, so two bundles, or a script reloaded after a deploy, don't clash:

```js
const palette = createComponent(CommandPalette)
```

### Without a Bundler

Each part is its own module, so a page loading keybinds straight from a CDN can import only what it uses, mapping `keybinds/` to the `src/` directory:

```html
<script type="importmap">
{ "imports": { "keybinds/": "https://cdn.jsdelivr.net/gh/pterror/keybinds@<commit>/src/" } }
</script>
<script type="module">
  import { CommandHub } from 'keybinds/hub.js'
  import { keysUI } from 'keybinds/keys-ui.js'
  import { KeybindSettings } from 'keybinds/components/settings.js'
</script>
```
