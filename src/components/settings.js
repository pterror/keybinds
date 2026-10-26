import { RELEASE_SUFFIX, markKind, findConflict, flipRelease, splitRelease, bindingLookup, formatBinding } from '../core.js'
import { keysUI } from '../keys-ui.js'

/** @typedef {import('../core.js').InputUI} Input */
/** @typedef {import('../core.js').BindingSchema} BindingSchema */
/** @typedef {import('../store.js').BindingsStore<any>} AnyStore */

/**
 * <keybinds-settings> - Keybinding settings panel
 *
 * Attributes:
 *   open - Show/hide the settings panel
 *
 * Properties:
 *   store: BindingsStore  - Reactive bindings store
 *   inputs: Input[]       - Which bindings are shown and can be recorded (default: keys only)
 *   releases: boolean     - Offer release bindings ("k:up"); set when keybinds() has releases() (default: false)
 *   holds: boolean        - Offer hold and tap bindings ("k:hold", "k:tap"), with holds() (default: false)
 *   sequences: boolean    - Offer bindings of several steps ("g i"), with sequences() (default: false)
 *   open: boolean         - Show/hide the settings panel
 *
 * Events:
 *   close  - Fired when settings panel is dismissed
 *   change - Fired when a binding is changed (detail: { commandId, bindings })
 *   reset  - Fired when bindings are reset (detail: { commandId? })
 *
 * BEM classes:
 *   .settings
 *   .settings__backdrop
 *   .settings__dialog
 *   .settings__header
 *   .settings__title
 *   .settings__reset-all
 *   .settings__group
 *   .settings__group-title
 *   .settings__list
 *   .settings__item
 *   .settings__item-label
 *   .settings__item-bindings
 *   .settings__item-reset
 *   .settings__binding
 *   .settings__binding-keys
 *   .settings__binding-key
 *   .settings__binding-remove
 *   .settings__item-add
 *   .settings__binding--recording
 *   .settings__recording-overlay
 *   .settings__conflict
 */
export class KeybindSettings extends HTMLElement {
  static kind = 'settings'

  static get observedAttributes() {
    return ['open']
  }

  constructor() {
    super()
    /** @type {AnyStore | null} */
    this._store = null
    /** @type {((e: Event) => void) | null} */
    this._storeListener = null
    /** @type {Input[]} */
    this._inputs = [keysUI()]
    /** Whether release bindings ("k:up") are on, so they can be recorded and switched to */
    this.releases = false
    /** Whether hold and tap bindings ("k:hold", "k:tap") are on, so they can be recorded */
    this.holds = false
    /** Whether bindings of several steps ("g i") are on, so they can be recorded */
    this.sequences = false
    /** @type {(() => void)[]} */
    this._unwatch = []
    /** @type {{ commandId: string, input: Input, index: number | null } | null} */
    this._recording = null
    /** @type {{ commandId: string, label: string, bindingStr: string, input: Input, index: number | null, flip?: boolean } | null} */
    this._conflict = null
    /** What recording captures: a press (""), or a release, hold or tap (":up", ":hold", ":tap") */
    this._recordSuffix = ''
    /** Whether recording takes several steps, and the steps so far */
    this._recordSequence = false
    /** @type {string[]} */
    this._steps = []
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._stepTimer = undefined
    /** The switches in the recording prompt, whose clicks aren't recorded */
    /** @type {HTMLElement[]} */
    this._toggles = []
    /** @type {(() => void) | null} */
    this._stopRecorder = null
    /** @type {((e: Event) => void) | null} */
    this._escapeHandler = null
    // An input that can't be recorded now (no pad connected) gets its add button when it can
    this._availabilityChanged = () => { if (this.open) this._render() }

    const shadow = this.attachShadow({ mode: 'open' })
    shadow.innerHTML = `
      <style>
        :host { display: none; }
        :host([open]) { display: block; }
        * { box-sizing: border-box; }
        .settings__backdrop { position: fixed; inset: 0; }
      </style>
      <div class="settings" part="settings">
        <div class="settings__backdrop" part="backdrop"></div>
        <div class="settings__dialog" part="dialog" role="dialog" aria-modal="true" aria-label="Keybind Settings"></div>
      </div>
    `

    /** @type {HTMLElement} */
    this._backdrop = /** @type {HTMLElement} */ (shadow.querySelector('.settings__backdrop'))
    /** @type {HTMLElement} */
    this._dialog = /** @type {HTMLElement} */ (shadow.querySelector('.settings__dialog'))

    this._backdrop.addEventListener('click', () => this._close())
  }

