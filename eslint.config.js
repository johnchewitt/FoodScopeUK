import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/** Imports banned by CLAUDE.md / ADR-02. */
const bannedImports = {
  patterns: [
    {
      group: ["@arcgis/map-components-react", "@arcgis/map-components-react/*"],
      message: "Not used in React 19 (ADR-02). Use the custom elements directly.",
    },
    {
      group: ["@arcgis/core/widgets/*"],
      message: "Widgets are deprecated in SDK 5.0 (ADR-02). Use map components or bespoke React controls.",
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dist-basemap",
      "coverage",
      "playwright-report",
      "test-results",
      "pipeline",
      "src/types/generated",
      "public",
      "node_modules",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-restricted-imports": ["error", bannedImports],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["src/analysis/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["react", "react-dom", "@arcgis/*", "@esri/*"],
              message: "src/analysis must stay pure (CLAUDE.md).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["scripts/**/*.mjs", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
);
