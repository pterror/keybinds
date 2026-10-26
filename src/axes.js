/**
 * Axes: continuous input read every frame, from mouse movement ("mouse:x"), sticks and triggers
 * ("pad:rx", "pad:lt") or a pair of keys ("keys:a/d"). A leading "-" inverts a source. Showing
 * and recording them is keybinds/axes-ui.
 */

import { NO_MODS, isActive, anyOverlayOpen, inInput } from './core.js'
import { parseKey, keyToLookup, eventToKeyLookups } from './keys.js'

/** @typedef {import('./core.js').Input} Input */
/** @typedef {import('./core.js').AxisDef} AxisDef */
/** @typedef {import('./core.js').AxisValue} AxisValue */
/** @typedef {import('./keys.js').ParsedKey} ParsedKey */

export const PAD_AXES = ['lx', 'ly', 'rx', 'ry', 'lt', 'rt']
const DEADZONE = 0.15

/**
 * Where an axis's value comes from: mouse movement, a stick or trigger, or a pair of keys
 * (the first pushes toward -1, the second toward 1). `invert` flips it.
 * @typedef {{ kind: 'mouse' | 'pad', source: string, invert: boolean }
 *   | { kind: 'keys', neg: ParsedKey, pos: ParsedKey, invert: boolean }} ParsedAxis
 */

/**
 * Parse an axis binding: "mouse:x", "pad:rx", "keys:a/d", with a leading "-" to invert
 * @param {string} binding
 * @param {import("./keys.js").KeySyntax[]} [syntax] - For key pairs, as for keys()
 * @returns {ParsedAxis}
 * @throws {Error} if the binding is invalid
 */
export function parseAxis(binding, syntax = []) {
  if (!binding || typeof binding !== 'string') {
    throw new Error(`Invalid axis binding: ${binding}`)
  }
  let body = binding.trim().toLowerCase()
  const invert = body.startsWith('-')
  if (invert) body = body.slice(1)
  const colon = body.indexOf(':')
  const kind = body.slice(0, colon)
  const rest = body.slice(colon + 1)
  if (kind === 'mouse' && (rest === 'x' || rest === 'y')) return { kind, source: rest, invert }
  if (kind === 'pad' && PAD_AXES.includes(rest)) return { kind, source: rest, invert }
  if (kind === 'keys') {
    const [neg, pos, ...extra] = rest.split('/')
    if (neg && pos && extra.length === 0) {
      const parsedNeg = parseKey(neg, syntax)
      const parsedPos = parseKey(pos, syntax)
      return { kind, neg: { ...parsedNeg, mods: NO_MODS }, pos: { ...parsedPos, mods: NO_MODS }, invert }
    }
  }
  throw new Error(`Unknown axis "${binding}". Valid: mouse:x, mouse:y, pad:${PAD_AXES.join(', pad:')}, keys:<key>/<key>, each with an optional leading "-" to invert`)
}

/**
 * Normalized form of an axis binding, without its inversion
 * @param {ParsedAxis} parsed
 * @returns {string}
 */
export function axisToLookup(parsed) {
  if (parsed.kind === 'keys') return `keys:${keyToLookup(parsed.neg)}/${keyToLookup(parsed.pos)}`
  return `${parsed.kind}:${parsed.source}`
}

export const hasPads = () => typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'

/**
 * A stick or trigger, summed over every connected pad. Sticks ignore small drift around the middle
 * @param {string} source
 */
function padAxis(source) {
  if (!hasPads()) return 0
  let sum = 0
  for (const pad of navigator.getGamepads()) {
    if (!pad) continue
    if (source === 'lt' || source === 'rt') {
      sum += pad.buttons[source === 'lt' ? 6 : 7]?.value ?? 0
      continue
    }
    const v = pad.axes[PAD_AXES.indexOf(source)] ?? 0
    if (Math.abs(v) > DEADZONE) sum += Math.sign(v) * (Math.abs(v) - DEADZONE) / (1 - DEADZONE)
  }
  return sum
}

