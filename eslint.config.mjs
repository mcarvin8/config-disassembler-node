import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "index.js", "**/*.ts"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2021,
    },
  },
  eslintConfigPrettier,
];
