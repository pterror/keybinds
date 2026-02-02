# Getting Started

keybinds is a declarative, contextual keybinding system for web applications.

## Installation

Not yet published on npm. Install from source:

```bash
git clone https://github.com/pterror/keybinds.git
cd keybinds
npm link
# Then in your project:
npm link keybinds
```

## Minimal Setup

```html
<command-palette auto-trigger></command-palette>
<keybind-cheatsheet auto-trigger></keybind-cheatsheet>
<context-menu auto-trigger target="#editor" menu="editor"></context-menu>

<script type="module">
  import { keybinds, registerComponents } from 'keybinds'
  import 'keybinds/styles/palette.css'

  const commands = [
    {
      id: 'save',
      label: 'Save document',
      category: 'File',
      keys: ['$mod+s'],
      menu: 'editor',
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
  const allComponents = document.querySelectorAll('command-palette, keybind-cheatsheet, context-menu')
  allComponents.forEach(el => el.commands = commands)
</script>
```

That's it. You get:
- `$mod+S` / `$mod+O` keybinds working
- `$mod+K` opens command palette with search
- Hold `Control` for 200ms shows cheatsheet
- Right-click shows context menu (for commands with `menu` tag)

Four web components are available via `registerComponents()`:
- `<command-palette>` — search-driven command execution
- `<keybind-cheatsheet>` — hold-to-show keybinding reference
- `<context-menu>` — right-click menus driven by commands
- `<keybind-settings>` — rebindable keyboard shortcuts panel

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
