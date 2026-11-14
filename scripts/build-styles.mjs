// Obsidian ships only main.js, manifest.json and styles.css, so the fonts travel inside styles.css.
import { readFile, writeFile } from "node:fs/promises";

const faces = [
  ["iAWriterQuattroS-Regular.woff2", "normal", 400],
  ["iAWriterQuattroS-Italic.woff2", "italic", 400],
  ["iAWriterQuattroS-Bold.woff2", "normal", 700],
  ["iAWriterQuattroS-BoldItalic.woff2", "italic", 700],
];

const license = (await readFile("fonts/LICENSE.md", "utf8")).trimEnd();
const rules = await Promise.all(
  faces.map(async ([file, style, weight]) => {
    const data = (await readFile(`fonts/${file}`)).toString("base64");
    return `@font-face { font-family: "Platen iA Writer Quattro"; src: url("data:font/woff2;base64,${data}") format("woff2"); font-style: ${style}; font-weight: ${weight}; font-display: swap; }`;
  }),
);
const styles = await readFile("src/styles.css", "utf8");
await writeFile("styles.css", `/*\n${license}\n*/\n\n${rules.join("\n")}\n\n${styles}`);
