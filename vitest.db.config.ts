import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    exclude: ["**/node_modules/**", ".sandcastle/worktrees/**"],
    maxWorkers: 2,
    reporters: ["default", "hanging-process"],
    teardownTimeout: 5000,
  },
});
