import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["packages/**/*.test.{ts,tsx}", "apps/*/src/**/*.test.{ts,tsx}", "scripts/*.test.mjs"],
    restoreMocks: true,
  },
});
