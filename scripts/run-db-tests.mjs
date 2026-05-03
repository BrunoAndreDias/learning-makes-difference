#!/usr/bin/env node

import { spawn } from "node:child_process";

import { resolveDatabaseUrl } from "./local-db-url.mjs";

const child = spawn(
  "node",
  [
    "scripts/run-vitest-with-timeout.mjs",
    "run",
    "--config",
    "vitest.db.config.ts",
  ],
  {
    env: {
      ...process.env,
      DATABASE_URL: resolveDatabaseUrl(),
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
