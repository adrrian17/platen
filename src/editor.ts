import { EditorState, type Range, StateEffect, StateField, type Text } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import { DEFAULT_SENTENCE_BOUNDARY_SETTINGS, getActiveSentenceBounds } from "./highlight-sentence";

/** Zen state of one editor. Only the zen editor ever holds one. */
interface ZenEditor {
  /** Target position of the cursor line, as a fraction of the pane height. */
  offset: number;
  /** Pane height in px. 0 until measured, and while the editor is hidden (Reading view). */
  height: number;
  /** Set by a manual scroll, cleared by the next edit. */
  paused: boolean;
}

/** Turns zen on in an editor with a typewriter offset (0..1), or off with null. */
export const setZen = StateEffect.define<{ offset: number } | null>();
const measured = StateEffect.define<number>();
const pause = StateEffect.define<null>();

const zenField = StateField.define<ZenEditor | null>({
  create: () => null,
  update(zen, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setZen))
        zen = effect.value && {
          offset: effect.value.offset,
          height: zen?.height ?? 0,
          paused: false,
        };
      else if (zen && effect.is(measured)) zen = { ...zen, height: effect.value };
      else if (zen && effect.is(pause)) zen = { ...zen, paused: true };
    }
    return zen?.paused && tr.docChanged ? { ...zen, paused: false } : zen;
  },
});

export function zenOffset(state: EditorState): number | null {
  return state.field(zenField, false)?.offset ?? null;
}

/** Room above and below the text so the first and last lines can reach the target position. */
export function typewriterPadding(height: number, offset: number): { top: number; bottom: number } {
  return { top: height * offset, bottom: height * (1 - offset) };
}

function recentre(head: number, zen: ZenEditor) {
  return EditorView.scrollIntoView(head, {
    y: "start",
    yMargin: typewriterPadding(zen.height, zen.offset).top,
  });
}

const RECENTRE_EVENTS = ["input", "delete", "undo", "redo", "select"];

// The scroll rides in the same transaction as the edit; a scroll in a later frame would jitter.
const typewriterScroll = EditorState.transactionExtender.of((tr) => {
  const zen = tr.startState.field(zenField, false);
  if (!zen || zen.height === 0 || (zen.paused && !tr.docChanged)) return null;
  if (!RECENTRE_EVENTS.some((event) => tr.isUserEvent(event))) return null;
  // CodeMirror tags input as "compose" exactly while `view.composing` holds.
  if (tr.isUserEvent("select.pointer") || tr.isUserEvent("input.type.compose")) return null;
  return { effects: recentre(tr.newSelection.main.head, zen) };
});

const typewriterPaddingAttrs = EditorView.contentAttributes.compute(
  [zenField],
  (state): Record<string, string> => {
    const zen = state.field(zenField);
    if (!zen || zen.height === 0) return {};
    const { top, bottom } = typewriterPadding(zen.height, zen.offset);
    return { style: `padding-top: ${top}px; padding-bottom: ${bottom}px` };
  },
);

function activeSentence(doc: Text, pos: number): { from: number; to: number } {
  const line = doc.lineAt(pos);
  let bounds = getActiveSentenceBounds(DEFAULT_SENTENCE_BOUNDARY_SETTINGS, line, pos);
  // Right after a sentence's final delimiter, that sentence is still the active one.
  if (bounds.end === null && pos > line.from) {
    bounds = getActiveSentenceBounds(DEFAULT_SENTENCE_BOUNDARY_SETTINGS, line, pos - 1);
  }
  return { from: bounds.start, to: bounds.end ?? line.to };
}

const dimMark = Decoration.mark({ class: "platen-dim" });

function dimDecorations(view: EditorView): DecorationSet {
  const { state } = view;
  if (!state.field(zenField, false) || state.selection.ranges.some((range) => !range.empty))
    return Decoration.none;
  const lit = activeSentence(state.doc, state.selection.main.head);
  const marks: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    const beforeEnd = Math.min(lit.from, to);
    if (beforeEnd > from) marks.push(dimMark.range(from, beforeEnd));
    const afterStart = Math.max(lit.to, from);
    if (to > afterStart) marks.push(dimMark.range(afterStart, to));
  }
  return Decoration.set(marks, true);
}

