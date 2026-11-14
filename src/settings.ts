import { type App, PluginSettingTab, Setting } from "obsidian";
import type PlatenPlugin from "./main";

export interface PlatenSettings {
  /** Cursor line position, as a percentage of the pane height. */
  typewriterPosition: number;
  dimOpacity: number;
  fullscreen: boolean;
  /** In `ch`; 0 turns the limit off. */
  maxLineWidth: number;
}

export const DEFAULT_SETTINGS: PlatenSettings = {
  typewriterPosition: 50,
  dimOpacity: 0.25,
  fullscreen: true,
  maxLineWidth: 65,
};

function numberIn(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

export function parseSettings(data: unknown): PlatenSettings {
  const raw = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  return {
    typewriterPosition: numberIn(
      raw.typewriterPosition,
      10,
      90,
      DEFAULT_SETTINGS.typewriterPosition,
    ),
    dimOpacity: numberIn(raw.dimOpacity, 0.05, 1, DEFAULT_SETTINGS.dimOpacity),
    fullscreen: typeof raw.fullscreen === "boolean" ? raw.fullscreen : DEFAULT_SETTINGS.fullscreen,
    maxLineWidth: Math.round(numberIn(raw.maxLineWidth, 0, 200, DEFAULT_SETTINGS.maxLineWidth)),
  };
}

export class PlatenSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: PlatenPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.plugin.settings;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Typewriter position")
      .setDesc("Where the cursor line stays, as a percentage of the pane height.")
      .addSlider((slider) =>
        slider
          .setLimits(10, 90, 1)
          .setValue(settings.typewriterPosition)
          .onChange((value) => this.plugin.updateSettings({ typewriterPosition: value })),
      );

    new Setting(containerEl)
      .setName("Dimmed text opacity")
      .setDesc("Opacity of everything except the sentence under the cursor.")
      .addSlider((slider) =>
        slider
          .setLimits(0.05, 1, 0.05)
          .setValue(settings.dimOpacity)
          .onChange((value) => this.plugin.updateSettings({ dimOpacity: value })),
      );

    new Setting(containerEl)
      .setName("Fullscreen on enter")
      .setDesc("Put the window in native fullscreen while zen is on.")
      .addToggle((toggle) =>
        toggle
          .setValue(settings.fullscreen)
          .onChange((value) => this.plugin.updateSettings({ fullscreen: value })),
      );

    new Setting(containerEl)
      .setName("Max line width")
      .setDesc("In characters (ch). 0 turns the limit off.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.maxLineWidth))
          .setValue(String(settings.maxLineWidth))
          .onChange((value) => {
            const width = Number(value);
            if (value.trim() !== "" && Number.isFinite(width))
              void this.plugin.updateSettings({ maxLineWidth: width });
          });
      });
  }
}
