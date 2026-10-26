import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { CommandHub } from './hub.js'
import { ALL, COMPONENTS } from './test-helpers.js'

describe('CommandHub', () => {
  beforeEach(() => localStorage.clear())

  /** @param {Partial<import('./index.js').Command>} extra */
  const cmd = (extra = {}) => ({ id: 'save', label: 'Save', keys: ['ctrl+s'], execute: mock(() => {}), ...extra })
  const press = (/** @type {EventTarget} */ t) => t.dispatchEvent(new KeyboardEvent('keydown', { key: 's', code: 'KeyS', ctrlKey: true }))

  test('rebindings can be kept in custom storage, per scope', () => {
    /** @type {Record<string, import('./index.js').BindingOverrides>} */
    const kept = {}
    const hub = new CommandHub({ ...ALL,
      listen: { target: document.createElement('div') },
      storage: (scope) => ({ load: () => kept[scope] ?? {}, save: (o) => { kept[scope] = o } }),
    })
    hub.setSource('a', () => [cmd()])
    hub.setScope('game')
    hub.refresh()
    hub.store?.save({ save: { keys: ['ctrl+shift+s'] } })
    expect(kept).toEqual({ game: { save: { keys: ['ctrl+shift+s'] } } })
    expect(localStorage.length).toBe(0)
    hub.destroy()
  })

  test('commands from every source fire on their keys, and the first source wins an id', () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target } })
    const mine = cmd()
    const theirs = cmd({ label: 'Other save' })
    hub.setSource('a', () => [mine])
    hub.setSource('b', () => [theirs])
    hub.refresh()
    press(target)
    expect(mine.execute).toHaveBeenCalledTimes(1)
    expect(theirs.execute).not.toHaveBeenCalled()
    expect(hub.get('save')?.label).toBe('Save')
    hub.destroy()
  })

  test("a person's rebinding takes effect at once and is kept per scope", () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target } })
    const save = cmd()
    hub.setSource('a', () => [save])
    hub.refresh()
    hub.store?.save({ save: { keys: ['ctrl+d'] } })
    press(target)
    expect(save.execute).not.toHaveBeenCalled()
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', ctrlKey: true }))
    expect(save.execute).toHaveBeenCalledTimes(1)
    expect(hub.bindingsFor('save', 'keys')).toEqual(['Ctrl+D'])
    hub.setScope('other')
    hub.refresh()
    expect(hub.bindingsFor('save', 'keys')).toEqual(['Ctrl+S'])
    hub.destroy()
  })

  test('one unreadable binding leaves the others working', () => {
    const target = document.createElement('div')
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target } })
    const save = cmd()
    const broken = cmd({ id: 'broken', keys: ['ctrl+notakey'] })
    const error = console.error
    console.error = () => {}
    hub.setSource('a', () => [broken, save])
    hub.refresh()
    console.error = error
    press(target)
    expect(save.execute).toHaveBeenCalledTimes(1)
    expect(hub.bindingsFor('broken', 'keys')).toEqual([])
    hub.destroy()
  })

  test('adapt turns other definitions into commands', () => {
    const target = document.createElement('div')
    const ran = mock(() => {})
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target }, adapt: (/** @type {any} */ d) => ({ ...d, execute: d.run }) })
    hub.setSource('a', () => [{ id: 'save', label: 'Save', keys: ['ctrl+s'], run: ran }])
    hub.refresh()
    press(target)
    expect(ran).toHaveBeenCalledTimes(1)
    expect(hub.run('save')).toBe(true)
    expect(ran).toHaveBeenCalledTimes(2)
    hub.destroy()
  })

  test('command buttons run their command and are disabled while it is unavailable', () => {
    let available = false
    const hub = new CommandHub({ ...ALL, storageKey: 't', listen: { target: document.createElement('div') } })
    const save = cmd({ when: () => available })
    hub.setSource('a', () => [save])
    hub.refresh()
    const bar = document.createElement('div')
    const button = document.createElement('button')
    button.dataset['command'] = 'save'
    bar.appendChild(button)
    const stop = hub.bindButtons(bar)
    expect(button.disabled).toBe(true)
    available = true
    hub.syncContext()
    expect(button.disabled).toBe(false)
    button.click()
    expect(save.execute).toHaveBeenCalledTimes(1)
    stop()
    hub.destroy()
  })

  test('with a host, it makes the components and keeps them in step', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const hub = new CommandHub({ ...ALL, components: COMPONENTS, storageKey: 't', host, listen: { target: document.createElement('div') } })
    hub.setSource('a', () => [cmd(), cmd({ id: 'secret', label: 'Secret', hidden: true })])
    hub.refresh()
    expect(hub.palette?.commands.map((c) => c.id)).toEqual(['save'])
    expect(hub.settings?.store).toBe(hub.store)
    expect(host.querySelectorAll('[data-keybinds]').length).toBe(4)
    hub.destroy()
    host.remove()
  })

  test('closing the palette gives focus back to where it was', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const hub = new CommandHub({ ...ALL, components: COMPONENTS, storageKey: 't', host, listen: { target: document.createElement('div') } })
    const editor = document.createElement('textarea')
    document.body.appendChild(editor)
    editor.focus()
    hub.openPalette()
    const palette = /** @type {any} */ (hub.palette)
    palette._input.focus()
    palette._close()
    expect(document.activeElement).toBe(editor)
    hub.destroy()
    host.remove()
    editor.remove()
  })

  test('an open menu or palette keeps the context it was opened in', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const hub = new CommandHub({ ...ALL, components: COMPONENTS, storageKey: 't', host, listen: { target: document.createElement('div') } })
    let editing = true
    hub.addContext(() => ({ editing }))
    hub.setSource('a', () => [cmd({ menu: 'text' })])
    hub.refresh()
    hub.openMenu('text', 0, 0)
    hub.openPalette()
    // Focus moved into them, so nothing is being edited any more
    editing = false
    hub.syncContext()
    expect(hub.menu?.context).toEqual({ editing: true })
    expect(hub.palette?.context).toEqual({ editing: true })
    expect(hub.cheatsheet?.context).toEqual({ editing: false })
    hub.menu && (hub.menu.open = false)
    hub.syncContext()
    expect(hub.menu?.context).toEqual({ editing: false })
    hub.destroy()
    host.remove()
  })
})
