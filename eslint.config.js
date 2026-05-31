import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  { ignores: ["dist/", "node_modules/"] },
  {
    files: ["src/**/*.{js,jsx}"],
    ...js.configs.recommended,
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // setState-in-effect is a refactoring concern, not a correctness bug — warn only.
      "react-hooks/set-state-in-effect": "warn",
      "no-console": "off",
    },
  },
];
