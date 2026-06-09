import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: [
        "src/main.ts",   // entry point, not unit-testable in isolation
        "src/seed.ts",   // dev-only script
        "src/store/sqlite-store.ts",  // covered via integration but excluded from threshold
      ],
      thresholds: {
        statements: 90,
        branches: 75,
        functions: 80,
        lines: 90,
      },
    },
  },
});
