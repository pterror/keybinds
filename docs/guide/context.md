# Context

Context is application state that determines which commands are active. It's evaluated on every key/mouse event.

## Providing Context

Pass a getter function as the second argument to `keybinds()`:

```js
keybinds(commands, () => ({
  hasSelection: selectedItems.length > 0,
  isEditing: editMode === true,
  canUndo: history.length > 0,
}))
```

The function is called on every event, so it always reflects current state.

## Using Context in Commands

The `when` function receives context and returns a boolean:

```js
{
  id: 'delete',
  keys: ['Backspace'],
  when: ctx => ctx.hasSelection && !ctx.isEditing,
  execute: () => deleteSelected()
}
```

Commands without `when` are always active.

## Context in Execute

The `execute` function also receives context:

```js
{
  id: 'copy',
  keys: ['$mod+c'],
  when: ctx => ctx.hasSelection,
  execute: (ctx) => {
    copyToClipboard(ctx.selectedItems)
  }
}
```

## Patterns

### Modal interfaces

```js
const getContext = () => ({
  mode: currentMode,  // 'normal', 'insert', 'visual'
})

const commands = [
  { id: 'enterInsert', keys: ['i'], when: ctx => ctx.mode === 'normal', ... },
  { id: 'exitInsert', keys: ['Escape'], when: ctx => ctx.mode === 'insert', ... },
]
```

### Focus-aware

```js
const getContext = () => ({
  focusedPanel: document.activeElement?.closest('[data-panel]')?.dataset.panel,
})

const commands = [
  { id: 'closePanel', keys: ['Escape'], when: ctx => ctx.focusedPanel != null, ... },
]
```

### Feature flags

```js
const getContext = () => ({
  canEdit: user.permissions.includes('edit'),
  experimentalFeatures: settings.experimental,
})
```

## Components and Context

Pass context to components to gray out inactive commands:

```js
const palette = document.querySelector('command-palette')
palette.commands = commands
palette.context = getContext()  // Commands with failing `when` appear disabled
```

Update context when state changes:

```js
function updatePaletteContext() {
  palette.context = getContext()
}
```
