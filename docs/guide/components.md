# Components

keybinds provides two web components for discoverability:

- **`<command-palette>`** - Search-driven command execution (like VS Code's Ctrl+Shift+P)
- **`<keybind-cheatsheet>`** - Glanceable reference (like ChatGPT's hold-Ctrl overlay)

## Setup

```js
import { registerComponents } from 'keybinds'

registerComponents()  // Defines both custom elements
```

Then use in HTML:

```html
<command-palette></command-palette>
<keybind-cheatsheet></keybind-cheatsheet>
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
