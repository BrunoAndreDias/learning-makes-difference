#!/usr/bin/env node

import { spawn } from "node:child_process";

const defaultTimeoutMs = 120_000;
const timeoutMs = Number.parseInt(
  process.env.VITEST_RUN_TIMEOUT_MS ?? String(defaultTimeoutMs),
  10,
);
const vitestArgs = process.argv.slice(2).filter((arg) => arg !== "--");
const child = spawn("pnpm", ["exec", "vitest", ...vitestArgs], {
  detached: process.platform !== "win32",
  stdio: "inherit",
});

let timedOut = false;

function killVitest(signal) {
  if (child.pid === undefined) {
    return;
  }

  try {
    if (process.platform === "win32") {
      child.kill(signal);
      return;
    }

    process.kill(-child.pid, signal);
  } catch {
    // The process may already have exited.
  }
}

const timeout = setTimeout(() => {
  timedOut = true;
  console.error(
    `Vitest exceeded ${timeoutMs}ms. Killing the Vitest process group.`,
  );
  killVitest("SIGTERM");

  setTimeout(() => {
    killVitest("SIGKILL");
  }, 5000).unref();
}, timeoutMs);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    killVitest(signal);
  });
}

child.on("exit", (code, signal) => {
  clearTimeout(timeout);

  if (timedOut) {
    process.exit(124);
  }

  if (signal !== null) {
    process.exit(1);
  }

  process.exit(code ?? 1);
});
