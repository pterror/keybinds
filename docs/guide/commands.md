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
  when?: (ctx) => bool // Activation condition
  execute: (ctx) => any // Action to perform
  hidden?: bool        // Hide from search
  captureInput?: bool  // Fire even in input fields
  menu?: string | string[]  // Context menu tag(s)
}
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

**Characters:** any single character can be bound as itself. A symbol binds however it's typed, so `?` fires on Shift+/ on a US layout and on whatever key types `?` elsewhere. Write the `+` key as `plus`.

```js
keys: ['?']             // the ? character, Shift included
keys: ['$mod+plus']     // Ctrl/Cmd and +
```

**Physical keys:** `shift+/` means Shift and the slash key (the same as `shift+slash`); `shift+1` means Shift and the 1 key (`shift+digit1`). The names are `slash`, `comma`, `period`, `semicolon`, `quote`, `backquote`, `minus`, `equal`, `bracketleft`, `bracketright`, `backslash` and `digit0`–`digit9`, and they're shown as the character they type.

## Mouse Bindings

```js
mouse: ['$mod+Click']   // Cmd/Ctrl + left click
mouse: ['MiddleClick']  // Middle mouse button
mouse: ['RightClick']   // Right click (context menu)
mouse: ['Back']         // Side button toward the user (BackClick also works)
mouse: ['Forward']      // Side button away from the user (ForwardClick also works)
```

While a command's press on Back or Forward fires, the browser's history navigation for that press is cancelled (mousedown, mouseup and auxclick).

## Press and Release Bindings

A trailing `:up` binds the moment the key or button comes up instead of going down:

```js
keys: ['Space', 'Space:up']
mouse: ['MiddleClick', 'MiddleClick:up']
```

- A release is matched against the modifiers held at press time, so `ctrl+k:up` fires when `k` comes up after a `ctrl+k` press, even if ctrl was let go first.
- A release only fires for a press this binding set saw, whether or not anything handled that press.
- A release-only command checks its own `when` at release time. If a command's own press fired, its release fires regardless of `when`, so a hold can't be left open.
- `execute` receives the `keyup` / `mouseup` event; check `event.type` to tell press from release.
- Scroll bindings have no release.

## Scroll/Wheel Bindings

Scroll triggers use the `mouse` array with scroll direction names:

```js
mouse: ['$mod+scrollup']    // Cmd/Ctrl + scroll up (e.g. zoom in)
mouse: ['$mod+scrolldown']  // Cmd/Ctrl + scroll down (e.g. zoom out)
mouse: ['scrollleft']       // Horizontal scroll left
mouse: ['scrollright']      // Horizontal scroll right
```

**Directions:** `scrollup`, `scrolldown`, `scrollleft`, `scrollright`

A scroll binding runs once per step of scrolling: a mouse-wheel notch is one step, and a trackpad's stream of small deltas adds up to one every 50 pixels. While a bound gesture is going, the page doesn't scroll or zoom in between steps; a pause of 200 ms ends it. Both numbers are options (`wheel: { step, idle }`). If the command returns `false`, the rest of that gesture goes to the page.

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

## Commands From Many Places: CommandHub

When commands come from several parts of an app, and come and go with its state, `CommandHub` does all of the above in one place: it collects commands from every source, derives the schema from them, keeps each person's rebindings, listens for keys, and keeps the components and any command buttons up to date.

```js
import { CommandHub } from 'keybinds'
import 'keybinds/styles/palette.css'

const hub = new CommandHub({
  storageKey: 'myapp:keys',   // rebindings are kept under "myapp:keys:<scope>"
  host: document.body,        // makes a palette, cheatsheet, settings panel and context menu here
  listen: { capture: true },  // keybinds() options; capture lets a command take a key before an editor does
})

hub.setSource('editor', () => editor.commands())
hub.setSource('file', () => fileCommands)
hub.addContext(() => ({ editing: editor.hasFocus() }))
hub.refresh()               // call again whenever the sources' commands change

hub.palette.open = true     // or hub.openPalette()
hub.settings.open = true    // rebinding: changes take effect immediately
hub.keysFor('save')         // ["Ctrl+S"], after any rebinding
hub.syncContext()           // when state changes, so unavailable commands grey out
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

A custom element name stays bound to the first class defined for it. `createComponent(kind)` (which the hub uses) gives each copy of keybinds on a page its own names, so two bundles, or a script reloaded after a deploy, don't clash:

```js
const palette = createComponent('command-palette')
```
