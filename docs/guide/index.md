# Getting Started

keybinds is a declarative, contextual keybinding system for web applications.

## Installation

```bash
npm install keybinds
```

## Minimal Setup

```html
<command-palette auto-trigger></command-palette>
<keybind-cheatsheet auto-trigger></keybind-cheatsheet>

<script type="module">
  import { keybinds, registerComponents } from 'keybinds'
  import 'keybinds/styles/palette.css'

  const commands = [
    {
      id: 'save',
      label: 'Save document',
      category: 'File',
      keys: ['$mod+s'],
      execute: () => console.log('save')
    },
    {
      id: 'open',
      label: 'Open file',
      category: 'File',
      keys: ['$mod+o'],
      execute: () => console.log('open')
    }
  ]

  // Register keybinds
  keybinds(commands)

  // Register and connect UI components
  registerComponents()
  document.querySelector('command-palette').commands = commands
  document.querySelector('keybind-cheatsheet').commands = commands
</script>
```

That's it. You get:
- `$mod+S` / `$mod+O` keybinds working
- `$mod+K` opens command palette with search
- Hold `Control` for 400ms shows cheatsheet

## Going Further

Add context for conditional commands:

```js
keybinds(commands, () => ({
  hasSelection: selection.length > 0
}))
```

```js
{
  id: 'delete',
  label: 'Delete selected',
  keys: ['Backspace'],
  when: ctx => ctx.hasSelection,  // Only active when something is selected
  execute: () => deleteSelected()
}
```

## Key Concepts

- **[Commands](/guide/commands)** - Actions with bindings, labels, and conditions
- **[Context](/guide/context)** - Application state that controls command activation
- **[Components](/guide/components)** - Web components for discoverability
- **[Styling](/guide/styling)** - Customizing component appearance
