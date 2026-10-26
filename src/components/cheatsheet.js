import { markKind, isMac, bindingParts } from '../core.js'
import { groupByCategory } from '../search.js'
import { onModifierHold, onModifierTaps } from '../modifiers.js'
import { keysUI } from '../keys-ui.js'

/** @typedef {import('../core.js').Command} Command */
/** @typedef {import('../core.js').InputUI} Input */

/**
 * <keybinds-cheatsheet> - Grouped display of available bindings
 *
 * Attributes:
 *   open         - Show/hide the cheatsheet
 *   auto-trigger  - Open while a modifier is held on its own; tapping it twice keeps it open
 *   trigger-key   - The modifier to hold: $mod (default: Meta on Mac, Control elsewhere), Control, Alt, Shift or Meta
 *   trigger-delay - How long to hold it before opening, in ms (default 200)
 *
 * Properties:
 *   commands: Command[]     - Array of command definitions
 *   context: object         - Context for `when` checks (grays out inactive)
 *   open: boolean           - Show/hide the cheatsheet
 *   inputs: Input[]         - Which bindings are shown, and how (default: keys only)
 *
 * Events:
 *   open  - Fired when it opens, however that happened
 *   close - Fired when cheatsheet is dismissed
 *
 * BEM classes:
 *   .cheatsheet
 *   .cheatsheet__backdrop
 *   .cheatsheet__dialog
 *   .cheatsheet__group
 *   .cheatsheet__group-title
 *   .cheatsheet__list
 *   .cheatsheet__item
 *   .cheatsheet__item--disabled
 *   .cheatsheet__item-label
 *   .cheatsheet__item-keys
 *   .cheatsheet__item-binding
 *   .cheatsheet__item-key
 */
export class KeybindCheatsheet extends HTMLElement {
  static kind = 'cheatsheet'

  static get observedAttributes() {
    return ['open', 'auto-trigger', 'trigger-key', 'trigger-delay']
  }

  constructor() {
    super()
    /** How bindings are shown. @type {Input[]} */
    this.inputs = [keysUI()]
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {(() => void) | null} */
    this._cleanupTrigger = null

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
      </style>
      <div class="cheatsheet" part="cheatsheet">
        <div class="cheatsheet__backdrop" part="backdrop"></div>
        <div class="cheatsheet__dialog" part="dialog" role="dialog" aria-modal="true"></div>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.cheatsheet__backdrop'))
    /** @type {HTMLElement} */
    this._dialog = /** @type {HTMLElement} */ (shadow.querySelector('.cheatsheet__dialog'))

    this._backdrop.addEventListener('click', () => this._close())
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = val || []
    if (this.open) this._render()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._render()
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
    if (name === 'open' && newVal !== null) {
      this.dispatchEvent(new CustomEvent('open'))
      this._render()
    } else if (name === 'auto-trigger') {
      this._setupAutoTrigger(newVal !== null)
    } else if ((name === 'trigger-key' || name === 'trigger-delay') && this.hasAttribute('auto-trigger')) {
      this._setupAutoTrigger(true)
    }
  }

  connectedCallback() {
    markKind(this, 'cheatsheet')
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

    // Which modifier to hold: "$mod" (the default) is Meta on Mac and Control elsewhere, like in bindings
    const key = this.getAttribute('trigger-key') || '$mod'
    const modifier = key.toLowerCase() === '$mod' ? (isMac ? 'Meta' : 'Control') : key
    const delay = Number(this.getAttribute('trigger-delay') ?? 200)
    // Holding shows it until the key is let go; tapping twice keeps it open (and tapping twice again,
    // Escape or a click outside closes it).
    let pinned = false
    const unhold = onModifierHold(modifier, (held) => {
      if (!pinned) this.open = held
    }, { delay: Number.isFinite(delay) ? delay : 200 })
    const untap = onModifierTaps(modifier, 2, () => {
      pinned = !this.open
      this.open = pinned
    })
    /** @param {KeyboardEvent} e */
    const escape = (e) => {
      if (e.key !== 'Escape' || !this.open) return
      // Escape was for closing it, not for whatever is underneath too
      e.preventDefault()
      e.stopPropagation()
      this._close()
    }
    const closed = () => { pinned = false }
    window.addEventListener('keydown', escape, true)
    this.addEventListener('close', closed)
    this._cleanupTrigger = () => {
      unhold()
      untap()
      window.removeEventListener('keydown', escape, true)
      this.removeEventListener('close', closed)
    }
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _render() {
    const groups = groupByCategory(this._commands, this._context, this.inputs.filter((i) => !i.axis).map((i) => i.field))
    this._dialog.replaceChildren()

    for (const [category, cmds] of Object.entries(groups)) {
      const group = document.createElement('div')
      group.className = 'cheatsheet__group'
      group.setAttribute('part', 'group')

      const title = document.createElement('div')
      title.className = 'cheatsheet__group-title'
      title.setAttribute('part', 'group-title')
      title.textContent = category
      group.appendChild(title)

      const list = document.createElement('ul')
      list.className = 'cheatsheet__list'
      list.setAttribute('part', 'list')

      for (const cmd of cmds) {
        const li = document.createElement('li')
        li.className = 'cheatsheet__item'
        if (!cmd.active) li.className += ' cheatsheet__item--disabled'
        li.setAttribute('part', `item${!cmd.active ? ' item-disabled' : ''}`)

        const label = document.createElement('span')
        label.className = 'cheatsheet__item-label'
        label.setAttribute('part', 'item-label')
        label.textContent = cmd.label
        li.appendChild(label)

        const bindings = document.createElement('span')
        bindings.className = 'cheatsheet__item-keys'
        bindings.setAttribute('part', 'item-keys')

        for (const parts of bindingParts(cmd, this.inputs)) {
          const binding = document.createElement('span')
          binding.className = 'cheatsheet__item-binding'
          binding.setAttribute('part', 'item-binding')
          for (const part of parts) {
            const kbd = document.createElement('kbd')
            kbd.className = 'cheatsheet__item-key'
            kbd.setAttribute('part', 'item-key')
            kbd.textContent = part
            binding.appendChild(kbd)
          }
          bindings.appendChild(binding)
        }

        li.appendChild(bindings)
        list.appendChild(li)
      }

      group.appendChild(list)
      this._dialog.appendChild(group)
    }
  }
}
