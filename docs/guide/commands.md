# Commands

Commands are the core unit of keybinds. Each command is an object describing what triggers it and what it does.

## Command Shape

```ts
interface Command {
  id: string           // Unique identifier
  label: string        // Display name (for palette/cheatsheet)
  category?: string    // Group for organization
  keys?: string[]      // Keyboard triggers
  mouse?: string[]     // Mouse triggers
  when?: (ctx) => bool // Activation condition
  execute: (ctx) => any // Action to perform
  hidden?: bool        // Hide from search
  captureInput?: bool  // Fire even in input fields
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

## Mouse Bindings

```js
mouse: ['$mod+Click']   // Cmd/Ctrl + left click
mouse: ['MiddleClick']  // Middle mouse button
mouse: ['RightClick']   // Right click (context menu)
```

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
