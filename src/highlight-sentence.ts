// Copied from davisriedel/obsidian-typewriter-mode at 295b9e2
// (src/cm6/highlight-sentence.ts), itself adapted from
// https://github.com/artisticat1/focus-active-sentence.
// Trimmed to the boundary parser: the upstream decoration builder is not used.
//
// MIT License
//
// Copyright (c) 2023-2026 Davis Riedel
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import type { Line } from "@codemirror/state";
const CLOSING_BRACKETS = new Set([")", "]", "}"]);

function isIgnoredDelimiter(lineText: string, ignoredPatterns: string[], i: number) {
  return ignoredPatterns.some(
    (pattern) => lineText.slice(i + 1 - pattern.length, i + 1) === pattern,
  );
}

function isFollowedByClosingBracket(lineText: string, i: number) {
  return CLOSING_BRACKETS.has(lineText[i + 1]);
}

function isLetter(c: string | undefined): boolean {
  return !!c && ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z"));
}

// A delimiter preceded by a single letter (itself preceded by a non-letter)
// is an abbreviation like "e.g." or "i.e." — not a sentence boundary.
function isPrecededBySingleLetter(lineText: string, i: number) {
  return isLetter(lineText[i - 1]) && !isLetter(lineText[i - 2]);
}

function isRealSentenceBoundary(lineText: string, ignoredPatterns: string[], i: number) {
  if (isIgnoredDelimiter(lineText, ignoredPatterns, i)) {
    return false;
  }
  if (isFollowedByClosingBracket(lineText, i)) {
    return false;
  }
  if (isPrecededBySingleLetter(lineText, i)) {
    return false;
  }
  return true;
}

export interface SentenceBoundarySettings {
  extraCharacters: string;
  ignoredPatterns: string;
  sentenceDelimiters: string;
}

export const DEFAULT_SENTENCE_BOUNDARY_SETTINGS: SentenceBoundarySettings = {
  extraCharacters: "*”’」』】）》",
  ignoredPatterns: "Mr.",
  sentenceDelimiters: ".!?。！？…",
};

export function getActiveSentenceBounds(
  settings: SentenceBoundarySettings,
  line: Line,
  pos: number,
) {
  const sentenceDelimiters = new Set(settings.sentenceDelimiters);
  const extraCharacters = new Set(settings.extraCharacters);
  const ignoredPatterns = settings.ignoredPatterns.split("\n");

  const lineStart = line.from;
  const lineText = line.text;

  let start = -1;

  for (let i = pos - lineStart - 1; i >= 0; i--) {
    if (!sentenceDelimiters.has(lineText[i])) {
      continue;
    }
    if (!isRealSentenceBoundary(lineText, ignoredPatterns, i)) {
      continue;
    }

    let offset = 1;

    // Don't highlight spaces between sentences
    while (lineText[i + offset] === " " && offset < pos - lineStart - 1) {
      offset += 1;
    }

    // Account for markdown syntax at the end of sentences (*)
    while (extraCharacters.has(lineText[i + offset]) && offset < pos - lineStart - 1) {
      offset += 1;
    }

    start = i + offset;
    break;
  }

  if (start === -1) {
    start = 0;
  }

  let end = -1;

  for (let i = pos - lineStart; i < line.length; i++) {
    if (!sentenceDelimiters.has(lineText[i])) {
      continue;
    }
    if (!isRealSentenceBoundary(lineText, ignoredPatterns, i)) {
      continue;
    }

    let offset = 1;

    // Account for ellipses, "!?", etc.
    while (sentenceDelimiters.has(lineText[i + offset]) && offset < line.length) {
      offset += 1;
    }

    // Account for markdown syntax at the end of sentences (*)
    while (extraCharacters.has(lineText[i + offset]) && offset < line.length) {
      offset += 1;
    }

    end = i + offset;
    break;
  }

  if (end !== -1) {
    return { end: end + lineStart, start: start + lineStart };
  }
  return { end: null, start: start + lineStart };
}
