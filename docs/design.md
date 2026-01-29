# Design Notes

## Why keybinds has a settings UI but not a general settings UI

A general-purpose settings component doesn't make sense as a library in this style. Here's why.

### Settings UIs are almost entirely opinion

The hard part of a settings UI is layout, grouping, responsive behavior, visual hierarchy, and information architecture. The data model is trivial: key-value pairs with types. Every framework already has form primitives (`<input>`, `<select>`, `<textarea>`). The real challenge is deciding *what goes where* — and that's entirely application-specific.

A library that tries to solve this either:
- Ships an opinionated layout that won't match your app (useless)
- Ships a headless data layer for something trivially simple (pointless)

### `<keybind-settings>` works because the scope is locked

Keybind settings are different. The library owns the data model: binding strings, conflict detection, recording state machines, `$mod` normalization, modifier parsing. This is genuinely hard to get right and users shouldn't have to reimplement it.

The UI surface is also constrained: show bindings, let users record new ones, handle conflicts. There's one right way to do it (record → detect conflict → resolve or cancel). The component can be unstyled via `::part()` selectors without losing its value.

### Contrast with the keybinds library itself

The keybinds library succeeds for the same reason: the hard part is the data model (key combos, modifier normalization, context conditions, conflict detection, event dispatch) and the UI is minimal (a few `<kbd>` elements, a search input). The complexity is in the engine, not the presentation.

A settings library would be the inverse: trivial engine, complex presentation. That's a bad fit for a zero-dependency library.
