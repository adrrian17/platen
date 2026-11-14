// The exact rule set of Obsidian's community plugin review, including the rules that need type
// information and so cannot run in `vp check`. Run with `pnpm lint:obsidian` before a release.
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
  globalIgnores(["main.js", "eslint.config.mjs", "vite.config.ts"]),
  ...obsidianmd.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Asks for the declarative settings API from Obsidian 1.13; minAppVersion is 1.5.0.
      "obsidianmd/settings-tab/prefer-setting-definitions": "off",
    },
  },
]);
