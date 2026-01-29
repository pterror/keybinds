# Styling

Components use Shadow DOM with `::part()` selectors and BEM class names for styling flexibility.

## Quick Start

Import the optional stylesheet for reasonable defaults:

```js
import 'keybinds/styles/palette.css'
```

## Custom Styles with ::part()

Target shadow DOM elements using CSS `::part()`:

```css
command-palette::part(dialog) {
  background: #fff;
  border-radius: 12px;
}

command-palette::part(input) {
  font-size: 18px;
}

command-palette::part(item-active) {
  background: #0066cc;
  color: white;
}
```

## Command Palette Parts

| Part | Description |
|------|-------------|
| `palette` | Root container |
| `backdrop` | Overlay behind dialog |
| `dialog` | Main dialog box |
| `input` | Search input field |
| `list` | Results list (`<ul>`) |
| `item` | Individual result (`<li>`) |
| `item-active` | Currently selected item |
| `item-disabled` | Inactive command (failing `when`) |
| `item-label` | Command label text |
| `item-category` | Category badge |
| `item-key` | Keyboard shortcut (`<kbd>`) |
| `empty` | "No results" message |

## Cheatsheet Parts

| Part | Description |
|------|-------------|
| `cheatsheet` | Root container |
| `backdrop` | Overlay behind dialog |
| `dialog` | Main dialog box |
| `group` | Category group container |
| `group-title` | Category heading |
| `list` | Commands list (`<ul>`) |
| `item` | Individual command (`<li>`) |
| `item-disabled` | Inactive command |
| `item-label` | Command label text |
| `item-keys` | Container for key badges |
| `item-key` | Individual key (`<kbd>`) |

## BEM Classes

Inside shadow DOM, elements have BEM class names matching their parts:

```
.palette
.palette__backdrop
.palette__dialog
.palette__input
.palette__list
.palette__item
.palette__item--active
.palette__item--disabled
...
```

These are useful if you're styling via JavaScript or inspecting elements.

## Example: Light Theme

```css
command-palette::part(backdrop) {
  background: rgba(0, 0, 0, 0.3);
}

command-palette::part(dialog) {
  background: #ffffff;
  border: 1px solid #e0e0e0;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

command-palette::part(input) {
  color: #333;
  border-bottom: 1px solid #e0e0e0;
}

command-palette::part(item) {
  color: #333;
}

command-palette::part(item-active) {
  background: #f0f0f0;
}

command-palette::part(item-key) {
  background: #f5f5f5;
  border-color: #ddd;
  color: #666;
}
```

## Example: Glassmorphic

```css
command-palette::part(dialog) {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}
```

## Positioning

Override default positioning:

```css
/* Center vertically */
command-palette::part(dialog) {
  top: 50%;
  transform: translate(-50%, -50%);
}

/* Bottom sheet on mobile */
@media (max-width: 600px) {
  command-palette::part(dialog) {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    transform: none;
    width: 100%;
    max-width: none;
    border-radius: 12px 12px 0 0;
  }
}
```
