/**
 * CommandHub: every command on the page, from every source, with one store of people's rebindings.
 */

import { keybinds, isActive, validateCommands, formatBinding } from './core.js'
import { BindingsStore, localStorageBindings } from './store.js'
import { createComponent } from './components/create.js'

/** @typedef {import('./core.js').Command} Command */
/** @typedef {import('./core.js').AxisDef} AxisDef */
/** @typedef {import('./core.js').AxisValue} AxisValue */
/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').Schema} Schema */
/** @typedef {import('./core.js').KeybindsOptions} KeybindsOptions */
/** @typedef {import('./store.js').BindingsStorage} BindingsStorage */
/** @typedef {import('./components/palette.js').CommandPalette} CommandPalette */
/** @typedef {import('./components/cheatsheet.js').KeybindCheatsheet} KeybindCheatsheet */
/** @typedef {import('./components/settings.js').KeybindSettings} KeybindSettings */
/** @typedef {import('./components/context-menu.js').ContextMenu} ContextMenu */

/**
 * @typedef {Object} CommandHubOptions
 * @property {Input[]} [inputs] - What to listen to: e.g. [keys(), mouse()]. With components, their UI
 *   halves, which can also be shown and recorded: [keysUI(), mouseUI()]
 * @property {(CustomElementConstructor & { kind: string })[]} [components] - Components to make
 *   inside `host`: any of CommandPalette, KeybindCheatsheet, KeybindSettings, ContextMenu
 * @property {HTMLElement} [host] - Where the components go
 * @property {string} [storageKey] - localStorage key for people's rebindings (default "keybinds"); the scope is appended
 * @property {(scope: string) => BindingsStorage} [storage] - Keep rebindings somewhere other than
 *   localStorage, separately per scope. Takes the place of `storageKey`
 * @property {import('./core.js').Phase} [releases] - From releases(), for release bindings ("k:up")
 * @property {import('./core.js').Phase} [holds] - From holds(), for "k:hold" and "k:tap"
 * @property {import('./core.js').Sequences} [sequences] - From sequences(), for bindings of several steps ("g i")
 * @property {import('./core.js').AnyModifiers} [anyModifiers] - From anyModifiers(), for commands with `anyModifiers`
 * @property {Omit<KeybindsOptions, 'inputs' | 'axes' | 'releases' | 'holds' | 'sequences' | 'anyModifiers'>} [listen] - Passed on to keybinds(): target, capture, onExecute
 */

/**
 * Every command on the page, from every source, with one store of people's rebindings.
 *
 * Sources are functions, re-read on refresh(), so commands can come and go with the page's
 * state. The hub derives the bindings schema from the commands themselves, lays each person's
 * overrides over it, listens through its inputs, and keeps its components and any command
 * buttons in step.
 *
 * @example
 * const hub = new CommandHub({
 *   inputs: [keys(), mouse()],
 *   components: [CommandPalette, KeybindSettings],
 *   host: document.body,
 *   storageKey: 'myapp:keys',
 * })
 * hub.setSource('editor', () => editorCommands)
 * hub.addContext(() => ({ editing: !!editor.focused }))
 * hub.refresh()
 * hub.bindButtons(toolbar) // <button data-command="save">Save</button>
 *
 * @template {{ id: string, label: string, category?: string | undefined, description?: string | undefined, keys?: string[] | undefined, mouse?: string[] | undefined, gamepad?: string[] | undefined, hidden?: boolean | undefined }} [D=Command]
 * @template {object} [C=Record<string, unknown>] - The context `when` conditions see
 */
export class CommandHub extends EventTarget {
  // Declared as fields so they appear in the generated type declarations
  /** @type {CommandPalette | null} */
  palette = null
  /** @type {KeybindCheatsheet | null} */
  cheatsheet = null
  /** @type {KeybindSettings | null} */
  settings = null
  /** @type {ContextMenu | null} */
  menu = null

