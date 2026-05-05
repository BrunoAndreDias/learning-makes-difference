import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      "**/node_modules/**",
      ".sandcastle/worktrees/**",
      "e2e/**",
      "**/*.db.test.ts",
    ],
    maxWorkers: 2,
    reporters: ["default", "hanging-process"],
    teardownTimeout: 5000,
  },
});
