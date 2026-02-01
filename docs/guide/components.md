# Components

keybinds provides four web components for discoverability and customization:

- **`<command-palette>`** - Search-driven command execution (like VS Code's Ctrl+Shift+P)
- **`<keybind-cheatsheet>`** - Glanceable reference (like ChatGPT's hold-Ctrl overlay)
- **`<keybind-settings>`** - Rebindable keyboard shortcuts panel
- **`<context-menu>`** - Right-click context menus driven by commands

## Setup

```js
import { registerComponents } from 'keybinds'

registerComponents()  // Defines all custom elements
```

Then use in HTML:

```html
<command-palette></command-palette>
<keybind-cheatsheet></keybind-cheatsheet>
<keybind-settings></keybind-settings>
<context-menu></context-menu>
```

## Command Palette

Search and execute commands by name.

```html
<command-palette auto-trigger></command-palette>
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Array of command definitions |
| `context` | `object` | Context for `when` checks |
| `open` | `boolean` | Show/hide the palette |

### Attributes

| Attribute | Description |
|-----------|-------------|
| `open` | When present, palette is visible |
| `auto-trigger` | Enable default `$mod+K` trigger |
| `placeholder` | Input placeholder text (default: "Type a command...") |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `execute` | `{ command }` | Fired when a command is executed |
| `close` | - | Fired when palette is dismissed |

### Usage

```js
const palette = document.querySelector('command-palette')
palette.commands = commands
palette.context = { hasSelection: true }

// Manual trigger
button.onclick = () => palette.open = true

// Listen for execution
palette.addEventListener('execute', (e) => {
  console.log('Executed:', e.detail.command.id)
})
```

## Keybind Cheatsheet

Grouped display of available bindings.

```html
<keybind-cheatsheet auto-trigger></keybind-cheatsheet>
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Array of command definitions |
| `context` | `object` | Context for `when` checks (inactive commands grayed) |
| `open` | `boolean` | Show/hide the cheatsheet |

### Attributes

| Attribute | Description |
|-----------|-------------|
| `open` | When present, cheatsheet is visible |
| `auto-trigger` | Enable hold-Control trigger (200ms delay) |

### Events

| Event | Description |
|-------|-------------|
| `close` | Fired when cheatsheet is dismissed |

### Usage

```js
const cheatsheet = document.querySelector('keybind-cheatsheet')
cheatsheet.commands = commands
cheatsheet.context = getContext()

// Manual trigger
helpButton.onclick = () => cheatsheet.open = true
```

## Keybind Settings

Rebindable keyboard shortcuts panel with conflict detection.

```html
<keybind-settings></keybind-settings>
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `store` | `BindingsStore` | Reactive bindings store instance |
| `open` | `boolean` | Show/hide the settings panel |

### Attributes

| Attribute | Description |
|-----------|-------------|
| `open` | When present, settings panel is visible |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `close` | - | Fired when settings panel is dismissed |
| `change` | `{ commandId, keys?, mouse? }` | Fired when a binding is changed |
| `reset` | `{ commandId? }` | Fired when bindings are reset |

### Usage

```js
import { BindingsStore, defineSchema, registerComponents } from 'keybinds'

const schema = defineSchema({
  save: { label: 'Save', category: 'File', keys: ['$mod+s'] },
  open: { label: 'Open', category: 'File', keys: ['$mod+o'] },
})

const store = new BindingsStore(schema, 'myapp:keybinds')
registerComponents()

const settings = document.querySelector('keybind-settings')
settings.store = store

// Open settings
settingsButton.onclick = () => settings.open = true

// Listen for changes
settings.addEventListener('change', (e) => {
  console.log('Changed:', e.detail.commandId)
})
```

### Behavior

- Groups commands by category
- Click a binding to re-record it
- Click "+ Key" or "+ Mouse" to add a new binding
- Conflicts are detected and shown inline with Replace/Cancel options
- Per-command and global reset buttons
- Escape cancels recording or closes the panel

## Context Menu

Right-click context menus populated from your commands.

```html
<context-menu auto-trigger></context-menu>
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Array of command definitions |
| `context` | `object` | Context for `when` checks |
| `menu` | `string` | Filter commands by `menu` tag |
| `position` | `{ x: number, y: number }` | Menu position in viewport coordinates |
| `open` | `boolean` | Show/hide the menu |

### Attributes

| Attribute | Description |
|-----------|-------------|
| `open` | When present, menu is visible |
| `auto-trigger` | Listen for `contextmenu` events on the parent (or `target`) |
| `menu` | Filter commands to those with a matching `menu` tag |
| `target` | CSS selector for the element to listen on (defaults to parent element) |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `execute` | `{ command }` | Fired when a command is executed |
| `close` | - | Fired when the menu is dismissed |

### Usage

Commands opt into context menus via the `menu` property:

```js
const commands = [
  {
    id: 'cut',
    label: 'Cut',
    category: 'Edit',
    keys: ['$mod+x'],
    menu: 'editor',
    execute: () => cut(),
  },
  {
    id: 'paste',
    label: 'Paste',
    category: 'Edit',
    keys: ['$mod+v'],
    menu: ['editor', 'sidebar'],  // Appears in multiple menus
    execute: () => paste(),
  },
]
```

Basic right-click menu on the parent element:

```html
<div class="editor">
  <context-menu auto-trigger></context-menu>
</div>
```

```js
const menu = document.querySelector('context-menu')
menu.commands = commands
menu.menu = 'editor'  // Only show commands tagged with 'editor'
```

Target a specific element instead of the parent:

```html
<context-menu auto-trigger target="#canvas" menu="canvas"></context-menu>
```

Manual positioning:

```js
const menu = document.querySelector('context-menu')
menu.commands = commands
menu.position = { x: event.clientX, y: event.clientY }
menu.open = true
```

### Behavior

- Items are grouped by category with separators between groups
- Inactive commands (failing `when`) are shown but disabled
- Hidden commands are excluded
- The menu auto-clamps to viewport edges
- Keyboard navigation with Arrow keys (wrap-around), Home/End, Enter to execute, Escape to close
- Clicking the backdrop or right-clicking outside closes the menu

## onModifierHold Utility

For custom hold-to-show behavior:

```js
import { onModifierHold } from 'keybinds'

const cleanup = onModifierHold('Control', (held) => {
  cheatsheet.open = held
}, { delay: 200 })

// Later: cleanup()
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `delay` | `number` | `200` | Milliseconds before triggering |
| `target` | `EventTarget` | `window` | Element to listen on |

### Multiple modifiers

```js
onModifierHold(['Control', 'Meta'], callback)  // Either modifier
```
