#!/usr/bin/env node

import { spawn } from "node:child_process";

const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@127.0.0.1:55432/learning_makes_difference";

const child = spawn(
  "node",
  ["scripts/run-vitest-with-timeout.mjs", "run", "--config", "vitest.db.config.ts"],
  {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    },
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal !== null) {
    process.exit(1);
  }

  process.exit(code ?? 1);
});
