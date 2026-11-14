# Platen

An Obsidian plugin with one writing mode, **zen**, that merges typewriter scrolling and a distraction-free overlay. Desktop only.

## Usage

Run **Toggle zen** from the command palette or click the ribbon icon. Press the command again, or `Esc`, to leave.

While zen is on:

- The active note covers the whole window. Sidebars, tabs and layout stay as they were underneath.
- The cursor line stays at a fixed height while you type or move with the keyboard. Clicks and drags never scroll. After a manual scroll, the page stays put until your next edit.
- Everything except the sentence under the cursor is dimmed. Dimming pauses while text is selected.
- Lines are limited to a maximum width.
- The note is set in the bundled iA Writer Quattro (optional). Code keeps its monospace font.
- The text can use its own size (optional).
- The window goes fullscreen (optional). Leaving zen exits fullscreen only if Platen entered it.

A note in Reading view switches to Live Preview on entry and back on exit. Zen ends when you close the note's tab or activate another one; opening another file in the same tab keeps it on. Zen is never restored after a restart.

`Esc` is ignored while a modal, menu, suggester or popover is open, during IME composition, and when Vim is in any mode other than normal.

## Settings

| Setting                                | Default |
| -------------------------------------- | ------- |
| Typewriter position (% of pane height) | 50      |
| Dimmed text opacity                    | 0.25    |
| Fullscreen on enter                    | on      |
| Max line width (ch, 0 = off)           | 65      |
| Use iA Writer Quattro                  | on      |
| Font size (px, 0 = editor size)        | 0       |

## Development

Requires [Vite+](https://viteplus.dev) (`vp`) and pnpm.

```sh
vp install
pnpm build   # type-check, then bundle main.js with vp pack
pnpm test    # unit tests (vp test)
pnpm dev     # rebuild on change
vp check     # format, lint (incl. Obsidian's review rules) and type-check
pnpm lint:obsidian  # Obsidian's exact review rule set (ESLint); run before a release
```

`pnpm build` also writes `styles.css` from `src/styles.css`, with the fonts in `fonts/` embedded.

To try it, copy `main.js`, `manifest.json` and `styles.css` into `<vault>/.obsidian/plugins/platen/` and enable Platen under Settings → Community plugins.

Pushing a tag such as `1.0.1` that matches `manifest.json` runs `.github/workflows/release.yml`, which checks, tests and builds the plugin, then publishes a GitHub release with `main.js`, `manifest.json` and `styles.css`.

## Credits

The sentence boundary parser in `src/highlight-sentence.ts` and its test are copied from [davisriedel/obsidian-typewriter-mode](https://github.com/davisriedel/obsidian-typewriter-mode) (MIT, Copyright (c) 2023-2026 Davis Riedel), which adapted it from [artisticat1/focus-active-sentence](https://github.com/artisticat1/focus-active-sentence).

The bundled iA Writer Quattro S font is Copyright © 2018 Information Architects Inc., based on IBM Plex (Copyright © 2017 IBM Corp.), and is licensed under the SIL Open Font License 1.1. Its notice and terms are in `fonts/LICENSE.md` and at the top of the built `styles.css`.
