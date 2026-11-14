import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: { ignorePatterns: ["SPEC.md"] },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  // Obsidian loads a single CommonJS `main.js` from the plugin folder and provides these modules at runtime.
  pack: {
    entry: "src/main.ts",
    format: "cjs",
    outDir: ".",
    outExtensions: () => ({ js: ".js" }),
    clean: false,
    target: "es2021",
    minify: true,
    deps: {
      neverBundle: ["obsidian", "electron", /^@codemirror\//, /^@lezer\//],
    },
  },
});
