#!/usr/bin/env node

import { spawn } from "node:child_process";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal !== null) {
        reject(new Error(`${command} exited with signal ${signal}.`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}.`));
        return;
      }

      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForPostgres() {
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await run(
        "docker",
        [
          "compose",
          "exec",
          "-T",
          "postgres",
          "pg_isready",
          "-U",
          "postgres",
          "-d",
          "learning_makes_difference",
        ],
        { stdio: "ignore" },
      );
      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(500);
    }
  }
}

function startDevServer() {
  const child = spawn("varlock", ["run", "--", "vite", "dev"], {
    stdio: "inherit",
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      child.kill(signal);
    });
  }

  child.on("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal !== null) {
      process.exit(1);
      return;
    }

    process.exit(code ?? 1);
  });
}

try {
  console.log("Starting local PostgreSQL...");
  await run("docker", ["compose", "up", "-d", "postgres"]);

  console.log("Waiting for PostgreSQL to accept connections...");
  await waitForPostgres();

  console.log("Running database migrations...");
  await run(process.execPath, ["scripts/db-migrate.mjs"]);

  startDevServer();
} catch (error) {
  console.error("Unable to prepare the local development database.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
