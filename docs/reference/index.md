# API Reference

## keybinds(commands, getContext?, options?)

Main entry point. Registers keyboard and mouse listeners.

```ts
function keybinds(
  commands: Command[],
  getContext?: () => Record<string, unknown>,
  options?: { target?: EventTarget, onExecute?: (cmd, ctx) => void }
): () => void
```

**Returns:** Cleanup function to remove listeners.

```js
const cleanup = keybinds(commands, () => ({ editing: false }))
// Later:
cleanup()
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
  options?: Record<string, { when?: (ctx) => boolean, captureInput?: boolean }>
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

Reactive store with localStorage persistence.

```ts
class BindingsStore<T extends Schema> extends EventTarget {
  constructor(schema: T, storageKey: string)
  get(): T
  getOverrides(): BindingOverrides
  save(overrides: BindingOverrides): void
}
```

Dispatches `'change'` event when bindings are saved.

```js
const store = new BindingsStore(schema, 'app:keybinds')
store.addEventListener('change', (e) => {
  console.log(e.detail.bindings)
})
store.save({ save: { keys: ['$mod+Shift+s'] } })
```

---

## Types

```ts
interface Command {
  id: string
  label: string
  category?: string
  keys?: string[]
  mouse?: string[]
  when?: (ctx: Record<string, unknown>) => boolean
  execute: (ctx: Record<string, unknown>, event?: Event) => unknown
  hidden?: boolean
  captureInput?: boolean
}

interface ScoredCommand extends Command {
  active: boolean
  score: number
}

interface BindingSchema {
  label: string
  category?: string
  keys?: string[]
  mouse?: string[]
  hidden?: boolean
}

type Schema = Record<string, BindingSchema>
type BindingOverrides = Record<string, { keys?: string[], mouse?: string[] }>
```
