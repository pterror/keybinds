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

Custom element: `<keybinds-command-palette>`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Commands to display and execute |
| `inputs` | `InputUI[]` | How bindings are shown: an item shows its first (default: keys only) |
| `context` | `object` | Context for `when` evaluation |
| `source` | `(query: string) => Command[] \| Promise<Command[]>` | Further commands for a typed query, merged with `commands` (same `id` keeps the one in `commands`); an answer for a query no longer typed is dropped |
| `sourceDelay` | `number` | Milliseconds of typing pause before `source` is asked (default 200) |
| `open` | `boolean` | Visibility state |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | boolean | When present, palette is visible |
| `auto-trigger` | boolean | Enable `$mod+K` keyboard trigger |
| `placeholder` | string | Input placeholder text (default: "Type a command...") |

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
| `item-description` | Description span |
| `item-category` | Category span |
| `item-key` | Shortcut kbd |
| `empty` | No results message |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results (wraps around) |
| `Home` / `End` | Jump to first / last result |
| `Enter` | Execute selected |
| `Escape` | Close palette |

Keyboard and pointer input are tracked separately — moving the mouse
won't hijack an in-progress keyboard selection until the pointer
deliberately moves again.

---

## KeybindCheatsheet

Custom element: `<keybinds-cheatsheet>`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Commands to display |
| `inputs` | `InputUI[]` | Which bindings are shown (default: keys only) |
| `context` | `object` | Context for `when` evaluation |
| `open` | `boolean` | Visibility state |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | boolean | When present, cheatsheet is visible |
| `auto-trigger` | boolean | Open while a modifier is held on its own |
| `trigger-key` | string | The modifier: `$mod` (default; Meta on Mac, Control elsewhere), `Control`, `Alt`, `Shift` or `Meta` |
| `trigger-delay` | number | How long it's held before opening, in ms (default 200) |

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

## KeybindSettings

Custom element: `<keybinds-settings>`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `store` | `BindingsStore` | Reactive bindings store instance |
| `inputs` | `InputUI[]` | Which bindings are shown and can be recorded (default: keys only) |
| `releases`, `holds`, `sequences` | `boolean` | Offer recording release bindings (`k:up`), holds and taps (`k:hold`, `k:tap`), and steps (`g i`); the hub sets them from its options (default: false) |
| `open` | `boolean` | Visibility state |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | boolean | When present, settings panel is visible |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `close` | - | Settings panel was dismissed |
| `change` | `{ commandId, keys?, mouse? }` | A binding was changed |
| `reset` | `{ commandId? }` | Bindings were reset (per-command or all) |

### CSS Parts

| Part | Element |
|------|---------|
| `settings` | Root `.settings` div |
| `backdrop` | Overlay div |
| `dialog` | Main dialog container |
| `header` | Header container |
| `title` | Title text |
| `reset-all` | Reset All button |
| `group` | Category group div |
| `group-title` | Category heading |
| `list` | Commands ul |
| `item` | Command li |
| `item-label` | Label span |
| `item-bindings` | Bindings container span |
| `item-reset` | Per-command reset button |
| `binding` | Individual binding span |
| `binding-recording` | Binding in recording state |
| `binding-keys` | Key display container |
| `binding-key` | Individual kbd |
| `binding-remove` | Remove (×) button |
| `binding-release` | Press/release switch on a binding (`binding-release-on` while it is a release) |
| `item-add` | Add binding container |
| `add-<input>` | Add button for each of `inputs`: `add-key`, `add-mouse`, `add-gamepad` (shown while a gamepad is connected), `add-axis` |
| `binding-invert` | An axis source's Invert switch (`binding-invert-on` when inverted) |
| `recording-overlay` | Recording prompt text |
| `recording-release` | Release toggle in the recording prompt (`recording-release-on` while on) |
| `recording-hold`, `recording-tap` | Hold and Tap toggles, with `holds` (`-on` while on) |
| `recording-sequence` | Steps toggle, with `sequences`: keys are recorded one after another until Done or a pause of a second |
| `recording-done` | Ends recording steps |
| `conflict` | Conflict warning |
| `conflict-accept` | Replace button |
| `conflict-cancel` | Cancel button |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Cancel recording, or close panel |

---

## ContextMenu

Custom element: `<keybinds-basic-context-menu>`

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `commands` | `Command[]` | Commands to display and execute |
| `inputs` | `InputUI[]` | How bindings are shown: an item shows its first (default: keys only) |
| `context` | `object` | Context for `when` evaluation |
| `menu` | `string` | Filter to commands with matching `menu` tag |
| `position` | `{ x: number, y: number }` | Menu position in viewport coordinates |
| `open` | `boolean` | Visibility state |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `open` | boolean | When present, menu is visible |
| `auto-trigger` | boolean | Listen for `contextmenu` on parent or `target` element |
| `menu` | string | Filter commands by menu tag |
| `target` | string | CSS selector for trigger element (defaults to parent) |

