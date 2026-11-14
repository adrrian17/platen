import type { EditorView } from "@codemirror/view";
import { MarkdownView, Notice, Plugin, Scope, type WorkspaceLeaf } from "obsidian";
import { setZen, zenExtension, zenOffset } from "./editor";
import { DEFAULT_SETTINGS, parseSettings, type PlatenSettings, PlatenSettingTab } from "./settings";

/** Obsidian's handle on its Electron window. Undocumented, so every use is guarded. */
interface ElectronWindow {
  isFullScreen(): boolean;
  setFullScreen(flag: boolean): void;
}

interface ZenSession {
  leaf: WorkspaceLeaf;
  /** The `.workspace-leaf` element; it outlives view swaps inside the leaf. */
  leafEl: HTMLElement;
  scope: Scope;
  /** The note was in Reading view before zen switched it to Live Preview. */
  restoreReading: boolean;
  /** Set only when the plugin itself put the window in fullscreen. */
  ownedFullscreen: ElectronWindow | null;
}

interface VimState {
  insertMode?: boolean;
  visualMode?: boolean;
  inputState?: { operator?: string | null; keyBuffer?: unknown[] };
}

const OVERLAYS = ".modal-container, .menu, .suggestion-container, .prompt, .popover";
/** Escape pressed inside one of these belongs to it, visible overlay or not. */
const ESCAPE_OWNERS = `${OVERLAYS}, .document-search-container`;

function electronWindow(win: Window | null): ElectronWindow | null {
  const handle = (win as { electronWindow?: Partial<ElectronWindow> } | null)?.electronWindow;
  return typeof handle?.isFullScreen === "function" && typeof handle.setFullScreen === "function"
    ? (handle as ElectronWindow)
    : null;
}

function editorView(leaf: WorkspaceLeaf): EditorView | null {
  return leaf.view instanceof MarkdownView
    ? ((leaf.view.editor as { cm?: EditorView }).cm ?? null)
    : null;
}

function ownsEscape(target: EventTarget): boolean {
  return (
    (target as Node).nodeType === Node.ELEMENT_NODE && (target as Element).matches(ESCAPE_OWNERS)
  );
}

/** Escape belongs to Vim first: insert, visual, a pending command or the `:` and `/` prompts. */
function vimWantsEscape(cm: EditorView, event: KeyboardEvent): boolean {
  const vim = (cm as unknown as { cm?: { state?: { vim?: VimState } } }).cm?.state?.vim;
  if (!vim) return false;
  const target = event.target as Node | null;
  const inPrompt = !!target && cm.dom.contains(target) && !cm.contentDOM.contains(target);
  const pending = !!vim.inputState?.operator || (vim.inputState?.keyBuffer?.length ?? 0) > 0;
  return !!vim.insertMode || !!vim.visualMode || inPrompt || pending;
}

export default class PlatenPlugin extends Plugin {
  settings: PlatenSettings = DEFAULT_SETTINGS;
  private session: ZenSession | null = null;