class ZenView implements PluginValue {
  decorations: DecorationSet;

  constructor(private readonly view: EditorView) {
    this.decorations = dimDecorations(view);
    view.scrollDOM.addEventListener("wheel", this.onManualScroll, { passive: true });
    view.scrollDOM.addEventListener("pointerdown", this.onPointerDown);
    view.scrollDOM.addEventListener("scroll", this.onScroll, { passive: true });
    view.contentDOM.addEventListener("compositionend", this.onCompositionEnd);
  }

  update(update: ViewUpdate): void {
    const zen = update.state.field(zenField, false);
    const was = update.startState.field(zenField, false);
    if (!zen && !was) return;
    if (zen !== was || update.docChanged || update.selectionSet || update.viewportChanged) {
      this.decorations = dimDecorations(update.view);
    }
    if (zen && (!was || update.geometryChanged)) this.measure();
  }

  destroy(): void {
    this.view.scrollDOM.removeEventListener("wheel", this.onManualScroll);
    this.view.scrollDOM.removeEventListener("pointerdown", this.onPointerDown);
    this.view.scrollDOM.removeEventListener("scroll", this.onScroll);
    this.view.contentDOM.removeEventListener("compositionend", this.onCompositionEnd);
  }

  private measure(): void {
    this.view.requestMeasure({
      key: this,
      read: (view) => view.scrollDOM.clientHeight,
      // State cannot change inside a measure cycle, so the new height is dispatched after it.
      write: (height, view) => {
        if (view.state.field(zenField, false)?.height !== height)
          window.setTimeout(() => this.storeHeight(height), 0);
      },
    });
  }

  /** A new pane height (entering, resizing, fullscreen) also puts the cursor line back in place. */
  private storeHeight(height: number): void {
    const zen = this.view.state.field(zenField, false);
    if (!zen || zen.height === height) return;
    const next = { ...zen, height };
    const effects: StateEffect<unknown>[] = [measured.of(height)];
    if (height > 0 && !zen.paused)
      effects.push(recentre(this.view.state.selection.main.head, next));
    this.view.dispatch({ effects });
  }

  private readonly onManualScroll = (): void => {
    const zen = this.view.state.field(zenField, false);
    if (zen && !zen.paused) this.view.dispatch({ effects: pause.of(null) });
  };

  /** Pointer held on the scroller itself (scrollbar or margin), not on the text. */
  private grabbed = false;

  // Only a scroll while grabbed counts: a plain click in the margin is not a manual scroll.
  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.target !== this.view.scrollDOM) return;
    this.grabbed = true;
    this.view.dom.ownerDocument.addEventListener("pointerup", () => (this.grabbed = false), {
      once: true,
    });
  };

  private readonly onScroll = (): void => {
    if (this.grabbed) this.onManualScroll();
  };

  // Composed text skips the typewriter while composing, so it catches up once composition ends.
  private readonly onCompositionEnd = (): void => {
    window.setTimeout(() => {
      const zen = this.view.state.field(zenField, false);
      if (zen && zen.height > 0 && !zen.paused) {
        this.view.dispatch({ effects: recentre(this.view.state.selection.main.head, zen) });
      }
    }, 0);
  };
}

/**
 * Registered once for every editor and inert until `setZen` reaches one.
 * `onEditorCreated` runs whenever an editor gets a fresh state (for example a new file in the
 * same leaf), so the owner can put zen back on its editor.
 */
export function zenExtension(onEditorCreated: () => void) {
  return [
    zenField,
    typewriterScroll,
    typewriterPaddingAttrs,
    ViewPlugin.define(
      (view) => {
        onEditorCreated();
        return new ZenView(view);
      },
      { decorations: (plugin) => plugin.decorations },
    ),
  ];
}