### Events

| Event | Detail | Description |
|-------|--------|-------------|
| `execute` | `{ command: Command }` | Command was executed |
| `close` | - | Menu was dismissed |

### CSS Parts

| Part | Element |
|------|---------|
| `context-menu` | Root div |
| `backdrop` | Overlay div |
| `list` | Menu ul |
| `item` | Menu item li |
| `item-active` | Highlighted item |
| `item-disabled` | Inactive item |
| `separator` | Category separator |
| `item-label` | Label span |
| `item-keys` | Keys container span |
| `item-key` | Individual kbd |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate items (wraps around) |
| `Home` / `End` | Jump to first / last item |
| `Enter` | Execute selected |
| `Escape` | Close menu |

Keyboard and pointer input are tracked separately — moving the mouse
won't hijack an in-progress keyboard selection until the pointer
deliberately moves again.

---

## eventToBindingString(event)

Convert a KeyboardEvent to a canonical binding string.

```ts
function eventToBindingString(event: KeyboardEvent): string | null
```

Returns `null` for bare modifier presses and unknown keys. Uses `$mod` for the platform modifier (Meta on Mac, Ctrl elsewhere).

---

## eventToMouseBindingString(event)

Convert a MouseEvent to a canonical binding string.

```ts
function eventToMouseBindingString(event: MouseEvent): string | null
```

Maps button numbers to canonical names (0=click, 1=middle, 2=right).

---

## findConflict(schema, bindingStr, input, excludeId?)

Check if a binding string conflicts with any command in a schema.

```ts
function findConflict(
  schema: Schema,
  bindingStr: string,
  input: Input,
  excludeId?: string
): { commandId: string, label: string } | null
```

Normalizes through parse → lookup for accurate cross-format comparison.

---

## formatMouseParts(binding)

Format a mouse/scroll binding string into an array of display-ready parts.

```ts
function formatMouseParts(binding: string): string[]
```

```js
formatMouseParts('$mod+click')      // ["⌘", "Click"] on Mac, ["Ctrl", "Click"] elsewhere
formatMouseParts('scrollup')        // ["Scroll ↑"]
formatMouseParts('ctrl+scrolldown') // ["Ctrl", "Scroll ↓"] on Mac, ["Ctrl", "Scroll ↓"] elsewhere
```

---

## formatGamepadParts(binding)

Format a gamepad binding string into display-ready parts.

```ts
function formatGamepadParts(binding: string): string[]
```

```js
formatGamepadParts('rt')     // ["RT"]
formatGamepadParts('south:up') // ["A", "Release"]
formatGamepadParts('up')     // ["D-pad ↑"]
```

---

## formatAxisParts(binding)

```js
formatAxisParts('mouse:x')  // ["Mouse ↔"]
formatAxisParts('-pad:ry')  // ["Right stick ↕", "Inverted"]
formatAxisParts('keys:a/d') // ["A", "/", "D"]
```

---

## filterByMenu(commands, menu, context?)

Filter commands by their `menu` tag for context menu display.

```ts
function filterByMenu(
  commands: Command[],
  menu: string,
  context?: Record<string, unknown>
): (Command & { active: boolean })[]
```

Returns commands whose `menu` property matches (string match or array includes). Each result includes an `active` boolean from `when` evaluation. Hidden commands are excluded.

```js
const items = filterByMenu(commands, 'editor', { hasSelection: true })
```

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
| `callback` | `(held: boolean) => void` | - | Called with `true` when held by itself for `delay`, `false` on release or when another key, a click or scrolling happens |
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

---

## onModifierTaps(modifiers, count, callback, options?)

Calls back when a modifier is tapped (pressed and released by itself) `count` times in a row.

```ts
function onModifierTaps(
  modifiers: string | string[],
  count: number,
  callback: () => void,
  options?: { within?: number, target?: EventTarget }
): () => void
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `modifiers` | `string \| string[]` | - | Modifier key(s): `'Control'`, `'Alt'`, `'Shift'`, `'Meta'` |
| `count` | `number` | - | Taps in a row |
| `callback` | `() => void` | - | Called on the last tap's release |
| `options.within` | `number` | `400` | Most ms from one tap's press to the next tap's release |
| `options.target` | `EventTarget` | `window` | Element to listen on |

**Returns:** Cleanup function.

```js
onModifierTaps('Shift', 2, () => palette.open = true)
```
