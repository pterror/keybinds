import { GlobalWindow } from 'happy-dom'

const window = new GlobalWindow()

const globals = [
  'HTMLElement', 'CustomEvent', 'KeyboardEvent', 'MouseEvent',
  'document', 'localStorage', 'navigator', 'customElements',
]

for (const key of globals) {
  if (globalThis[key] === undefined) {
    globalThis[key] = window[key]
  }
}
