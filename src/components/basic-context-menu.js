import { markKind, isActive, bindingParts } from '../core.js'
import { filterByMenu } from '../search.js'
import { keysUI } from '../keys-ui.js'

/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').InputUI} Input */

/**
 * <keybinds-basic-context-menu> - Context menu driven by commands (no search, no limit)
 *
 * Attributes:
 *   open         - Show/hide the menu
 *   auto-trigger - Wire contextmenu event on target element
 *   menu         - Menu tag to filter commands by
 *   target       - CSS selector for contextmenu target (defaults to parentElement)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks
 *   open: boolean           - Show/hide the menu
 *   menu: string            - Menu tag to filter by
 *   position: { x: number, y: number } - Menu position
 *   inputs: Input[]         - How bindings are shown (default: keys only)
 *
 * Events:
 *   execute - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * BEM classes:
 *   .context-menu
 *   .context-menu__backdrop
 *   .context-menu__list
 *   .context-menu__separator
 *   .context-menu__item
 *   .context-menu__item--disabled
 *   .context-menu__item--active
 *   .context-menu__item-label
 *   .context-menu__item-keys
 *   .context-menu__item-key
 */
export class BasicContextMenu extends HTMLElement {
  static kind = 'basic-context-menu'

  static get observedAttributes() {
    return ['open', 'auto-trigger', 'menu', 'target']
  }

  constructor() {
    super()
    /** How bindings are shown: an item shows its first. @type {Input[]} */
    this.inputs = [keysUI()]
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {string} */
    this._menu = ''
    /** @type {{ x: number, y: number }} */
    this._position = { x: 0, y: 0 }
    /** @type {(Command & { active: boolean })[]} */
    this._items = []
    /** @type {number} */
    this._activeIndex = -1
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'pointer'
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null
    /** @type {((e: Event) => void) | null} */
    this._keyHandler = null

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .context-menu__backdrop { position: fixed; inset: 0; }
      </style>
      <div class="context-menu__backdrop" part="backdrop"></div>
      <div class="context-menu" part="context-menu">
        <ul class="context-menu__list" part="list" role="menu"></ul>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__backdrop'))
    /** @type {HTMLElement} */
    this._list = /** @type {HTMLElement} */ (shadow.querySelector('.context-menu__list'))
    /** @type {ResizeObserver | null} */
    this._resize = null

    this._backdrop.addEventListener('click', () => this._close())
    this._backdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this._close()
    })
    this._list.addEventListener('mousemove', () => { this._inputMode = 'pointer' })
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
    markKind(this, 'basic-context-menu', true)
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
    this._buildItems()
    this._updatePosition()
    /** @type {(e: Event) => void} */
    const handler = (e) => this._handleKey(/** @type {KeyboardEvent} */ (e))
    this._keyHandler = handler
    const shadow = /** @type {ShadowRoot} */ (this.shadowRoot)
    shadow.addEventListener('keydown', handler)
    this._list.focus()
  }

  _onClose() {
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
    this._items = this._menu
      ? filterByMenu(this._commands, this._menu, this._context)
      : this._commands
          .filter(cmd => !cmd.hidden)
          .map(cmd => ({ ...cmd, active: isActive(cmd, this._context) }))
    this._render()
  }

  _updatePosition() {
    const { x, y } = this._position
    const list = this._list
    list.style.position = 'fixed'
    list.style.left = `${x}px`
    list.style.top = `${y}px`

    // Defer clamping to after render
    requestAnimationFrame(() => {
      const rect = list.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      if (rect.right > vw) list.style.left = `${Math.max(0, vw - rect.width)}px`
      if (rect.bottom > vh) list.style.top = `${Math.max(0, vh - rect.height)}px`
    })
  }

  _render() {
    this._list.replaceChildren()
    this._list.setAttribute('tabindex', '0')

    let lastCategory = null
    for (let i = 0; i < this._items.length; i++) {
      const cmd = /** @type {Command & { active: boolean }} */ (this._items[i])

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
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex < this._items.length - 1
          ? this._activeIndex + 1 : 0
        this._render()
        break
      case 'ArrowUp':
        e.preventDefault()
        this._inputMode = 'keyboard'
        this._activeIndex = this._activeIndex > 0
          ? this._activeIndex - 1 : this._items.length - 1
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
        this._activeIndex = this._items.length - 1
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
    const cmd = this._items[index]
    if (!cmd || !cmd.active) return

    this._close()
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('execute', { detail: { command: cmd } }))
  }
}
