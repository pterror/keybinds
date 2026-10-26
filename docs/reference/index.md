# API Reference

## keybinds(commands, getContext?, options?)

Main entry point. Listens through the inputs it's given.

```ts
function keybinds(
  commands: Command[],
  getContext?: () => Record<string, unknown>,
  options?: {
    inputs?: Input[],
    releases?: Releases,          // releases()
    anyModifiers?: AnyModifiers,  // anyModifiers()
    target?: EventTarget,
    onExecute?: (cmd, ctx) => void,
    capture?: boolean,
    axes?: AxisDef[],
  }
): (() => void) & { held(id: string): boolean, axis(id: string): { position: number, delta: number } }
```

| Option | Default | Description |
|--------|---------|-------------|
| `inputs` | `[]` | What to listen to, e.g. `[keys(), mouse()]`. A command with bindings no input reads (gamepad bindings without `gamepad()`, say) is an error |
| `releases` | - | `releases()`: bindings to an input coming up (`k:up`). Without it, such a binding is an error |
| `anyModifiers` | - | `anyModifiers()`: commands with `anyModifiers: true` match whatever other modifiers are held. Without it, such a command is an error |
| `target` | `window` | Where to listen |
| `onExecute` | - | Called after a command consumes an event |
| `capture` | `false` | Listen in the capture phase, so a bound key reaches its command before anything under `target` (an editor, say) handles it. A key with no active command, or whose command returns `false`, goes on as usual. |
| `axes` | `[]` | Continuous inputs, read with `axis(id)`; needs `axes()` among the inputs |

**Returns:** Cleanup function to remove listeners. It also has `held(id)`: whether a command is held right now (its press fired, and that key or button hasn't come up), for controls read every frame rather than per event, and `axis(id)`.

```js
import { keybinds, keys } from 'keybinds'

const kb = keybinds(commands, () => ({ editing: false }), { inputs: [keys()] })
if (kb.held('forward')) walk()
// Later:
kb()
```

---

## Inputs

Each kind of input is its own module, so an app only ships the ones it uses. Each also has a UI half, which shows and records its bindings for the settings panel, cheatsheet, palette and menus; an app without those components doesn't ship it.

| Input | With its UI half | Bindings |
|-------|------------------|----------|
| `keys()` from `keybinds/keys` | `keysUI()` from `keybinds/keys-ui` | `keys: ['$mod+k', 'Escape', '?', 'k:up']` |
| `mouse({ wheel? })` from `keybinds/mouse` | `mouseUI()` from `keybinds/mouse-ui` | `mouse: ['$mod+Click', 'MiddleClick', 'Back:up', 'ScrollUp']` |
| `gamepad()` from `keybinds/gamepad` | `gamepadUI()` from `keybinds/gamepad-ui` | `gamepad: ['a', 'rt', 'start:up']` |
| `axes()` from `keybinds/axes` | `axesUI()` from `keybinds/axes-ui` | an axis's `axes: ['mouse:x', '-pad:ry', 'keys:a/d']` |

A UI half is the input plus more, so it goes in the same `inputs` list: `[keysUI(), mouseUI()]`.

`mouse({ wheel: { step, idle } })`: a scroll binding runs once per `step` pixels scrolled (default 50, about one mouse-wheel notch), and `idle` ms without scrolling (default 200) ends a gesture.

An input is a plain object, so a new kind of input (a MIDI controller, say) is written the same way:

```ts
interface Input {
  field: string                 // the command field holding its bindings
  axis?: boolean                // its bindings are an axis's sources
  parse(binding: string): { lookup: string, loose: string, mods: Modifiers }  // throws if invalid
  matches?(cmd: Command, event: Event): boolean
  listen(d: Dispatch): (() => void) & { axis?(id: string): AxisValue }
}

interface InputUI extends Input {
  label: string                 // what one binding is called, for "+ Key"
  format(binding: string): string[]
  release?(binding: string): boolean  // whether a binding can be its ":up" form
  invert?: boolean              // bindings can be inverted with a leading "-"
  available?(): boolean         // whether it can be recorded right now
  watch?(onChange: () => void): () => void
  record?(options: { release: boolean, ignore(e: Event): boolean }, done: (binding: string) => void): () => void
  prompt?(release: boolean): string
}
```

`listen` gets a `Dispatch` with the target, the context, this input's held presses, `candidates(lookups, loose, mods)` to find the commands bound to an event, and `fire`/`release` to run them. See `src/keys.js` for a complete one.

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

## validateCommands(commands, options)

Validate all command bindings upfront, with the same options as `keybinds()`: its inputs, and `releases`/`anyModifiers` if used.

```ts
function validateCommands(commands: Command[], options: { inputs: Input[], releases?, anyModifiers? }): true
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
  input: Input,
  excludeId?: string
): { commandId: string, label: string } | null
```

```js
const conflict = findConflict(schema, '$mod+s', keys(), 'save')
if (conflict) {
  console.log(`Conflicts with ${conflict.label}`)
}
```

---

## CommandHub

`new CommandHub({ inputs?, releases?, anyModifiers?, components?, host?, storageKey?, storage?, listen?, adapt? })`. `inputs` are what it listens to and what its components show and record (with components, their UI halves); `releases` and `anyModifiers` are as for `keybinds()`, and with `releases` the settings panel offers release bindings; `components` are the classes to make inside `host` (any of `CommandPalette`, `KeybindCheatsheet`, `KeybindSettings`, `ContextMenu`). `storage` is `(scope) => BindingsStorage`, for keeping rebindings somewhere other than localStorage. See [Commands From Many Places](../guide/commands.md#commands-from-many-places-commandhub).

| Method | Description |
|--------|-------------|
| `setSource(owner, get \| null)` | Set or remove the commands owned by `owner` |
| `addContext(get)` | Add to the context `when` sees; returns a remover |
| `setScope(scope)` | Keep rebindings separately per scope |
| `refresh()` | Re-read sources, rebuild bindings, update components (fires `refresh`) |
| `syncContext()` | Push the current context to components and buttons |
| `run(id, event?)` | Run a command if it's available; returns whether it ran |
| `get(id)`, `all()` | The definitions as given |
| `bindingsFor(id, field)` | Current bindings through one input (`'keys'`, `'mouse'`, `'gamepad'`, `'axes'`) as shown to people |
| `held(id)` | Whether a command is held down right now |
| `setAxes(owner, get)` | Add axes, rebindable like commands |
| `axis(id)` | An axis's value |
| `matches(id, event)` | Whether an event is one of the command's press bindings (a mouse press, say) |
| `bindButtons(root)` | Make `[data-command]` elements under `root` run and gray out; returns a stopper |
| `openPalette()`, `openMenu(tag, x, y)` | Open the components |
| `destroy()` | Stop listening |

Properties: `palette`, `cheatsheet`, `settings`, `menu` (when made with `host`), `store`.

---

## createComponent(cls)

Creates a component from its class (`CommandPalette`, `KeybindCheatsheet`, `KeybindSettings`, `BasicContextMenu`, `ContextMenu`, `RadialMenu`) under a tag name this copy of the library owns.

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