  async onload(): Promise<void> {
    this.settings = parseSettings(await this.loadData());
    this.registerEditorExtension(zenExtension(() => window.setTimeout(() => this.syncEditor(), 0)));
    this.addCommand({ id: "toggle-zen", name: "Toggle zen", callback: () => this.toggle() });
    this.addRibbonIcon("focus", "Toggle zen", () => this.toggle());
    this.addSettingTab(new PlatenSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        if (leaf && this.session && leaf !== this.session.leaf) this.exit();
      }),
    );
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        const session = this.session;
        if (!session) return;
        if (!session.leafEl.isConnected) this.exit();
        else this.syncEditor();
      }),
    );
  }

  onunload(): void {
    this.exit();
  }

  async updateSettings(patch: Partial<PlatenSettings>): Promise<void> {
    this.settings = parseSettings({ ...this.settings, ...patch });
    await this.saveData(this.settings);
    this.applyStyles();
    this.syncEditor();
  }

  private toggle(): void {
    if (this.session) this.exit();
    else void this.enter();
  }

  private async enter(): Promise<void> {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const leafEl = view?.containerEl.closest<HTMLElement>(".workspace-leaf");
    if (!view || !leafEl) {
      new Notice("Zen works only in a Markdown note.");
      return;
    }
    const { leaf } = view;
    const scope = new Scope(this.app.scope);
    scope.register([], "Escape", (event) => this.onEscape(event));
    this.app.keymap.pushScope(scope);
    leafEl.addClass("platen-zen-leaf");
    const session: ZenSession = {
      leaf,
      leafEl,
      scope,
      restoreReading: view.getMode() === "preview",
      ownedFullscreen: null,
    };
    this.session = session;
    this.applyStyles();

    const win = electronWindow(leafEl.ownerDocument.defaultView);
    if (this.settings.fullscreen && win) {
      try {
        if (!win.isFullScreen()) {
          win.setFullScreen(true);
          session.ownedFullscreen = win;
        }
      } catch {
        // The handle exists but refused the call; zen works without fullscreen.
      }
    }

    if (session.restoreReading) {
      const state = leaf.getViewState();
      await leaf.setViewState({
        ...state,
        state: { ...state.state, mode: "source", source: false },
      });
      if (this.session !== session) return;
    }
    this.syncEditor();
    view.editor.focus();
  }

  private exit(): void {
    const session = this.session;
    if (!session) return;
    this.session = null;
    const { leaf, leafEl, scope, restoreReading, ownedFullscreen } = session;

    this.app.keymap.popScope(scope);
    leafEl.removeClass("platen-zen-leaf", "platen-line-width");
    leafEl.setCssProps({ "--platen-dim-opacity": "", "--platen-line-width": "" });

    const cm = editorView(leaf);
    if (cm && zenOffset(cm.state) !== null) cm.dispatch({ effects: setZen.of(null) });

    try {
      ownedFullscreen?.setFullScreen(false);
    } catch {
      // Nothing to give back.
    }

    if (
      restoreReading &&
      leafEl.isConnected &&
      leaf.view instanceof MarkdownView &&
      leaf.view.getMode() === "source"
    ) {
      const state = leaf.getViewState();
      void leaf.setViewState({ ...state, state: { ...state.state, mode: "preview" } });
    }
  }

  /** Brings the zen editor's CodeMirror state in line with the session. Safe to call any time. */
  private syncEditor(): void {
    const session = this.session;
    const cm = session && editorView(session.leaf);
    if (!cm) return;
    const offset = this.settings.typewriterPosition / 100;
    if (zenOffset(cm.state) !== offset) cm.dispatch({ effects: setZen.of({ offset }) });
  }

  private applyStyles(): void {
    const session = this.session;
    if (!session) return;
    const { dimOpacity, maxLineWidth } = this.settings;
    session.leafEl.toggleClass("platen-line-width", maxLineWidth > 0);
    session.leafEl.setCssProps({
      "--platen-dim-opacity": String(dimOpacity),
      "--platen-line-width": `${maxLineWidth}ch`,
    });
  }

  /** Returning anything but `false` lets the key through to whatever else wants it. */
  private onEscape(event: KeyboardEvent): boolean {
    const session = this.session;
    if (!session || event.isComposing || event.defaultPrevented) return true;
    // A modal closed by this same Escape may already be gone from the DOM, but not from the event path.
    if (event.composedPath().some(ownsEscape)) return true;
    const overlays = session.leafEl.ownerDocument.querySelectorAll<HTMLElement>(OVERLAYS);
    if (Array.from(overlays).some((el) => el.getClientRects().length > 0)) return true;
    const cm = editorView(session.leaf);
    if (cm && vimWantsEscape(cm, event)) return true;
    this.exit();
    return false;
  }
}
