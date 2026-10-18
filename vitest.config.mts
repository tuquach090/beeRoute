import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Only the pure logic is unit-tested; components are checked in the browser.
    include: ["src/**/*.test.ts"],
  },
});
