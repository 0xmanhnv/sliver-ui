import js from "@eslint/js";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist/**", "build/**", "node_modules/**", "tailwind.config.js", "vite.config.ts"] },

  js.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // TypeScript recommended
      ...tsPlugin.configs.recommended.rules,

      // React hooks recommended
      ...reactHooks.configs.recommended.rules,

      // Vite React Refresh rule
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // React 17+ JSX transform — no need to import React for JSX
      "no-undef": "off",

      // TypeScript handles unused vars better than base ESLint
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],

      // Allow empty interfaces extending other interfaces (common in UI libs)
      "@typescript-eslint/no-empty-object-type": "off",

      // Relax no-explicit-any to warning
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