  /**
   * @param {CommandHubOptions & { adapt?: (def: D) => Command }} [options] - `adapt` turns the
   *   sources' definitions into commands, when they aren't commands already
   */
  constructor(options = {}) {
    super()
    /** @type {Input[]} */
    this.inputs = options.inputs ?? []
    const key = options.storageKey ?? 'keybinds'
    /** @type {(scope: string) => BindingsStorage} */
    this._storage = options.storage ?? ((scope) => localStorageBindings(`${key}:${scope}`))
    /** What keybinds() is given besides the commands and axes */
    /** @type {KeybindsOptions} */
    this._options = { ...options.listen, inputs: this.inputs }
    for (const k of /** @type {const} */ (['releases', 'holds', 'sequences', 'anyModifiers'])) {
      if (options[k]) Object.assign(this._options, { [k]: options[k] })
    }
    /** @type {(def: D) => Command} */
    this._adapt = options.adapt ?? ((def) => /** @type {Command} */ (/** @type {unknown} */ (def)))
    /** @type {{ owner: string, get: () => D[] }[]} */
    this._sources = []
    /** @type {{ owner: string, get: () => AxisDef[] }[]} */
    this._axisSources = []
    /** @type {Map<string, AxisDef>} */
    this._axes = new Map()
    /** @type {(() => Partial<C>)[]} */
    this._contexts = []
    /** @type {Map<string, D>} */
    this._defs = new Map()
    /** @type {Map<string, Command>} */
    this._live = new Map()
    /** @type {BindingsStore<Schema> | null} */
    this._store = null
    this._storeListener = () => this.refresh()
    /** @type {ReturnType<typeof keybinds> | null} */
    this._unbind = null
    this._scope = 'global'
    /** @type {Set<Element>} */
    this._buttonRoots = new Set()

    const components = options.components ?? []
    if (components.length > 0 && !options.host) throw new Error('CommandHub: components need a host to go in')
    // Components show and record bindings, which is each input's UI half
    const bare = components.length > 0 && this.inputs.find((i) => !('format' in i))
    if (bare) throw new Error(`CommandHub: components need inputs that can be shown; use ${bare.field}UI() from keybinds/${bare.field}-ui`)
    if (!options.host) return
    for (const cls of components) {
      const el = /** @type {HTMLElement & { inputs?: Input[] }} */ (createComponent(cls))
      el.inputs = this.inputs
      options.host.append(el)
      if (cls.kind === 'command-palette') this.palette = /** @type {CommandPalette} */ (/** @type {unknown} */ (el))
      else if (cls.kind === 'cheatsheet') this.cheatsheet = /** @type {KeybindCheatsheet} */ (/** @type {unknown} */ (el))
      else if (cls.kind === 'settings') this.settings = /** @type {KeybindSettings} */ (/** @type {unknown} */ (el))
      else if (cls.kind === 'context-menu') this.menu = /** @type {ContextMenu} */ (/** @type {unknown} */ (el))
      else throw new Error(`CommandHub: no place for a ${cls.kind} component`)
    }
    // However the cheatsheet opens (a command, holding a key), it shows what applies right now.
    this.cheatsheet?.addEventListener('open', () => this.syncContext())
    // Closing the palette, settings or a menu gives focus back to where it was (the text being
    // edited, say), before the chosen command runs; the command can still move it elsewhere.
    /** @type {HTMLElement | null} */
    this._lastFocus = null
    /** @param {FocusEvent} e */
    this._onFocusIn = (e) => {
      const el = /** @type {HTMLElement} */ (e.target)
      // Focus inside a component (even in its shadow DOM) isn't somewhere to come back to
      for (let n = /** @type {Element | undefined} */ (el); n; n = /** @type {ShadowRoot} */ (n.getRootNode()).host) {
        if (n.closest?.('[data-keybinds]')) return
      }
      this._lastFocus = el
    }
    document.addEventListener('focusin', this._onFocusIn, true)
    for (const overlay of [this.palette, this.settings, this.menu]) {
      overlay?.addEventListener('close', () => {
        const now = document.activeElement
        const lost = !now || now === document.body || now === overlay || overlay.contains(now) || now.getRootNode() === overlay.shadowRoot
        if (lost && this._lastFocus?.isConnected) this._lastFocus.focus({ preventScroll: true })
      })
    }
  }

  /**
   * Replace the commands owned by `owner` (null removes them). Takes effect on refresh().
   * Earlier sources win when two define the same id.
   * @param {string} owner
   * @param {(() => D[]) | null} get
   */
  setSource(owner, get) {
    this._sources = this._sources.filter((s) => s.owner !== owner)
    if (get) this._sources.push({ owner, get })
  }

  /**
   * Replace the axes owned by `owner` (null removes them). Takes effect on refresh(). Axes are
   * rebindable in the settings panel like commands, and read with axis(id).
   * @param {string} owner
   * @param {(() => AxisDef[]) | null} get
   */
  setAxes(owner, get) {
    this._axisSources = this._axisSources.filter((s) => s.owner !== owner)
    if (get) this._axisSources.push({ owner, get })
  }

  /**
   * Add to the context that `when` conditions see. Returns a function that removes it again.
   * @param {() => Partial<C>} get
   * @returns {() => void}
   */
  addContext(get) {
    this._contexts.push(get)
    return () => { this._contexts = this._contexts.filter((g) => g !== get) }
  }

