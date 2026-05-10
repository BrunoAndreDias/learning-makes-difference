import { defineConfig } from "vitest/config";

const maxWorkers =
  process.env.VITEST_DB_MAX_WORKERS ?? process.env.VITEST_MAX_WORKERS ?? "2";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.db.test.ts"],
    exclude: ["**/node_modules/**", ".sandcastle/worktrees/**"],
    maxWorkers,
    reporters: ["default", "hanging-process"],
    teardownTimeout: 5000,
  },
});
