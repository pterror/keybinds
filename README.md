# keybinds

Declarative, contextual keybindings for the web. Zero dependencies.

## Install

Not yet published on npm. Install from source:

```bash
git clone https://github.com/pterror/keybinds.git
cd keybinds
npm link
# Then in your project:
npm link keybinds
```

## Usage

```js
import { keybinds, registerComponents } from 'keybinds'
import 'keybinds/styles/palette.css'

const commands = [
  {
    id: 'save',
    label: 'Save document',
    category: 'File',
    keys: ['$mod+s'],
    execute: () => save()
  }
]

keybinds(commands)

// Optional: command palette and cheatsheet
registerComponents()
document.querySelector('command-palette').commands = commands
```

`$mod` maps to `Cmd` on Mac, `Ctrl` elsewhere.

## Features

- **Schema-driven** — define bindings as data, separate triggers from handlers
- **Context-aware** — commands activate based on application state
- **User-rebindable** — `BindingsStore` persists overrides to localStorage
- **Discoverable** — built-in `<command-palette>` and `<keybind-cheatsheet>` web components
- **Framework-agnostic** — pure JS core, works anywhere

## Docs

[pterror.github.io/keybinds](https://pterror.github.io/keybinds/)

## License

MIT