  /** @returns {C} */
  context() {
    return Object.assign({}, ...this._contexts.map((g) => g()))
  }

  /**
   * Keep rebindings separately per scope (a document type, a game), so a key can mean different
   * things in each. Takes effect on refresh().
   * @param {string} scope
   */
  setScope(scope) {
    this._scope = scope
  }

  /** The store of people's rebindings, as the settings panel edits it. */
  get store() {
    return this._store
  }

  /**
   * Whether a command is held right now: its press fired and that key or button hasn't come up.
   * @param {string} id
   */
  held(id) {
    return this._unbind?.held(id) ?? false
  }

  /**
   * An axis's value right now; reading it takes the mouse movement since its last read.
   * @param {string} id
   * @returns {AxisValue}
   */
  axis(id) {
    return this._unbind?.axis(id) ?? { position: 0, delta: 0 }
  }

  /** @returns {D[]} */
  all() {
    return [...this._defs.values()]
  }

  /**
   * @param {string} id
   * @returns {D | undefined}
   */
  get(id) {
    return this._defs.get(id)
  }

  /**
   * Run a command if it's available now. Returns whether it ran.
   * @param {string} id
   * @param {Event} [event]
   * @returns {boolean}
   */
  run(id, event) {
    const cmd = this._live.get(id)
    if (!cmd) return false
    const ctx = /** @type {Record<string, unknown>} */ (this.context())
    if (!isActive(cmd, ctx)) return false
    cmd.execute(ctx, event)
    return true
  }

  /** Re-read the sources, rebuild bindings and listeners, and update every component. */
  refresh() {
    this._defs.clear()
    for (const src of this._sources) {
      /** @type {D[]} */
      let list = []
      try {
        list = src.get()
      } catch (e) {
        console.error(`keybinds: command source "${src.owner}" threw`, e)
      }
      for (const d of list) if (!this._defs.has(d.id)) this._defs.set(d.id, d)
    }

    const fields = this.inputs.filter((i) => !i.axis).map((i) => i.field)
    /** @type {Schema} */
    const schema = {}
    for (const d of this._defs.values()) {
      const def = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (d))
      schema[d.id] = { label: d.label, category: d.category, description: d.description, hidden: d.hidden, keys: d.keys ?? [] }
      for (const f of fields) if (def[f] !== undefined) /** @type {Record<string, unknown>} */ (schema[d.id])[f] = def[f]
    }
    this._axes.clear()
    for (const src of this._axisSources) {
      /** @type {AxisDef[]} */
      let list = []
      try {
        list = src.get()
      } catch (e) {
        console.error(`keybinds: axis source "${src.owner}" threw`, e)
      }
      for (const a of list) {
        if (this._axes.has(a.id) || this._defs.has(a.id)) continue
        this._axes.set(a.id, a)
        schema[a.id] = { label: a.label, category: a.category, description: a.description, axes: a.axes, hidden: a.hidden }
      }
    }
    this._store?.removeEventListener('change', this._storeListener)
    this._store?.dispose()
    this._store = new BindingsStore(schema, this._storage(this._scope))
    this._store.addEventListener('change', this._storeListener)
    const bound = /** @type {Record<string, Record<string, string[] | undefined>>} */ (/** @type {unknown} */ (this._store.get()))

    this._live.clear()
    for (const d of this._defs.values()) {
      /** @type {Record<string, unknown>} */
      const cmd = { ...this._adapt(d) }
      for (const f of fields) cmd[f] = bound[d.id]?.[f]
      try {
        validateCommands([/** @type {Command} */ (cmd)], this._options)
      } catch (e) {
        // One unreadable binding mustn't take every other key down with it
        console.error(`keybinds: dropping the bindings of "${d.id}"`, e)
        for (const f of fields) cmd[f] = []
      }
      this._live.set(d.id, /** @type {Command} */ (cmd))
    }

