# Platen — v1 spec

An Obsidian plugin that merges typewriter scrolling and zen mode into **one mode**.
Desktop only. Based on a review of 31 existing plugins (see "Prior art").

## User-facing behaviour

### One mode, one command
- Command `Toggle zen` (plus ribbon icon). No separate typewriter or dimming toggles:
  typewriter scroll and sentence dimming exist only while zen is on.
- Exit: the same command, or `Esc`.
  - `Esc` is ignored when a modal, menu, suggester or popover is open, while IME
    composition is active, or when Vim is in any mode other than normal.
- Zen state is **not** persisted. After a restart Obsidian opens normally.

### Entering zen
1. If the active leaf is not a markdown view, show a Notice and do nothing.
2. If the note is in Reading view, switch it to Live Preview and remember (in memory)
   that it must go back to Reading view on exit.
3. The active leaf is laid over the whole window (`position: fixed; inset: 0`).
   The workspace layout, sidebars and tabs are **not touched**, so nothing needs restoring.
   Modals, menus, the command palette and notices must stay above the overlay.
4. If the "Fullscreen" setting is on, put the window in native fullscreen
   (`electronWindow.setFullScreen(true)`), remembering whether the plugin turned it on.

### While in zen
- **Typewriter scroll**: the cursor line stays at the configured vertical position
  (percentage of the pane height, default 50%).
  - Recentre on keyboard-driven changes only: `input`, `delete`, `undo`, `redo`,
    keyboard `select`. Never on `select.pointer` (mouse clicks and drags).
  - Do not recentre during IME composition (`view.composing`).
  - After a manual scroll (wheel, scrollbar), pause recentring until the next edit.
  - Top/bottom padding so the first and last lines can reach the target position:
    top = H·offset, bottom = H·(1−offset), where H is the **pane** height (not `vh`).
- **Sentence dimming**: everything except the sentence under the cursor is dimmed
  (default opacity 0.25). Dimming is suspended while a non-empty selection exists.
- **Max line width** (default 65ch) applied only inside zen.
- **Font**: iA Writer Quattro S (bundled, SIL OFL 1.1) for the note text inside zen, when the
  setting is on. Code keeps the monospace font. Outside zen the editor font is untouched.
- If the user switches the leaf to Reading view while in zen, the overlay stays;
  typewriter and dimming simply do not apply there.

### Leaving zen
- Remove the overlay classes, restore Reading view if step 2 changed it, and exit fullscreen
  **only if the plugin entered it**.
- Also leave zen automatically when the zen leaf is closed or another leaf becomes active.
  Navigating to another file inside the same leaf keeps zen on.
- If the window leaves fullscreen by other means, zen stays on (it does not depend on fullscreen).

### Settings
| Setting | Default |
|---|---|
| Typewriter position (%) | 50 |
| Dimmed text opacity | 0.25 |
| Fullscreen on enter | on |
| Max line width (ch, 0 = off) | 65 |
| Use iA Writer Quattro | on |

## Out of scope for v1
Mobile, per-note/folder overrides, profiles, separate toggles, line/paragraph/gradient
dimming, current-line highlight, word count, sounds, Hemingway mode, paper/themes, other fonts or a font picker,
AI, integrations with other plugins, persisting zen across restarts, changing vault config
(`readableLineLength`, theme).

## Implementation notes (from the review)
- **No scroll jitter**: add the scroll as an effect of the same transaction via
  `EditorState.transactionExtender` + `EditorView.scrollIntoView(head, {y: "start", yMargin})`
  instead of scrolling in a later rAF (hexennacht/writing-mode). Do any measuring in
  `view.requestMeasure`, never `coordsAtPos` in `update()`.
- **Use `this.view`**, never `document.querySelector(".mod-active …")` (typewriter-mode bug).
- **Register the CM extension once** behind a `Compartment`/facet that is empty unless zen is on,
  and only for the zen editor.
- **Tables**: skip nested table-cell editors (`.table-cell-wrapper`); they break measurement.
- **Dimming**: opacity on a parent cannot be undone by a child, so dim with mark decorations
  over the *non-active* ranges, limited to `view.visibleRanges`. Do not use `:has()` on whole lines.
- **Sentence parser**: copy `src/cm6/highlight-sentence.ts` (+ its test) from
  davisriedel/obsidian-typewriter-mode (MIT) with attribution in the file header and README.
- **Esc**: push an Obsidian `Scope` on enter, pop it on exit. Check overlays that are actually
  visible, `isComposing`, and Vim state before exiting.
- **Fullscreen**: `electronWindow` is undocumented API; guard it and fall back to doing nothing.
- **Overlay z-index**: below Obsidian's modal/menu/notice layers (use its `--layer-*` variables).
- **Cleanup**: `onunload` must leave zen (remove classes, pop scope, exit owned fullscreen).

## Tests
- Sentence parser: the copied unit test.
- Padding/offset math: one small test for top/bottom padding at 0.33, 0.5, 0.7.
- Manual checklist: click does not recentre; typing recentres; table cell editing; Vim normal
  vs insert + Esc; IME composition (Japanese/Chinese input); command palette and quick switcher
  usable in zen; Reading view round-trip; fullscreen owned vs pre-existing.

## Prior art
- Typewriter: davisriedel/obsidian-typewriter-mode, deathau/cm-typewriter-scroll-obsidian,
  lijyze/scroll-offset, omeyenburg/obsidian-scrolling, marsuero/centerline.
- Zen: kepano/obsidian-hider, ryanpcmcquen/obsidian-focus-mode, marckfp/ultra-zen-mode,
  woodoffice/obsidian-minimo (overlay approach), hexennacht666/obsidian-writing-mode.
- Combos: aescanes/scribe-of-lagash-focus, zpzp13/obsidian-writing-menu.
