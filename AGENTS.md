# AGENTS.md

Platen is an Obsidian desktop plugin with one mode, zen, that merges typewriter scrolling, sentence dimming and a full-window overlay.

## Source of truth

`SPEC.md` defines v1. Do not add anything from its "Out of scope for v1" list. If the spec turns out to be wrong or impossible against the real Obsidian API, stop and ask instead of improvising.

## Commands

```sh
vp install          # pnpm, through Vite+
pnpm build          # type-check, then bundle main.js with vp pack
pnpm test           # unit tests (vp test)
vp check            # format, lint (incl. 32 obsidianmd rules) and type-check
pnpm lint:obsidian  # ESLint with Obsidian's exact review rule set; run before a release
```

Never reintroduce npm or esbuild. `SPEC.md` is excluded from formatting.

## Layout

- `src/main.ts`: the plugin. Owns the zen session (enter, exit, Esc scope, owned fullscreen, Reading view restore) and the workspace events that end it.
- `src/editor.ts`: the CodeMirror extension. One `StateField` holds the zen state of an editor and is non-null only in the zen editor; typewriter scroll, padding and dimming all read it.
- `src/settings.ts`: settings, parsed at the boundary, and the settings tab.
- `src/highlight-sentence.ts`: vendored from davisriedel/obsidian-typewriter-mode (MIT). Keep its license header; change it only to re-sync with upstream.

## Invariants (each one was verified in Obsidian; do not regress)

- The typewriter scroll rides in the same transaction as the edit (`EditorState.transactionExtender`). Never scroll in a later frame; it jitters.
- Measure only inside `view.requestMeasure`. Never dispatch inside `update()` or a measure callback; defer with `window.setTimeout`.
- Recentre only on `input`, `delete`, `undo`, `redo` and keyboard `select`. Never on `select.pointer` or `input.type.compose`.
- Padding goes through `EditorView.contentAttributes`, not inherited CSS variables, so nested table-cell editors never get it.
- Only the zen editor ever receives `setZen`; table-cell editors stay inert by construction.
- The workspace layout is never touched. Zen is never persisted. Fullscreen is exited only if Platen entered it.
- `syncEditor()` is idempotent and is the one path that applies zen to an editor; a new editor state (file switch in the same leaf) re-applies it.

## Obsidian plugin guidelines

The review rejects releases that break these. `vp check` and `pnpm lint:obsidian` catch most of them.

- Use `this.app`, never a global `app`. Prefer `activeDocument` / `activeWindow` or the element's own `ownerDocument`.
- Register listeners with `registerEvent` / `registerDomEvent`; anything else `onload` changes, `onunload` undoes.
- No `element.style.x = ...`: static styles go in `styles.css`, dynamic ones through `setCssProps`. No `innerHTML`.
- No default hotkeys, no plugin name in command names, sentence case in UI text.
- `console` only for warn, error and debug.
- `electronWindow` and `editor.cm` are undocumented: feature-detect and guard every use.

## Verifying in Obsidian

Unit tests cover the parser and padding math only; behaviour needs a real vault (the test vault is `Sandbox`). To drive Obsidian, quit it and relaunch with `open -a Obsidian --args --remote-debugging-port=9333`, then `agent-browser connect 9333` and switch to the Sandbox tab. macOS native menus block Obsidian's main process while open, so close any context menu before testing fullscreen. Relaunch Obsidian normally afterwards to close the debug port.

## Working rules

- Code, comments, docs and commit messages in English. Conventional Commits, no AI attribution lines.
- May do without asking: refactors with no behaviour change, tests, docs, tooling.
- Must ask: anything user-visible (settings, CSS, copy, UX), scope changes, version bumps.
- Never: push, tag, or create releases.