    this._unbind?.()
    const live = [...this._live.values()]
    /** @type {AxisDef[]} */
    const axes = []
    const axisInput = this.inputs.find((i) => i.axis)
    for (const a of this._axes.values()) {
      const def = { ...a, axes: bound[a.id]?.['axes'] ?? a.axes }
      try {
        if (axisInput) def.axes.forEach((b) => axisInput.parse(b, ''))
      } catch (e) {
        console.error(`keybinds: dropping the sources of axis "${a.id}"`, e)
        def.axes = []
      }
      axes.push(def)
    }
    const hasBindings = (/** @type {Command} */ c) => fields.some((f) => /** @type {unknown[] | undefined} */ (/** @type {Record<string, unknown>} */ (c)[f])?.length)
    this._unbind = keybinds(live.filter(hasBindings), () => /** @type {Record<string, unknown>} */ (this.context()), { ...this._options, axes })
    const visible = live.filter((c) => !c.hidden)
    if (this.palette) this.palette.commands = visible
    if (this.cheatsheet) this.cheatsheet.commands = visible
    if (this.menu) this.menu.commands = live
    if (this.settings) {
      this.settings.releases = !!this._options.releases
      this.settings.holds = !!this._options.holds
      this.settings.sequences = !!this._options.sequences
      this.settings.store = this._store
    }
    this.syncContext()
    this.dispatchEvent(new Event('refresh'))
  }

  /** Push the current context into the components and command buttons, so unavailable commands gray out. */
  syncContext() {
    const ctx = /** @type {Record<string, unknown>} */ (this.context())
    // The palette and menus take focus when they open, which changes the context (nothing is being
    // edited any more); while open, they keep acting on where they were opened from.
    if (this.palette && !this.palette.open) this.palette.context = ctx
    if (this.cheatsheet) this.cheatsheet.context = ctx
    if (this.menu && !this.menu.open) this.menu.context = ctx
    for (const root of this._buttonRoots) this._paintButtons(root, ctx)
  }

  openPalette() {
    if (!this.palette) return
    this.refresh()
    this.palette.open = true
  }

  /**
   * Open the context menu with the commands tagged `tag`, at a point on screen.
   * @param {string} tag
   * @param {number} x
   * @param {number} y
   */
  openMenu(tag, x, y) {
    if (!this.menu) return
    this.syncContext()
    this.menu.menu = tag
    this.menu.position = { x, y }
    this.menu.open = true
  }

  /**
   * A command's or axis's bindings through one input right now, as shown to people (e.g.
   * "Ctrl+Z" for keys, "Mouse ↔" for axes).
   * @param {string} id
   * @param {string} field - The input's field: "keys", "mouse", "gamepad", "axes"
   * @returns {string[]}
   */
  bindingsFor(id, field) {
    const input = this.inputs.find((i) => i.field === field)
    if (!input) return []
    // A command's are what it's listening with (an unreadable binding was dropped); an axis's are in the store
    const source = input.axis ? this._store?.get()[id] : this._live.get(id)
    const list = /** @type {string[] | undefined} */ (/** @type {Record<string, unknown> | undefined} */ (source)?.[field])
    const ui = 'format' in input ? /** @type {import('./core.js').InputUI} */ (input) : null
    return (list ?? []).map((b) => ui ? formatBinding(ui, b).join(input.axis ? ' ' : '+').replaceAll('+then+', ' then ') : b)
  }

  /**
   * Whether an event is one of a command's press bindings, for code that handles the press
   * itself, like a drag that should start on a rebindable mouse button.
   * @param {string} id
   * @param {Event} event
   * @returns {boolean}
   */
  matches(id, event) {
    const cmd = this._live.get(id)
    if (!cmd) return false
    return this.inputs.some((i) => i.matches?.(cmd, event))
  }

  /**
   * Make every element with `data-command="<id>"` under `root` run that command when clicked and
   * be disabled while it isn't available. Returns a function that stops.
   * @param {Element} root
   * @returns {() => void}
   */
  bindButtons(root) {
    /** @param {Event} e */
    const onClick = (e) => {
      const el = /** @type {HTMLElement | null} */ (/** @type {Element} */ (e.target).closest?.('[data-command]'))
      if (!el || !root.contains(el)) return
      const id = el.dataset['command']
      if (id && this.run(id, e)) e.preventDefault()
    }
    root.addEventListener('click', onClick)
    this._buttonRoots.add(root)
    this._paintButtons(root, /** @type {Record<string, unknown>} */ (this.context()))
    return () => {
      root.removeEventListener('click', onClick)
      this._buttonRoots.delete(root)
    }
  }

  /**
   * @param {Element} root
   * @param {Record<string, unknown>} ctx
   */
  _paintButtons(root, ctx) {
    for (const el of Array.from(/** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-command]')))) {
      const cmd = this._live.get(el.dataset['command'] ?? '')
      const off = !cmd || !isActive(cmd, ctx)
      if ('disabled' in el) /** @type {HTMLButtonElement} */ (el).disabled = off
      else el.toggleAttribute('aria-disabled', off)
    }
  }

  /** Stop listening, and detach from the store. */
  destroy() {
    this._unbind?.()
    this._unbind = null
    this._store?.removeEventListener('change', this._storeListener)
    this._store?.dispose()
    this._buttonRoots.clear()
    if (this._onFocusIn) document.removeEventListener('focusin', this._onFocusIn, true)
  }
}
