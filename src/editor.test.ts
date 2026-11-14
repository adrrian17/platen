import { describe, expect, test } from "vite-plus/test";
import { typewriterPadding } from "./editor";

describe("typewriterPadding", () => {
  test.each([
    [0.33, 264, 536],
    [0.5, 400, 400],
    [0.7, 560, 240],
  ])("offset %f on an 800px pane gives top %f and bottom %f", (offset, top, bottom) => {
    const padding = typewriterPadding(800, offset);
    expect(padding.top).toBeCloseTo(top);
    expect(padding.bottom).toBeCloseTo(bottom);
    expect(padding.top + padding.bottom).toBeCloseTo(800);
  });
});
