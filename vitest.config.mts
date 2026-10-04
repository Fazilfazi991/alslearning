import { configDefaults, defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "scripts/microbiology-import.test.mjs",
      ".local-qa/**",
    ],
  },
  resolve: { alias: {
    "@": fileURLToPath(new URL("./src", import.meta.url)),
    "server-only": fileURLToPath(new URL("./src/test/server-only.ts", import.meta.url)),
  } },
});
