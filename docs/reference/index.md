# API Reference

## keybinds(commands, getContext?, options?)

Main entry point. Registers keyboard and mouse listeners.

```ts
function keybinds(
  commands: Command[],
  getContext?: () => Record<string, unknown>,
  options?: {
    target?: EventTarget,
    onExecute?: (cmd, ctx) => void,
    capture?: boolean,
    wheel?: { step?: number, idle?: number },
  }
): (() => void) & { held(id: string): boolean, axis(id: string): { position: number, delta: number } }
```

| Option | Default | Description |
|--------|---------|-------------|
| `target` | `window` | Where to listen |
| `onExecute` | - | Called after a command consumes an event |
| `capture` | `false` | Listen in the capture phase, so a bound key reaches its command before anything under `target` (an editor, say) handles it. A key with no active command, or whose command returns `false`, goes on as usual. |
| `wheel.step` | `50` | Pixels of scrolling per step of a scroll binding (about one mouse-wheel notch) |
| `wheel.idle` | `200` | Milliseconds without scrolling that end a gesture |

**Returns:** Cleanup function to remove listeners. It also has `held(id)`: whether a command is held right now (its press fired, and that key or button hasn't come up), for controls read every frame rather than per event.

```js
const kb = keybinds(commands, () => ({ editing: false }))
if (kb.held('forward')) walk()
// Later:
kb()
```

---

## searchCommands(commands, query, context?)

Search commands for palette display.

```ts
function searchCommands(
  commands: Command[],
  query: string,
  context?: Record<string, unknown>
): ScoredCommand[]
```

Returns commands matching query, sorted by relevance. Each result includes `active` (boolean) and `score` (number).

---

## groupByCategory(commands, context?)

Group commands by category for cheatsheet display.

```ts
function groupByCategory(
  commands: Command[],
  context?: Record<string, unknown>
): Record<string, (Command & { active: boolean })[]>
```

---

## executeCommand(commands, id, context?)

Execute a command by ID.

```ts
function executeCommand(
  commands: Command[],
  id: string,
  context?: Record<string, unknown>
): boolean
```

Returns `true` if command was found and executed.

---

## validateCommands(commands)

Validate all command bindings upfront.

```ts
function validateCommands(commands: Command[]): true
```

Throws if any binding is invalid. Call on init to catch typos early.

---

## formatKey(key)

Format key binding for display.

```ts
function formatKey(key: string): string
```

```js
formatKey('$mod+k')  // "⌘K" on Mac, "CTRLK" on Windows
formatKey('Escape')  // "ESC"
```

---

## defineSchema(schema)

Identity function for type inference when defining binding schemas.

```ts
function defineSchema<T extends Schema>(schema: T): T
```

```js
const schema = defineSchema({
  save: { label: 'Save', keys: ['$mod+s'] },
})
```

---

## mergeBindings(schema, overrides)

Merge schema with user overrides.

```ts
function mergeBindings(
  schema: Schema,
  overrides: BindingOverrides
): Schema
```

---

## fromBindings(bindings, handlers, options?)

Create commands from bindings + handlers.

```ts
function fromBindings(
  bindings: Schema,
  handlers: Record<string, (ctx, event?) => unknown>,
  options?: Record<string, { when?: (ctx) => boolean, captureInput?: boolean, anyModifiers?: boolean }>
): Command[]
```

---

## listBindings(schema)

Get all bindings as flat list for settings UI.

```ts
function listBindings(schema: Schema): Array<BindingSchema & { id: string }>
```

---

## BindingsStore

Reactive store of people's overrides, kept in localStorage or anywhere else.

```ts
class BindingsStore<T extends Schema> extends EventTarget {
  constructor(schema: T, storage: string | BindingsStorage)
  get(): T
  getOverrides(): BindingOverrides
  save(overrides: BindingOverrides): void
  dispose(): void
}

type BindingsStorage = {
  load(): BindingOverrides
  save(overrides: BindingOverrides): void
  subscribe?(onChange: (overrides: BindingOverrides) => void): () => void
}

function localStorageBindings(key: string): BindingsStorage
```

A string is a localStorage key (the same as `localStorageBindings(key)`). Any other storage only needs `load` and `save`. If it can change from elsewhere (another tab, an undo, sync), give it `subscribe` too and the store follows it; `dispose()` stops following.

Dispatches `'change'` event when bindings are saved, or when the storage changes.

```js
const store = new BindingsStore(schema, 'app:keybinds')
store.addEventListener('change', (e) => {
  console.log(e.detail.bindings)
})
store.save({ save: { keys: ['$mod+Shift+s'] } })
```

---

## eventToBindingString(event)

Convert a KeyboardEvent to a canonical binding string.

```ts
function eventToBindingString(event: KeyboardEvent): string | null
```

Returns `null` for bare modifier presses and unknown keys.

```js
// In a keydown handler:
const binding = eventToBindingString(event)  // e.g. "$mod+shift+k"
```

---

## eventToMouseBindingString(event)

Convert a MouseEvent or WheelEvent to a canonical binding string.

```ts
function eventToMouseBindingString(event: MouseEvent): string | null
```

```js
// In a mousedown handler:
const binding = eventToMouseBindingString(event)  // e.g. "$mod+click"

// Also works with WheelEvent:
const scroll = eventToMouseBindingString(wheelEvent)  // e.g. "$mod+scrollup"

// Side buttons are "back" and "forward"; a mouseup / keyup event gives a ":up" binding:
eventToMouseBindingString(mouseupEvent)  // e.g. "middle:up"
```

---

## findConflict(schema, bindingStr, type, excludeId?)

Check if a binding conflicts with any command in a schema.

```ts
function findConflict(
  schema: Schema,
  bindingStr: string,
  type: 'keys' | 'mouse',
  excludeId?: string
): { commandId: string, label: string } | null
```

```js
const conflict = findConflict(schema, '$mod+s', 'keys', 'save')
if (conflict) {
  console.log(`Conflicts with ${conflict.label}`)
}
```

---

## CommandHub

`new CommandHub({ storageKey?, storage?, host?, listen?, adapt? })`. `storage` is `(scope) => BindingsStorage`, for keeping rebindings somewhere other than localStorage. See [Commands From Many Places](../guide/commands.md#commands-from-many-places-commandhub).

| Method | Description |
|--------|-------------|
| `setSource(owner, get \| null)` | Set or remove the commands owned by `owner` |
| `addContext(get)` | Add to the context `when` sees; returns a remover |
| `setScope(scope)` | Keep rebindings separately per scope |
| `refresh()` | Re-read sources, rebuild bindings, update components (fires `refresh`) |
| `syncContext()` | Push the current context to components and buttons |
| `run(id, event?)` | Run a command if it's available; returns whether it ran |
| `get(id)`, `all()` | The definitions as given |
| `keysFor(id)`, `mouseFor(id)`, `gamepadFor(id)` | Current bindings as shown to people |
| `held(id)` | Whether a command is held down right now |
| `setAxes(owner, get)` | Add axes, rebindable like commands |
| `axis(id)`, `axesFor(id)` | An axis's value, and its sources as shown to people |
| `mouseMatches(id, event)` | Whether a mouse press is one of the command's bindings |
| `bindButtons(root)` | Make `[data-command]` elements under `root` run and gray out; returns a stopper |
| `openPalette()`, `openMenu(tag, x, y)` | Open the components |
| `destroy()` | Stop listening |

Properties: `palette`, `cheatsheet`, `settings`, `menu` (when made with `host`), `store`.

---

## createComponent(kind)

Creates a component (`'command-palette'`, `'cheatsheet'`, `'settings'`, `'basic-context-menu'`, `'context-menu'`, `'radial-menu'`) under a tag name this copy of the library owns.

---

## Types

```ts
interface Command {
  id: string
  label: string
  description?: string
  category?: string
  keys?: string[]
  mouse?: string[]
  gamepad?: string[]
  when?: (ctx: Record<string, unknown>) => boolean
  execute: (ctx: Record<string, unknown>, event?: Event) => unknown
  hidden?: boolean
  captureInput?: boolean
  anyModifiers?: boolean  // match whatever other modifiers are held
  menu?: string | string[]
}

interface ScoredCommand extends Command {
  active: boolean
  score: number
}

interface BindingSchema {
  label: string
  description?: string
  category?: string
  keys?: string[]
  mouse?: string[]
  gamepad?: string[]
  axes?: string[]   // an axis's sources, for axes
  hidden?: boolean
}

type Schema = Record<string, BindingSchema>
type BindingOverrides = Record<string, { keys?: string[], mouse?: string[], gamepad?: string[], axes?: string[] }>

interface AxisDef {
  id: string
  label: string
  category?: string
  description?: string
  axes: string[]    // "mouse:x", "pad:rx", "keys:a/d", ... with a leading "-" to invert
  when?: (ctx: Record<string, unknown>) => boolean
  hidden?: boolean
}
```
