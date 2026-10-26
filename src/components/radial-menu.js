import { markKind, isActive } from '../core.js'

/** @typedef {import('../core.js').Command} Command */

/**
 * <keybinds-radial-menu> - Radial command menu with bilateral text layout
 *
 * Up to 8 commands arranged evenly around a circle. Labels on the right half
 * are left-aligned to the right of their indicator; labels on the left half
 * are right-aligned to the left. Direction becomes muscle memory; eight slots
 * maps to Miller's Law (≤7±2).
 *
 * No auto-trigger — caller controls open/close.
 *
 * Attributes:
 *   open - Reflects open state
 *
 * Properties:
 *   commands: Command[]            - Up to 8 command definitions
 *   context: object                - Context for `when` checks
 *   open: boolean                  - Show/hide the menu
 *
 * Methods:
 *   open({ x, y })  - Open at viewport coordinates (omit for viewport center)
 *   close()         - Dismiss the menu
 *
 * Events:
 *   command - Fired when command is executed (detail: { command })
 *   close   - Fired when menu is dismissed
 *
 * CSS parts:
 *   backdrop        - Click-away backdrop
 *   container       - SVG/div outer wrapper
 *   slot            - Each radial slot wrapper
 *   slot-active     - Hovered/focused slot
 *   slot-disabled   - Inactive command slot
 *   indicator       - The dot/circle for each slot
 *   label           - The text label for each slot
 */
export class RadialMenu extends HTMLElement {
  static kind = 'radial-menu'

  static get observedAttributes() {
    return ['open']
  }

