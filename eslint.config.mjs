import js from "@eslint/js";
import ts from "typescript-eslint";
import prettier from "eslint-plugin-prettier/recommended";

export default [
  {
    ignores: ["dist/**", "test/**", "**/*.d.ts"],
  },
  js.configs.recommended,
  ...ts.configs.strictTypeChecked,
  ...ts.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: "tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        {
          allowNumber: true,
        },
      ],
    },
  },
];
