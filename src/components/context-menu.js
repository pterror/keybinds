import { markKind, isActive, bindingParts } from '../core.js'
import { filterByMenu, searchCommands, defaultScorer } from '../search.js'
import { keys } from '../keys.js'

/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').Input} Input */
/** @typedef {import('../core.js').Scorer} Scorer */
/** @typedef {import('../core.js').HistoryEntry} HistoryEntry */
/** @typedef {import('../core.js').ScoredCommand} ScoredCommand */

/**
 * <keybinds-context-menu> - Scored, searchable context menu driven by commands
 *
 * Shows top `maxVisible` items (default: 7) scored via the scorer (default:
 * `defaultScorer()`). A search input at the top filters and re-scores. When
 * more items exist than `maxVisible`, a subtle "▾ N more" row at the bottom
 * reveals them on hover/focus with a smooth height transition.
 *
 * Attributes:
 *   open         - Show/hide the menu
 *   auto-trigger - Wire contextmenu event on target element
 *   menu         - Menu tag to filter commands by
 *   target       - CSS selector for contextmenu target (defaults to parentElement)
 *
 * Properties:
 *   commands: Command[]           - Array of command definitions
 *   context: object               - Context for `when` checks
 *   open: boolean                 - Show/hide the menu
 *   menu: string                  - Menu tag to filter by
 *   position: { x: number, y: number } - Menu position
 *   scorer: Scorer                - Scoring function (default: defaultScorer())
 *   history: HistoryEntry[]       - Frecency history for defaultScorer
 *   maxVisible: number            - Max visible items before "N more" (default: 7)
 *   inputs: Input[]               - How bindings are shown (default: keys only)
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * CSS parts:
 *   search          - The search input element
 *   context-menu    - Outer container
 *   backdrop        - Click-away backdrop
 *   list            - The <ul>
 *   separator       - Category separator <li>
 *   item            - Command <li>
 *   item-active     - Active/focused item
 *   item-disabled   - Inactive command
 *   item-label      - Label span
 *   item-keys       - Keys container
 *   item-key        - Individual key <kbd>
 *   more-row        - "▾ N more" toggle row
 */
export class ContextMenu extends HTMLElement {
  static kind = 'context-menu'

  static get observedAttributes() {
    return ['open', 'auto-trigger', 'menu', 'target']
  }

  constructor() {
    super()
    /** How bindings are shown: an item shows its first. @type {Input[]} */
    this.inputs = [keys()]
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {string} */
    this._menu = ''
    /** @type {{ x: number, y: number }} */
    this._position = { x: 0, y: 0 }
    /** @type {(Command & { active: boolean })[]} */
    this._allItems = []
    /** @type {(Command & { active: boolean })[]} */
    this._visibleItems = []
    /** @type {number} */
    this._activeIndex = -1
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'pointer'
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null
    /** @type {((e: Event) => void) | null} */
    this._keyHandler = null
    /** @type {Scorer} */
    this._scorer = defaultScorer()
    /** @type {HistoryEntry[]} */
    this._history = []
    /** @type {number} */
    this._maxVisible = 7
    /** @type {boolean} */
    this._expanded = false

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .context-menu__backdrop { position: fixed; inset: 0; }
        .context-menu__more-row {
          list-style: none;
          cursor: pointer;
          padding: 4px 8px;
          opacity: 0.6;
          font-size: 0.85em;
        }
        .context-menu__more-row:hover,
        .context-menu__more-row:focus {
          opacity: 1;
        }
        .context-menu__overflow {
          overflow: hidden;
          max-height: 0;
          transition: max-height 0.2s ease;
        }
        .context-menu__overflow--visible {
          max-height: 600px;
        }
      </style>
      <div class="context-menu__backdrop" part="backdrop"></div>
      <div class="context-menu" part="context-menu">
        <input
          class="context-menu__search"
          part="search"
          type="text"
          placeholder="Search..."
          autocomplete="off"
          spellcheck="false"
        />
        <ul class="context-menu__list" part="list" role="menu"></ul>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__backdrop'))
    /** @type {HTMLInputElement} */
    this._searchInput = /** @type {HTMLInputElement} */ (shadow.querySelector('.context-menu__search'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__list'))

    this._backdrop.addEventListener('click', () => this._close())
    this._backdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this._close()
    })
    this._list.addEventListener('mousemove', () => { this._inputMode = 'pointer' })
    this._searchInput.addEventListener('input', () => {
      this._expanded = false
      this._buildItems()
    })
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._buildItems()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._buildItems()
  }

