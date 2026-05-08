import { readdir } from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { migrateDatabase } from "./migrate";
import {
  closePostgresIntegrationDatabases,
  createPostgresIntegrationDatabase,
  type PostgresIntegrationDatabase,
} from "./postgres-integration-test-db";

const migrationsDir = path.resolve(process.cwd(), "drizzle", "migrations");

async function readExpectedMigrationHistory() {
  return (await readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort()
    .map((name) => ({ name }));
}

describe("migrateDatabase PostgreSQL integration", () => {
  const databases = new Set<PostgresIntegrationDatabase>();

  afterEach(async () => {
    await closePostgresIntegrationDatabases(databases);
  });

  it("migrates a clean PostgreSQL database repeatedly without duplicating migration history", async () => {
    const database = await createPostgresIntegrationDatabase();
    databases.add(database);

    await migrateDatabase(null, database.client);
    await migrateDatabase(null, database.client);

    const migrations = await database.client.unsafe<Array<{ name: string }>>(
      "select name from __drizzle_migrations order by name;",
    );

    expect(migrations).toEqual(await readExpectedMigrationHistory());

    const tables = await database.client.unsafe<Array<{ table_name: string }>>(`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          '__drizzle_migrations',
          'auth_sessions',
          'focus_records',
          'focus_sessions',
          'label_edges',
          'labels',
          'note_acronyms',
          'note_labels',
          'note_metaphors',
          'notes',
          'recall_sessions',
          'session_results',
          'users'
        )
      order by table_name;
    `);

    expect(tables.map((table) => table.table_name)).toEqual([
      "__drizzle_migrations",
      "auth_sessions",
      "focus_records",
      "focus_sessions",
      "label_edges",
      "labels",
      "note_acronyms",
      "note_labels",
      "note_metaphors",
      "notes",
      "recall_sessions",
      "session_results",
      "users",
    ]);
  });
});