/**
 * Axes, read with `axis(id)` on what keybinds() returns
 * @param {...import("./keys.js").KeySyntax} syntax - For key pairs, as for keys()
 * @returns {Input}
 */
export function axes(...syntax) {
  return {
    field: 'axes',
    axis: true,
    parse(binding, suffix) {
      if (suffix) throw new Error(`Axes have no "${suffix}": "${binding}${suffix}"`)
      return { lookup: axisToLookup(parseAxis(binding, syntax)), loose: '', mods: NO_MODS }
    },
    listen(d) {
      /** @type {Map<string, { def: AxisDef, sources: ParsedAxis[] }>} */
      const defs = new Map()
      for (const def of d.axes) {
        try {
          defs.set(def.id, { def, sources: def.axes.map((b) => parseAxis(b, syntax)) })
        } catch (e) {
          throw new Error(`Axis "${def.id}": ${e instanceof Error ? e.message : String(e)}`)
        }
      }
      /** Keys down right now, by their unmodified lookups */
      /** @type {Map<string, string[]>} */
      const downKeys = new Map()
      // Mouse movement so far; each axis remembers where it was when it was last read
      const mouseTotal = { x: 0, y: 0 }
      /** @type {Map<string, { x: number, y: number }>} */
      const mouseRead = new Map()

      /** @param {Event} e */
      const onDown = (e) => {
        const event = /** @type {KeyboardEvent} */ (e)
        if (!inInput(event.target)) downKeys.set(event.code || event.key, eventToKeyLookups(event, '', '', syntax))
      }
      /** @param {Event} e */
      const onUp = (e) => {
        const event = /** @type {KeyboardEvent} */ (e)
        downKeys.delete(event.code || event.key)
      }
      const onBlur = () => downKeys.clear()
      /** @param {Event} e */
      const onMove = (e) => {
        const event = /** @type {MouseEvent} */ (e)
        mouseTotal.x += event.movementX ?? 0
        mouseTotal.y += event.movementY ?? 0
      }

      /** @param {ParsedKey} key */
      const keyDown = (key) => {
        const l = keyToLookup(key)
        for (const lookups of downKeys.values()) if (lookups.includes(l)) return true
        return false
      }

      /**
       * An axis's value right now. Reading it takes the mouse movement since its last read
       * @param {string} id
       * @returns {AxisValue}
       */
      function axis(id) {
        const entry = defs.get(id)
        const last = mouseRead.get(id) ?? { x: 0, y: 0 }
        mouseRead.set(id, { ...mouseTotal })
        if (!entry || !isActive(entry.def, d.context()) || anyOverlayOpen()) return { position: 0, delta: 0 }
        let position = 0
        let delta = 0
        for (const src of entry.sources) {
          const sign = src.invert ? -1 : 1
          if (src.kind === 'mouse') delta += sign * (src.source === 'x' ? mouseTotal.x - last.x : mouseTotal.y - last.y)
          else if (src.kind === 'pad') position += sign * padAxis(src.source)
          else if (src.kind === 'keys') position += sign * ((keyDown(src.pos) ? 1 : 0) - (keyDown(src.neg) ? 1 : 0))
        }
        return { position: Math.max(-1, Math.min(1, position)), delta }
      }

      const opts = { capture: d.capture }
      d.target.addEventListener('keydown', onDown, opts)
      d.target.addEventListener('keyup', onUp, opts)
      d.target.addEventListener('mousemove', onMove, opts)
      const focusTarget = typeof window !== 'undefined' ? window : d.target
      focusTarget.addEventListener('blur', onBlur)
      return Object.assign(() => {
        d.target.removeEventListener('keydown', onDown, opts)
        d.target.removeEventListener('keyup', onUp, opts)
        d.target.removeEventListener('mousemove', onMove, opts)
        focusTarget.removeEventListener('blur', onBlur)
      }, { axis })
    },
  }
}