  connectedCallback() {
    markKind(this, 'settings', true)
    this._watchInputs()
  }

  get store() { return this._store }
  set store(val) {
    // Remove old listener
    if (this._store && this._storeListener) {
      this._store.removeEventListener('change', this._storeListener)
    }
    this._store = val || null
    // Add new listener
    if (this._store) {
      this._storeListener = () => this._render()
      this._store.addEventListener('change', this._storeListener)
    }
    if (this.open) this._render()
  }

  get inputs() { return this._inputs }
  set inputs(val) {
    this._inputs = val || []
    if (this.isConnected) this._watchInputs()
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
    if (name === 'open') {
      if (newVal !== null) {
        this._recording = null
        this._conflict = null
        this._render()
      } else {
        this._stopRecording()
      }
    }
  }

  disconnectedCallback() {
    this._stopRecording()
    for (const stop of this._unwatch) stop()
    this._unwatch = []
    if (this._store && this._storeListener) {
      this._store.removeEventListener('change', this._storeListener)
    }
  }

  _watchInputs() {
    for (const stop of this._unwatch) stop()
    this._unwatch = this._inputs.flatMap((i) => i.watch ? [i.watch(this._availabilityChanged)] : [])
  }

  _close() {
    this._stopRecording()
    this.open = false
    this.dispatchEvent(new CustomEvent('close'))
  }

  /**
   * The effective bindings for a command (overrides merged with schema), by field
   * @param {string} commandId
   * @returns {Record<string, string[]>}
   */
  _getBindings(commandId) {
    const binding = /** @type {Record<string, unknown> | undefined} */ (this._store?.get()[commandId])
    /** @type {Record<string, string[]>} */
    const out = {}
    for (const input of this._inputs) {
      const list = /** @type {string[] | undefined} */ (binding?.[input.field])
      out[input.field] = list ? [...list] : []
    }
    return out
  }

  /**
   * Save binding changes, cleaning up overrides that match defaults
   * @param {string} commandId
   * @param {Record<string, string[]>} newBindings
   */
  _saveBindings(commandId, newBindings) {
    if (!this._store) return
    const schemaDef = /** @type {Record<string, unknown> | undefined} */ (this._store.schema[commandId])
    if (!schemaDef) return

    const overrides = { ...this._store.getOverrides() }
    /** @type {Record<string, string[]>} */
    const changed = {}
    for (const [field, list] of Object.entries(newBindings)) {
      if (!arraysEqual(list, /** @type {string[] | undefined} */ (schemaDef[field]) ?? [])) changed[field] = list
    }
    if (Object.keys(changed).length === 0) delete overrides[commandId]
    else overrides[commandId] = changed

    this._store.save(overrides)
    this.dispatchEvent(new CustomEvent('change', { detail: { commandId, bindings: newBindings } }))
  }

