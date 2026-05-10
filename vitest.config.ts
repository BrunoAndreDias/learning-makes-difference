import { defineConfig } from "vitest/config";

const maxWorkers = process.env.VITEST_MAX_WORKERS ?? "80%";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      ".sandcastle/worktrees/**",
      "e2e/**",
      "**/*.db.test.ts",
    ],
    maxWorkers,
    reporters: ["default", "hanging-process"],
    teardownTimeout: 5000,
  },
});
