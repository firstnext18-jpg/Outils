import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Variables volontairement ignorées : préfixe « _ » ou propriétés retirées d'un objet.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Code généré ou copié d'une bibliothèque
    "src/generated/**",
    "src/components/ui/**",
    "playwright-report/**",
    // Applications de bureau et Android : projets à part (voir docs/APPLICATION_BUREAU.md)
    "desktop/**",
    "android/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