  /**
   * @param {string} commandId
   * @param {Input} input
   * @param {number | null} index - null for adding, number for replacing
   */
  _startRecording(commandId, input, index) {
    this._stopRecording()
    this._recording = { commandId, input, index }
    this._conflict = null
    this._record()

    /** @param {Event} e */
    const escape = (e) => {
      if (/** @type {KeyboardEvent} */ (e).key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      this._stopRecording()
      this._render()
    }
    window.addEventListener('keydown', escape, true)
    this._escapeHandler = escape
    this._render()
  }

  // (Re)starts the input's recorder, for a press or a release as the switches say
  _record() {
    this._stopRecorder?.()
    this._stopRecorder = null
    const input = this._recording?.input
    if (!input?.record) return
    /** @param {Event} e */
    const ignore = (e) => this._toggles.some((t) => e.composedPath().includes(t))
    this._stopRecorder = input.record({ release: this._recordSuffix === RELEASE_SUFFIX, ignore }, (b) => this._recorded(b))
  }

  _stopRecording() {
    this._stopRecorder?.()
    this._stopRecorder = null
    if (this._escapeHandler) {
      window.removeEventListener('keydown', this._escapeHandler, true)
      this._escapeHandler = null
    }
    clearTimeout(this._stepTimer)
    this._recording = null
    this._conflict = null
    this._recordSuffix = ''
    this._recordSequence = false
    this._steps = []
    this._toggles = []
  }

  /**
   * Switch what recording captures; choosing what's already chosen goes back to a press
   * @param {string} suffix - "", ":up", ":hold" or ":tap"
   */
  _setRecordSuffix(suffix) {
    this._recordSuffix = this._recordSuffix === suffix ? '' : suffix
    if (this._recordSuffix) this._recordSequence = false
    this._record()
    this._render()
  }

  _toggleSequence() {
    this._recordSequence = !this._recordSequence
    if (this._recordSequence) this._recordSuffix = ''
    this._steps = []
    clearTimeout(this._stepTimer)
    this._record()
    this._render()
  }

  // How long recording a sequence waits after a step before taking the steps so far
  static SEQUENCE_PAUSE = 1000

  /**
   * A binding was recorded: one step of a sequence, or the whole binding
   * @param {string} binding
   */
  _recorded(binding) {
    const input = /** @type {Input} */ (this._recording?.input)
    // A binding that can't be held or tapped (a scroll) isn't one to record while that's asked for
    if (this._recordSuffix && input.release && !input.release(binding)) return
    const full = this._recordSuffix && this._recordSuffix !== RELEASE_SUFFIX ? binding + this._recordSuffix : binding
    if (!this._recordSequence) return this._handleRecordedBinding(full)
    this._steps.push(binding)
    clearTimeout(this._stepTimer)
    this._stepTimer = setTimeout(() => this._finishSequence(), KeybindSettings.SEQUENCE_PAUSE)
    this._record()
    this._render()
  }

  // Takes the steps recorded so far as the binding
  _finishSequence() {
    clearTimeout(this._stepTimer)
    if (this._steps.length === 0) return
    this._handleRecordedBinding(this._steps.join(' '))
  }

  /**
   * Switch a stored binding to another form of it: its release, or inverted
   * @param {string} commandId
   * @param {Input} input
   * @param {number} index
   * @param {string} flipped
   */
  _flip(commandId, input, index, flipped) {
    if (this._store) {
      const conflict = findConflict(this._store.get(), flipped, input, commandId)
      if (conflict) {
        this._stopRecording()
        this._recording = { commandId, input, index }
        this._conflict = { ...conflict, bindingStr: flipped, input, index, flip: true }
        this._render()
        return
      }
    }
    this._applyBinding(commandId, input, index, flipped)
  }

  /**
   * A switch inside the recording prompt
   * @param {string} name - Its part name: "release" gives "recording-release" and, while on, "recording-release-on"
   * @param {string} label
   * @param {boolean} on
   * @param {() => void} onClick
   * @returns {HTMLElement}
   */
  _renderToggle(name, label, on, onClick) {
    const toggle = document.createElement('button')
    toggle.className = `settings__recording-${name}`
    toggle.setAttribute('part', on ? `recording-${name} recording-${name}-on` : `recording-${name}`)
    toggle.setAttribute('aria-pressed', String(on))
    toggle.textContent = label
    toggle.addEventListener('click', onClick)
    this._toggles.push(toggle)
    return toggle
  }

  /** @param {string} bindingStr */
  _handleRecordedBinding(bindingStr) {
    if (!this._recording || !this._store) return
    const { commandId, input, index } = this._recording

    const conflict = findConflict(this._store.get(), bindingStr, input, commandId)
    if (conflict) {
      this._conflict = { ...conflict, bindingStr, input, index }
      this._render()
      return
    }

    this._applyBinding(commandId, input, index, bindingStr)
  }

  /**
   * @param {string} commandId
   * @param {Input} input
   * @param {number | null} index
   * @param {string} bindingStr
   */
  _applyBinding(commandId, input, index, bindingStr) {
    const bindings = this._getBindings(commandId)
    const list = bindings[input.field] ?? []
    if (index !== null) list[index] = bindingStr
    else list.push(bindingStr)
    bindings[input.field] = list
    this._stopRecording()
    this._saveBindings(commandId, bindings)
  }

  _acceptConflict() {
    if (!this._conflict || !this._recording || !this._store) return
    const { commandId: conflictCmdId, bindingStr, input } = this._conflict
    const { commandId, index } = this._recording

    // Remove conflicting binding from the other command
    const conflictBindings = this._getBindings(conflictCmdId)
    const lookup = bindingLookup(input, bindingStr)
    conflictBindings[input.field] = (conflictBindings[input.field] ?? []).filter((b) => {
      try {
        return bindingLookup(input, b) !== lookup
      } catch { return true }
    })
    this._saveBindings(conflictCmdId, conflictBindings)

    this._applyBinding(commandId, input, index, bindingStr)
  }

  _cancelConflict() {
    if (this._conflict?.flip) this._stopRecording()
    this._conflict = null
    this._render()
  }

  /**
   * @param {string} commandId
   * @param {Input} input
   * @param {number} index
   */
  _removeBinding(commandId, input, index) {
    const bindings = this._getBindings(commandId)
    bindings[input.field]?.splice(index, 1)
    this._saveBindings(commandId, bindings)
  }

  /** @param {string} commandId */
  _resetCommand(commandId) {
    if (!this._store) return
    const overrides = { ...this._store.getOverrides() }
    delete overrides[commandId]
    this._store.save(overrides)
    this.dispatchEvent(new CustomEvent('reset', { detail: { commandId } }))
  }

  _resetAll() {
    if (!this._store) return
    this._store.save({})
    this.dispatchEvent(new CustomEvent('reset', { detail: {} }))
  }

  _render() {
    if (!this._store) {
      this._dialog.replaceChildren()
      return
    }

    const schema = this._store.schema
    const merged = this._store.get()
    this._dialog.replaceChildren()

    // Header
    const header = document.createElement('div')
    header.className = 'settings__header'
    header.setAttribute('part', 'header')

    const title = document.createElement('div')
    title.className = 'settings__title'
    title.setAttribute('part', 'title')
    title.textContent = 'Keyboard Shortcuts'
    header.appendChild(title)

    const resetAll = document.createElement('button')
    resetAll.className = 'settings__reset-all'
    resetAll.setAttribute('part', 'reset-all')
    resetAll.textContent = 'Reset All'
    resetAll.addEventListener('click', () => this._resetAll())
    header.appendChild(resetAll)

    this._dialog.appendChild(header)

    // Group by category
    /** @type {Record<string, Array<{ id: string, label: string }>>} */
    const groups = {}
    for (const [id, val] of Object.entries(schema)) {
      const binding = /** @type {BindingSchema} */ (val)
      if (binding.hidden) continue
      const cat = binding.category || 'Other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push({ id, label: binding.label })
    }

    for (const [category, cmds] of Object.entries(groups)) {
      const group = document.createElement('div')
      group.className = 'settings__group'
      group.setAttribute('part', 'group')

      const groupTitle = document.createElement('div')
      groupTitle.className = 'settings__group-title'
      groupTitle.setAttribute('part', 'group-title')
      groupTitle.textContent = category
      group.appendChild(groupTitle)

      const list = document.createElement('ul')
      list.className = 'settings__list'
      list.setAttribute('part', 'list')

      for (const cmd of cmds) {
        const bindings = /** @type {Record<string, unknown> | undefined} */ (merged[cmd.id])
        const li = document.createElement('li')
        li.className = 'settings__item'
        li.setAttribute('part', 'item')

        // Label
        const label = document.createElement('span')
        label.className = 'settings__item-label'
        label.setAttribute('part', 'item-label')
        label.textContent = cmd.label
        li.appendChild(label)

        // Bindings container
        const bindingsEl = document.createElement('span')
        bindingsEl.className = 'settings__item-bindings'
        bindingsEl.setAttribute('part', 'item-bindings')

        // An axis's row holds its sources; a command's, its triggers
        const isAxis = Array.isArray(schema[cmd.id]?.axes)
        const inputs = this._inputs.filter((i) => !!i.axis === isAxis)
        for (const input of inputs) {
          const list = /** @type {string[] | undefined} */ (bindings?.[input.field]) ?? []
          for (let i = 0; i < list.length; i++) {
            bindingsEl.appendChild(this._renderBinding(cmd.id, input, i, /** @type {string} */ (list[i])))
          }
        }

        // Check if recording for this command (add mode)
        const isRecordingAdd = this._recording &&
          this._recording.commandId === cmd.id &&
          this._recording.index === null

        if (isRecordingAdd) {
          bindingsEl.appendChild(this._renderRecording())
          if (this._conflict) bindingsEl.appendChild(this._renderConflict())
        }

        if (!this._recording) {
          const addBtn = document.createElement('span')
          addBtn.className = 'settings__item-add'
          addBtn.setAttribute('part', 'item-add')
          for (const input of inputs) {
            if (!input.record || (input.available && !input.available())) continue
            const btn = document.createElement('button')
            btn.setAttribute('part', `add-${input.label.toLowerCase()}`)
            btn.textContent = `+ ${input.label}`
            btn.addEventListener('click', () => this._startRecording(cmd.id, input, null))
            addBtn.appendChild(btn)
          }
          bindingsEl.appendChild(addBtn)
        }

        li.appendChild(bindingsEl)

        // Reset button
        const resetBtn = document.createElement('button')
        resetBtn.className = 'settings__item-reset'
        resetBtn.setAttribute('part', 'item-reset')
        resetBtn.textContent = 'Reset'
        resetBtn.addEventListener('click', () => this._resetCommand(cmd.id))
        li.appendChild(resetBtn)

        list.appendChild(li)
      }

      group.appendChild(list)
      this._dialog.appendChild(group)
    }
  }

  /**
   * What's shown while recording: the input's prompt, or the steps so far, and switches for what
   * to record: a release, hold or tap instead of a press, or several steps
   * @returns {HTMLElement}
   */
  _renderRecording() {
    const input = /** @type {Input} */ (this._recording?.input)
    const wrapper = document.createElement('span')
    wrapper.className = 'settings__binding settings__binding--recording'
    wrapper.setAttribute('part', 'binding binding-recording')
    const overlay = document.createElement('span')
    overlay.className = 'settings__recording-overlay'
    overlay.setAttribute('part', 'recording-overlay')
    overlay.textContent = this._steps.length > 0
      ? `${formatBinding(input, this._steps.join(' ')).join(' ')} then...`
      : input.prompt?.(this._recordSuffix === RELEASE_SUFFIX) ?? 'Waiting...'
    wrapper.appendChild(overlay)
    this._toggles = []
    const suffix = this._recordSuffix
    if (this.releases && input.release) {
      wrapper.appendChild(this._renderToggle('release', 'Release', suffix === RELEASE_SUFFIX, () => this._setRecordSuffix(RELEASE_SUFFIX)))
    }
    if (this.holds && input.release) {
      wrapper.appendChild(this._renderToggle('hold', 'Hold', suffix === ':hold', () => this._setRecordSuffix(':hold')))
      wrapper.appendChild(this._renderToggle('tap', 'Tap', suffix === ':tap', () => this._setRecordSuffix(':tap')))
    }
    if (this.sequences && !input.axis) {
      wrapper.appendChild(this._renderToggle('sequence', 'Steps', this._recordSequence, () => this._toggleSequence()))
    }
    if (this._steps.length > 0) {
      wrapper.appendChild(this._renderToggle('done', 'Done', false, () => this._finishSequence()))
    }
    return wrapper
  }

  /**
   * @param {string} commandId
   * @param {Input} input
   * @param {number} index
   * @param {string} bindingStr
   * @returns {HTMLElement}
   */
  _renderBinding(commandId, input, index, bindingStr) {
    const isRecording = this._recording &&
      this._recording.commandId === commandId &&
      this._recording.input === input &&
      this._recording.index === index

    if (isRecording) {
      if (!this._conflict?.flip) return this._withConflict(this._renderRecording())
      const wrapper = document.createElement('span')
      wrapper.className = 'settings__binding settings__binding--recording'
      wrapper.setAttribute('part', 'binding binding-recording')
      wrapper.appendChild(this._renderConflict())
      return wrapper
    }

    const binding = document.createElement('span')
    binding.className = 'settings__binding'
    binding.setAttribute('part', 'binding')

    const keysContainer = document.createElement('span')
    keysContainer.className = 'settings__binding-keys'
    keysContainer.setAttribute('part', 'binding-keys')

    for (const part of formatBinding(input, bindingStr)) {
      const kbd = document.createElement('kbd')
      kbd.className = 'settings__binding-key'
      kbd.setAttribute('part', 'binding-key')
      kbd.textContent = part
      keysContainer.appendChild(kbd)
    }
    keysContainer.addEventListener('click', () => this._startRecording(commandId, input, index))
    binding.appendChild(keysContainer)

    if (input.invert) {
      const inverted = bindingStr.trim().startsWith('-')
      const invertBtn = document.createElement('button')
      invertBtn.className = 'settings__binding-release'
      invertBtn.setAttribute('part', inverted ? 'binding-invert binding-invert-on' : 'binding-invert')
      invertBtn.setAttribute('aria-pressed', String(inverted))
      invertBtn.textContent = 'Invert'
      invertBtn.addEventListener('click', () => {
        this._flip(commandId, input, index, inverted ? bindingStr.trim().slice(1) : `-${bindingStr.trim()}`)
      })
      binding.appendChild(invertBtn)
    }

    const isRelease = splitRelease(bindingStr.toLowerCase()).release
    if (this.releases && input.release && (isRelease || input.release(bindingStr))) {
      const releaseBtn = document.createElement('button')
      releaseBtn.className = 'settings__binding-release'
      releaseBtn.setAttribute('part', isRelease ? 'binding-release binding-release-on' : 'binding-release')
      releaseBtn.setAttribute('aria-pressed', String(isRelease))
      releaseBtn.textContent = 'Release'
      releaseBtn.addEventListener('click', () => this._flip(commandId, input, index, flipRelease(bindingStr)))
      binding.appendChild(releaseBtn)
    }

    const removeBtn = document.createElement('button')
    removeBtn.className = 'settings__binding-remove'
    removeBtn.setAttribute('part', 'binding-remove')
    removeBtn.textContent = '×'
    removeBtn.addEventListener('click', () => this._removeBinding(commandId, input, index))
    binding.appendChild(removeBtn)

    return binding
  }

  /**
   * @param {HTMLElement} el
   * @returns {HTMLElement}
   */
  _withConflict(el) {
    if (this._conflict) el.appendChild(this._renderConflict())
    return el
  }

  /** @returns {HTMLElement} */
  _renderConflict() {
    const conflict = /** @type {NonNullable<typeof this._conflict>} */ (this._conflict)
    const conflictEl = document.createElement('span')
    conflictEl.className = 'settings__conflict'
    conflictEl.setAttribute('part', 'conflict')
    conflictEl.textContent = `Already bound to "${conflict.label}". `

    const acceptBtn = document.createElement('button')
    acceptBtn.setAttribute('part', 'conflict-accept')
    acceptBtn.textContent = 'Replace'
    acceptBtn.addEventListener('click', () => this._acceptConflict())
    conflictEl.appendChild(acceptBtn)

    const cancelBtn = document.createElement('button')
    cancelBtn.setAttribute('part', 'conflict-cancel')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.addEventListener('click', () => this._cancelConflict())
    conflictEl.appendChild(cancelBtn)

    return conflictEl
  }
}

/**
 * Check if two string arrays are equal
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
function arraysEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
