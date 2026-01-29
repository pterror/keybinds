# Components

keybinds provides three web components for discoverability and customization:

- **`<command-palette>`** - Search-driven command execution (like VS Code's Ctrl+Shift+P)
- **`<keybind-cheatsheet>`** - Glanceable reference (like ChatGPT's hold-Ctrl overlay)
- **`<keybind-settings>`** - Rebindable keyboard shortcuts panel

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
