# Components Reference

## registerComponents()

Register all web components. Call once at startup.

```ts
function registerComponents(): void
```

```js
import { registerComponents } from 'keybinds'
registerComponents()
```

---

## CommandPalette

Custom element: `<command-palette>`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Commands to display and execute |
| `context` | `object` | Context for `when` evaluation |
| `open` | `boolean` | Visibility state |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | boolean | When present, palette is visible |
| `auto-trigger` | boolean | Enable `$mod+K` keyboard trigger |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `execute` | `{ command: Command }` | Command was executed |
| `close` | - | Palette was dismissed |

### CSS Parts

| Part | Element |
|------|---------|
| `palette` | Root `.palette` div |
| `backdrop` | Overlay div |
| `dialog` | Main dialog container |
| `input` | Search input |
| `list` | Results ul |
| `item` | Result li |
| `item-active` | Selected result |
| `item-disabled` | Inactive result |
| `item-label` | Label span |
| `item-category` | Category span |
| `item-key` | Shortcut kbd |
| `empty` | No results message |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Execute selected |
| `Escape` | Close palette |

---

## KeybindCheatsheet

Custom element: `<keybind-cheatsheet>`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Commands to display |
| `context` | `object` | Context for `when` evaluation |
| `open` | `boolean` | Visibility state |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | boolean | When present, cheatsheet is visible |
| `auto-trigger` | boolean | Enable hold-Control trigger (200ms) |

### Events

| Event | Description |
|-------|-------------|
| `close` | Cheatsheet was dismissed |

### CSS Parts

| Part | Element |
|------|---------|
| `cheatsheet` | Root div |
| `backdrop` | Overlay div |
| `dialog` | Main dialog container |
| `group` | Category group div |
| `group-title` | Category heading |
| `list` | Commands ul |
| `item` | Command li |
| `item-disabled` | Inactive command |
| `item-label` | Label span |
| `item-keys` | Keys container span |
| `item-key` | Individual kbd |

---

## onModifierHold(modifiers, callback, options?)

Utility for hold-to-show behavior.

```ts
function onModifierHold(
  modifiers: string | string[],
  callback: (held: boolean) => void,
  options?: { delay?: number, target?: EventTarget }
): () => void
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modifiers` | `string \| string[]` | - | Modifier key(s): `'Control'`, `'Alt'`, `'Shift'`, `'Meta'` |
| `callback` | `(held: boolean) => void` | - | Called with `true` when held, `false` on release |
| `options.delay` | `number` | `200` | Hold duration in ms |
| `options.target` | `EventTarget` | `window` | Element to listen on |

**Returns:** Cleanup function.

```js
const cleanup = onModifierHold('Control', (held) => {
  cheatsheet.open = held
})

// Multiple modifiers (either triggers)
onModifierHold(['Control', 'Meta'], callback)

// Custom delay
onModifierHold('Alt', callback, { delay: 300 })
```
