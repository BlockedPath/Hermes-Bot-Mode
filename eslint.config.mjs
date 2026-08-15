import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "docs/**", "*.watch.mjs"],
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    rules: {
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          // `const { chat_pin, ...rest } = entry` is the omit-a-key idiom; the
          // named bindings are intentionally discarded, not dead code.
          ignoreRestSiblings: true,
        },
      ],
      "no-undef": "error",
      "no-console": "off",
    },
  },
  {
    // groups.mjs, lib/, and tests are Node, not browser.
    files: ["groups.mjs", "lib/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
