// @ts-check
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.mjs",
      "apps/web/src/**"
    ]
  },
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module"
      }
    },
    plugins: {
      "@typescript-eslint": tseslint
    },
    rules: {
      // Catch real bugs
      "no-undef": "off", // TypeScript handles this
      "no-unused-vars": "off", // use TS version below
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",

      // Prevent common mistakes
      "eqeqeq": ["error", "always"],
      "no-console": "off",

      // Style (errors only for things that indicate bugs)
      "no-var": "error",
      "prefer-const": "error"
    }
  }
];