  constructor() {
    super()
    /** @type {Command[]} */
    this._commands = []
    /** @type {Record<string, unknown>} */
    this._context = {}
    /** @type {{ x: number, y: number }} */
    this._position = { x: 0, y: 0 }
    /** @type {(Command & { active: boolean })[]} */
    this._items = []
    /** @type {number} */
    this._activeIndex = -1
    /** @type {'keyboard' | 'pointer'} */
    this._inputMode = 'pointer'
    /** @type {((e: Event) => void) | null} */
    this._keyHandler = null

    // Radial layout constants
    /** @type {number} */
    this._radius = 80
    /** @type {number} */
    this._indicatorR = 6
    /** @type {number} */
    this._labelGap = 14

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .radial-menu__backdrop {
          position: fixed;
          inset: 0;
          z-index: 9998;
        }
        .radial-menu__container {
          position: fixed;
          z-index: 9999;
          pointer-events: none;
          overflow: visible;
        }
        .radial-menu__slot {
          pointer-events: all;
          cursor: pointer;
        }
        .radial-menu__slot--disabled {
          cursor: default;
          opacity: 0.35;
        }
        .radial-menu__indicator {
          transition: r 0.1s, fill 0.1s;
        }
        .radial-menu__slot--active .radial-menu__indicator {
          /* active state handled via JS attribute */
        }
        .radial-menu__label {
          font: 13px/1.4 system-ui, sans-serif;
          fill: currentColor;
          dominant-baseline: central;
          pointer-events: none;
          user-select: none;
        }
        .radial-menu__spoke {
          stroke-width: 1;
          opacity: 0.25;
        }
      </style>
      <div class="radial-menu__backdrop" part="backdrop"></div>
      <svg class="radial-menu__container" part="container" xmlns="http://www.w3.org/2000/svg">
        <g class="radial-menu__spokes"></g>
        <g class="radial-menu__slots"></g>
      </svg>
    `

    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.radial-menu__backdrop'))
    this._svg = /** @type {SVGSVGElement} */ (shadow.querySelector('.radial-menu__container'))
    this._spokesGroup = /** @type {SVGGElement} */ (shadow.querySelector('.radial-menu__spokes'))
    this._slotsGroup = /** @type {SVGGElement} */ (shadow.querySelector('.radial-menu__slots'))

    this._backdrop.addEventListener('click', () => this._close())
    this._backdrop.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      this._close()
    })
  }

  connectedCallback() {
    markKind(this, 'radial-menu')
  }

  get commands() { return this._commands }
  set commands(val) {
    this._commands = (val || []).slice(0, 8)
    if (this.open) this._buildItems()
  }

  get context() { return this._context }
  set context(val) {
    this._context = val || {}
    if (this.open) this._buildItems()
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
    }
  }

  /**
   * Open the menu at the given viewport coordinates.
   * If no coords given, centers in the viewport.
   * @param {{ x?: number, y?: number } | undefined} [coords]
   */
  openAt(coords) {
    if (coords && typeof coords.x === 'number' && typeof coords.y === 'number') {
      this._position = { x: coords.x, y: coords.y }
    } else {
      this._position = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      }
    }
    this._buildItems()
    this.open = true
  }

  close() {
    this._close()
  }

  _onOpen() {
    this._activeIndex = -1
    this._inputMode = 'pointer'
    this._buildItems()
    this._updatePosition()
    /** @type {(e: Event) => void} */
    const handler = (e) => this._handleKey(/** @type {KeyboardEvent} */ (e))
    this._keyHandler = handler
    // Listen on the document so the component doesn't need focus
    document.addEventListener('keydown', handler)
  }

  _onClose() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler)
      this._keyHandler = null
    }
  }

  _close() {
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  _buildItems() {
    this._items = this._commands
      .filter(cmd => !cmd.hidden)
      .map(cmd => ({ ...cmd, active: isActive(cmd, this._context) }))
    this._render()
  }

  _updatePosition() {
    const { x, y } = this._position
    const r = this._radius
    const pad = r + 160 // enough room for labels
    this._svg.style.left = `${x - pad}px`
    this._svg.style.top = `${y - pad}px`
    this._svg.style.width = `${pad * 2}px`
    this._svg.style.height = `${pad * 2}px`
    this._svg.setAttribute('viewBox', `${-pad} ${-pad} ${pad * 2} ${pad * 2}`)
  }

  _render() {
    this._updatePosition()
    this._spokesGroup.replaceChildren()
    this._slotsGroup.replaceChildren()

    const count = this._items.length
    if (count === 0) return

    const total = 8 // always 8 slots so positions are consistent
    const r = this._radius
    const indR = this._indicatorR
    const gap = this._labelGap

    // Indicator fill from CSS custom property or fallback
    const activeColor = 'var(--radial-menu-active-color, #4f8ef7)'
    const inactiveColor = 'var(--radial-menu-inactive-color, #888)'
    const disabledColor = 'var(--radial-menu-disabled-color, #555)'
    const textColor = 'var(--radial-menu-text-color, currentColor)'
    const spokeColor = 'var(--radial-menu-spoke-color, currentColor)'

    for (let slot = 0; slot < total; slot++) {
      // Distribute evenly, starting at top (−π/2), clockwise
      const angle = (2 * Math.PI * slot) / total - Math.PI / 2
      const cx = r * Math.cos(angle)
      const cy = r * Math.sin(angle)

      const cmd = this._items[slot]

      // Spoke line from origin to indicator
      const spokeLine = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      spokeLine.setAttribute('class', 'radial-menu__spoke')
      spokeLine.setAttribute('x1', '0')
      spokeLine.setAttribute('y1', '0')
      spokeLine.setAttribute('x2', String(cx))
      spokeLine.setAttribute('y2', String(cy))
      spokeLine.setAttribute('stroke', cmd ? spokeColor : disabledColor)
      spokeLine.setAttribute('part', 'spoke')
      this._spokesGroup.appendChild(spokeLine)

      if (!cmd) continue

      const isActive_ = cmd.active
      const isHighlighted = slot === this._activeIndex

      // Slot group
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      g.setAttribute('class', `radial-menu__slot${!isActive_ ? ' radial-menu__slot--disabled' : ''}${isHighlighted ? ' radial-menu__slot--active' : ''}`)
      g.setAttribute('part', `slot${isHighlighted ? ' slot-active' : ''}${!isActive_ ? ' slot-disabled' : ''}`)
      g.setAttribute('role', 'menuitem')
      g.setAttribute('aria-label', cmd.label)
      if (!isActive_) g.setAttribute('aria-disabled', 'true')

      // Clickable hit area (larger than visual indicator)
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      hit.setAttribute('cx', String(cx))
      hit.setAttribute('cy', String(cy))
      hit.setAttribute('r', String(indR + 10))
      hit.setAttribute('fill', 'transparent')
      g.appendChild(hit)

      // Visual indicator dot
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('class', 'radial-menu__indicator')
      dot.setAttribute('part', 'indicator')
      dot.setAttribute('cx', String(cx))
      dot.setAttribute('cy', String(cy))
      dot.setAttribute('r', isHighlighted ? String(indR + 2) : String(indR))
      dot.setAttribute('fill', !isActive_ ? disabledColor : isHighlighted ? activeColor : inactiveColor)
      g.appendChild(dot)

      // Label — bilateral layout:
      // Right half (cos > 0 or top/bottom dead center columns): label to the right, left-aligned
      // Left half (cos < 0): label to the left, right-aligned
      // Exactly at ±90° (cos ≈ 0): stack label to the right (top/bottom slots go right by convention)
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      text.setAttribute('class', 'radial-menu__label')
      text.setAttribute('part', 'label')
      text.setAttribute('fill', !isActive_ ? disabledColor : isHighlighted ? activeColor : textColor)

      const onRight = Math.cos(angle) >= 0
      const lx = onRight ? cx + indR + gap : cx - indR - gap
      text.setAttribute('x', String(lx))
      text.setAttribute('y', String(cy))
      text.setAttribute('text-anchor', onRight ? 'start' : 'end')
      text.textContent = cmd.label
      g.appendChild(text)

      // Events
      if (isActive_) {
        g.addEventListener('click', () => this._execute(slot))
      }
      g.addEventListener('mouseenter', () => {
        if (this._inputMode !== 'pointer') return
        this._activeIndex = slot
        this._render()
      })
      g.addEventListener('mouseleave', () => {
        if (this._inputMode !== 'pointer') return
        if (this._activeIndex === slot) {
          this._activeIndex = -1
          this._render()
        }
      })

      this._slotsGroup.appendChild(g)
    }
  }

  /** @param {KeyboardEvent} e */
  _handleKey(e) {
    if (!this.open) return

    // Arrow key → slot mapping based on 8-slot layout
    // Slots: 0=top, 1=top-right, 2=right, 3=bottom-right, 4=bottom, 5=bottom-left, 6=left, 7=top-left
    /** @type {Record<string, number>} */
    const arrowToSlot = {
      ArrowUp: 0,
      ArrowRight: 2,
      ArrowDown: 4,
      ArrowLeft: 6,
    }

    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
      case 'ArrowDown':
      case 'ArrowLeft': {
        e.preventDefault()
        this._inputMode = 'keyboard'
        const target = /** @type {number} */ (arrowToSlot[e.key])
        // Find the nearest filled slot at or adjacent to the arrow direction
        if (this._items[target]) {
          this._activeIndex = target
        } else {
          // walk clockwise to find nearest filled slot
          for (let d = 1; d < 8; d++) {
            const cw = (target + d) % 8
            const ccw = (target - d + 8) % 8
            if (this._items[cw]) { this._activeIndex = cw; break }
            if (this._items[ccw]) { this._activeIndex = ccw; break }
          }
        }
        this._render()
        break
      }
      case 'Tab': {
        e.preventDefault()
        this._inputMode = 'keyboard'
        const filled = this._items.map((_, i) => i)
        if (filled.length === 0) break
        const cur = filled.indexOf(this._activeIndex)
        const next = e.shiftKey ? filled[cur <= 0 ? filled.length - 1 : cur - 1] : filled[cur >= filled.length - 1 ? 0 : cur + 1]
        this._activeIndex = next ?? 0
        this._render()
        break
      }
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

  /** @param {number} slot */
  _execute(slot) {
    const cmd = this._items[slot]
    if (!cmd || !cmd.active) return

    this._close()
    cmd.execute(this._context)
    this.dispatchEvent(new CustomEvent('command', { detail: { command: cmd } }))
  }
}
