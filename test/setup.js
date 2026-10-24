import { GlobalWindow } from 'happy-dom'

const window = new GlobalWindow()

// Everything the DOM touches has to come from the same window: happy-dom's elements reject events
// made by Bun's own Event classes (and newer happy-dom versions check this strictly). So these
// always replace what the runtime provides, rather than only filling gaps.
const globals = [
  'window', 'document', 'navigator', 'localStorage', 'customElements',
  'HTMLElement', 'Element', 'Node', 'EventTarget',
  'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'WheelEvent', 'PointerEvent', 'FocusEvent',
  'requestAnimationFrame', 'cancelAnimationFrame',
]

for (const key of globals) {
  globalThis[key] = window[key]
}
