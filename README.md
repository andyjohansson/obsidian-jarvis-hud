# Obsidian Jarvis HUD

A sci-fi HUD look for [Obsidian](https://obsidian.md), inspired by the holographic interfaces in the Iron Man and Avengers films. Cyan glow, a faint grid, angular headings and HUD-cornered callouts, built as CSS snippets on top of the [Minimal](https://github.com/kepano/obsidian-minimal) theme.

![Jarvis HUD preview](screenshots/preview.png)

## What it does

- Near-black, blue-tinted background with arc-reactor cyan (`#00D8FF`) as accent and gold for highlights and warnings
- Faint HUD grid and a soft glow from the top of the editor
- Uppercase headings in Rajdhani, glowing H1 and inline title, cyan marker on H2
- Callouts with HUD corner brackets in each callout's own color
- Square, glowing checkboxes, outlined tags, HUD-style table headers and properties
- Cyan accents on the active tab, active file and command palette
- A pulsing `● J.A.R.V.I.S. ONLINE` indicator in the status bar
- Dark mode only, light mode is left untouched

## Requirements

- Obsidian with the **Minimal** theme enabled
- Optional: the **Style Settings** plugin, for toggles
- Internet on first load for the Google Fonts (Rajdhani, JetBrains Mono). Falls back to system fonts offline.

## Installation

1. Copy the files in `snippets/` into your vault's `.obsidian/snippets/` folder.
2. In Obsidian, go to **Settings → Appearance → CSS snippets**, refresh, and enable `jarvis-hud` (and `jarvis-callouts` if you want it).
3. Make sure you are in dark mode.

## Files

| File | Purpose |
|---|---|
| `snippets/jarvis-hud.css` | The main HUD styling |
| `snippets/jarvis-callouts.css` | Custom callout types, e.g. `> [!calendar]` |

## Style Settings toggles

With Style Settings installed you get a **Jarvis HUD** section where you can turn off:

- the background grid
- the glow
- animations
- the status bar text

Animations are also turned off automatically if your OS has reduced motion enabled.

## Credits

Built on top of [Minimal](https://github.com/kepano/obsidian-minimal) by kepano. Not affiliated with Marvel or Disney, the name is a nod to the films.

## License

[MIT](LICENSE)
