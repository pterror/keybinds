import { markKind, bindingParts } from '../core.js'
import { searchCommands } from '../search.js'
import { keys } from '../keys.js'

/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').Matcher} Matcher */
/** @typedef {import('../core.js').ScoredCommand} ScoredCommand */
/** @typedef {import('../core.js').Input} Input */

/**
 * <keybinds-command-palette> - Search-driven command execution
 *
 * Attributes:
 *   open         - Show/hide the palette
 *   auto-trigger - Enable default $mod+K trigger
 *   placeholder  - Input placeholder text (default: "Type a command...")
 *   hide-inactive - List only commands that apply now (otherwise the rest are shown disabled)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   matcher: Matcher        - Custom matcher function
 *   inputs: Input[]         - How bindings are shown (default: keys only)
 *   source: (query) => Command[] | Promise<Command[]>
 *                           - Further commands for a non-empty query, merged with `commands`
 *   sourceDelay: number     - Milliseconds of typing pause before `source` is asked (default 200)
 *   open: boolean           - Show/hide the palette
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when palette is dismissed
 *
 * BEM classes:
 *   .palette
 *   .palette__backdrop
 *   .palette__dialog
 *   .palette__input
 *   .palette__list
 *   .palette__item
 *   .palette__item--active
 *   .palette__item--disabled
 *   .palette__item-label
 *   .palette__item-label-match (highlight)
 *   .palette__item-description
 *   .palette__item-category
 *   .palette__item-keys
 *   .palette__item-key
 *   .palette__empty
 */
export class CommandPalette extends HTMLElement {
  static kind = 'command-palette'

  static get observedAttributes() {
    return ['open', 'auto-trigger', 'placeholder']
  }

