import { randomUUID } from "node:crypto";

import postgres from "postgres";

const DEFAULT_DATABASE_URL =
  "postgres://postgres:postgres@127.0.0.1:55432/learning_makes_difference";

export type PostgresIntegrationDatabase = {
  client: postgres.Sql;
  close: () => Promise<void>;
  databaseName: string;
  databaseUrl: string;
};

function resolveBaseDatabaseUrl() {
  return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

function buildMaintenanceDatabaseUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

function buildTestDatabaseName(baseDatabaseUrl: string) {
  const baseName =
    new URL(baseDatabaseUrl).pathname.replace(/^\//u, "") || "lmd";
  const suffix = `${Date.now()}_${randomUUID().slice(0, 8)}`.replaceAll(
    "-",
    "",
  );

  return `${baseName}_itest_${suffix}`.slice(0, 63);
}

function buildTestDatabaseUrl(baseDatabaseUrl: string, databaseName: string) {
  const url = new URL(baseDatabaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

export async function createPostgresIntegrationDatabase(): Promise<PostgresIntegrationDatabase> {
  const baseDatabaseUrl = resolveBaseDatabaseUrl();
  const databaseName = buildTestDatabaseName(baseDatabaseUrl);
  const databaseUrl = buildTestDatabaseUrl(baseDatabaseUrl, databaseName);
  const maintenanceClient = postgres(
    buildMaintenanceDatabaseUrl(baseDatabaseUrl),
    {
      max: 1,
      prepare: false,
    },
  );

  try {
    await maintenanceClient.unsafe(
      `create database ${quoteIdentifier(databaseName)};`,
    );
  } catch (error) {
    await maintenanceClient.end();
    throw error;
  }

  const client = postgres(databaseUrl, {
    max: 1,
    prepare: false,
  });

  return {
    client,
    databaseName,
    databaseUrl,
    async close() {
      await client.end();
      await maintenanceClient.unsafe(`
        select pg_terminate_backend(pid)
        from pg_stat_activity
        where datname = ${quoteLiteral(databaseName)}
          and pid <> pg_backend_pid();
      `);
      await maintenanceClient.unsafe(
        `drop database if exists ${quoteIdentifier(databaseName)};`,
      );
      await maintenanceClient.end();
    },
  };
}