  get menu() { return this._menu }
  set menu(val) {
    this._menu = val || ''
    if (this.open) this._buildItems()
  }

  get open() { return this.hasAttribute('open') }
  set open(val) {
    if (val) this.setAttribute('open', '')
    else this.removeAttribute('open')
  }

  get position() { return this._position }
  set position(val) {
    this._position = val || { x: 0, y: 0 }
    if (this.open) this._updatePosition()
  }

  get scorer() { return this._scorer }
  set scorer(val) {
    this._scorer = val || defaultScorer()
    if (this.open) this._buildItems()
  }

  get history() { return this._history }
  set history(val) {
    this._history = val || []
    // Update the scorer to incorporate new history when using default
    if (this.open) this._buildItems()
  }

  get maxVisible() { return this._maxVisible }
  set maxVisible(val) {
    this._maxVisible = (typeof val === 'number' && val > 0) ? val : 7
    if (this.open) this._render()
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
    } else if (name === 'menu') {
      this._menu = newVal || ''
      if (this.open) this._buildItems()
    }
  }

  connectedCallback() {
    markKind(this, 'context-menu')
    if (this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
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

    /** @param {Event} e */
    const handler = (e) => {
      const event = /** @type {MouseEvent} */ (e)
      event.preventDefault()
      this._position = { x: event.clientX, y: event.clientY }
      this._buildItems()
      this.open = true
    }

    const selector = this.getAttribute('target')
    const target = selector ? document.querySelector(selector) : this.parentElement
    if (!target) return

    target.addEventListener('contextmenu', handler)
    this._cleanupTrigger = () => target.removeEventListener('contextmenu', handler)
  }

  _onOpen() {
    this._activeIndex = -1
    this._inputMode = 'pointer'
    this._expanded = false
    this._searchInput.value = ''
    this._buildItems()
    this._updatePosition()
    /** @type {(e: Event) => void} */
    const handler = (e) => this._handleKey(/** @type {KeyboardEvent} */ (e))
    this._keyHandler = handler
    const shadow = /** @type {ShadowRoot} */ (this.shadowRoot)
    shadow.addEventListener('keydown', handler)
    // On a touch screen, focusing the search would bring up the on-screen keyboard over the menu;
    // the list takes focus instead, and the search is a tap away.
    const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
    const first = touch ? this._list : this._searchInput
    first.focus()
  }

  _onClose() {
    this._resize?.disconnect()
    this._resize = null
    if (this._keyHandler) {
      const shadow = /** @type {ShadowRoot} */ (this.shadowRoot)
      shadow.removeEventListener('keydown', this._keyHandler)
      this._keyHandler = null
    }
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _buildItems() {
    const query = this._searchInput ? this._searchInput.value : ''
    const scorer = this._scorer

    if (query) {
      // Search mode: fuzzy match + scorer
      const scored = searchCommands(this._commands, query, this._context, { scorer })
      this._allItems = scored.map(cmd => ({ ...cmd, active: cmd.active }))
    } else {
      // No query: apply scorer to rank all relevant commands
      let base = this._menu
        ? filterByMenu(this._commands, this._menu, this._context)
        : this._commands
            .filter(cmd => !cmd.hidden)
            .map(cmd => ({ ...cmd, active: isActive(cmd, this._context) }))

      // Score and sort: active first, then by score, preserving original order for ties
      /** @type {Array<Command & { active: boolean, _score: number, _origIdx: number }>} */
      const withScores = base.map((cmd, i) => ({
        ...cmd,
        _score: scorer(cmd, this._context),
        _origIdx: i,
      }))

      withScores.sort((a, b) => {
        if (a.active !== b.active) return (b.active ? 1 : 0) - (a.active ? 1 : 0)
        if (b._score !== a._score) return b._score - a._score
        return a._origIdx - b._origIdx
      })

      // Exclude items the scorer excluded (score <= 0) only if they have a `when`
      // (commands without `when` always get score 1 from defaultScorer so they pass)
      this._allItems = withScores
        .filter(cmd => !cmd.when || cmd._score > 0)
        .map(({ _score: _s, _origIdx: _o, ...cmd }) => cmd)
    }

    this._render()
  }

  _updatePosition() {
    const { x, y } = this._position
    const container = /** @type {HTMLElement} */ (this.shadowRoot?.querySelector('.context-menu'))
    if (!container) return
    container.style.position = 'fixed'
    // Kept on screen, and again whenever it changes size (more items shown, a search narrowing them):
    // without room below the point it opens upward from it, and without room either way it fits
    // where it can.
    const clamp = () => {
      const w = container.offsetWidth
      const h = container.offsetHeight
      const vh = window.innerHeight
      const top = y + h <= vh ? y : y - h >= 0 ? y - h : vh - h
      container.style.left = `${Math.max(0, Math.min(x, window.innerWidth - w))}px`
      container.style.top = `${Math.max(0, top)}px`
    }
    clamp()
    if (typeof ResizeObserver === 'function') {
      this._resize?.disconnect()
      this._resize = new ResizeObserver(clamp)
      this._resize.observe(container)
    } else requestAnimationFrame(clamp)
  }

  _render() {
    const all = this._allItems
    const limit = this._maxVisible
    const showAll = this._expanded || all.length <= limit
    this._visibleItems = showAll ? all : all.slice(0, limit)
    const hiddenCount = all.length - this._visibleItems.length

    this._list.replaceChildren()
    this._list.setAttribute('tabindex', '0')

    let lastCategory = null
    for (let i = 0; i < this._visibleItems.length; i++) {
      const cmd = /** @type {Command & { active: boolean }} */ (this._visibleItems[i])

      // Category separator
      const cat = cmd.category || null
      if (cat !== lastCategory && lastCategory !== null) {
        const sep = document.createElement('li')
        sep.className = 'context-menu__separator'
        sep.setAttribute('part', 'separator')
        sep.setAttribute('role', 'separator')
        this._list.appendChild(sep)
      }
      lastCategory = cat

      const li = document.createElement('li')
      li.className = 'context-menu__item'
      if (i === this._activeIndex) li.className += ' context-menu__item--active'
      if (!cmd.active) li.className += ' context-menu__item--disabled'
      li.setAttribute('part', `item${i === this._activeIndex ? ' item-active' : ''}${!cmd.active ? ' item-disabled' : ''}`)
      li.setAttribute('role', 'menuitem')
      li.dataset['index'] = String(i)

      const label = document.createElement('span')
      label.className = 'context-menu__item-label'
      label.setAttribute('part', 'item-label')
      label.textContent = cmd.label
      li.appendChild(label)

      const first = bindingParts(cmd, this.inputs)[0]
      if (first) {
        const keyContainer = document.createElement('span')
        keyContainer.className = 'context-menu__item-keys'
        keyContainer.setAttribute('part', 'item-keys')
        for (const part of first) {
          const kbd = document.createElement('kbd')
          kbd.className = 'context-menu__item-key'
          kbd.setAttribute('part', 'item-key')
          kbd.textContent = part
          keyContainer.appendChild(kbd)
        }
        li.appendChild(keyContainer)
      }

      li.addEventListener('click', () => this._execute(i))
      li.addEventListener('mouseenter', () => {
        if (this._inputMode !== 'pointer') return
        this._activeIndex = i
        this._render()
      })

      this._list.appendChild(li)
    }

    // "N more" row
    if (hiddenCount > 0) {
      const moreRow = document.createElement('li')
      moreRow.className = 'context-menu__more-row'
      moreRow.setAttribute('part', 'more-row')
      moreRow.setAttribute('role', 'menuitem')
      moreRow.setAttribute('tabindex', '0')
      moreRow.textContent = `▾ ${hiddenCount} more`

      const expand = () => {
        this._expanded = true
        this._render()
      }
      moreRow.addEventListener('click', expand)
      moreRow.addEventListener('mouseenter', expand)
      moreRow.addEventListener('focus', expand)

      this._list.appendChild(moreRow)
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    // Allow typing in search input without intercepting arrow navigation
    if (e.target === this._searchInput && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter' && e.key !== 'Escape') {
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex < this._visibleItems.length - 1
          ? this._activeIndex + 1 : 0
        this._render()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex > 0
          ? this._activeIndex - 1 : this._visibleItems.length - 1
        this._render()
        break
      case 'Home':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = 0
        this._render()
        break
      case 'End':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._visibleItems.length - 1
        this._render()
        break
      case 'Enter':
        e.preventDefault()
        if (this._activeIndex >= 0) this._execute(this._activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        this._close()
        break
    }
  }

  /** @param {number} index */
  _execute(index) {
    const cmd = this._visibleItems[index]
    if (!cmd || !cmd.active) return

    this._close()
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}