  constructor() {
    super()
    /** How bindings are shown: an item shows its first. @type {Input[]} */
    this.inputs = [keys()]
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {Matcher | undefined} */
    this._matcher = undefined
    /** @type {ScoredCommand[]} */
    this._results = []
    /** @type {HTMLLIElement[]} */
    this._items = []
    /** @type {number} */
    this._activeIndex = 0
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'keyboard'
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null
    /** @type {((query: string) => Command[] | Promise<Command[]>) | undefined} */
    this._source = undefined
    /** @type {number} */
    this.sourceDelay = 200
    /** What `source` answered for the query in the input. @type {Command[]} */
    this._sourced = []
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._sourceTimer = undefined

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
      </style>
      <div class="palette" part="palette">
        <div class="palette__backdrop" part="backdrop"></div>
        <div class="palette__dialog" part="dialog" role="dialog" aria-modal="true">
          <input
            class="palette__input"
            part="input"
            type="text"
            placeholder="Type a command..."
            autocomplete="off"
            spellcheck="false"
          />
          <ul class="palette__list" part="list" role="listbox"></ul>
        </div>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.palette__backdrop'))
    /** @type {HTMLInputElement} */
    this._input = /** @type {HTMLInputElement} */ (shadow.querySelector('.palette__input'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.palette__list'))

    this._backdrop.addEventListener('click', () => this._close())
    this._input.addEventListener('input', () => this._search())
    this._input.addEventListener('keydown', (e) => this._handleKey(e))
    this._list.addEventListener('mousemove', () => { this._inputMode = 'pointer' })
    this._list.addEventListener('click', (e) => {
      const li = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.palette__item'))
      if (li) this._execute(Number(li.dataset['index']))
    })
    this._list.addEventListener('mouseover', (e) => {
      if (this._inputMode !== 'pointer') return
      const li = /** @type {HTMLElement | null} */ (/** @type {HTMLElement} */ (e.target).closest('.palette__item'))
      if (!li) return
      const index = Number(li.dataset['index'])
      if (index !== this._activeIndex) this._setActive(index)
    })
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._search(false)
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._search(false)
  }

  get matcher() { return this._matcher }
  set matcher(val) {
    this._matcher = val
    if (this.open) this._search(false)
  }

  get source() { return this._source }
  set source(val) {
    this._source = val
    if (this.open) this._search()
  }

  get open() { return this.hasAttribute('open') }
  set open(val) {
    if (val) this.setAttribute('open', '')
    else this.removeAttribute('open')
  }

  /**
   * @param {string} name
   * @param {string | null} _oldVal
   * @param {string | null} newVal
   */
  attributeChangedCallback(name, _oldVal, newVal) {
    if (name === 'open') {
      if (newVal !== null) this._onOpen()
      else this._onClose()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    } else if (name === 'placeholder') {
      this._input.placeholder = newVal || 'Type a command...'
    }
  }

  connectedCallback() {
    markKind(this, 'command-palette')
    if (this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
    }
    if (this.hasAttribute('placeholder')) {
      this._input.placeholder = this.getAttribute('placeholder') || 'Type a command...'
    }
  }

  disconnectedCallback() {
    this._setupAutoTrigger(false)
  }

  /** @param {boolean} enable */
  _setupAutoTrigger(enable) {
    if (this._cleanupTrigger) {
      this._cleanupTrigger()
      this._cleanupTrigger = null
    }
    if (!enable) return

    const mac = /Mac|iPhone|iPad/.test(navigator.platform)

    /** @param {KeyboardEvent} e */
    const handler = (e) => {
      const mod = mac ? e.metaKey : e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        this.open = !this.open
      }
    }

    window.addEventListener('keydown', handler)
    this._cleanupTrigger = () => window.removeEventListener('keydown', handler)
  }

  _onOpen() {
    this._input.value = ''
    this._activeIndex = 0
    this._inputMode = 'keyboard'
    this._search()
    this._input.focus()
  }

  _onClose() {
    clearTimeout(this._sourceTimer)
    this._sourced = []
    this._input.blur()
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  /** @param {boolean} [ask] - whether to ask `source` again for this query */
  _search(ask = true) {
    const query = this._input.value
    if (ask) this._ask(query)
    const ids = new Set(this._commands.map(c => c.id))
    const all = query ? [...this._commands, ...this._sourced.filter(c => !ids.has(c.id))] : this._commands
    const found = query ? searchCommands(all, query, this._context, { matcher: this._matcher }) : this._getAllVisible()
    this._results = this.hasAttribute('hide-inactive') ? found.filter(cmd => cmd.active) : found
    this._activeIndex = 0
    this._render()
    this._list.scrollTop = 0
  }

  /**
   * Asks `source` once typing pauses; an answer for a query no longer typed is dropped.
   * @param {string} query
   */
  _ask(query) {
    clearTimeout(this._sourceTimer)
    this._sourced = []
    const source = this._source
    if (!source || !query) return
    this._sourceTimer = setTimeout(async () => {
      let got
      try {
        got = await source(query)
      } catch {
        return
      }
      if (!this.open || this._input.value !== query) return
      this._sourced = got || []
      this._search(false)
    }, this.sourceDelay)
  }

  _getAllVisible() {
    // Show all non-hidden commands when no query
    return this._commands
      .filter(cmd => !cmd.hidden)
      .map(cmd => ({
        ...cmd,
        active: !cmd.when || cmd.when(this._context),
        score: 0
      }))
  }

  _render() {
    if (this._results.length === 0) {
      for (const item of this._items) item.remove()
      if (!this._emptyEl) {
        this._emptyEl = document.createElement('li')
        this._emptyEl.className = 'palette__empty'
        this._emptyEl.setAttribute('part', 'empty')
        this._emptyEl.textContent = 'No commands found'
      }
      if (!this._emptyEl.parentNode) this._list.appendChild(this._emptyEl)
      return
    }

    if (this._emptyEl && this._emptyEl.parentNode) this._emptyEl.remove()

    for (let i = 0; i < this._results.length; i++) {
      let li = this._items[i]
      if (!li) {
        li = document.createElement('li')
        li.setAttribute('role', 'option')
        this._items[i] = li
      }
      if (!li.parentNode) this._list.appendChild(li)
      this._updateItem(li, /** @type {ScoredCommand} */ (this._results[i]), i)
    }

    for (let i = this._results.length; i < this._items.length; i++) {
      this._items[i]?.remove()
    }

    this._setActive(this._activeIndex)
  }

  /**
   * @param {HTMLLIElement} li
   * @param {ScoredCommand} cmd
   * @param {number} index
   */
  _updateItem(li, cmd, index) {
    li.className = 'palette__item' + (!cmd.active ? ' palette__item--disabled' : '')
    li.setAttribute('part', `item${!cmd.active ? ' item-disabled' : ''}`)
    li.setAttribute('aria-selected', 'false')
    li.dataset['index'] = String(index)
    li.replaceChildren()

    const label = document.createElement('span')
    label.className = 'palette__item-label'
    label.setAttribute('part', 'item-label')

    if (cmd.positions && cmd.positions.length > 0) {
      const posSet = new Set(cmd.positions)
      for (let j = 0; j < cmd.label.length; j++) {
        const ch = /** @type {string} */ (cmd.label[j])
        if (posSet.has(j)) {
          const mark = document.createElement('mark')
          mark.className = 'palette__item-label-match'
          mark.setAttribute('part', 'item-label-match')
          mark.textContent = ch
          label.appendChild(mark)
        } else {
          label.appendChild(document.createTextNode(ch))
        }
      }
    } else {
      label.textContent = cmd.label
    }

    li.appendChild(label)

    if (cmd.description) {
      const desc = document.createElement('span')
      desc.className = 'palette__item-description'
      desc.setAttribute('part', 'item-description')
      desc.textContent = cmd.description
      li.appendChild(desc)
    }

    if (cmd.category) {
      const cat = document.createElement('span')
      cat.className = 'palette__item-category'
      cat.setAttribute('part', 'item-category')
      cat.textContent = cmd.category
      li.appendChild(cat)
    }

    const first = bindingParts(cmd, this.inputs)[0]
    if (first) {
      const keyContainer = document.createElement('span')
      keyContainer.className = 'palette__item-keys'
      keyContainer.setAttribute('part', 'item-keys')
      for (const part of first) {
        const kbd = document.createElement('kbd')
        kbd.className = 'palette__item-key'
        kbd.setAttribute('part', 'item-key')
        kbd.textContent = part
        keyContainer.appendChild(kbd)
      }
      li.appendChild(keyContainer)
    }
  }

  /** @param {number} index */
  _setActive(index) {
    const prev = this._items[this._activeIndex]
    const next = this._items[index]
    if (prev) {
      prev.classList.remove('palette__item--active')
      prev.setAttribute('part', `item${prev.classList.contains('palette__item--disabled') ? ' item-disabled' : ''}`)
      prev.setAttribute('aria-selected', 'false')
    }
    if (next) {
      next.classList.add('palette__item--active')
      next.setAttribute('part', `item item-active${next.classList.contains('palette__item--disabled') ? ' item-disabled' : ''}`)
      next.setAttribute('aria-selected', 'true')
    }
    this._activeIndex = index
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(this._activeIndex < this._results.length - 1
          ? this._activeIndex + 1 : 0)
        this._scrollToActive()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(this._activeIndex > 0
          ? this._activeIndex - 1 : this._results.length - 1)
        this._scrollToActive()
        break
      case 'Home':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(0)
        this._scrollToActive()
        break
      case 'End':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._setActive(this._results.length - 1)
        this._scrollToActive()
        break
      case 'Enter':
        e.preventDefault()
        this._execute(this._activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        this._close()
        break
    }
  }

  _scrollToActive() {
    const el = this._items[this._activeIndex]
    if (el) el.scrollIntoView({ block: 'nearest' })
  }

  /** @param {number} index */
  _execute(index) {
    const cmd = this._results[index]
    if (!cmd || !cmd.active) return

    this._close()
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}
