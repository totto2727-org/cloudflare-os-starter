import { generateIgnorePatterns } from "@totto2727/gitignore-patterns";
import preset from "@totto2727/oxlint/typescript";
import { defineConfig } from "oxlint";

const ignorePatterns = await generateIgnorePatterns(new URL(".", import.meta.url));

export default defineConfig({
  env: {
    es2024: true,
  },
  extends: [preset],
  ignorePatterns: [
    // The submodule lints itself, with its own config, its own plugins (including the local
    // `gadgets/prefer-jsdoc` rule this file does not load) and its own per-directory overrides.
    // Linting it from here would report findings nobody in this repository can fix.
    "cloudflare-os/**",
    ...ignorePatterns,
    "**/dist/**",
    "**/generated/**",
    "**/*.gen.ts",
    "packages/custom-gatekeeper/worker-configuration.d.ts",
    "**/.wrangler/**",
  ],
  overrides: [
    {
      env: { es2024: true, serviceworker: true },
      files: ["packages/*/src/**/*.ts"],
      // These packages emit JavaScript with tsc.
      rules: { "rules/consistent-import-extension": ["error", { mode: "js" }] },
    },
    {
      env: { es2024: true, vitest: true },
      files: [
        "packages/*/**/*.test.ts",
        "packages/*/vitest.config.ts",
        "packages/*/__tests__/**/*.ts",
      ],
      // Vitest runs TypeScript from source.
      rules: { "rules/consistent-import-extension": ["error", { mode: "ts" }] },
    },
    {
      env: { es2024: true, node: true },
      files: ["scripts/**/*.ts"],
    },
  ],
});
