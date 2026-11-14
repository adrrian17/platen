import obsidianmd from "eslint-plugin-obsidianmd";
import { defineConfig } from "vite-plus";

// These need typescript-eslint type information, which oxlint does not give JS plugins.
// `pnpm lint:obsidian` runs them with ESLint instead.
const TYPED_OBSIDIAN_RULES = new Set([
  "obsidianmd/no-plugin-as-component",
  "obsidianmd/no-view-references-in-plugin",
  "obsidianmd/no-misused-promises",
  "obsidianmd/prefer-create-el",
  "obsidianmd/prefer-instanceof",
  "obsidianmd/no-unsupported-api",
  "obsidianmd/prefer-file-manager-trash-file",
]);

// The Obsidian team's recommended severities, the same checks their plugin review runs.
const obsidianRules = Object.fromEntries(
  [obsidianmd.configs.recommended]
    .flat()
    .flatMap((config) => Object.entries(config.rules ?? {}))
    .filter(([rule]) => rule.startsWith("obsidianmd/") && !TYPED_OBSIDIAN_RULES.has(rule))
    // A wrapper that rewords core rule messages; `no-console` below is the rule it wraps.
    .filter(([rule]) => rule !== "obsidianmd/rule-custom-message"),
);

export default defineConfig({
  fmt: { ignorePatterns: ["SPEC.md", "styles.css", "fonts/"] },
  lint: {
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "obsidianmd", specifier: "eslint-plugin-obsidianmd" },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-console": ["error", { allow: ["warn", "error", "debug"] }],
      ...obsidianRules,
      // Asks for the declarative settings API from Obsidian 1.13; minAppVersion is 1.5.0.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
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
